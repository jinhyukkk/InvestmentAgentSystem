# ponytail: 회귀 체크 1개 — 핸들러 반환 후 UploadFile이 닫혀도 파일 업로드가 되는지.
# 웍스 API는 목 처리. 실행: python test_upload_after_return.py
import json

import main
from fastapi.testclient import TestClient


class FakeResp:
    def __init__(self, headers=None, data=None, lines=None):
        self.headers = headers or {}
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
        content = kwargs["files"]["file"][1]
        # 닫힌 파일이면 여기서 read of closed file이 났었다 — bytes여야 한다
        assert isinstance(content, bytes), f"bytes가 아님: {type(content)}"
        assert content == b"dummy-im-pdf"
        return FakeResp(data={"data": {"id": "f1", "name": "im.pdf"}})
    # 대화 생성 및 후속 메시지
    return FakeResp(
        headers={"X-Chat-Id": "c1"},
        lines=[b'data: {"type": "text-delta", "text": "ok"}', b"data: [DONE]"],
    )


main.requests.post = fake_post

client = TestClient(main.app)
resp = client.post(
    "/api/review",
    data={"message": "이 IM 분석해줘"},
    files={"files": ("im.pdf", b"dummy-im-pdf", "application/pdf")},
)
events = [json.loads(line) for line in resp.text.strip().splitlines()]
types = [e["type"] for e in events]

assert "error" not in types, f"error 이벤트 발생: {events}"
assert "file-uploaded" in types, f"file-uploaded 없음: {types}"
print("OK:", types)
