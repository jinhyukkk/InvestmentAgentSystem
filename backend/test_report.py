# ponytail: 회귀 체크 5개 — 실행: python test_report.py
#  1) 정상 json 블록이 dict로 나오고 허용 목록 밖 값은 null이 되는지
#  2) json 블록이 없으면 None
#  3) 깨진 json / total_score 범위 밖이면 None
#  4) 블록이 여러 개면 마지막 것을 쓰는지
#  5) 닫는 ``` 앞에 개행이 없어도(한 줄짜리 블록 등) 추출되는지
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


def test_no_newline_before_close():
    # 한 줄짜리 블록: 본문 뒤에 바로 ``` 가 붙는 경우
    assert extract_report('```json\n{"total_score": 82}```')["total_score"] == 82
    # 여러 줄인데 마지막 줄이 개행 없이 ``` 로 바로 이어지는 경우
    multi = '```json\n{"total_score": 82,\n"company": "가"}```'
    assert extract_report(multi)["total_score"] == 82
    # 본문 마지막 글자가 백틱 하나인 경우(닫는 펜스의 ``` 세 개와 혼동되지 않아야 함)
    backtick_body = '```json\n{"total_score": 82, "note": "end`"}```'
    r = extract_report(backtick_body)
    assert r["total_score"] == 82
    assert r["note"] == "end`"
    # 블록 사이에 아무 구분자 없이 바로 이어붙어도 마지막 블록을 쓴다
    adjacent = '```json\n{"total_score": 1}``````json\n{"total_score": 2}```'
    assert extract_report(adjacent)["total_score"] == 2
    # 닫는 펜스 자체가 없으면(여는 펜스만) 여전히 매치되지 않아야 한다
    assert extract_report('```json\n{"total_score": 82}') is None


if __name__ == "__main__":
    test_good()
    test_missing()
    test_broken()
    test_last_block_wins()
    test_no_newline_before_close()
    print("test_report OK")
