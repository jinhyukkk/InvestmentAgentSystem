# ponytail: 회귀 체크 4개 — 웍스 API는 목 처리. 실행: python test_upload_after_return.py
#  1) 핸들러 반환 후 UploadFile이 닫혀도 업로드되는지 (read of closed file 회귀)
#  2) 이미지가 imageFileIds로 전달되는지 (안 그러면 모델이 이미지를 못 본다)
#  3) 미지원 엑셀이 .md로 변환돼 올라가는지
#  4) 거절된 파일이 file-error로 보고되고 나머지는 계속 진행되는지
#  5) 자리표시자 턴을 끝까지 읽고 나서 업로드하는지 (중도 절단 시 웍스가 504로 막는다)
#  6) 작은 엑셀 변환본이 질문에 원문 그대로 실리는지 (검색 조각 누락으로 자료를 못 읽던 회귀)
#  7) 출력 규칙(REPORT_INSTRUCTION)이 실제 심의 질문에만 붙는지 (자리표시자에는 X)
#  8) meta 에 reviewId 가 실리고 안건·파일·ai 턴이 저장되는지
#  9) 저장된 안건이 없는 chatId 로 후속 메시지를 보내도 404가 아니라 정상 스트림으로 진행되는지
# 10) 후속 메시지에도 출력 규칙이 붙되, 저장되는 사용자 턴에는 안 섞이는지
import io
import json
import os

# 이 테스트는 main 을 import 하는 순간 .env 의 DATABASE_URL(개발 DB)을 물게 된다.
# 아래 reset() 이 TRUNCATE 를 날리므로 test_api.py 와 같은 방식으로 테스트 DB를 하드 대입한다.
os.environ["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/investment_test"

import db
import main
from sqlalchemy import text
from fastapi.testclient import TestClient
from openpyxl import Workbook

from itertools import count

chat_ids = count(1)
chat_bodies = []
uploads = []
read_lines = []
first_upload_at = []  # 업로드 시점에 자리표시자 스트림을 어디까지 읽었는지 기록


class FakeResp:
    def __init__(self, status_code=200, data=None, lines=None, text=""):
        self.status_code = status_code
        self.text = text
        self._data = data
        self._lines = lines or []

    def raise_for_status(self):
        pass

    def close(self):
        pass

    def json(self):
        return self._data

    def iter_lines(self):
        for line in self._lines:
            read_lines.append(line)  # 어디까지 읽고 끊었는지 기록 (중도 절단 감지용)
            yield line


def fake_post(url, **kwargs):
    if url.endswith("/v2/files"):
        name, content, ctype = kwargs["files"]["file"]
        # 닫힌 파일이면 여기서 read of closed file이 났었다 — bytes여야 한다
        assert isinstance(content, bytes), f"bytes가 아님: {type(content)}"
        uploads.append((name, content, ctype))
        first_upload_at.append(len(read_lines))
        if name.endswith(".png"):
            return FakeResp(201, {"data": {"fileId": 7, "filename": name, "imageUrl": "https://img/x.png"}})
        if name.endswith(".zip"):  # 웍스가 415로 거절하는 형식
            return FakeResp(415, text="unsupported")
        return FakeResp(201, {"data": {"fileId": 8, "filename": name}})

    chat_bodies.append(kwargs["json"])
    # 대화마다 다른 chatId — 전부 "c1" 이면 뒤쪽 심의가 같은 chat_id 로 저장되며 UNIQUE 위반이
    # 나고, 그 트레이스백이 통과한 테스트 출력에 섞여 "실패한 것처럼" 보인다.
    chat_id = f"c{next(chat_ids)}"
    return FakeResp(
        200,
        lines=[
            b'data: {"type":"chat-id","chatId":"%s"}' % chat_id.encode(),
            b'data: {"type":"text-delta","id":"1","delta":"ok"}',
            b'data: {"type":"finish","finishReason":"stop"}',
            b"data: [DONE]",
        ],
    )


def make_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["항목", "2025년"])
    ws.append(["EBITDA", 137.4])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


