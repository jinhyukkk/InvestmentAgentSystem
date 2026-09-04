# 심의 이력 저장·조회 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 심의 요청에서 진행된 심의를 PostgreSQL에 저장하고, 대시보드·안건목록·안건상세가 목업 대신 저장된 이력을 보여주게 한다.

**Architecture:** 백엔드가 웍스AI 스트림을 릴레이하면서 이벤트를 그대로 DB에 기록하고, 보고서 끝의 ```json 블록을 파싱해 구조화 필드를 채운다. 프론트는 목록·상세 조회 API를 붙이고, 저장된 이벤트 배열을 기존 `streamReducer.applyEvent`로 재생한다. 위원회 결정은 상세 화면에서 사람이 PATCH로 입력한다.

**Tech Stack:** FastAPI, SQLAlchemy 2.x ORM, psycopg v3, PostgreSQL(JSONB), React 18 + Vite.

스펙: `docs/superpowers/specs/2026-09-03-review-history-design.md`

## Global Constraints

- DB는 PostgreSQL만. `DATABASE_URL` 미설정 시 기동 실패. SQLite 폴백 없음.
- 저장 실패는 스트림을 끊지 않는다. 로그만 남긴다.
- JSON 파싱 실패는 사용자에게 알리지 않는다.
- 스트림 응답 형식(NDJSON, 이벤트 타입)은 바꾸지 않는다. `meta`에 `reviewId`만 추가.
- 허용 값: asset_type `M&A|실물자산|그린필드`, review_level `예비 검토|본심의`, recommendation `투자 승인|조건부 투자 승인|추가 검토 후 재상정|투자 부적합`, committee `승인|조건부 승인|부결|재상정`, status `검토 중|심의 대기|완료`.
- status 규칙: committee가 있으면 `완료`, 없고 report_json이 있으면 `심의 대기`, 둘 다 없으면 `검토 중`.
- 사람이 접수 필드를 PATCH하면 `manual_edited=true`. 이후 AI 재파싱은 접수 필드를 덮어쓰지 않는다.
- 테스트는 기존 `backend/test_upload_after_return.py`처럼 `python test_x.py`로 실행되는 assert 스크립트. 테스트 실행 전 `DATABASE_URL`이 **테스트용 DB**를 가리켜야 한다(테이블을 TRUNCATE한다).
- 코드 주석·문구는 한국어. 커밋 메시지는 기존 규칙(`feat:`/`fix:` + 한국어)을 따른다.
- 로컬 PostgreSQL: `docker run -d --name inv-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=investment -p 5432:5432 postgres:16` 후 `DATABASE_URL=postgresql+psycopg://postgres:dev@localhost:5432/investment`.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `backend/report.py` (신규) | 허용 값 상수, 에이전트 지시문, `extract_report(text)` |
| `backend/db.py` (신규) | 엔진·모델(`Review`, `Turn`)·저장/조회 함수·직렬화 |
| `backend/main.py` (수정) | 스트림에 기록 후크, 지시문 주입, 조회·수정 라우트 |
| `backend/test_report.py` (신규) | 파싱 4케이스 |
| `backend/test_api.py` (신규) | 저장 함수·status 전이·PATCH 검증 |
| `frontend/src/api.js` (수정) | 조회·수정 fetch 헬퍼 |
| `frontend/src/useAsync.js` (신규) | 조회 훅 하나 |
| `frontend/src/mockData.js` (수정) | 목업 배열 삭제, stage 계산, 통계 계산 |
| `frontend/src/reportView.js` (신규, `detailData.js` 대체) | `toDetail(reportJson)`, `toc`, `timelineFor(review)` |
| `frontend/src/Dashboard.jsx`, `CaseList.jsx`, `CaseDetail.jsx`, `Markdown.jsx` (수정) | API 연동 |

---

### Task 1: 보고서 JSON 추출 (`report.py`)

**Files:**
- Create: `backend/report.py`
- Test: `backend/test_report.py`

**Interfaces:**
- Produces: `ASSET_TYPES, REVIEW_LEVELS, RECOMMENDATIONS, COMMITTEES: tuple[str, ...]`, `REPORT_INSTRUCTION: str`, `extract_report(text: str) -> dict | None`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test_report.py`:

```python
# ponytail: 회귀 체크 4개 — 실행: python test_report.py
#  1) 정상 json 블록이 dict로 나오고 허용 목록 밖 값은 null이 되는지
#  2) json 블록이 없으면 None
#  3) 깨진 json / total_score 범위 밖이면 None
#  4) 블록이 여러 개면 마지막 것을 쓰는지
from report import extract_report

GOOD = """보고서 본문입니다.

```json
{"total_score": 82, "recommendation": "조건부 투자 승인", "asset_type": "M&A", "review_level": "이상한값", "company": "대성정밀"}
```
"""


def test_good():
    r = extract_report(GOOD)
    assert r["total_score"] == 82
    assert r["recommendation"] == "조건부 투자 승인"
    assert r["asset_type"] == "M&A"
    assert r["review_level"] is None, "허용 목록 밖 값은 null"
    assert r["company"] == "대성정밀"


def test_missing():
    assert extract_report("json 블록 없는 답변") is None
    assert extract_report("") is None
    assert extract_report(None) is None


def test_broken():
    assert extract_report("```json\n{broken\n```") is None
    assert extract_report('```json\n{"total_score": 130}\n```') is None
    assert extract_report('```json\n{"total_score": true}\n```') is None
    assert extract_report('```json\n[1, 2]\n```') is None


def test_last_block_wins():
    text = '```json\n{"total_score": 10}\n```\n중간\n```json\n{"total_score": 90}\n```'
    assert extract_report(text)["total_score"] == 90


if __name__ == "__main__":
    test_good()
    test_missing()
    test_broken()
    test_last_block_wins()
    print("test_report OK")
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && python test_report.py`
Expected: `ModuleNotFoundError: No module named 'report'`

- [ ] **Step 3: 구현**

`backend/report.py`:

```python
"""에이전트 최종 보고서 끝에 붙는 ```json 블록을 구조화 데이터로 뽑는다."""
import json
import logging
import re

logger = logging.getLogger("investment-proxy")

ASSET_TYPES = ("M&A", "실물자산", "그린필드")
REVIEW_LEVELS = ("예비 검토", "본심의")
RECOMMENDATIONS = ("투자 승인", "조건부 투자 승인", "추가 검토 후 재상정", "투자 부적합")
COMMITTEES = ("승인", "조건부 승인", "부결", "재상정")

