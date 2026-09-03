# 심의 이력 저장 및 대시보드·안건목록·안건상세 연동 설계

작성일: 2026-09-03

## 1. 배경과 목표

현재 백엔드(`backend/main.py`)는 웍스AI 스트림을 릴레이만 하고 아무것도 저장하지 않는다.
대시보드·안건목록·안건상세는 `frontend/src/mockData.js`, `detailData.js`의 정적 목업으로 동작한다.

목표: 새 심의 요청에서 진행된 심의를 서버에 저장하고, 그 이력을 대시보드·안건목록·안건상세에서
실제 데이터로 확인할 수 있게 한다.

제약
- 배포 환경 DB는 PostgreSQL만 사용 가능하다.
- 에이전트 최종 보고서는 자유 형식 마크다운이다. 총점·권고·5대 항목 점수는 구조화돼 오지 않는다.
- 위원회 결정(승인·조건부 승인·부결·재상정)은 AI가 알 수 없는 값이다. 사람이 입력한다.

## 2. 접근 방식

채택: 백엔드가 스트림을 릴레이하면서 그대로 DB에 기록하고, 보고서 끝에 붙는 JSON 블록을 파싱해 구조화 필드를 채운다.

제외한 대안
- 웍스AI 대화 목록 API 의존: 구조화 데이터·위원회 결정을 둘 곳이 없고, API 존재도 미확인.
- 브라우저 localStorage: PC 한 대에서만 보인다.

## 3. 저장소

- PostgreSQL 단일 타깃. `DATABASE_URL` 환경변수 필수(`.env.example`에 예시 추가). 미설정 시 기동 실패.
- 드라이버 `psycopg[binary]`(v3), SQLAlchemy 2.x ORM. 로컬 개발도 같은 PostgreSQL을 쓴다. SQLite 폴백 없음.
- JSON 컬럼은 `JSONB`.
- 테이블 생성은 기동 시 `Base.metadata.create_all`. Alembic은 운영 후 첫 스키마 변경 때 도입한다.
- 파일 구성: `backend/db.py`(엔진·세션·모델), `backend/report.py`(JSON 추출), `backend/main.py`(라우트·스트림 후크).

## 4. 데이터 모델

```
reviews (안건 1건 = 웍스 대화 1개)
  id             serial PK
  chat_id        text UNIQUE NOT NULL      -- 웍스 chatId
  title          text NOT NULL             -- 사용자 첫 메시지 앞 24자
  company        text
  asset_type     text                      -- M&A | 실물자산 | 그린필드
  sector         text
  total_invest   numeric                   -- 억원
  base_price     numeric                   -- 억원
  review_level   text                      -- 예비 검토 | 본심의
  status         text NOT NULL             -- 검토 중 | 심의 대기 | 완료
  ai_score       integer                   -- 0~100
  ai_rec         text                      -- 투자 승인 | 조건부 투자 승인 | 추가 검토 후 재상정 | 투자 부적합
  report_json    jsonb                     -- 5절 스키마 전체
  manual_edited  boolean NOT NULL default false  -- 접수 필드를 사람이 정정했는지
  committee      text                      -- 승인 | 조건부 승인 | 부결 | 재상정
  committee_note text
  decided_at     timestamptz
  files_json     jsonb                     -- [{filename, original, size}]
  created_at     timestamptz NOT NULL default now()
  reported_at    timestamptz               -- JSON 블록을 처음 파싱한 시각
  updated_at     timestamptz NOT NULL

turns (대화 이력)
  id            serial PK
  review_id     integer FK reviews.id ON DELETE CASCADE
  role          text NOT NULL              -- user | ai
  payload_json  jsonb NOT NULL
  created_at    timestamptz NOT NULL default now()
  index (review_id, id)
```

payload_json
- user: `{"text": "...", "files": [{"name", "size"}]}`
- ai: 백엔드가 릴레이한 스트림 이벤트 원본 배열(`text-delta`, `reasoning-delta`, `tool-*`, `finish`, `file-uploaded`, `file-error`, `error`).
  프론트는 기존 `streamReducer.applyEvent`로 순서대로 재생해 `AiMessage`에 그린다. 별도 변환 계층을 두지 않는다.

status 전이(서버가 결정)
- 생성 시 `검토 중`
- 턴 종료 시 JSON 블록 파싱에 성공하면 `심의 대기`
- PATCH로 `committee`가 채워지면 `완료`. `committee`를 null로 되돌리면 `심의 대기`로 복귀.

