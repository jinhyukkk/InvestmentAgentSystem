// 목업(유진그룹 투자심의 시스템.html)의 JS 데이터 모델을 그대로 이식.
// 대시보드/안건목록/상세는 아직 실제 백엔드(케이스 저장소)가 없어 임시 목업 데이터로 구성.

export const steps = ["접수", "자료 분석", "외부 데이터 수집", "정보 보강", "4관점 분석", "종합", "심의 상정", "최종 결정"];

export const cases = [
  { id: "c1", company: "대성정밀공업 인수", assetType: "M&A", sector: "자동차 부품", totalInvest: 1850, basePrice: 1720, received: "2026-05-12", status: "심의 대기", reviewLevel: "본심의", aiScore: 82, aiRec: "조건부 투자 승인", committee: null, stage: 6 },
  { id: "c2", company: "송도 스마트 물류센터", assetType: "실물자산", sector: "물류 인프라", totalInvest: 2400, basePrice: 2400, received: "2026-04-28", status: "검토 중", reviewLevel: "본심의", aiScore: 76, aiRec: "조건부 투자 승인", committee: null, stage: 4, awaitInput: true },
  { id: "c3", company: "베트남 흥옌 2차전지 소재공장", assetType: "그린필드", sector: "배터리 소재", totalInvest: 3200, basePrice: null, received: "2026-06-02", status: "검토 중", reviewLevel: "예비 검토", aiScore: 68, aiRec: "추가 검토 후 재상정", committee: null, stage: 3, provisional: true },
  { id: "c9", company: "분당 프라임 오피스타워", assetType: "실물자산", sector: "상업용 부동산", totalInvest: 1450, basePrice: 1450, received: "2026-05-30", status: "심의 대기", reviewLevel: "본심의", aiScore: 71, aiRec: "조건부 투자 승인", committee: null, stage: 6 },
  { id: "c8", company: "울산 그린수소 생산플랜트", assetType: "그린필드", sector: "에너지", totalInvest: 2750, basePrice: null, received: "2026-06-15", status: "검토 중", reviewLevel: "예비 검토", aiScore: null, aiRec: null, committee: null, stage: 1 },
  { id: "c4", company: "평택 하이퍼스케일 데이터센터", assetType: "실물자산", sector: "IT 인프라", totalInvest: 2100, basePrice: 2050, received: "2026-03-10", status: "완료", reviewLevel: "본심의", aiScore: 88, aiRec: "투자 승인", committee: "승인", stage: 7 },
  { id: "c5", company: "광양 특수강 합작법인", assetType: "M&A", sector: "철강", totalInvest: 1680, basePrice: 1590, received: "2026-02-24", status: "완료", reviewLevel: "본심의", aiScore: 79, aiRec: "조건부 투자 승인", committee: "조건부 승인", stage: 7 },
  { id: "c7", company: "창원 정밀기계 인수", assetType: "M&A", sector: "기계", totalInvest: 940, basePrice: 910, received: "2026-01-30", status: "완료", reviewLevel: "본심의", aiScore: 84, aiRec: "투자 승인", committee: "조건부 승인", stage: 7 },
  { id: "c6", company: "인도네시아 니켈 제련소", assetType: "그린필드", sector: "비철금속", totalInvest: 3600, basePrice: null, received: "2026-02-08", status: "완료", reviewLevel: "본심의", aiScore: 61, aiRec: "추가 검토 후 재상정", committee: "부결", stage: 7 },
  { id: "c10", company: "천안 반도체 후공정 인수", assetType: "M&A", sector: "반도체", totalInvest: 1220, basePrice: 1180, received: "2026-01-15", status: "완료", reviewLevel: "본심의", aiScore: 45, aiRec: "투자 부적합", committee: "부결", stage: 7 },
];

export function fmt(n) {
  return n == null ? "—" : n.toLocaleString("ko-KR") + "억원";
}

const recMap = {
  "투자 승인": { c: "#0F7A55", bg: "#E6F4EE", short: "승인" },
  "조건부 투자 승인": { c: "#9A6B10", bg: "#FaF0D8", short: "조건부" },
  "추가 검토 후 재상정": { c: "#3B5A86", bg: "#E9EEF6", short: "재상정" },
  "투자 부적합": { c: "#B02A30", bg: "#FaEaEb", short: "부적합" },
};
const comMap = {
  승인: { c: "#0F7A55", bg: "#E6F4EE" },
  "조건부 승인": { c: "#9A6B10", bg: "#FaF0D8" },
  부결: { c: "#B02A30", bg: "#FaEaEb" },
  재상정: { c: "#3B5A86", bg: "#E9EEF6" },
};

