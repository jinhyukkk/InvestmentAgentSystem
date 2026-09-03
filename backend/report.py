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

# ponytail: 닫는 ``` 앞 개행은 선택(모델이 한 줄짜리 블록을 낼 수 있음). 여는 쪽 개행은 그대로 유지.
_FENCE = re.compile(r"```json\s*\n(.*?)\n?\s*```", re.DOTALL)
_ENUM_FIELDS = (("asset_type", ASSET_TYPES), ("review_level", REVIEW_LEVELS), ("recommendation", RECOMMENDATIONS))


def _coerce_score(value) -> int | None:
    """total_score 를 0~100 정수로 보정. 불린·해석 불가·범위 밖은 None(점수 미상).

    모델은 "82"·82.5 같은 모양도 흔히 낸다 — 이걸로 보고서 전체를 버리면 안 된다.
    불린은 파이썬에서 int 취급이라 명시적으로 먼저 막는다.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, str):
        try:
            value = float(value.strip())
        except ValueError:
            return None
    if not isinstance(value, (int, float)):
        return None
    score = int(value)
    return score if 0 <= score <= 100 else None


def extract_report(text: str | None) -> dict | None:
    """텍스트의 마지막 ```json 블록을 dict로. 블록이 없거나 깨졌거나 dict가 아니면 None.

    점수가 이상해도 보고서는 살린다(total_score 만 None). 점수 하나 때문에 15분짜리 심의
    결과 전체가 사라지고 안건이 '검토 중'에 영원히 묶이던 회귀 방지.
    """
    blocks = _FENCE.findall(text or "")
    if not blocks:
        logger.info("최종 답변에 ```json 블록이 없어 보고서를 추출하지 못함 (본문 %d자)", len(text or ""))
        return None
    try:
        data = json.loads(blocks[-1])
    except ValueError:
        logger.warning("보고서 json 블록 파싱 실패: %s", blocks[-1][:200])
        return None
    if not isinstance(data, dict):
        logger.warning("보고서 json 블록이 객체가 아님: %s", blocks[-1][:200])
        return None
    # 스키마 예시를 그대로 되돌려준 경우("M&A | 실물자산 | 그린필드" 같은 선택지 문법이 값에 남아있다).
    # 이대로 통과시키면 자리표시자 문구가 실데이터로 저장돼 모든 화면에 그대로 뜬다.
    for key, _ in _ENUM_FIELDS:
        value = data.get(key)
        if isinstance(value, str) and " | " in value:
            logger.warning("스키마 예시가 그대로 회신됨 — 보고서 폐기: %s=%r", key, value)
            return None
    score = _coerce_score(data.get("total_score"))
    if score is None:
        logger.warning("보고서 total_score 비정상 — 점수 미상으로 저장: %r", data.get("total_score"))
    data["total_score"] = score
    for key, allowed in _ENUM_FIELDS:
        if data.get(key) not in allowed:
            data[key] = None
    return data
