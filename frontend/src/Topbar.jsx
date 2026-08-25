import { colors } from "./theme.js";

export default function Topbar({ title }) {
  return (
    <header
      style={{
        height: 60,
        flexShrink: 0,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid #E4E8ED`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#F1F3F6",
          border: "1px solid #E4E8ED",
          borderRadius: 8,
          padding: "7px 12px",
          width: 260,
          color: colors.textMuted,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <span style={{ fontSize: 12.5 }}>회사명·자산유형 검색</span>
      </div>
    </header>
  );
}