export function levelStyle(lv, sm) {
  const pad = sm ? "1px 6px" : "3px 9px";
  const fs = sm ? "10px" : "11px";
  if (lv === "본심의")
    return `flex-shrink:0;white-space:nowrap;font-size:${fs};font-weight:600;color:#274A72;background:#E7EEF6;border:1px solid #D3E0EE;padding:${pad};border-radius:5px;`;
  return `flex-shrink:0;white-space:nowrap;font-size:${fs};font-weight:600;color:#7A6A3E;background:#F5EFE0;border:1px solid #E7DCC0;padding:${pad};border-radius:5px;`;
}

export function decorate(c) {
  const r = c.aiRec ? recMap[c.aiRec] : { c: "#9AA3AF", bg: "#F1F3F6", short: "진행 중" };
  const co = c.committee ? comMap[c.committee] : { c: "#9AA3AF", bg: "#F1F3F6" };
  const chip = (col) => `display:inline-block;font-size:11px;font-weight:600;color:${col.c};background:${col.bg};padding:3px 9px;border-radius:20px;white-space:nowrap;`;
  const chipSm = (col) => `display:inline-block;font-size:10.5px;font-weight:600;color:${col.c};background:${col.bg};padding:2px 8px;border-radius:16px;white-space:nowrap;`;
  let match = "—",
    matchC = { c: "#9AA3AF", bg: "#F1F3F6" };
  if (c.committee && c.aiRec) {
    const ok = r.short === { 승인: "승인", "조건부 승인": "조건부", 부결: "부적합", 재상정: "재상정" }[c.committee];
    if (ok) {
      match = "일치";
      matchC = { c: "#0F7A55", bg: "#E6F4EE" };
    } else if (r.short === "승인" && c.committee === "조건부 승인") {
      match = "부분";
      matchC = { c: "#9A6B10", bg: "#FaF0D8" };
    } else {
      match = "불일치";
      matchC = { c: "#B02A30", bg: "#FaEaEb" };
    }
  }
  return Object.assign({}, c, {
    investStr: fmt(c.totalInvest),
    baseStr: fmt(c.basePrice),
    scoreStr: c.aiScore == null ? "—" : String(c.aiScore),
    scoreBar: `width:${c.aiScore || 0}%;height:100%;background:${c.aiScore >= 80 ? "#3E8ED0" : c.aiScore >= 65 ? "#C79A3A" : "#C86B63"};border-radius:3px;`,
    recStyle: chip(r),
    recStyleSm: chipSm(r),
    aiRecShort: r.short,
    comStyle: c.committee ? chipSm(co) : "font-size:11px;color:#B4BCC7;",
    comLabel: c.committee || "심의 전",
    matchStyle: chipSm(matchC),
    matchLabel: match,
    stageLabel: c.awaitInput ? "입력 대기 중" : steps[c.stage],
    awaitLabel: c.awaitInput ? "입력 대기" : "",
    awaitStyle: c.awaitInput
      ? "display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#9A6B10;background:#FaF0D8;border:1px solid #EDD9A8;padding:2px 7px;border-radius:20px;"
      : "display:none;",
    levelStyleStr: levelStyle(c.reviewLevel, false),
    levelStyleSmStr: levelStyle(c.reviewLevel, true),
  });
}

export function statusChip(st) {
  const m = { "검토 중": { c: "#3B5A86", bg: "#E9EEF6" }, "심의 대기": { c: "#9A6B10", bg: "#FaF0D8" }, 완료: { c: "#5A6473", bg: "#EEF1F4" } }[st] || {
    c: "#5A6473",
    bg: "#EEF1F4",
  };
  return `display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:${m.c};background:${m.bg};padding:3px 9px;border-radius:20px;white-space:nowrap;`;
}

export const statCards = [
  { label: "검토 중", value: "3", unit: "건", delta: "AI 분석 진행", deltaColor: "#3B5A86" },
  { label: "심의 대기", value: "2", unit: "건", delta: "상정 완료", deltaColor: "#9A6B10" },
  { label: "이번 분기 완료", value: "12", unit: "건", delta: "전분기 대비 +3", deltaColor: "#0F7A55" },
  { label: "승인율", value: "67", unit: "%", delta: "승인·조건부 8 / 12", deltaColor: "#8A94A3" },
];

export const matchBars = [
  { label: "일치", count: "3건", pct: 75, color: "#0F7A55" },
  { label: "부분 일치", count: "1건", pct: 25, color: "#C79A3A" },
  { label: "불일치", count: "1건", pct: 25, color: "#C86B63" },
];