# 상세 화면(reportView.js)이 그대로 쓰는 모양. 필드를 바꾸면 양쪽을 같이 바꾼다.
REPORT_SCHEMA = """{
  "report_version": 1,
  "company": "안건명(회사명 또는 자산명)",
  "asset_type": "M&A | 실물자산 | 그린필드",
  "sector": "업종",
  "total_invest": 1850,
  "base_price": 1720,
  "review_level": "예비 검토 | 본심의",
  "total_score": 82,
  "recommendation": "투자 승인 | 조건부 투자 승인 | 추가 검토 후 재상정 | 투자 부적합",
  "recommendation_reason": "권고 근거 2~3문장",
  "summary": "안건 개요 2문단(사업 내용, 투자 규모와 핵심 판단 근거)",
  "scores": [
    {"label": "전략적 적합성", "max": 20, "value": 17},
    {"label": "가격 매력도", "max": 25, "value": 21},
    {"label": "현금 회수 가시성", "max": 20, "value": 16},
    {"label": "리스크 통제", "max": 20, "value": 15},
    {"label": "실행 가능성", "max": 15, "value": 13}
  ],
  "conditions": ["충족 조건"],
  "pros": ["찬성 논거"],
  "cons": ["반대 논거"],
  "claims": [{"claim": "매도자 측 주장", "tag": "확인됨 | 과장 가능성 | 근거 부족 | 반대 시나리오 존재"}],
  "perspectives": [{"name": "외부투자자 관점", "summary": "..."}, {"name": "CFO 관점", "summary": "..."}, {"name": "감사 관점", "summary": "..."}],
  "red_team": {"weak": ["취약가정"], "worst": "최악 시나리오"},
  "map_rows": [{"a": "취약가정", "c": "선행조건", "s": "충족 | 진행 중 | 미충족"}],
  "critical_gaps": ["치명적 정보 부족"],
  "normal_gaps": ["일반 추가 확인 항목"],
  "financials": [{"label": "매출액", "values": {"2023": "1,740", "2024": "1,920", "2025": "2,080"}, "warn": false}]
}"""

REPORT_INSTRUCTION = (
    "[출력 규칙] 최종 투자심의 결과보고서를 낼 때는 본문 맨 끝에 아래 스키마를 그대로 채운 ```json 코드 블록을 "
    "반드시 포함할 것. 중간 단계 답변(사전 확인 질문 등)에는 붙이지 말 것. 값을 알 수 없는 항목은 null. "
    "숫자 필드는 억원 단위 숫자만.\n" + REPORT_SCHEMA
)

_FENCE = re.compile(r"```json\s*\n(.*?)\n\s*```", re.DOTALL)
_ENUM_FIELDS = (("asset_type", ASSET_TYPES), ("review_level", REVIEW_LEVELS), ("recommendation", RECOMMENDATIONS))


def extract_report(text: str | None) -> dict | None:
    """텍스트의 마지막 ```json 블록을 dict로. 없거나 깨졌거나 total_score가 0~100 정수가 아니면 None."""
    blocks = _FENCE.findall(text or "")
    if not blocks:
        return None
    try:
        data = json.loads(blocks[-1])
    except ValueError:
        logger.warning("보고서 json 블록 파싱 실패: %s", blocks[-1][:200])
        return None
    if not isinstance(data, dict):
        return None
    score = data.get("total_score")
    if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
        logger.warning("보고서 total_score 비정상: %r", score)
        return None
    for key, allowed in _ENUM_FIELDS:
        if data.get(key) not in allowed:
            data[key] = None
    return data
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && python test_report.py`
Expected: `test_report OK`

- [ ] **Step 5: 커밋**

```bash
git add backend/report.py backend/test_report.py
git commit -m "feat: 보고서 말미 json 블록에서 구조화 데이터 추출"
```

---

### Task 2: DB 모델과 저장 함수 (`db.py`)

**Files:**
- Create: `backend/db.py`
- Modify: `backend/requirements.txt`, `backend/.env.example`
- Test: `backend/test_api.py` (이 Task에서는 저장 함수 부분만)

**Interfaces:**
- Consumes: `report.extract_report`, `report.ASSET_TYPES` 등
- Produces:
  - `init_db() -> None`
  - `create_review(chat_id: str, user_text: str, files: list[dict]) -> int` (사용자 턴도 함께 저장)
  - `find_review_id(chat_id: str) -> int | None`
  - `add_user_turn(review_id: int, text: str) -> None`
  - `add_file(review_id: int, file: dict) -> None`
  - `save_ai_turn(review_id: int, events: list[dict]) -> None` (턴 저장 + 파싱 + status)
  - `list_reviews(asset_type: str | None = None, status: str | None = None) -> list[dict]`
  - `get_review(review_id: int) -> dict | None`
  - `update_review(review_id: int, fields: dict) -> dict | None` (snake_case 키)

- [ ] **Step 1: 의존성·환경 파일**

`backend/requirements.txt`에 두 줄 추가:

```
sqlalchemy>=2.0
psycopg[binary]>=3.1
```

`backend/.env.example` 끝에 추가:

```
# 심의 이력 저장소 (PostgreSQL 전용)
DATABASE_URL=postgresql+psycopg://postgres:dev@localhost:5432/investment
```

Run: `cd backend && pip install -r requirements.txt`

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/test_api.py`:

```python
# ponytail: 회귀 체크 — 실행: DATABASE_URL 이 테스트용 DB를 가리킨 상태에서 python test_api.py
#  1) 안건 생성 → 목록에 '검토 중'으로 나오는지
#  2) ai 턴에 json 블록이 있으면 점수·권고가 채워지고 '심의 대기'가 되는지
#  3) 사람이 접수 정보를 고친 뒤에는 AI 재파싱이 덮어쓰지 않는지
#  4) 위원회 결정 입력 → '완료', 해제 → '심의 대기'
#  5) 허용 목록 밖 값은 422
import os

os.environ.setdefault("WRKS_API_KEY", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres:dev@localhost:5432/investment_test")

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
```

- [ ] **Step 3: 실패 확인**

테스트 DB 생성 후 실행:

```bash
docker exec inv-pg psql -U postgres -c "CREATE DATABASE investment_test"
cd backend && python test_api.py
```
Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 4: 구현**

`backend/db.py`:

