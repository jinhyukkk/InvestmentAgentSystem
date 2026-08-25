import { colors } from "./theme.js";

const PIPELINE = [
  { emoji: "📎", label: "자료 첨부", desc: "IM·사업계획서·재무모델 업로드" },
  { emoji: "🔍", label: "AI 사전 스캔", desc: "자산유형·기준가·핵심 지표 자동 추출" },
  { emoji: "⚖️", label: "4관점 심층 분석", desc: "외부투자자 → CFO → 감사실 → 레드팀 순차 검증" },
  { emoji: "📊", label: "결과보고서", desc: "5대 항목 점수 + 최종 권고의견" },
];

const PERSONAS = [
  { icon: "🧑‍💼", name: "외부투자자 관점", desc: "시장 매력도·경쟁 강도·Exit 가능성을 평가합니다." },
  { icon: "💰", name: "CFO 관점", desc: "재무 타당성·수익성·자금조달 구조를 검증합니다." },
  { icon: "🔎", name: "감사실 관점", desc: "법률·규제·내부통제·이해상충 리스크를 점검합니다." },
  { icon: "🚩", name: "레드팀 관점", desc: "투자 반대 논거와 매도자 측 편향을 전담 탐지합니다." },
];

const SOURCES = ["금융/기업 데이터", "금융감독원 전자공시(DART)", "국가통계포털(KOSIS)", "국가법령정보"];

export default function AgentIntro() {
  return (
    <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 14, padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: colors.primaryLight,
            color: "#3B5A86",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          AI
        </span>
        <div style={{ fontSize: 15, fontWeight: 700 }}>투자심의 에이전트는 이렇게 동작합니다</div>
      </div>
      <p style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.6, margin: "0 0 22px 39px" }}>
        IM·사업계획서 등 자료를 첨부하면, 4명의 전문가 관점을 순차 적용해 교차 검증한 뒤 하나의 투자심의 결과보고서로 정리합니다. AI 점수·권고는 참고 지표이며 최종 투자 결정은 위원회 의결 사항입니다.
      </p>

      {/* 파이프라인 흐름 */}
      <div style={{ display: "flex", marginBottom: 26 }}>
        {PIPELINE.map((step, i) => (
          <div key={step.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i > 0 && <div style={{ position: "absolute", top: 19, left: "-50%", right: "50%", height: 2, background: colors.border }} />}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: colors.primaryLight,
                border: `2px solid ${colors.primary}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                position: "relative",
                zIndex: 1,
              }}
            >
              {step.emoji}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 10, textAlign: "center" }}>{step.label}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3, textAlign: "center", lineHeight: 1.4, padding: "0 8px" }}>{step.desc}</div>
          </div>
        ))}
      </div>

      {/* 4관점 페르소나 */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5A6473", marginBottom: 10 }}>4관점 교차 검증</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {PERSONAS.map((p) => (
          <div key={p.name} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, padding: 13 }}>
            <div style={{ fontSize: 16, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.primary, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      {/* 연동 데이터 소스 */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5A6473", marginBottom: 10 }}>교차 검증에 사용하는 외부 데이터</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {SOURCES.map((s) => (
          <span
            key={s}
            style={{
              fontSize: 11.5,
              color: "#3A4656",
              background: "#F2F4F7",
              border: `1px solid ${colors.border}`,
              padding: "5px 11px",
              borderRadius: 20,
              fontWeight: 500,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
