"""투자심의 웹 UI용 백엔드 프록시.

WRKS_API_KEY 를 서버에서만 보관하고, 프론트엔드는 이 프록시만 호출한다.
웍스AI가 실시간으로 보내는 SSE 이벤트(텍스트·사고 과정·도구 호출)를 버퍼링 없이
그대로 NDJSON으로 릴레이한다 — 프론트가 타이핑되는 것처럼 실시간 렌더링할 수 있게.
실행: uvicorn main:app --reload --port 8787
"""
import io
import json
import logging
import os

import requests
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

WRKS_BASE_URL = "https://gateway-api.wrks.ai"
AGENT_ID = os.environ.get("INVESTMENT_AGENT_ID", "22231")
MAX_AUTO_APPROVALS = 5  # ponytail: 무한 루프 방지용 상한. 더 긴 조사가 필요하면 올리기


def load_api_key() -> str:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        for line in open(env_path, encoding="utf-8"):
            if line.startswith("WRKS_API_KEY="):
                os.environ.setdefault("WRKS_API_KEY", line.split("=", 1)[1].strip())
    key = os.environ.get("WRKS_API_KEY", "")
    if not key:
        raise RuntimeError(".env 에 WRKS_API_KEY 를 설정하세요 (.env.example 참고)")
    return key


API_KEY = load_api_key()
HEADERS = {"API-KEY": API_KEY}

app = FastAPI(title="투자심의 에이전트 프록시")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def ndjson(obj) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


logger = logging.getLogger("investment-proxy")


def friendly_error(e: Exception) -> str:
    """원본 예외/응답 바디는 서버 로그에만 남기고, 프론트에는 사람이 읽을 메시지만 보낸다."""
    # print는 uvicorn 아래서 버퍼링돼 진단이 유실된다 — 로거를 써야 바로 남는다
    logger.exception("심의 요청 처리 실패: %r", e)
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."


class UploadRejected(Exception):
    """사용자에게 그대로 보여줘도 되는 업로드 실패(형식·크기 등)."""


XLSX_EXTENSIONS = (".xlsx", ".xlsm")
XLSX_MAX_ROWS = 2000  # ponytail: 시트당 상한. 더 큰 재무모델을 통째로 넣어야 하면 올리기
UPLOAD_REJECTIONS = {
    413: "파일이 100MB를 넘습니다",
    415: "지원하지 않는 파일 형식입니다 (pdf·docx·doc·pptx·hwp·hwpx·txt·md·png·jpg)",
}


def xlsx_to_markdown(filename: str, content: bytes) -> tuple[str, bytes, str]:
    """엑셀을 시트별 마크다운 표로 바꿔 .md 로 올린다.

    웍스 v2 파일 업로드는 엑셀을 415로 거절하는데(실측), 투자심의에서 재무모델은
    엑셀로 오는 게 보통이라 텍스트로 변환해 넣는다. data_only=True 는 수식이 아니라
    '엑셀이 마지막으로 저장한 계산값'을 읽는다 — 심의에는 값이 필요하기 때문.
    엑셀로 한 번도 연 적 없이 생성된 파일은 캐시된 값이 없어 빈 칸이 될 수 있다.
    """
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    lines = []
    try:
        for ws in wb.worksheets:
            lines.append(f"## 시트: {ws.title}")
            need_header_rule = True
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i >= XLSX_MAX_ROWS:
                    lines.append(f"_({XLSX_MAX_ROWS}행 초과분은 생략됨)_")
                    break
                cells = ["" if c is None else str(c).replace("|", "\\|") for c in row]
                if not any(c.strip() for c in cells):
                    continue
                lines.append("| " + " | ".join(cells) + " |")
                if need_header_rule:  # 마크다운 표는 구분선이 있어야 표로 읽힌다
                    lines.append("|" + "---|" * len(cells))
                    need_header_rule = False
            lines.append("")
    finally:
        wb.close()

    return filename.rsplit(".", 1)[0] + ".md", "\n".join(lines).encode("utf-8"), "text/markdown"