```python
"""심의 이력 저장소. PostgreSQL 전용 — DATABASE_URL 이 없으면 기동하지 않는다."""
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from report import extract_report

logger = logging.getLogger("investment-proxy")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError(".env 에 DATABASE_URL 을 설정하세요 (예: postgresql+psycopg://user:pw@host:5432/investment)")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

INTAKE_FIELDS = ("company", "asset_type", "sector", "total_invest", "base_price", "review_level")
TITLE_LEN = 24


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[str] = mapped_column(String, unique=True)
    title: Mapped[str] = mapped_column(Text)
    company: Mapped[str | None] = mapped_column(Text)
    asset_type: Mapped[str | None] = mapped_column(String)
    sector: Mapped[str | None] = mapped_column(Text)
    total_invest: Mapped[float | None] = mapped_column(Numeric)
    base_price: Mapped[float | None] = mapped_column(Numeric)
    review_level: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="검토 중")
    ai_score: Mapped[int | None] = mapped_column(Integer)
    ai_rec: Mapped[str | None] = mapped_column(String)
    report_json: Mapped[dict | None] = mapped_column(JSONB)
    manual_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    committee: Mapped[str | None] = mapped_column(String)
    committee_note: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    files_json: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Turn(Base):
    __tablename__ = "turns"
    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String)  # user | ai
    payload_json: Mapped[dict | list] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


def init_db() -> None:
    # ponytail: create_all. 운영 중 스키마가 바뀌기 시작하면 Alembic 도입
    Base.metadata.create_all(engine)


def _status(r: Review) -> str:
    if r.committee:
        return "완료"
    return "심의 대기" if r.report_json else "검토 중"


def create_review(chat_id: str, user_text: str, files: list[dict]) -> int:
    with Session(engine) as s:
        r = Review(chat_id=chat_id, title=user_text[:TITLE_LEN] or "제목 없음")
        s.add(r)
        s.flush()
        s.add(Turn(review_id=r.id, role="user", payload_json={"text": user_text, "files": files}))
        s.commit()
        return r.id


def find_review_id(chat_id: str) -> int | None:
    with Session(engine) as s:
        return s.scalar(select(Review.id).where(Review.chat_id == chat_id))


def add_user_turn(review_id: int, text: str) -> None:
    with Session(engine) as s:
        s.add(Turn(review_id=review_id, role="user", payload_json={"text": text, "files": []}))
        s.commit()


def add_file(review_id: int, file: dict) -> None:
    with Session(engine) as s:
        r = s.get(Review, review_id)
        r.files_json = [*r.files_json, {"filename": file.get("filename"), "original": file.get("original"), "size": file.get("size")}]
        s.commit()


def save_ai_turn(review_id: int, events: list[dict]) -> None:
    """ai 턴 원본 이벤트를 저장하고, 보고서 json 블록이 있으면 안건 필드를 채운다."""
    text = "".join(e.get("delta") or "" for e in events if e.get("type") == "text-delta")
    report = extract_report(text)
    with Session(engine) as s:
        s.add(Turn(review_id=review_id, role="ai", payload_json=events))
        if report:
            r = s.get(Review, review_id)
            r.ai_score = report["total_score"]
            r.ai_rec = report.get("recommendation")
            r.report_json = report
            r.reported_at = r.reported_at or now()
            if not r.manual_edited:  # 사람이 정정한 접수 정보는 AI가 덮어쓰지 않는다
                for f in INTAKE_FIELDS:
                    setattr(r, f, report.get(f))
            r.status = _status(r)
        s.commit()


def _num(v):
    return None if v is None else float(v)


def _date(d: datetime | None):
    return d.date().isoformat() if d else None


def _summary(r: Review) -> dict:
    # 프론트 decorate()가 읽는 키 이름 그대로
    return {
        "id": r.id,
        "chatId": r.chat_id,
        "company": r.company or r.title,
        "assetType": r.asset_type,
        "sector": r.sector,
        "totalInvest": _num(r.total_invest),
        "basePrice": _num(r.base_price),
        "received": _date(r.created_at),
        "status": r.status,
        "reviewLevel": r.review_level,
        "aiScore": r.ai_score,
        "aiRec": r.ai_rec,
        "committee": r.committee,
        "decidedAt": _date(r.decided_at),
    }


def _detail(s: Session, r: Review) -> dict:
    turns = s.scalars(select(Turn).where(Turn.review_id == r.id).order_by(Turn.id)).all()
    return {
        **_summary(r),
        "reportJson": r.report_json,
        "committeeNote": r.committee_note,
        "reportedAt": _date(r.reported_at),
        "files": r.files_json,
        "turns": [{"role": t.role, "payload": t.payload_json, "createdAt": t.created_at.isoformat()} for t in turns],
    }


def list_reviews(asset_type: str | None = None, status: str | None = None) -> list[dict]:
    q = select(Review).order_by(Review.created_at.desc())
    if asset_type:
        q = q.where(Review.asset_type == asset_type)
    if status:
        q = q.where(Review.status == status)
    with Session(engine) as s:
        return [_summary(r) for r in s.scalars(q)]


def get_review(review_id: int) -> dict | None:
    with Session(engine) as s:
        r = s.get(Review, review_id)
        return _detail(s, r) if r else None


def update_review(review_id: int, fields: dict) -> dict | None:
    """fields 는 snake_case. 접수 필드가 오면 manual_edited, committee 가 오면 decided_at·status 갱신."""
    with Session(engine) as s:
        r = s.get(Review, review_id)
        if not r:
            return None
        for k, v in fields.items():
            setattr(r, k, v)
        if any(k in INTAKE_FIELDS for k in fields):
            r.manual_edited = True
        if "committee" in fields:
            r.decided_at = now() if fields["committee"] else None
        r.status = _status(r)
        s.commit()
        return _detail(s, r)
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && python test_api.py`
Expected: `test_api(db) OK`

- [ ] **Step 6: 커밋**

```bash
git add backend/db.py backend/test_api.py backend/requirements.txt backend/.env.example
git commit -m "feat: 심의 안건·대화 턴 PostgreSQL 저장소 추가"
```

---

### Task 3: 스트림에 기록 후크와 지시문 주입 (`main.py`)

**Files:**
- Modify: `backend/main.py` (`stream_new_review`, `stream_continue`, 두 라우트)
- Test: `backend/test_upload_after_return.py` (기존, 회귀만 확인)

**Interfaces:**
- Consumes: `db.create_review, db.find_review_id, db.add_user_turn, db.add_file, db.save_ai_turn, db.init_db`, `report.REPORT_INSTRUCTION`
- Produces: `record(events, user_text, files_meta, review_id=None)` 제너레이터. `meta` 이벤트에 `reviewId` 추가.

- [ ] **Step 1: import·기동 시 테이블 생성**

`backend/main.py` 상단 `from fastapi.responses import StreamingResponse` 아래에 추가:

```python
from fastapi import HTTPException

import db
from report import REPORT_INSTRUCTION
```

`app = FastAPI(...)` 와 CORS 미들웨어 등록 뒤에 추가:

```python
db.init_db()
```

- [ ] **Step 2: `stream_new_review`·`stream_continue`가 dict를 yield하도록 변경**

두 함수 안의 모든 `yield ndjson(x)`를 `yield x`로 바꾼다. 그리고 `stream_new_review`에서 지시문을 실제 심의 메시지 끝에 붙인다.

`stream_new_review`의 파일 없는 분기: `first_message = "자료를 첨부할게" if has_files else message` 를 다음으로 교체:

```python
        # 파일이 없으면 이 첫 메시지가 곧 심의 요청이므로 출력 규칙을 여기 붙인다
        first_message = "자료를 첨부할게" if has_files else f"{message}\n\n{REPORT_INSTRUCTION}"
```

파일 있는 분기의 `yield {"type": "turn-start"}` 직전(`if has_files:` 블록 끝, `time.sleep` 다음)에 추가:

```python
            message = f"{message}\n\n{REPORT_INSTRUCTION}"
```

`except Exception as e:` 블록은 `yield {"type": "error", "message": friendly_error(e)}` 가 된다.

- [ ] **Step 3: 기록 제너레이터 추가**

`stream_new_review` 정의 바로 위에 추가:

```python
def record(events, user_text: str, files_meta: list[dict], review_id: int | None = None):
    """릴레이하면서 안건·턴을 DB에 남긴다. 저장 실패는 로그만 — 심의가 저장 장애로 끊기면 안 된다.

    새 심의는 meta 에서 안건을 만들고(reviewId 를 meta 에 실음), 이어가기는 review_id 를 받아 온다.
    turn-start~turn-end 사이 이벤트를 모아 ai 턴 하나로 저장한다.
    """
    buf = None
    for evt in events:
        try:
            t = evt.get("type")
            if t == "meta" and review_id is None:
                review_id = db.create_review(evt["chatId"], user_text, files_meta)
                evt = {**evt, "reviewId": review_id}
            elif t == "turn-start":
                buf = []
            elif t == "turn-end":
                if buf is not None and review_id is not None:
                    db.save_ai_turn(review_id, buf)
                buf = None
            elif buf is not None:
                buf.append(evt)
            elif t == "file-uploaded" and review_id is not None:
                db.add_file(review_id, evt["file"])
        except Exception:
            logger.exception("심의 이력 저장 실패 (review=%s)", review_id)
        yield evt
```

