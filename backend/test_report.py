# ponytail: 회귀 체크 5개 — 실행: python test_report.py
#  1) 정상 json 블록이 dict로 나오고 허용 목록 밖 값은 null이 되는지
#  2) json 블록이 없으면 None
#  3) 깨진 json / total_score 범위 밖이면 None
#  4) 블록이 여러 개면 마지막 것을 쓰는지
#  5) 닫는 ``` 앞에 개행이 없어도(한 줄짜리 블록 등) 추출되는지
#  6) total_score 가 문자열·실수면 정수로 보정되고, 없거나 범위 밖·불린이면 점수만 미상으로 두고 본문은 살리는지
#  7) 스키마 예시를 그대로 되돌려준 블록은 실데이터로 받지 않는지
from report import REPORT_SCHEMA, extract_report

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
    # 파싱 불가·dict 아님만 폐기한다. 점수 이상은 아래 test_score 참고(보고서는 살린다)
    assert extract_report("```json\n{broken\n```") is None
    assert extract_report('```json\n[1, 2]\n```') is None


def test_score():
    # 숫자 문자열·실수는 정수로 보정
    assert extract_report('```json\n{"total_score": "82"}\n```')["total_score"] == 82
    assert extract_report('```json\n{"total_score": 82.5}\n```')["total_score"] == 82
    # 점수를 알 수 없어도(null·범위 밖·불린·누락) 보고서 본문은 그대로 살아야 한다
    for block, label in (
        ('{"total_score": null, "company": "대성정밀"}', "null"),
        ('{"total_score": 130, "company": "대성정밀"}', "범위 밖"),
        ('{"total_score": true, "company": "대성정밀"}', "불린"),
        ('{"company": "대성정밀"}', "누락"),
        # json.loads 는 표준 밖인 NaN/Infinity 리터럴도 float로 받고, "1e999"도 inf로 파싱된다 —
        # int() 에 그대로 넣으면 ValueError/OverflowError 가 나 보고서 전체가 사라지던 회귀
        ('{"total_score": NaN, "company": "대성정밀"}', "NaN"),
        ('{"total_score": Infinity, "company": "대성정밀"}', "Infinity"),
        ('{"total_score": 1e999, "company": "대성정밀"}', "1e999"),
    ):
        r = extract_report(f"```json\n{block}\n```")
        assert r is not None, f"{label} 점수 때문에 보고서 전체가 버려짐"
        assert r["total_score"] is None, f"{label} 은 점수 미상이어야 함"
        assert r["company"] == "대성정밀", f"{label}: 나머지 필드는 보존돼야 함"


def test_schema_echo():
    # 스키마 예시를 그대로 되돌려주면 "안건명(회사명 또는 자산명)" 같은 자리표시자가 실데이터로 저장된다
    # (enum 필드 3개가 전부 " | " 선택지 문법이라 통째 폐기)
    assert extract_report(f"```json\n{REPORT_SCHEMA}\n```") is None


def test_schema_echo_single_field_hedge():
    # enum 필드 하나만 "M&A | 실물자산" 처럼 스키마 선택지를 얼버무린 경우는 모델이 그 필드만
    # 확신 못한 헤징일 뿐 나머지는 실데이터일 수 있다 — 그 필드만 null 처리하고 보고서는 살린다
    block = '{"total_score": 82, "company": "대성정밀", "asset_type": "M&A | 실물자산", "review_level": "본심의"}'
    r = extract_report(f"```json\n{block}\n```")
    assert r is not None, "필드 하나의 헤징 때문에 보고서 전체가 버려짐"
    assert r["asset_type"] is None, "헤징된 필드는 null 이어야 함"
    assert r["company"] == "대성정밀" and r["review_level"] == "본심의", "헤징과 무관한 필드는 보존돼야 함"


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
    test_score()
    test_schema_echo()
    test_schema_echo_single_field_hedge()
    test_last_block_wins()
    test_no_newline_before_close()
    print("test_report OK")