def upload_one(chat_id: str, filename: str, content: bytes, content_type: str) -> dict:
    """파일 하나를 웍스에 올리고 data를 반환. 거절되면 조치 가능한 문구로 바꿔 올린다."""
    original = filename
    if filename.lower().endswith(XLSX_EXTENSIONS):
        try:
            filename, content, content_type = xlsx_to_markdown(filename, content)
        except Exception:
            logger.warning("엑셀 변환 실패: %s", original, exc_info=True)
            raise UploadRejected(f"{original}: 엑셀을 읽지 못했습니다")
        # 표 한 줄도 안 나왔다면 빈 파일을 올려 심의에서 조용히 누락되게 두지 않는다
        if b"|" not in content:
            raise UploadRejected(f"{original}: 엑셀에서 읽을 데이터가 없습니다 (빈 시트이거나 계산값 미저장)")

    r = requests.post(
        f"{WRKS_BASE_URL}/v2/files",
        headers=HEADERS,
        params={"chatId": chat_id},
        files={"file": (filename, content, content_type)},
    )
    if r.status_code >= 400:
        logger.warning("업로드 거절: %s %s %s", original, r.status_code, r.text[:300])
        reason = UPLOAD_REJECTIONS.get(r.status_code, f"업로드에 실패했습니다 ({r.status_code})")
        raise UploadRejected(f"{original}: {reason}")

    data = r.json().get("data")
    if not data:  # 2xx인데 data가 없는 응답도 실측된다 — 통짜 에러로 새지 않게 여기서 잡는다
        logger.warning("업로드 응답에 data 없음: %s %s", original, r.text[:300])
        raise UploadRejected(f"{original}: 업로드에 실패했습니다")
    return data


def _post_chat_stream(url: str, body: dict):
    """POST 하나의 SSE 파싱된 파트를 하나씩 yield. [DONE]에서 멈춘다."""
    resp = requests.post(
        url,
        headers={**HEADERS, "Content-Type": "application/json"},
        json=body,
        stream=True,
    )
    try:
        resp.raise_for_status()
        for raw in resp.iter_lines():
            if not raw or not raw.startswith(b"data: "):
                continue
            payload = raw[6:]
            if payload == b"[DONE]":
                return
            try:
                yield json.loads(payload.decode("utf-8"))
            except ValueError:
                continue
    finally:
        # 호출자가 chatId만 받고 중도 이탈(close)해도 커넥션을 반납한다
        resp.close()


def wrks_chat_events(url: str, message: str, image_file_ids: list[int] | None = None):
    """SSE 파트를 하나씩 그대로 yield (버퍼링 없음).

    실측 결과 실제 엔드포인트는 POST /v2/chat/stream(신규) ·
    POST /v2/chat/stream/{chatId}(이어가기)이며 — 문서(agent-api-v2)에
    적힌 POST /v2/chat, /v2/chat/{chatId}는 현재 404로 죽어있다(2026-08-25
    실측, 문서가 구버전으로 보임). 스트림 첫 파트로 {"type":"chat-id",...}가
    오는데 프론트는 이 타입을 모르므로 프론트가 쓰는 meta로 변환해 보낸다.
    reasoning(사고 과정)·tool-input-*/tool-output-* (MCP 도구 호출) 파트도
    함께 오며, 그 외 알 수 없는 타입은 그대로 흘려보낸다.

    승인(HITL): 도구 호출이 몰리면 서버가 승인 체크포인트를 보낸다. 실측 결과
    두 가지 모양이 섞여서 온다 — 문서에 있는 data-approval({"data":{"id":...}})과
    문서에 없는 tool-approval-request({"approvalId":...}). 둘 다 답하지 않아도
    당장 멈추진 않지만, 결국 finishReason이 "tool-calls"(텍스트 답변 없이
    미완료)로 끝나버린다 — 이 앱은 사람이 매번 승인할 이유가 없는 내부 배치
    분석 도구이므로, 턴이 tool-calls로 끝나면 마지막 승인 id에 approved:true를
    보내 자동으로 이어간다(무한 루프 방지로 최대 MAX_AUTO_APPROVALS회).
    """
    chat_id = None
    body = {"message": message, "agentId": AGENT_ID}
    if image_file_ids:
        # 이미지는 업로드해도 대화에 묶이지 않는다 — 여기 실어 보내야 모델이 본다
        body["imageFileIds"] = image_file_ids
    for attempt in range(MAX_AUTO_APPROVALS + 1):
        pending_approval_id = None
        finish_reason = None
        for evt in _post_chat_stream(url, body):
            t = evt.get("type")
            if t == "chat-id":
                chat_id = evt.get("chatId")
                yield {"type": "meta", "chatId": chat_id}
                continue
            if t == "data-approval":
                pending_approval_id = evt.get("data", {}).get("id")
                continue
            if t == "tool-approval-request":
                pending_approval_id = evt.get("approvalId")
                continue
            if t == "error":
                # 웍스 자체 에러 파트는 errorText/code를 쓰는데 프론트는 message만 읽으므로 맞춰준다.
                yield {"type": "error", "message": evt.get("errorText") or evt.get("message") or json.dumps(evt, ensure_ascii=False)}
                continue
            if t == "finish":
                finish_reason = evt.get("finishReason")
            yield evt

        if finish_reason != "tool-calls" or not pending_approval_id:
            return
        if attempt == MAX_AUTO_APPROVALS:
            yield {"type": "error", "message": f"도구 호출이 {MAX_AUTO_APPROVALS}회 자동 승인 후에도 끝나지 않아 중단했습니다."}
            return
        url = f"{WRKS_BASE_URL}/v2/chat/stream/{chat_id}"
        body = {"agentId": AGENT_ID, "approval": {"id": pending_approval_id, "approved": True}}


