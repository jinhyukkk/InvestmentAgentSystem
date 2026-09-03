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
