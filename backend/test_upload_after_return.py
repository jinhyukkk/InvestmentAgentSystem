# ponytail: 회귀 체크 4개 — 웍스 API는 목 처리. 실행: python test_upload_after_return.py
#  1) 핸들러 반환 후 UploadFile이 닫혀도 업로드되는지 (read of closed file 회귀)
#  2) 이미지가 imageFileIds로 전달되는지 (안 그러면 모델이 이미지를 못 본다)
#  3) 미지원 엑셀이 .md로 변환돼 올라가는지
#  4) 거절된 파일이 file-error로 보고되고 나머지는 계속 진행되는지
import io
import json

import main
from fastapi.testclient import TestClient
from openpyxl import Workbook

chat_bodies = []
uploads = []


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
        return iter(self._lines)


def fake_post(url, **kwargs):
    if url.endswith("/v2/files"):
        name, content, ctype = kwargs["files"]["file"]
        # 닫힌 파일이면 여기서 read of closed file이 났었다 — bytes여야 한다
        assert isinstance(content, bytes), f"bytes가 아님: {type(content)}"
        uploads.append((name, content, ctype))
        if name.endswith(".png"):
            return FakeResp(201, {"data": {"fileId": 7, "filename": name, "imageUrl": "https://img/x.png"}})
        if name.endswith(".zip"):  # 웍스가 415로 거절하는 형식
            return FakeResp(415, text="unsupported")
        return FakeResp(201, {"data": {"fileId": 8, "filename": name}})

    chat_bodies.append(kwargs["json"])
    return FakeResp(
        200,
        lines=[
            b'data: {"type":"chat-id","chatId":"c1"}',
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

print("OK:", types)