## 5. 구조화 추출

### 5.1 지시문 주입
`stream_new_review`에서 사용자 실제 메시지(파일 안내문 뒤) 끝에 다음을 덧붙인다. 후속 턴(`stream_continue`)에는 붙이지 않는다. 같은 대화 안에서 지시가 유지된다는 전제이며, 유지되지 않는 것이 실측되면 후속 턴에도 짧게 반복한다.

```
[출력 규칙] 최종 투자심의 결과보고서를 낼 때는 본문 맨 끝에 아래 스키마를 그대로 채운
json 코드 블록을 반드시 포함할 것. 중간 단계 답변에는 붙이지 말 것. 값을 알 수 없는 항목은 null.
{ ...5.2 스키마... }
```

### 5.2 JSON 스키마 (현재 `detailData.js` 모양과 1:1)

```json
{
  "report_version": 1,
  "company": "대성정밀공업 인수",
  "asset_type": "M&A",
  "sector": "자동차 부품",
  "total_invest": 1850,
  "base_price": 1720,
  "review_level": "본심의",
  "total_score": 82,
  "recommendation": "조건부 투자 승인",
  "recommendation_reason": "권고 근거 2~3문장",
  "summary": "안건 개요 2문단(사업 내용, 투자 규모와 핵심 판단 근거)",
  "scores": [
    {"label": "전략적 적합성", "max": 20, "value": 17},
    {"label": "가격 매력도", "max": 25, "value": 21},
    {"label": "현금 회수 가시성", "max": 20, "value": 16},
    {"label": "리스크 통제", "max": 20, "value": 15},
    {"label": "실행 가능성", "max": 15, "value": 13}
  ],
  "conditions": ["..."],
  "pros": ["..."],
  "cons": ["..."],
  "claims": [{"claim": "...", "tag": "확인됨|과장 가능성|근거 부족|반대 시나리오 존재"}],
  "perspectives": [{"name": "외부투자자 관점", "summary": "..."}],
  "red_team": {"weak": ["..."], "worst": "..."},
  "map_rows": [{"a": "취약 가정", "c": "선행 조건", "s": "충족|진행 중|미충족"}],
  "critical_gaps": ["..."],
  "normal_gaps": ["..."],
  "financials": [{"label": "매출액", "values": {"2023": "1,740", "2024": "1,920", "2025": "2,080"}, "warn": false}]
}
```

### 5.3 파싱 규칙 (`backend/report.py`, `extract_report(text) -> dict | None`)
- 턴의 `text-delta`를 이어 붙인 전체 텍스트에서 **마지막** json 펜스 블록을 찾는다.
- `json.loads` 실패, 객체가 아님, `total_score`가 0~100 정수가 아님 → `None`. 서버 로그에 warning만 남기고 사용자에게는 알리지 않는다.
- 성공 시 `reviews`에 `ai_score, ai_rec, report_json, reported_at` 갱신. 접수 필드(`company, asset_type, sector, total_invest, base_price, review_level`)는 `manual_edited=false`일 때만 갱신한다. 사람이 정정한 값을 AI가 덮어쓰지 않기 위함.
- 값 정규화: `asset_type`, `recommendation`, `review_level`은 허용 목록 밖이면 null.

### 5.4 화면 표시
- `frontend/src/Markdown.jsx`에서 텍스트 끝의 json 펜스 블록을 제거한 뒤 렌더링한다. 스트리밍 중 아직 닫히지 않은 펜스는 그대로 둔다(닫히면 사라짐).

## 6. API

기존
- `POST /api/review`: `meta` 이벤트 시점에 `reviews` 생성(status `검토 중`, title = 메시지 앞 24자). 사용자 메시지를 `turns`에 저장. `file-uploaded`는 `files_json`에 누적. `turn-start`~`turn-end` 사이 이벤트를 모아 `turn-end`에서 ai 턴으로 저장하고 5.3 파싱을 돌린다. 자리표시자 턴("자료를 첨부할게")은 저장하지 않는다.
- `POST /api/review/{chat_id}/message`: chat_id로 `reviews`를 찾아 user·ai 턴 저장, 5.3 파싱. 못 찾으면 404.
- 스트림 응답 형식은 바뀌지 않는다. `meta` 이벤트에 `reviewId`를 추가로 싣는다.

