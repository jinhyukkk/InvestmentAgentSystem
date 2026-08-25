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


def wrks_chat_events(url: str, message: str):
    """isStream=true 응답의 SSE 파트를 하나씩 그대로 yield (버퍼링 없음).

    v2 API 문서는 텍스트 파트만 명시하지만, 실측 결과 reasoning(사고 과정)과
    tool-input-*/tool-output-* (MCP 도구 호출) 파트도 함께 온다. 알 수 없는
    타입은 그대로 흘려보낸다(API가 파트를 추가해도 프론트가 무시하면 그만이므로).
    """
    resp = requests.post(
        url,
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"message": message, "agentId": AGENT_ID, "isStream": True},
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


def stream_new_review(message: str, files: list[tuple[str, bytes, str]]):
    """대화 생성 → (파일이 있으면) 업로드 → 사용자 메시지 순으로 진행한다.

    웍스 v2 API는 파일 업로드에 chatId가 필요하고, chatId는 첫 메시지를 보내야만
    발급된다(문서 참고: docs/AI 대화 API/에이전트 대화 API v2.md 시나리오 C).
    파일이 있을 때 사용자의 실제 메시지를 그 첫 메시지로 써버리면 에이전트가
    파일 없이 먼저 답해버리므로, 그때는 자리표시자로 chatId만 받고 파일을
    업로드한 뒤에 실제 메시지를 보낸다.
    """
    try:
        has_files = bool(files)
        first_message = "문서를 첨부할게" if has_files else message

        resp = requests.post(
            f"{WRKS_BASE_URL}/v2/chat",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"message": first_message, "agentId": AGENT_ID, "isStream": True},
            stream=True,
        )
        resp.raise_for_status()
        chat_id = resp.headers.get("X-Chat-Id")
        if not chat_id:
            yield ndjson({"type": "error", "message": "웍스AI가 chatId를 반환하지 않았습니다."})
            return
        yield ndjson({"type": "meta", "chatId": chat_id})

        if has_files:
            resp.close()  # 자리표시자 응답은 프론트에 보여주지 않고 버린다
        else:
            yield ndjson({"type": "turn-start"})
            for raw in resp.iter_lines():
                if not raw or not raw.startswith(b"data: ") or raw == b"data: [DONE]":
                    continue
                try:
                    yield ndjson(json.loads(raw[6:].decode("utf-8")))
                except ValueError:
                    continue
            yield ndjson({"type": "turn-end"})

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
            for evt in wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/{chat_id}", message):
                yield ndjson(evt)
            yield ndjson({"type": "turn-end"})
    except requests.HTTPError as e:
        yield ndjson({"type": "error", "message": e.response.text})
    except Exception as e:
        yield ndjson({"type": "error", "message": f"{type(e).__name__}: {e}"})


def stream_continue(chat_id: str, message: str):
    try:
        yield ndjson({"type": "turn-start"})
        for evt in wrks_chat_events(f"{WRKS_BASE_URL}/v2/chat/{chat_id}", message):
            yield ndjson(evt)
        yield ndjson({"type": "turn-end"})
    except requests.HTTPError as e:
        yield ndjson({"type": "error", "message": e.response.text})
    except Exception as e:
        yield ndjson({"type": "error", "message": f"{type(e).__name__}: {e}"})


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
