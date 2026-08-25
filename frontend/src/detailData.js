// 목업 상세 화면(대성정밀공업 인수)의 정적 데이터. 실제 케이스별 상세 데이터는
// 백엔드 케이스 저장소가 생기기 전까지 이 하나의 샘플로 대체(임시 목업).
import { steps } from "./mockData.js";

const tdates = ["05.12", "05.14", "05.18", "05.21", "05.26", "05.29", "06.01", "—"];
const cur = 6;

export const timeline = steps.map((label, i) => ({
  label,
  date: tdates[i],
  done: i <= cur,
  current: i === cur,
}));

const rawScores = [
  { label: "전략적 적합성", max: 20, value: 17 },
  { label: "가격 매력도", max: 25, value: 21 },
  { label: "현금 회수 가시성", max: 20, value: 16 },
  { label: "리스크 통제", max: 20, value: 15 },
  { label: "실행 가능성", max: 15, value: 13 },
];
export const scores = rawScores.map((s) => {
  const pct = s.value == null ? 0 : Math.round((s.value / s.max) * 100);
  const color = pct >= 80 ? "#3E8ED0" : pct >= 60 ? "#C79A3A" : "#C86B63";
  return { ...s, pct, color, valStr: s.value == null ? "자료 미도달" : `${s.value}` };
});

export const conditions = [
  "인수가 대비 순차입금 규모를 실사 확정치로 재산정, EV/EBITDA 7.5배 이내로 인수가 재협상",
  "핵심 고객사(현대·기아) 공급계약 3년 이상 연장 확약 확보",
  "노후 설비 재투자(CAPEX 400억원)를 반영한 통합 후 현금흐름 재검증",
];

const tagMap = {
  확인됨: { c: "#0F7A55", bg: "#E6F4EE" },
  "과장 가능성": { c: "#9A6B10", bg: "#FaF0D8" },
  "근거 부족": { c: "#5A6473", bg: "#EEF1F4" },
  "반대 시나리오 존재": { c: "#B02A30", bg: "#FaEaEb" },
};
export const claims = [
  { claim: "2027년 매출 2,400억원 달성 (연 12% 성장)", tag: "과장 가능성" },
  { claim: "주요 고객사 장기 공급계약 확보", tag: "확인됨" },
  { claim: "영업이익률 업계 상위 10% 유지", tag: "확인됨" },
  { claim: "신규 전기차 부품 라인 수주 잔고 800억원", tag: "근거 부족" },
  { claim: "경쟁사 신규 진입 장벽 높음", tag: "반대 시나리오 존재" },
].map((x) => ({ ...x, tagColor: tagMap[x.tag] }));

export const perspectives = [
  { name: "외부투자자 관점", summary: "시장 지위와 고객 기반은 견고하나, 인수 배수가 동종 대비 다소 높아 가격 협상 여지 필요." },
  { name: "CFO 관점", summary: "통합 후 연 250억 시너지 추정. 다만 순차입금 인수로 그룹 연결 레버리지 상승 부담." },
  { name: "감사 관점", summary: "재무제표 신뢰도 양호. 품질보증 충당금 등 우발부채 실사 자료 추가 확인 필요." },
];

export const redTeam = {
  weak: ["전기차 전환기 기존 부품 수요 예측의 낙관 편향", "핵심 고객 1개사 매출 의존도 58%", "노후 설비 재투자 규모 과소 추정"],
  worst: "주고객 물량 20% 이탈 시 3년 내 EBITDA 35% 감소, 투자 원금 회수 8년 이상 지연 가능.",
};

export const pros = [
  "자동차 부품 수직 계열화 완성으로 그룹 시너지 확보",
  "안정적 캐시카우 (영업현금흐름 연 320억원)",
  "국내 유일 정밀가공 라인 확보 — 높은 진입장벽",
];
export const cons = [
  "특정 고객(현대·기아) 매출 의존도 과다",
  "전기차 전환에 따른 기존 내연 부품 수요 축소 리스크",
  "인수 배수(EV/EBITDA 8.4배) 가격 부담",
];

const mapStatus = { 충족: { c: "#0F7A55", bg: "#E6F4EE" }, "진행 중": { c: "#9A6B10", bg: "#FaF0D8" }, 미충족: { c: "#B02A30", bg: "#FaEaEb" } };
export const mapRows = [
  { a: "전기차 전환기 부품 수요 낙관 가정", c: "수요 시나리오 보수적 재추정 + 계약 물량 확약", s: "미충족" },
  { a: "핵심 고객 매출 의존도 58%", c: "상위 고객 3년 이상 공급계약 연장 확약", s: "진행 중" },
  { a: "노후 설비 재투자 과소 추정", c: "CAPEX 400억원 반영 현금흐름 재검증", s: "미충족" },
].map((r) => ({ ...r, sColor: mapStatus[r.s] }));

export const criticalGaps = ["품질보증 우발부채 실사 자료 미제출 — 인수가 확정 및 최종 권고 제한 사유"];
export const normalGaps = ["최근 3개월 월별 수주 상세 내역", "핵심 인력 리텐션(잔류) 계획", "환헤지 정책 및 원자재 조달 계약서"];

const opMap = { 찬성: { c: "#0F7A55", bg: "#E6F4EE" }, 조건부: { c: "#9A6B10", bg: "#FaF0D8" }, 반대: { c: "#B02A30", bg: "#FaEaEb" } };
export const members = [
  { name: "박이사", role: "전략담당", op: "조건부", text: "전략적 시너지는 크나 레버리지 관리 조건 이행이 전제." },
  { name: "이상무", role: "재무담당", op: "조건부", text: "인수가 재협상을 전제로 찬성. 순차입금 규모 확정 필요." },
  { name: "최전무", role: "감사담당", op: "반대", text: "우발부채 미확인 상태에서 본심의 상정은 시기상조." },
  { name: "정부사장", role: "경영총괄", op: "찬성", text: "전략적 가치 충분, 조건 이행 전제로 신속 추진 권고." },
].map((m) => ({ ...m, opColor: opMap[m.op], initial: m.name[0] }));

export const financials = [
  { label: "매출액", y2023: "1,740", y2024: "1,920", y2025: "2,080" },
  { label: "영업이익", y2023: "158", y2024: "182", y2025: "205" },
  { label: "EBITDA", y2023: "212", y2024: "238", y2025: "262" },
  { label: "순차입금", y2023: "2,980", y2024: "3,120", y2025: "3,240", warn: true },
];

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
];
