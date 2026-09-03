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
