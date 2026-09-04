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