def stream_new_review(message: str, files: list[tuple[str, bytes, str]]):
    """대화 생성 → (파일이 있으면) 업로드 → 사용자 메시지 순으로 진행한다.

    웍스 v2 API는 파일 업로드에 chatId가 필요하고, chatId는 첫 메시지를 보내야만
    발급된다. 파일이 있을 때 사용자의 실제 메시지를 그 첫 메시지로 써버리면
    에이전트가 파일 없이 먼저 답해버리므로, 그때는 자리표시자로 chatId만 받고
    파일을 업로드한 뒤에 실제 메시지를 보낸다.
    """
    try:
        has_files = bool(files)
        first_message = "자료를 첨부할게" if has_files else message
        chat_id = None

        events = wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/stream", first_message)
        if has_files:
            for evt in events:  # 자리표시자 답변 본문은 버리지만 에러까지 버리면 원인이 사라진다
                if evt["type"] == "error":
                    yield ndjson(evt)
                    continue
                if evt["type"] == "meta":
                    chat_id = evt["chatId"]
                    yield ndjson(evt)
                    break
            events.close()  # 남은 자리표시자 스트림은 안 읽고 끊는다
        else:
            yield ndjson({"type": "turn-start"})
            for evt in events:
                if evt["type"] == "meta":
                    chat_id = evt["chatId"]
                yield ndjson(evt)
            yield ndjson({"type": "turn-end"})

        if not chat_id:
            logger.warning("자리표시자 턴에서 chatId를 못 받음 (files=%d)", len(files))
            yield ndjson({"type": "error", "message": "대화를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."})
            return

        image_file_ids = []
        for filename, content, content_type in files:
            try:
                data = upload_one(chat_id, filename, content, content_type)
            except UploadRejected as e:
                # 한 파일이 거절돼도 나머지는 진행하되, 어떤 파일이 왜 빠졌는지는 알린다
                yield ndjson({"type": "file-error", "message": str(e)})
                continue
            if data.get("imageUrl"):  # 이미지 응답에만 있다 = 대화에 안 묶였다는 뜻
                image_file_ids.append(data["fileId"])
            yield ndjson({"type": "file-uploaded", "file": data})

        if has_files:
            yield ndjson({"type": "turn-start"})
            for evt in wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/stream/{chat_id}", message, image_file_ids):
                yield ndjson(evt)
            yield ndjson({"type": "turn-end"})
    except Exception as e:
        yield ndjson({"type": "error", "message": friendly_error(e)})


def stream_continue(chat_id: str, message: str):
    try:
        yield ndjson({"type": "turn-start"})
        for evt in wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/stream/{chat_id}", message):
            yield ndjson(evt)
        yield ndjson({"type": "turn-end"})
    except Exception as e:
        yield ndjson({"type": "error", "message": friendly_error(e)})


@app.post("/api/review")
async def start_review(message: str = Form(...), files: list[UploadFile] = File(default=[])):
    """새 심의 요청: 대화 생성 → 자료 업로드 → 검토 요청까지 실시간 스트림으로 릴레이.

    FastAPI는 핸들러가 반환되는 즉시 UploadFile을 닫으므로(스트리밍 제너레이터는
    그 이후에 실행됨) 여기서 bytes로 미리 읽어 넘긴다 — 안 그러면 read of closed file.
    """
    payloads = [(f.filename, await f.read(), f.content_type) for f in files if f.filename]
    return StreamingResponse(stream_new_review(message, payloads), media_type="application/x-ndjson")


@app.post("/api/review/{chat_id}/message")
async def continue_review(chat_id: str, message: str = Form(...)):
    """기존 심의 대화에 후속 메시지(예: "1번으로 진행해 줘") 전송, 실시간 스트림으로 릴레이."""
    return StreamingResponse(stream_continue(chat_id, message), media_type="application/x-ndjson")