신규
- `GET /api/reviews?asset_type=&status=`: `created_at desc`. `report_json`·turns 제외. 응답 필드는 `mockData.cases` 항목과 이름을 맞춘다(`id, company, assetType, sector, totalInvest, basePrice, received, status, reviewLevel, aiScore, aiRec, committee, decidedAt`). `company`가 null이면 `title`을 대신 싣는다. `stage`·`awaitInput`은 프론트가 status에서 계산한다.
- `GET /api/reviews/{id}`: 위 필드 + `reportJson, committeeNote, reportedAt, files, turns[]`.
- `PATCH /api/reviews/{id}`: 본문 필드 `company, assetType, sector, totalInvest, basePrice, reviewLevel, committee, committeeNote` 중 보낸 것만 갱신. 접수 필드가 하나라도 오면 `manual_edited=true`. `committee` 규칙은 4절 status 전이. 허용 목록 밖 값은 422.

대시보드 통계는 별도 엔드포인트 없이 프론트가 목록 응답에서 계산한다. 안건이 수천 건이 되면 집계 엔드포인트를 추가한다.

## 7. 프론트엔드 변경

- `api.js`: `fetchReviews(params)`, `fetchReview(id)`, `patchReview(id, body)` 추가.
- `mockData.js`: `cases, statCards, matchBars` 삭제. `decorate, fmt, levelStyle, statusChip, steps` 유지. `stage` 계산 추가: `검토 중`→1, `심의 대기`→6, `완료`→7.
- `Dashboard.jsx`: 마운트 시 `fetchReviews()`. 통계 카드·일치율 막대는 응답에서 계산(`decorate`의 `matchLabel` 재사용). "이번 분기 완료"는 `decidedAt`이 현재 분기인 건. 로딩·빈 상태·백엔드 미기동 문구 표시.
- `CaseList.jsx`: 동일하게 `fetchReviews()`. 자산유형 필터는 클라이언트에서 적용.
- `CaseDetail.jsx`: `caseItem.id`로 `fetchReview`. 섹션 데이터는 `reportJson`을 `detailData.js`와 같은 모양으로 가공하는 함수 하나(`toDetail(reportJson)`)를 두고, `reportJson`이 null이면 각 섹션에 "AI 분석 결과가 아직 없습니다" 표시. 추가 UI 두 가지:
  1. 헤더 카드의 접수 정보와 위원회 결정 편집 폼(select + 메모 textarea + 저장 버튼 → PATCH → 재조회).
  2. 대화 이력 섹션: `turns`를 순서대로 렌더링. user는 말풍선, ai는 이벤트 배열을 `applyEvent`로 reduce해 `AiMessage`. 읽기 전용.
- 진행 단계 타임라인: 날짜는 `received`(접수), `reportedAt`(종합), `decidedAt`(최종 결정)만 실제값, 나머지 "—".
- `detailData.js`: 삭제. `steps`는 `mockData.js`에 이미 있다.
- `RequestScreen.jsx`: 변경 없음. `meta`의 `reviewId`는 이번 범위에서 쓰지 않는다.

## 8. 오류 처리

- DB 저장 실패는 스트림을 끊지 않는다. 로그만 남기고 릴레이를 계속한다. 심의 자체가 저장 장애로 중단되면 안 된다.
- JSON 파싱 실패는 사용자에게 알리지 않는다. 상세 화면에 "AI 분석 결과 없음"으로 드러난다.
- 프론트는 목록·상세 조회 실패 시 기존 `api.js`의 오프라인 판별 문구를 재사용한다.

## 9. 검증

- `backend/test_report.py`: `extract_report` 정상·JSON 없음·깨진 JSON·마지막 블록 선택 4케이스.
- `backend/test_api.py`: PATCH의 status 전이(committee 입력→완료, 해제→심의 대기), 허용 목록 밖 값 422. `DATABASE_URL`이 테스트용 DB를 가리킨다.
- 수동: 실제 심의 1건 실행 → 목록·대시보드·상세에 반영, 위원회 결정 입력 후 대시보드 일치율 변동 확인.

## 10. 범위 밖 (다음 단계)

- 안건상세에서 "이어서 대화"(chatId 재개). 저장 구조는 이미 지원한다.
- 통계·리포트 메뉴, 사용자 인증·권한, Alembic 마이그레이션, 안건 삭제.
