// 안건 표시용 스타일·계산 헬퍼. 데이터는 GET /api/reviews 에서 온다.

export const steps = ["접수", "자료 분석", "외부 데이터 수집", "정보 보강", "4관점 분석", "종합", "심의 상정", "최종 결정"];

export const ASSET_TYPES = ["M&A", "실물자산", "그린필드"];
export const REVIEW_LEVELS = ["예비 검토", "본심의"];
export const COMMITTEES = ["승인", "조건부 승인", "부결", "재상정"];

// 서버 status → 8단계 타임라인 위치. 세부 단계는 서버가 모르므로 세 지점만 쓴다.
const STAGE_BY_STATUS = { "검토 중": 1, "심의 대기": 6, 완료: 7 };

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
    stage: STAGE_BY_STATUS[c.status] ?? 0,
    stageLabel: steps[STAGE_BY_STATUS[c.status] ?? 0],
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

function quarterOf(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function quarterLabel(date = new Date()) {
  return `${date.getFullYear()}년 ${Math.floor(date.getMonth() / 3) + 1}분기`;
}

// decorate()를 거친 행 배열에서 대시보드 카드·일치율을 계산한다.
export function computeStats(rows) {
  const count = (pred) => rows.filter(pred).length;
  const done = rows.filter((c) => c.status === "완료");
  const thisQ = quarterOf(new Date().toISOString());
  const doneThisQ = done.filter((c) => c.decidedAt && quarterOf(c.decidedAt) === thisQ).length;
  const approved = done.filter((c) => c.committee === "승인" || c.committee === "조건부 승인").length;
  const approvalRate = done.length ? Math.round((approved / done.length) * 100) : 0;
  const matched = done.filter((c) => c.matchLabel !== "—");
  const pct = (n) => (matched.length ? Math.round((n / matched.length) * 100) : 0);
  const bar = (label, color) => {
    const n = matched.filter((c) => c.matchLabel === label).length;
    return { label: label === "부분" ? "부분 일치" : label, count: `${n}건`, pct: pct(n), color };
  };
  return {
    statCards: [
      { label: "검토 중", value: String(count((c) => c.status === "검토 중")), unit: "건", delta: "AI 분석 진행", deltaColor: "#3B5A86" },
      { label: "심의 대기", value: String(count((c) => c.status === "심의 대기")), unit: "건", delta: "보고서 완료", deltaColor: "#9A6B10" },
      { label: "이번 분기 완료", value: String(doneThisQ), unit: "건", delta: `전체 완료 ${done.length}건`, deltaColor: "#0F7A55" },
      { label: "승인율", value: String(approvalRate), unit: "%", delta: `승인·조건부 ${approved} / ${done.length}`, deltaColor: "#8A94A3" },
    ],
    approvalRate,
    approvedText: `완료 ${done.length}건 중 승인·조건부 ${approved}건`,
    matchRate: pct(matched.filter((c) => c.matchLabel === "일치").length),
    matchBars: [bar("일치", "#0F7A55"), bar("부분", "#C79A3A"), bar("불일치", "#C86B63")],
  };
}
