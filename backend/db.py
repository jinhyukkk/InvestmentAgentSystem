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
