# ponytail: 회귀 체크 — 실행: DATABASE_URL 이 테스트용 DB를 가리킨 상태에서 python test_api.py
#  1) 안건 생성 → 목록에 '검토 중'으로 나오는지
#  2) ai 턴에 json 블록이 있으면 점수·권고가 채워지고 '심의 대기'가 되는지
#  3) 사람이 접수 정보를 고친 뒤에는 AI 재파싱이 덮어쓰지 않는지
#  4) 위원회 결정 입력 → '완료', 해제 → '심의 대기'
#  5) 허용 목록 밖 값은 422
import os

os.environ.setdefault("WRKS_API_KEY", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/investment_test")

from sqlalchemy import text

import db

REPORT = '```json\n{"total_score": 82, "recommendation": "조건부 투자 승인", "company": "대성정밀", "asset_type": "M&A", "sector": "자동차 부품", "total_invest": 1850, "base_price": 1720, "review_level": "본심의", "scores": []}\n```'


def reset():
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


def test_committee_status():
    reset()
    rid = db.create_review("chat-4", "검토", [])
    db.save_ai_turn(rid, ai_turn(REPORT))
    d = db.update_review(rid, {"committee": "승인", "committee_note": "만장일치"})
    assert d["status"] == "완료" and d["decidedAt"] is not None and d["committeeNote"] == "만장일치"
    d = db.update_review(rid, {"committee": None})
    assert d["status"] == "심의 대기" and d["decidedAt"] is None
    assert db.update_review(999, {"committee": "승인"}) is None


if __name__ == "__main__":
    test_create_and_list()
    test_ai_turn_fills_report()
    test_manual_edit_wins()
    test_committee_status()
    print("test_api(db) OK")