main.requests.post = fake_post

# 매 실행이 같은 chatId("c1", "c2"…)를 쓰므로 비우고 시작해야 UNIQUE 위반 없이 저장까지 검증된다
assert db.DATABASE_URL.endswith("_test"), f"테스트 DB가 아닌 DB를 TRUNCATE 하려 합니다: {db.DATABASE_URL}"
db.init_db()  # 앱 기동(lifespan)이 아니라 여기서 만든다 — TestClient 는 lifespan 을 돌리지 않는다
with db.Session(db.engine) as s:
    s.execute(text("TRUNCATE reviews, turns RESTART IDENTITY CASCADE"))
    s.commit()

client = TestClient(main.app)
resp = client.post(
    "/api/review",
    data={"message": "이 IM 분석해줘"},
    files=[
        ("files", ("im.pdf", b"dummy-im-pdf", "application/pdf")),
        ("files", ("chart.png", b"dummy-png", "image/png")),
        ("files", ("model.xlsx", make_xlsx(), "application/vnd.ms-excel")),
        ("files", ("junk.zip", b"dummy-zip", "application/zip")),
    ],
)
events = [json.loads(line) for line in resp.text.strip().splitlines()]
types = [e["type"] for e in events]

assert "error" not in types, f"error 이벤트 발생: {events}"
assert types.count("file-uploaded") == 3, f"업로드 성공 3건이 아님: {types}"

# 2) 이미지는 imageFileIds로 넘어가야 한다. 대화 호출은 자리표시자 → 실제 질문 순.
review_body = chat_bodies[-1]
assert review_body.get("imageFileIds") == [7], f"imageFileIds 누락: {review_body}"

# 2-1) 질문 앞에 첨부 파일 목록이 붙어야 한다 (없으면 에이전트가 검색을 안 함)
assert review_body["message"].startswith("[첨부 자료 3건:"), f"매니페스트 누락: {review_body['message'][:80]}"
assert "이 IM 분석해줘" in review_body["message"]

# 3) 엑셀은 .md 로 변환돼 올라가야 한다
md = next((u for u in uploads if u[0] == "model.md"), None)
assert md, f"model.md 업로드 없음: {[u[0] for u in uploads]}"
assert "EBITDA" in md[1].decode("utf-8"), "엑셀 내용이 변환되지 않음"
assert not any(u[0].endswith(".xlsx") for u in uploads), "xlsx가 그대로 업로드됨"

# 4) 거절된 파일만 file-error 로 보고되고 나머지는 진행
errs = [e["message"] for e in events if e["type"] == "file-error"]
assert len(errs) == 1 and errs[0].startswith("junk.zip"), f"file-error 이상: {errs}"

# 6) 엑셀 원문이 질문에 실려야 한다 — pdf처럼 변환하지 않는 자료는 실리지 않는다
assert "### model.md 원문" in review_body["message"], "엑셀 원문이 질문에 안 실림"
assert "EBITDA" in review_body["message"], "엑셀 표 내용이 질문에 안 실림"
assert "im.pdf 원문" not in review_body["message"], "변환 대상이 아닌 파일이 실렸다"

# 5) 첫 업로드 전에 자리표시자 스트림이 끝까지 읽혀 있어야 한다
assert first_upload_at[0] >= 4, f"자리표시자 턴을 끝까지 읽기 전에 업로드했다 — {first_upload_at[0]}/4줄 (504 회귀)"

# 7) 출력 규칙은 실제 심의 질문에만 — 자리표시자 턴에 붙으면 첫 턴부터 보고서를 쓰려 든다
from report import REPORT_INSTRUCTION

assert chat_bodies[0]["message"] == "자료를 첨부할게", f"자리표시자가 변형됨: {chat_bodies[0]['message'][:80]}"
assert REPORT_INSTRUCTION in review_body["message"], "실제 질문에 출력 규칙이 안 붙음"

