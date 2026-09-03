# ponytail: 회귀 체크 — 실행: backend 디렉터리에서 python test_api.py
#  1) 안건 생성 → 목록에 '검토 중'으로 나오는지
#  2) ai 턴에 json 블록이 있으면 점수·권고가 채워지고 '심의 대기'가 되는지
#  3) 사람이 접수 정보를 고친 뒤에는 AI 재파싱이 덮어쓰지 않는지
#  4) 위원회 결정 입력 → '완료', 해제 → '심의 대기'
#  5) created_at 이 UTC 로 저장돼도 날짜는 한국 시간(KST) 기준으로 나오는지
#  6) 저장 시 연속된 delta 가 하나로 합쳐지고, 합친 뒤 재생 결과가 원본과 같은지
#  7) 그릴 게 없는 빈 턴은 아예 저장되지 않는지
import os

os.environ["WRKS_API_KEY"] = "test"
# 반드시 하드 대입: setdefault 를 쓰면 개발자 쉘에 DATABASE_URL 이 이미 개발 DB로 export 돼
# 있을 때 아무 효과가 없어서, 아래 reset() 의 TRUNCATE 가 실제 운영/개발 데이터를 지워버린다.
os.environ["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/investment_test"

from sqlalchemy import text

import db

REPORT = '```json\n{"total_score": 82, "recommendation": "조건부 투자 승인", "company": "대성정밀", "asset_type": "M&A", "sector": "자동차 부품", "total_invest": 1850, "base_price": 1720, "review_level": "본심의", "scores": []}\n```'


def reset():
    # 실수로 개발 DB를 겨냥한 채 실행되더라도 TRUNCATE 가 나가기 전에 막는다
    assert db.DATABASE_URL.endswith("_test"), f"테스트 DB(이름이 _test로 끝나야 함)가 아닌 DB를 TRUNCATE 하려 합니다: {db.DATABASE_URL}"
    db.init_db()
    with db.Session(db.engine) as s:
        s.execute(text("TRUNCATE reviews, turns RESTART IDENTITY CASCADE"))
        s.commit()


def ai_turn(report_text):
    return [{"type": "text-delta", "delta": "보고서\n\n"}, {"type": "text-delta", "delta": report_text}, {"type": "finish", "finishReason": "stop"}]


def test_create_and_list():
    reset()
    rid = db.create_review("chat-1", "대성정밀 인수 검토해줘", [{"name": "im.pdf", "size": 10}])
    rows = db.list_reviews()
    assert [r["id"] for r in rows] == [rid]
    assert rows[0]["status"] == "검토 중"
    assert rows[0]["company"] == "대성정밀 인수 검토해줘"[:24], "company 없으면 title 대신"
    assert db.find_review_id("chat-1") == rid
    assert db.find_review_id("없음") is None
    detail = db.get_review(rid)
    assert detail["turns"][0]["role"] == "user"
    assert detail["turns"][0]["payload"]["files"][0]["name"] == "im.pdf"


def test_ai_turn_fills_report():
    reset()
    rid = db.create_review("chat-2", "검토", [])
    db.save_ai_turn(rid, ai_turn(REPORT))
    d = db.get_review(rid)
    assert d["status"] == "심의 대기"
    assert d["aiScore"] == 82 and d["aiRec"] == "조건부 투자 승인"
    assert d["company"] == "대성정밀" and d["assetType"] == "M&A" and d["totalInvest"] == 1850
    assert d["reportedAt"] is not None
    assert d["turns"][-1]["role"] == "ai" and d["turns"][-1]["payload"][0]["type"] == "text-delta"
    # json 없는 턴은 기존 값을 건드리지 않는다
    db.save_ai_turn(rid, ai_turn("추가 설명만"))
    assert db.get_review(rid)["aiScore"] == 82


def test_manual_edit_wins():
    reset()
    rid = db.create_review("chat-3", "검토", [])
    db.save_ai_turn(rid, ai_turn(REPORT))
    db.update_review(rid, {"company": "사람이 고친 이름"})
    db.save_ai_turn(rid, ai_turn(REPORT.replace("대성정밀", "AI가 다시 쓴 이름").replace("82", "70")))
    d = db.get_review(rid)
    assert d["company"] == "사람이 고친 이름"
    assert d["aiScore"] == 70, "점수·보고서는 계속 갱신된다"


def replay(events):
    """frontend streamReducer.appendDelta 와 같은 규칙으로 블록을 만든다 (재생 동일성 확인용)."""
    kinds = {"text-delta": "text", "reasoning-delta": "reasoning"}
    blocks = []
    for e in events:
        kind = kinds.get(e["type"])
        if kind is None:
            if e["type"].startswith("tool-"):
                blocks.append(("tool", e.get("toolCallId")))
            continue
        if blocks and blocks[-1][0] == kind:
            blocks[-1] = (kind, blocks[-1][1] + (e.get("delta") or ""))
        else:
            blocks.append((kind, e.get("delta") or ""))
    return blocks


def test_delta_coalesced():
    reset()
    rid = db.create_review("chat-6", "검토", [])
    raw = [
        {"type": "reasoning-delta", "id": "r1", "delta": "생각"},
        {"type": "reasoning-delta", "id": "r1", "delta": "중"},
        {"type": "text-delta", "id": "1", "delta": "답"},
        {"type": "tool-input-available", "toolCallId": "t1", "toolName": "search"},
        {"type": "text-delta", "id": "2", "delta": "변"},
        {"type": "text-delta", "id": "2", "delta": "!"},
        {"type": "finish", "finishReason": "stop"},
    ]
    db.save_ai_turn(rid, raw)
    saved = db.get_review(rid)["turns"][-1]["payload"]
    assert [e["type"] for e in saved] == [
        "reasoning-delta",
        "text-delta",
        "tool-input-available",
        "text-delta",
        "finish",
    ], f"연속 delta 가 합쳐지지 않음: {[e['type'] for e in saved]}"
    assert saved[0]["delta"] == "생각중"
    assert saved[3]["delta"] == "변!"
    assert replay(saved) == replay(raw), "합친 뒤 재생 결과가 달라졌다"


def test_empty_turn_not_saved():
    reset()
    rid = db.create_review("chat-7", "검토", [])
    db.save_ai_turn(rid, [])
    db.save_ai_turn(rid, [{"type": "finish", "finishReason": "error"}, {"type": "text-delta", "delta": ""}])
    assert [t["role"] for t in db.get_review(rid)["turns"]] == ["user"], "빈 ai 턴이 저장됐다 (빈 말풍선)"


def test_kst_date_boundary():
    # db._date() 를 직접 호출한다: DB 서버 세션 타임존이 이미 Asia/Seoul 이면
    # list_reviews() 왕복만으로는 UTC .date() 버그가 가려져 버려서 검증이 안 된다.
    from datetime import timezone as _tz, datetime as _dt

    utc_instant = _dt(2026, 5, 11, 23, 30, tzinfo=_tz.utc)  # 한국 시간으로는 2026-05-12 08:30
    assert db._date(utc_instant) == "2026-05-12", "UTC 그대로 .date() 를 뽑으면 하루 전 날짜가 나온다"


def test_committee_status():
    reset()
    rid = db.create_review("chat-4", "검토", [])
    db.save_ai_turn(rid, ai_turn(REPORT))
    d = db.update_review(rid, {"committee": "승인", "committee_note": "만장일치"})
    assert d["status"] == "완료" and d["decidedAt"] is not None and d["committeeNote"] == "만장일치"
    d = db.update_review(rid, {"committee": None})
    assert d["status"] == "심의 대기" and d["decidedAt"] is None
    assert db.update_review(999, {"committee": "승인"}) is None


from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_http_list_detail_patch():
    reset()
    rid = db.create_review("chat-5", "HTTP 검토", [])
    db.save_ai_turn(rid, ai_turn(REPORT))
    assert client.get("/api/reviews").json()[0]["id"] == rid
    assert client.get("/api/reviews", params={"asset_type": "실물자산"}).json() == []
    assert client.get("/api/reviews", params={"status": "심의 대기"}).json()[0]["id"] == rid
    assert client.get("/api/reviews/999").status_code == 404
    d = client.get(f"/api/reviews/{rid}").json()
    assert d["reportJson"]["total_score"] == 82 and len(d["turns"]) == 2
    r = client.patch(f"/api/reviews/{rid}", json={"committee": "부결", "committeeNote": "리스크"})
    assert r.status_code == 200 and r.json()["status"] == "완료"
    r = client.patch(f"/api/reviews/{rid}", json={"company": "정정", "totalInvest": 2000})
    assert r.json()["company"] == "정정" and r.json()["totalInvest"] == 2000
    assert client.patch(f"/api/reviews/{rid}", json={"committee": "엉뚱"}).status_code == 422
    assert client.patch(f"/api/reviews/{rid}", json={"status": "완료"}).status_code == 422, "status 는 서버가 정한다"
    assert client.patch("/api/reviews/999", json={"committee": "승인"}).status_code == 404
    # committee: null 은 결정 해제, committee 자체를 안 보내면 그대로 유지 — 구분되어야 한다
    r = client.patch(f"/api/reviews/{rid}", json={"committee": "승인"})
    assert r.json()["status"] == "완료"
    r = client.patch(f"/api/reviews/{rid}", json={"company": "재정정"})
    assert r.json()["status"] == "완료" and r.json()["committee"] == "승인", "committee 미포함이면 유지"
    r = client.patch(f"/api/reviews/{rid}", json={"committee": None})
    assert r.json()["status"] == "심의 대기" and r.json()["committee"] is None, "committee: null 은 해제"


if __name__ == "__main__":
    test_create_and_list()
    test_ai_turn_fills_report()
    test_manual_edit_wins()
    test_delta_coalesced()
    test_empty_turn_not_saved()
    test_kst_date_boundary()
    test_committee_status()
    test_http_list_detail_patch()
    print("test_api OK")
