import { colors } from "./theme.js";

const navDef = [
  { key: "dashboard", label: "대시보드" },
  { key: "request", label: "새 심의 요청" },
  { key: "list", label: "안건 목록" },
  { key: "detail", label: "안건 상세" },
  { key: "stats", label: "통계·리포트", disabled: true },
];

function NavButton({ item, active, onClick }) {
  const base = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: item.disabled ? "default" : "pointer",
    background: active ? "rgba(255,255,255,0.08)" : "transparent",
    color: active ? "#fff" : item.disabled ? "#4E6182" : colors.navyText,
    fontWeight: active ? 700 : 500,
    opacity: item.disabled ? 0.55 : 1,
  };
  return (
    <button style={base} disabled={item.disabled} onClick={onClick} title={item.disabled ? "준비 중" : undefined}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "#5FB39A" : "#425A7A",
          flexShrink: 0,
        }}
      />
      <span>{item.label}</span>
    </button>
  );
}

export default function Sidebar({ screen, onNavigate }) {
  return (
    <aside
      style={{
        width: 236,
        flexShrink: 0,
        background: colors.navy,
        color: colors.navyText,
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: "linear-gradient(135deg,#2E6BB0,#1B4A82)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
            }}
          >
            유
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>유진그룹 투자심의</div>
            <div style={{ fontSize: 10.5, color: colors.navyMuted, letterSpacing: "0.02em" }}>
              Investment Committee
            </div>
          </div>
        </div>
      </div>
      <nav style={{ padding: 12, display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {navDef.map((item) => (
          <NavButton key={item.key} item={item} active={screen === item.key} onClick={() => !item.disabled && onNavigate(item.key)} />
        ))}
      </nav>
      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          김
        </div>
        <div style={{ lineHeight: 1.25, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#E4EAF2" }}>김상무 · 위원</div>
          <div style={{ fontSize: 10, color: colors.navyMuted }}>투자심의위원회</div>
        </div>
      </div>
    </aside>
  );
}