- [ ] **Step 4: 라우트 연결**

두 라우트를 다음으로 교체:

```python
@app.post("/api/review")
async def start_review(message: str = Form(...), files: list[UploadFile] = File(default=[])):
    """새 심의 요청: 대화 생성 → 자료 업로드 → 검토 요청까지 실시간 스트림으로 릴레이하며 DB에 기록.

    FastAPI는 핸들러가 반환되는 즉시 UploadFile을 닫으므로(스트리밍 제너레이터는
    그 이후에 실행됨) 여기서 bytes로 미리 읽어 넘긴다 — 안 그러면 read of closed file.
    """
    payloads = [(f.filename, await f.read(), f.content_type) for f in files if f.filename]
    files_meta = [{"name": name, "size": len(content)} for name, content, _ in payloads]
    events = record(stream_new_review(message, payloads), message, files_meta)
    return StreamingResponse((ndjson(e) for e in events), media_type="application/x-ndjson")


@app.post("/api/review/{chat_id}/message")
async def continue_review(chat_id: str, message: str = Form(...)):
    """기존 심의 대화에 후속 메시지(예: "1번으로 진행해 줘") 전송, 실시간 스트림으로 릴레이하며 DB에 기록."""
    review_id = db.find_review_id(chat_id)
    if review_id is None:
        raise HTTPException(404, "저장된 안건이 없는 대화입니다")
    db.add_user_turn(review_id, message)
    events = record(stream_continue(chat_id, message), message, [], review_id)
    return StreamingResponse((ndjson(e) for e in events), media_type="application/x-ndjson")
```

- [ ] **Step 5: 기존 회귀 테스트 통과 확인**

Run: `cd backend && DATABASE_URL=postgresql+psycopg://postgres:dev@localhost:5432/investment_test python test_upload_after_return.py`
Expected: 기존 테스트가 통과(마지막 줄 OK 출력). 실패하면 원인은 대개 (a) 테스트가 `stream_new_review`의 반환을 bytes로 가정 → 라우트를 통해 호출하도록 유지, (b) 같은 chatId 재사용으로 UNIQUE 위반 → `record`가 예외를 삼키므로 스트림은 계속되어야 한다. 로그에 "심의 이력 저장 실패"가 찍히는지 확인.

- [ ] **Step 6: 저장 연동 확인 (수동)**

백엔드 기동 후 curl로 파일 없는 심의 1건:

```bash
curl -N -F "message=테스트 안건" http://localhost:8787/api/review | head -c 400
```
Expected: 첫 줄 `{"type":"meta","chatId":"...","reviewId":1}` 형태. 이후 `python -c "import db; print(db.list_reviews())"`에 1건.

- [ ] **Step 7: 커밋**

```bash
git add backend/main.py
git commit -m "feat: 심의 스트림을 릴레이하며 안건·대화 턴 저장, 보고서 json 출력 규칙 주입"
```

---

### Task 4: 조회·수정 API

**Files:**
- Modify: `backend/main.py` (라우트 3개 추가)
- Modify: `backend/test_api.py` (HTTP 케이스 추가)

**Interfaces:**
- Consumes: `db.list_reviews, db.get_review, db.update_review`, `report.ASSET_TYPES, REVIEW_LEVELS, COMMITTEES`
- Produces: `GET /api/reviews`, `GET /api/reviews/{id}`, `PATCH /api/reviews/{id}` (camelCase JSON)

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/test_api.py`의 `if __name__` 위에 추가:

```python
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
```

그리고 `if __name__` 블록에 `test_http_list_detail_patch()` 호출과 출력 문구 `test_api OK` 로 변경.

- [ ] **Step 2: 실패 확인**

Run: `cd backend && python test_api.py`
Expected: `assert client.get("/api/reviews").json()[0]...` 에서 404 응답으로 실패.

- [ ] **Step 3: 라우트 구현**

`backend/main.py` 상단 import에 추가:

```python
from typing import Literal

from pydantic import BaseModel, ConfigDict
from report import ASSET_TYPES, COMMITTEES, REVIEW_LEVELS
```

파일 끝에 추가:

```python
class ReviewPatch(BaseModel):
    """사람이 고치는 필드만. status·점수는 서버가 정하므로 받지 않는다(extra=forbid)."""

    model_config = ConfigDict(extra="forbid")
    company: str | None = None
    assetType: Literal[ASSET_TYPES] | None = None
    sector: str | None = None
    totalInvest: float | None = None
    basePrice: float | None = None
    reviewLevel: Literal[REVIEW_LEVELS] | None = None
    committee: Literal[COMMITTEES] | None = None
    committeeNote: str | None = None


_SNAKE = {
    "assetType": "asset_type",
    "totalInvest": "total_invest",
    "basePrice": "base_price",
    "reviewLevel": "review_level",
    "committeeNote": "committee_note",
}


@app.get("/api/reviews")
def list_reviews(asset_type: str | None = None, status: str | None = None):
    return db.list_reviews(asset_type, status)


@app.get("/api/reviews/{review_id}")
def get_review(review_id: int):
    r = db.get_review(review_id)
    if r is None:
        raise HTTPException(404, "안건이 없습니다")
    return r


@app.patch("/api/reviews/{review_id}")
def patch_review(review_id: int, patch: ReviewPatch):
    # exclude_unset: 보낸 필드만 갱신한다. null 을 보내면 지운다(위원회 결정 해제).
    fields = {_SNAKE.get(k, k): v for k, v in patch.model_dump(exclude_unset=True).items()}
    r = db.update_review(review_id, fields)
    if r is None:
        raise HTTPException(404, "안건이 없습니다")
    return r
```

`Literal[ASSET_TYPES]`는 튜플을 그대로 넣으면 `Literal["M&A", "실물자산", "그린필드"]`로 해석된다(파이썬 3.11+). 3.10이면 `Literal["M&A", "실물자산", "그린필드"]`처럼 직접 나열한다.

- [ ] **Step 4: 통과 확인**

Run: `cd backend && python test_api.py`
Expected: `test_api OK`

- [ ] **Step 5: 커밋**

```bash
git add backend/main.py backend/test_api.py
git commit -m "feat: 안건 목록·상세 조회와 접수 정보·위원회 결정 수정 API"
```

---

### Task 5: 프론트 API 헬퍼·조회 훅·데이터 계산

**Files:**
- Modify: `frontend/src/api.js`
- Create: `frontend/src/useAsync.js`
- Modify: `frontend/src/mockData.js`

**Interfaces:**
- Produces:
  - `api.js`: `fetchReviews(params?) -> Promise<Summary[]>`, `fetchReview(id) -> Promise<Detail>`, `patchReview(id, body) -> Promise<Detail>`
  - `useAsync.js`: `useAsync(fn, deps) -> { data, error, loading, reload }`
  - `mockData.js`: `decorate(c)`(기존, `stage` 자동 계산), `computeStats(decoratedRows) -> { statCards, approvalRate, approvedText, matchRate, matchBars }`, `COMMITTEES`, `ASSET_TYPES`, `REVIEW_LEVELS`

- [ ] **Step 1: `api.js` 헬퍼**

`frontend/src/api.js`의 `streamNdjson` 안 `catch (e)` 블록을 헬퍼로 뽑고 조회 함수를 추가한다. 파일 전체:

```js
const API_BASE = "http://localhost:8787";