# 7-1) 자료가 없는 경로도 같은 규칙 — 이쪽 주입 지점은 별도 assert가 없어 회귀에 취약했다
resp_no_files = client.post("/api/review", data={"message": "포트폴리오 리스크 점검해줘"})
no_files_events = [json.loads(line) for line in resp_no_files.text.strip().splitlines()]
assert "error" not in [e["type"] for e in no_files_events], f"error 이벤트 발생(자료 없음): {no_files_events}"
no_files_body = chat_bodies[-1]
assert REPORT_INSTRUCTION in no_files_body["message"], "자료 없는 경로에 출력 규칙이 안 붙음"

# 8) 저장: meta 에 reviewId, 안건 1건에 파일 3건과 ai 턴 1건
meta = next(e for e in events if e["type"] == "meta")
assert meta.get("reviewId"), f"meta 에 reviewId 없음: {meta}"
detail = db.get_review(meta["reviewId"])
assert [f["filename"] for f in detail["files"]] == ["im.pdf", "chart.png", "model.md"], f"파일 저장 이상: {detail['files']}"
roles = [t["role"] for t in detail["turns"]]
assert roles == ["user", "ai"], f"턴 저장 이상 (자리표시자가 새어 들어갔는지 확인): {roles}"
assert detail["turns"][0]["payload"]["text"] == "이 IM 분석해줘", "사용자 턴은 원문 그대로 (규칙 미포함)"
assert any(e["type"] == "text-delta" for e in detail["turns"][1]["payload"]), "ai 턴 이벤트 미저장"

# 10) 후속 메시지에도 출력 규칙이 붙어야 한다 — 규칙상 보고서는 중간 턴이 아니라 뒤쪽 턴에서 나오므로
# 첫 메시지에만 붙이면 정작 보고서를 내는 턴에 규칙이 없다. 단, 저장되는 사용자 턴은 원문 그대로여야 한다.
resp_follow = client.post("/api/review/c1/message", data={"message": "2번안으로 진행해줘"})
assert resp_follow.status_code == 200, f"후속 메시지 실패: {resp_follow.status_code}"
follow_body = chat_bodies[-1]
assert REPORT_INSTRUCTION in follow_body["message"], "후속 메시지에 출력 규칙이 안 붙음"
assert follow_body["message"].startswith("2번안으로 진행해줘"), f"사용자 메시지가 앞에 와야 함: {follow_body['message'][:40]}"
follow_turns = db.get_review(meta["reviewId"])["turns"]
assert follow_turns[-1]["role"] == "user" or follow_turns[-2]["role"] == "user"
user_texts = [t["payload"]["text"] for t in follow_turns if t["role"] == "user"]
assert user_texts[-1] == "2번안으로 진행해줘", f"저장된 사용자 턴에 출력 규칙이 섞였다: {user_texts[-1][:60]}"

# 9) 저장된 안건이 없는 chatId 로 후속 메시지를 보내도 404가 아니라 정상 스트림으로 진행돼야 한다
# (저장이 실패해 안건 행이 없는 대화라도, 사용자가 보고 있는 심의는 계속 쓸 수 있어야 한다)
resp_orphan = client.post("/api/review/ghost-chat-id/message", data={"message": "후속 질문"})
assert resp_orphan.status_code == 200, f"저장 안 된 대화의 후속 메시지가 실패함: {resp_orphan.status_code} {resp_orphan.text[:200]}"
orphan_events = [json.loads(line) for line in resp_orphan.text.strip().splitlines()]
orphan_types = [e["type"] for e in orphan_events]
assert "error" not in orphan_types, f"error 이벤트 발생(안건 없음): {orphan_events}"
assert "text-delta" in orphan_types, f"정상 스트림이 아님: {orphan_events}"

print("OK:", types)
