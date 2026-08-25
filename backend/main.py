"""투자심의 웹 UI용 백엔드 프록시.

WRKS_API_KEY 를 서버에서만 보관하고, 프론트엔드는 이 프록시만 호출한다.
웍스AI가 실시간으로 보내는 SSE 이벤트(텍스트·사고 과정·도구 호출)를 버퍼링 없이
그대로 NDJSON으로 릴레이한다 — 프론트가 타이핑되는 것처럼 실시간 렌더링할 수 있게.
실행: uvicorn main:app --reload --port 8787
"""
import json
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


def friendly_error(e: Exception) -> str:
    """원본 예외/응답 바디는 서버 로그에만 남기고, 프론트에는 사람이 읽을 메시지만 보낸다."""
    print(f"[review-error] {e!r}")
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."


def _post_chat_stream(url: str, body: dict):
    """POST 하나의 SSE 파싱된 파트를 하나씩 yield. [DONE]에서 멈춘다."""
    resp = requests.post(
        url,
        headers={**HEADERS, "Content-Type": "application/json"},
        json=body,
        stream=True,
    )
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


def wrks_chat_events(url: str, message: str):
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
        first_message = "문서를 첨부할게" if has_files else message
        chat_id = None

        events = wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/stream", first_message)
        if has_files:
            for evt in events:  # 자리표시자 응답 본문은 프론트에 보여주지 않고 버린다
                if evt["type"] == "meta":
                    chat_id = evt["chatId"]
                    yield ndjson(evt)
                    break
        else:
            yield ndjson({"type": "turn-start"})
            for evt in events:
                if evt["type"] == "meta":
                    chat_id = evt["chatId"]
                yield ndjson(evt)
            yield ndjson({"type": "turn-end"})

        if not chat_id:
            yield ndjson({"type": "error", "message": "웍스AI가 chatId를 반환하지 않았습니다."})
            return

        for filename, content, content_type in files:
            r = requests.post(
                f"{WRKS_BASE_URL}/v2/files",
                headers=HEADERS,
                params={"chatId": chat_id},
                files={"file": (filename, content, content_type)},
            )
            r.raise_for_status()
            data = r.json()["data"]
            yield ndjson({"type": "file-uploaded", "file": data})

        if has_files:
            yield ndjson({"type": "turn-start"})
            for evt in wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/stream/{chat_id}", message):
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