// 서버가 안 떠 있으면 fetch 자체가 TypeError로 죽는다 — 스트림 중단과는 원인이 달라 구분해 알린다.
function offlineError(cause) {
  const err = new Error(`백엔드 서버(${API_BASE})에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.`);
  err.offline = true;
  err.cause = cause;
  return err;
}

async function request(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw offlineError(e);
  }
  if (!res.ok) throw new Error(await res.text());
  return res;
}

// 백엔드가 NDJSON(줄 단위 JSON)으로 실시간 이벤트를 흘려보내면, 도착하는 즉시 onEvent로 넘긴다.
async function streamNdjson(url, form, onEvent) {
  const res = await request(url, { method: "POST", body: form });
  if (!res.body) throw new Error("응답 본문이 없습니다");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

export function streamStartReview(message, files, onEvent) {
  const form = new FormData();
  form.append("message", message);
  files.forEach((f) => form.append("files", f));
  return streamNdjson(`${API_BASE}/api/review`, form, onEvent);
}

export function streamContinueReview(chatId, message, onEvent) {
  const form = new FormData();
  form.append("message", message);
  return streamNdjson(`${API_BASE}/api/review/${chatId}/message`, form, onEvent);
}

const json = (res) => res.json();

export function fetchReviews(params = {}) {
  return request(`${API_BASE}/api/reviews?${new URLSearchParams(params)}`).then(json);
}

export function fetchReview(id) {
  return request(`${API_BASE}/api/reviews/${id}`).then(json);
}

export function patchReview(id, body) {
  return request(`${API_BASE}/api/reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(json);
}
```

- [ ] **Step 2: 조회 훅**

`frontend/src/useAsync.js`:

```js
import { useCallback, useEffect, useState } from "react";

// 목록·상세 세 화면이 같은 "불러오는 중 / 실패 / 다시 불러오기" 패턴을 쓴다.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e) => alive && setState({ data: null, error: e.message, loading: false })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}
```

- [ ] **Step 3: `mockData.js` 정리**

- `cases`, `statCards`, `matchBars` export 삭제.
- 파일 상단 주석을 `// 안건 표시용 스타일·계산 헬퍼. 데이터는 GET /api/reviews 에서 온다.` 로 교체.
- `steps` 아래에 추가:

```js
export const ASSET_TYPES = ["M&A", "실물자산", "그린필드"];
export const REVIEW_LEVELS = ["예비 검토", "본심의"];
export const COMMITTEES = ["승인", "조건부 승인", "부결", "재상정"];

// 서버 status → 8단계 타임라인 위치. 세부 단계는 서버가 모르므로 세 지점만 쓴다.
const STAGE_BY_STATUS = { "검토 중": 1, "심의 대기": 6, 완료: 7 };
```

- `decorate(c)` 안에서 `stageLabel: c.awaitInput ? "입력 대기 중" : steps[c.stage]` 를 다음으로 교체하고, 반환 객체에 `stage` 를 넣는다:

```js
    stage: STAGE_BY_STATUS[c.status] ?? 0,
    stageLabel: steps[STAGE_BY_STATUS[c.status] ?? 0],
```

(`awaitInput` 관련 `awaitLabel`, `awaitStyle` 는 그대로 두되 서버는 이 값을 보내지 않으므로 항상 숨김이다.)

- 파일 끝에 대시보드 통계 계산 추가:

```js
function quarterOf(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function quarterLabel(date = new Date()) {
  return `${date.getFullYear()}년 ${Math.floor(date.getMonth() / 3) + 1}분기`;
}

// decorate()를 거친 행 배열에서 대시보드 카드·일치율을 계산한다.
export function computeStats(rows) {
  const count = (pred) => rows.filter(pred).length;
  const done = rows.filter((c) => c.status === "완료");
  const thisQ = quarterOf(new Date().toISOString());
  const doneThisQ = done.filter((c) => c.decidedAt && quarterOf(c.decidedAt) === thisQ).length;
  const approved = done.filter((c) => c.committee === "승인" || c.committee === "조건부 승인").length;
  const approvalRate = done.length ? Math.round((approved / done.length) * 100) : 0;
  const matched = done.filter((c) => c.matchLabel !== "—");
  const pct = (n) => (matched.length ? Math.round((n / matched.length) * 100) : 0);
  const bar = (label, color) => {
    const n = matched.filter((c) => c.matchLabel === label).length;
    return { label: label === "부분" ? "부분 일치" : label, count: `${n}건`, pct: pct(n), color };
  };
  return {
    statCards: [
      { label: "검토 중", value: String(count((c) => c.status === "검토 중")), unit: "건", delta: "AI 분석 진행", deltaColor: "#3B5A86" },
      { label: "심의 대기", value: String(count((c) => c.status === "심의 대기")), unit: "건", delta: "보고서 완료", deltaColor: "#9A6B10" },
      { label: "이번 분기 완료", value: String(doneThisQ), unit: "건", delta: `전체 완료 ${done.length}건`, deltaColor: "#0F7A55" },
      { label: "승인율", value: String(approvalRate), unit: "%", delta: `승인·조건부 ${approved} / ${done.length}`, deltaColor: "#8A94A3" },
    ],
    approvalRate,
    approvedText: `완료 ${done.length}건 중 승인·조건부 ${approved}건`,
    matchRate: pct(matched.filter((c) => c.matchLabel === "일치").length),
    matchBars: [bar("일치", "#0F7A55"), bar("부분", "#C79A3A"), bar("불일치", "#C86B63")],
  };
}
```

- [ ] **Step 4: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: `Dashboard.jsx`/`CaseList.jsx`가 아직 `cases`를 import하므로 빌드 오류. Task 6에서 해소된다. 이 Task는 커밋만 한다.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/api.js frontend/src/useAsync.js frontend/src/mockData.js
git commit -m "feat: 안건 조회 API 헬퍼와 대시보드 통계 계산 추가"
```

---

### Task 6: 대시보드·안건목록 API 연동

**Files:**
- Modify: `frontend/src/Dashboard.jsx`, `frontend/src/CaseList.jsx`

**Interfaces:**
- Consumes: `fetchReviews`, `useAsync`, `decorate`, `computeStats`, `quarterLabel`, `ASSET_TYPES`

- [ ] **Step 1: 공통 상태 표시 컴포넌트**

`frontend/src/useAsync.js` 끝에 추가(훅과 같이 쓰이므로 같은 파일):

```js
// 불러오는 중·실패·0건을 한 줄로. 세 화면이 같은 문구를 쓴다.
export function AsyncStatus({ loading, error, empty, onRetry }) {
  const box = { padding: "40px 20px", textAlign: "center", fontSize: 13, color: "#8A94A3" };
  if (loading) return <div style={box}>불러오는 중…</div>;
  if (error)
    return (
      <div style={box}>
        {error}{" "}
        <button onClick={onRetry} style={{ marginLeft: 8, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
          다시 시도
        </button>
      </div>
    );
  if (empty) return <div style={box}>저장된 안건이 없습니다. 새 심의 요청으로 시작하세요.</div>;
  return null;
}
```

`useAsync.js`는 JSX를 담으므로 파일명을 `useAsync.jsx`로 만들고 import 경로도 `./useAsync.jsx`로 쓴다.

- [ ] **Step 2: `Dashboard.jsx`**

상단 import를 교체:

```js
import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, computeStats, quarterLabel } from "./mockData.js";
import { fetchReviews } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";
```

컴포넌트 시작부를 교체:

```js
export default function Dashboard({ onOpenCase, onNewRequest }) {
  const [variant, setVariant] = useState("a");
  const { data, error, loading, reload } = useAsync(fetchReviews, []);
  const dec = (data || []).map(decorate);
  const stats = computeStats(dec);
  const active = dec.filter((c) => c.status !== "완료");
  const recent = dec.filter((c) => c.status === "완료").slice(0, 5);
  const boardColumns = [
    { title: "검토 중", dot: "#3B5A86", list: dec.filter((c) => c.status === "검토 중") },
    { title: "심의 대기", dot: "#C79A3A", list: dec.filter((c) => c.status === "심의 대기") },
    { title: "완료", dot: "#0F7A55", list: dec.filter((c) => c.status === "완료").slice(0, 3) },
  ];
```

본문 교체 목록:
- `2026년 2분기 · 마지막 갱신 오늘 09:12` → `{quarterLabel()} · 전체 {dec.length}건`
- 헤더 div 바로 아래(`{variant === "a" && (` 앞)에 `<AsyncStatus loading={loading} error={error} empty={!loading && !error && dec.length === 0} onRetry={reload} />`
- `statCards.map` → `stats.statCards.map`
- "이번 분기 승인율" 카드: `<div style={{ fontSize: 38, fontWeight: 700 }}>67</div>` → `{stats.approvalRate}`, `width: "67%"` → `` width: `${stats.approvalRate}%` ``, `완료 12건 중 승인·조건부 8건` → `{stats.approvedText}`
- 일치율 카드: `<div style={{ fontSize: 26, fontWeight: 700, color: "#2E6BB0" }}>75</div>` → `{stats.matchRate}`, `matchBars.map` → `stats.matchBars.map`
- 완료 안건 표의 접수일 `{c.received} 접수` 는 그대로(서버가 `YYYY-MM-DD`를 준다).

- [ ] **Step 3: `CaseList.jsx`**

import 교체:

```js
import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, statusChip, ASSET_TYPES } from "./mockData.js";
import { fetchReviews } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";

const FILTERS = ["전체", ...ASSET_TYPES];
```

컴포넌트 시작부 교체:

```js
export default function CaseList({ onOpenCase, onNewRequest }) {
  const [filter, setFilter] = useState("전체");
  const { data, error, loading, reload } = useAsync(fetchReviews, []);
  const dec = (data || []).map(decorate).filter((c) => filter === "전체" || c.assetType === filter);
```

표 컨테이너(`<div style={{ background: "#fff", border: ..., overflow: "hidden" }}>`) 안 첫 줄에 `<AsyncStatus loading={loading} error={error} empty={!loading && !error && dec.length === 0} onRetry={reload} />` 추가. 나머지 표 JSX는 그대로.

- [ ] **Step 4: 빌드·화면 확인**

Run: `cd frontend && npm run build`
Expected: `CaseDetail.jsx`의 `detailData.js` import는 아직 있으므로 통과. 오류 없음.

브라우저: 백엔드·프론트 기동 후 대시보드에 Task 3에서 만든 안건 1건이 "검토 중"으로 보이고, 안건 목록 필터가 동작한다. 백엔드를 끄면 "연결할 수 없습니다" 문구와 다시 시도 버튼.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/Dashboard.jsx frontend/src/CaseList.jsx frontend/src/useAsync.jsx
git rm -q frontend/src/useAsync.js 2>/dev/null; true
git commit -m "feat: 대시보드·안건목록을 저장된 심의 이력으로 표시"
```

---

### Task 7: 안건상세 API 연동 (보고서 섹션·편집 폼·대화 이력)

**Files:**
- Create: `frontend/src/reportView.js`
- Delete: `frontend/src/detailData.js`
- Modify: `frontend/src/CaseDetail.jsx`, `frontend/src/Markdown.jsx`

**Interfaces:**
- Consumes: `fetchReview, patchReview`, `useAsync, AsyncStatus`, `decorate, steps, ASSET_TYPES, REVIEW_LEVELS, COMMITTEES`, `applyEvent, newLiveMessage`, `AiMessage`
- Produces: `reportView.js`: `toDetail(reportJson) -> Detail | null`, `timelineFor(review) -> Timeline[]`, `toc`

- [ ] **Step 1: `Markdown.jsx`에서 말미 json 블록 제거**

```js
import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

// 보고서 끝의 ```json 블록은 서버 저장용이라 사람에게 보여주지 않는다.
// 닫히지 않은 펜스(스트리밍 중)는 매칭되지 않아 그대로 보이다가 닫히는 순간 사라진다.
const TRAILING_JSON = /```json\s*\n[\s\S]*?\n\s*```\s*$/;
export function stripReportJson(text) {
  return (text || "").replace(TRAILING_JSON, "").trimEnd();
}

// 에이전트가 첨부 문서 내용을 읽어 그대로 인용할 수 있으므로(간접 프롬프트 인젝션 경로),
// marked로 HTML 변환 후 반드시 DOMPurify로 살균한다.
export default function Markdown({ text, className }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(stripReportJson(text))), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 2: `reportView.js` 작성 (detailData.js 대체)**

```js
// GET /api/reviews/{id} 의 reportJson(report.py REPORT_SCHEMA 모양)을 CaseDetail 섹션이 그리는 모양으로 바꾼다.
import { steps } from "./mockData.js";

const tagMap = {
  확인됨: { c: "#0F7A55", bg: "#E6F4EE" },
  "과장 가능성": { c: "#9A6B10", bg: "#FaF0D8" },
  "근거 부족": { c: "#5A6473", bg: "#EEF1F4" },
  "반대 시나리오 존재": { c: "#B02A30", bg: "#FaEaEb" },
};
const mapStatus = { 충족: { c: "#0F7A55", bg: "#E6F4EE" }, "진행 중": { c: "#9A6B10", bg: "#FaF0D8" }, 미충족: { c: "#B02A30", bg: "#FaEaEb" } };
const list = (v) => (Array.isArray(v) ? v : []);

export function toDetail(r) {
  if (!r) return null;
  const scores = list(r.scores).map((s) => {
    const pct = s.value == null || !s.max ? 0 : Math.round((s.value / s.max) * 100);
    const color = pct >= 80 ? "#3E8ED0" : pct >= 60 ? "#C79A3A" : "#C86B63";
    return { ...s, pct, color, valStr: s.value == null ? "자료 미도달" : `${s.value}` };
  });
  const financials = list(r.financials).map((f) => ({ label: f.label, warn: !!f.warn, values: f.values || {} }));
  const years = [...new Set(financials.flatMap((f) => Object.keys(f.values)))].sort().slice(-3);
  return {
    summary: r.summary || "",
    recommendation: r.recommendation,
    recommendationReason: r.recommendation_reason || "",
    scores,
    conditions: list(r.conditions),
    pros: list(r.pros),
    cons: list(r.cons),
    claims: list(r.claims).map((x) => ({ ...x, tagColor: tagMap[x.tag] || tagMap["근거 부족"] })),
    perspectives: list(r.perspectives),
    redTeam: { weak: list(r.red_team?.weak), worst: r.red_team?.worst || "" },
    mapRows: list(r.map_rows).map((row) => ({ ...row, sColor: mapStatus[row.s] || mapStatus["진행 중"] })),
    criticalGaps: list(r.critical_gaps),
    normalGaps: list(r.normal_gaps),
    financials,
    years,
  };
}

const mmdd = (iso) => (iso ? iso.slice(5).replace("-", ".") : "—");

// 서버가 아는 날짜는 접수·종합(보고서)·최종 결정 셋뿐. 나머지 단계는 날짜 없이 위치만 표시한다.
export function timelineFor(review) {
  const cur = review.stage;
  const dates = { 0: mmdd(review.received), 5: mmdd(review.reportedAt), 7: mmdd(review.decidedAt) };
  return steps.map((label, i) => ({ label, date: dates[i] ?? "—", done: i <= cur, current: i === cur }));
}

export const toc = [
  { num: "①", title: "개요", id: "s1" },
  { num: "②", title: "핵심 재무 지표", id: "s2" },
  { num: "③", title: "매도자 측 주장 검증", id: "s3" },
  { num: "④", title: "4관점 분석", id: "s4" },
  { num: "⑤", title: "찬성·반대 논거", id: "s5" },
  { num: "⑥", title: "심의 점수", id: "s6" },
  { num: "⑥.5", title: "취약가정 ↔ 선행조건", id: "s65" },
  { num: "⑦", title: "최종 권고", id: "s7" },
  { num: "⑧", title: "추가 확인 필요", id: "s8" },
  { num: "⑨", title: "대화 이력", id: "s9" },
];
```

- [ ] **Step 3: `CaseDetail.jsx` 데이터 계층 교체**

import 블록 전체를 교체:

```js
import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, ASSET_TYPES, REVIEW_LEVELS, COMMITTEES, statusChip } from "./mockData.js";
import { fetchReview, patchReview } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";
import { toDetail, timelineFor, toc } from "./reportView.js";
import { applyEvent, newLiveMessage } from "./streamReducer.js";
import AiMessage from "./AiMessage.jsx";
```

컴포넌트 시작부를 교체:

```js
export default function CaseDetail({ caseItem, onBack }) {
  const [section, setSection] = useState("s1");
  const { data, error, loading, reload } = useAsync(() => fetchReview(caseItem.id), [caseItem?.id]);

  if (!data) {
    return (
      <div style={{ padding: "22px 28px" }}>
        <button onClick={onBack} style={backBtn}>← 안건 목록</button>
        <AsyncStatus loading={loading} error={error} empty={false} onRetry={reload} />
      </div>
    );
  }
  const review = decorate(data);
  const detail = toDetail(data.reportJson);
  const timeline = timelineFor(review);
```

`const divider = ...` 아래에 스타일 상수 추가:

```js
const backBtn = { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: colors.textMuted, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", padding: 0, marginBottom: 16 };
const input = { fontFamily: "inherit", fontSize: 12.5, padding: "6px 8px", border: `1px solid ${colors.border}`, borderRadius: 6, width: "100%" };
const empty = (msg = "AI 분석 결과가 아직 없습니다.") => <div style={{ fontSize: 12.5, color: colors.textFaint, padding: "10px 0" }}>{msg}</div>;
```

기존 JSX에서 목업 상수를 다음처럼 바꾼다(각 섹션은 `detail`이 null이면 `empty()`를 그린다):

| 기존 | 변경 |
|---|---|
| 헤더 `본심의` 고정 배지 | `{review.reviewLevel || "검토 수준 미정"}` |
| `{caseItem?.assetType \|\| "M&A"}` | `{review.assetType || "자산유형 미정"}` |
| `심의 대기` 고정 칩 | `<span style={cssStr(statusChip(review.status))}>{review.status}</span>` |
| `{caseItem?.company \|\| "대성정밀공업 인수"}` | `{review.company}` |
| `{caseItem?.sector \|\| "자동차 부품"} · 안건번호 IC-2026-047` | `{review.sector || "업종 미정"} · 안건번호 IC-{review.received?.slice(0, 4)}-{String(review.id).padStart(3, "0")}` |
| 헤더 스탯 4개 배열 | `[["총 투자비", review.investStr, ""], ["기준가", review.baseStr, ""], ["접수일", review.received, ""]]` (인수 배수 항목 삭제) |
| AI 분석 박스 `82` / `조건부 투자 승인` | `{review.scoreStr}` / `<span style={cssStr(review.recStyle)}>{review.aiRec || "AI 분석 전"}</span>` |
| 진행 단계 `timeline.map` | 그대로(변수명이 같다) |
| AI 점수 패널 `82`, `scores.map` | `{review.scoreStr}`, `detail ? detail.scores.map(...) : empty()` |
| AI 권고 카드 `조건부 투자 승인`, `conditions.map` | `{review.aiRec || "AI 분석 전"}`, `detail ? detail.conditions.map(...) : empty()` |
| ① 개요 두 문단 | `detail ? detail.summary.split("\n").filter(Boolean).map((p, i) => <p key={i} style={...}>{p}</p>) : empty()` |
| ② 재무 표 헤더 2023/2024/2025 고정 | `detail.years.map((y) => <div key={y} style={{ textAlign: "right" }}>{y}</div>)`, 행은 `detail.years.map((y) => <div key={y} style={{ textAlign: "right", color: f.warn ? "#B02A30" : undefined }}>{f.values[y] ?? "—"}</div>)`. gridTemplateColumns는 `` `1.4fr ${"1fr ".repeat(detail.years.length)}` `` |
| ③~⑧ `claims, perspectives, redTeam, pros, cons, scores, mapRows, criticalGaps, normalGaps` | 각각 `detail.xxx`, `detail` null이면 `empty()` |
| ⑦ 권고 칩·문단 | `{review.aiRec || "AI 분석 전"}`, `{detail?.recommendationReason}` |

- [ ] **Step 4: 접수 정보 편집 폼**

헤더 카드 안, 스탯 행 아래에 추가:

```jsx
          <IntakeForm review={data} onSaved={reload} />
```

파일 끝에 컴포넌트 추가:

```jsx
// 접수 정보는 AI가 1차 추출하지만 틀릴 수 있다. 한 번 고치면 이후 AI 재파싱이 덮어쓰지 않는다(서버 manual_edited).
function IntakeForm({ review, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!open)
    return (
      <button onClick={() => { setForm({ company: review.company || "", assetType: review.assetType || "", sector: review.sector || "", totalInvest: review.totalInvest ?? "", basePrice: review.basePrice ?? "", reviewLevel: review.reviewLevel || "" }); setOpen(true); }} style={{ ...backBtn, marginTop: 14, marginBottom: 0 }}>
        ✎ 접수 정보 수정
      </button>
    );
  async function save() {
    setSaving(true);
    try {
      await patchReview(review.id, {
        company: form.company || null,
        assetType: form.assetType || null,
        sector: form.sector || null,
        totalInvest: form.totalInvest === "" ? null : Number(form.totalInvest),
        basePrice: form.basePrice === "" ? null : Number(form.basePrice),
        reviewLevel: form.reviewLevel || null,
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14, maxWidth: 560 }}>
      <input style={input} placeholder="안건명" value={form.company} onChange={set("company")} />
      <select style={input} value={form.assetType} onChange={set("assetType")}>
        <option value="">자산유형</option>
        {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input style={input} placeholder="업종" value={form.sector} onChange={set("sector")} />
      <input style={input} type="number" placeholder="총 투자비(억원)" value={form.totalInvest} onChange={set("totalInvest")} />
      <input style={input} type="number" placeholder="기준가(억원)" value={form.basePrice} onChange={set("basePrice")} />
      <select style={input} value={form.reviewLevel} onChange={set("reviewLevel")}>
        <option value="">검토 수준</option>
        {REVIEW_LEVELS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ ...input, width: "auto", background: colors.primary, color: "#fff", border: "none", cursor: "pointer" }}>저장</button>
        <button onClick={() => setOpen(false)} style={{ ...input, width: "auto", cursor: "pointer" }}>취소</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 위원회 결정 폼 (기존 "위원 심의 · 의결" 카드 교체)**

기존 `위원 심의 · 의결` 카드 전체(`<div style={{ ...card, marginTop: 16, overflow: "hidden" }}>` 부터 그 닫힘까지)를 다음으로 교체. 위원별 의견 목록은 데이터 출처가 없으므로 뺀다.

```jsx
      <div style={{ ...card, marginTop: 16, overflow: "hidden" }}>
        <div style={{ background: colors.navy, color: "#fff", padding: "15px 24px", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>위원회 최종 결정</span>
          <span style={{ fontSize: 11, color: "#9DB0C7", marginLeft: 6 }}>최종 결정 영역 · AI 분석과 별개</span>
        </div>
        <DecisionForm review={data} onSaved={reload} />
      </div>
```

파일 끝에 추가:

```jsx
// 위원회 결정을 넣으면 status 가 '완료'가 되고, 비우면 '심의 대기'로 돌아간다(서버 규칙).
function DecisionForm({ review, onSaved }) {
  const [committee, setCommittee] = useState(review.committee || "");
  const [note, setNote] = useState(review.committeeNote || "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await patchReview(review.id, { committee: committee || null, committeeNote: note || null });
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ padding: "22px 24px", display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {["", ...COMMITTEES].map((v) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${committee === v ? colors.navy : colors.border}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontSize: 13 }}>
            <input type="radio" name="committee" value={v} checked={committee === v} onChange={() => setCommittee(v)} />
            {v || "미결 (심의 전)"}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} placeholder="의결 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={save} disabled={saving} style={{ background: colors.navy, color: "#fff", border: "none", borderRadius: 9, padding: 12, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          {saving ? "저장 중…" : "최종 의결 확정"}
        </button>
        {review.decidedAt && <div style={{ fontSize: 11, color: colors.textMuted }}>결정일 {review.decidedAt}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 대화 이력 섹션**

⑧ 섹션 뒤(보고서 카드 안, 마지막 `</div>` 앞)에 추가:

```jsx
          {divider}
          <div id="s9" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑨", "대화 이력")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.turns.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "78%", background: colors.primary, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "12px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {t.payload.files?.length > 0 && <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>📎 {t.payload.files.map((f) => f.name).join(", ")}</div>}
                      {t.payload.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: colors.primaryLight, color: "#3B5A86", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>AI</div>
                    <AiMessage data={t.payload.reduce(applyEvent, newLiveMessage())} />
                  </div>
                )
              )}
            </div>
          </div>
```

- [ ] **Step 7: `detailData.js` 삭제·빌드**

```bash
git rm -q frontend/src/detailData.js
cd frontend && npm run build
```
Expected: 오류 없음. `grep -rn detailData frontend/src` 결과 없음.

- [ ] **Step 8: 화면 확인**

브라우저에서 안건 목록 → 안건 클릭:
- 보고서 없는 안건: 각 섹션에 "AI 분석 결과가 아직 없습니다", 헤더 점수 "—".
- 접수 정보 수정 → 저장 → 헤더에 반영, 목록으로 돌아가도 반영.
- 위원회 결정 "부결" 저장 → 상태 칩 "완료", 대시보드 승인율·일치율 변동. "미결"로 되돌리면 "심의 대기".
- 대화 이력에 사용자 말풍선과 AI 답변(도구 블록 포함)이 새 심의 요청 화면과 같은 모양으로 보임.

- [ ] **Step 9: 커밋**

```bash
git add frontend/src/CaseDetail.jsx frontend/src/reportView.js frontend/src/Markdown.jsx
git commit -m "feat: 안건상세를 저장된 보고서·대화 이력으로 표시하고 접수 정보·위원회 결정 입력"
```

---

### Task 8: 실제 심의 1건으로 끝까지 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 실제 심의 실행**

새 심의 요청 화면에서 IM 1건 첨부 후 심의 요청. HITL 질문이 오면 후속 답변으로 진행해 최종 보고서까지 받는다.

- [ ] **Step 2: 확인 항목**

- 대화창 마지막 답변 끝에 json 블록이 **보이지 않는다** (Markdown.jsx strip).
- 서버 로그에 "보고서 json 블록 파싱 실패"가 없다. 있으면 `python -c "import db; print(db.get_review(<id>)['turns'][-1]['payload'][-3:])"`로 원문 확인 후 `REPORT_INSTRUCTION` 문구를 다듬는다.
- 안건 목록에 회사명·자산유형·AI 총점·권고가 채워지고 상태가 "심의 대기".
- 안건 상세 ①~⑧ 섹션이 채워짐. 재무 표 연도가 보고서 기준으로 나옴.
- 후속 턴(스펙 5.1)에서도 json이 붙는지: "보고서를 다시 정리해줘"로 한 턴 더 보내 파싱되는지 확인. 안 붙으면 `stream_continue`에도 `f"{message}\n\n{REPORT_INSTRUCTION}"`를 붙이도록 바꾸고 스펙 5.1의 유보 조항대로 기록한다.

- [ ] **Step 3: 스펙·README 갱신 후 커밋**

`backend/.env.example` 안내가 맞는지, `main.py` 모듈 docstring 실행 안내에 `DATABASE_URL` 필요를 한 줄 추가.

```bash
git add backend/main.py
git commit -m "docs: 심의 이력 저장소 기동 요건 안내"
```

---

## Self-Review 결과

- **스펙 커버리지**: 3절 저장소(Task 2), 4절 모델·status(Task 2), 5.1 지시문(Task 3), 5.2 스키마(Task 1 `REPORT_SCHEMA`), 5.3 파싱·manual_edited(Task 1·2), 5.4 표시 제거(Task 7), 6절 API(Task 3·4), 7절 프론트(Task 5·6·7), 8절 오류 처리(Task 3 `record`, Task 6 `AsyncStatus`), 9절 검증(Task 1·2·4 테스트, Task 8 수동). 스펙의 `meta.reviewId`는 Task 3에서 싣고 프론트는 쓰지 않는다(스펙 7절과 일치).
- **타입 일관성**: `db.update_review`는 snake_case, 라우트가 `_SNAKE`로 변환. `_summary` 키(`aiRec, aiScore, received, decidedAt`)와 `decorate()`·`computeStats()`·`timelineFor()`가 읽는 키가 같다. `review.stage`는 `decorate()`가 넣는다.
- **미해결 가정**: 지시문이 후속 턴까지 유지되는지는 실측 필요(Task 8 Step 2에 대응 경로 명시).
