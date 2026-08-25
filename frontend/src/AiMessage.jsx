import { useState } from "react";
import { colors } from "./theme.js";
import Markdown from "./Markdown.jsx";

const styles = {
  card: { flex: 1, minWidth: 0, background: "#fff", border: `1px solid ${colors.border}`, borderRadius: "4px 14px 14px 14px", padding: "14px 16px" },
  headRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  modelBadge: { fontSize: 10.5, fontWeight: 600, color: "#3B5A86", background: colors.primaryLight, padding: "2px 8px", borderRadius: 20 },
  toolChip: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#3A4656", background: "#F2F4F7", border: `1px solid ${colors.border}`, padding: "4px 9px", borderRadius: 8, cursor: "pointer" },
  toggle: { fontSize: 11.5, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 4 },
};

function ToolCallChip({ tc }) {
  const [open, setOpen] = useState(false);
  const pending = tc.output === undefined;
  return (
    <div>
      <button className={pending ? "step-pulse" : undefined} style={styles.toolChip} onClick={() => !pending && setOpen((v) => !v)}>
        🔧 {tc.client || "도구"} · {tc.name}
        {pending && <span className="typing-dots" style={{ marginLeft: 2 }}><span /><span /><span /></span>}
      </button>
      {open && (
        <pre
          style={{
            fontSize: 10.5,
            background: "#F7F9FB",
            border: `1px solid ${colors.borderLight}`,
            borderRadius: 8,
            padding: "8px 10px",
            marginTop: 6,
            maxHeight: 220,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify({ input: tc.input, output: tc.output }, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AiMessage({ data, streaming }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const toolCalls = data.toolCalls || [];
  const thinking = streaming && !data.message && data.reasoning;

  return (
    <div style={styles.card}>
      {(data.model?.modelDisplayName || data.reasoning || thinking) && (
        <div style={styles.headRow}>
          {data.model?.modelDisplayName && <span style={styles.modelBadge}>{data.model.modelDisplayName}</span>}
          {data.reasoning && (
            <button style={styles.toggle} onClick={() => setShowReasoning((v) => !v)}>
              🧠 AI 생각 과정 {showReasoning ? "숨기기" : "보기"}
            </button>
          )}
          {thinking && (
            <span style={{ fontSize: 11, color: colors.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
              생각 중
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
            </span>
          )}
        </div>
      )}

      {showReasoning && data.reasoning && (
        <div
          style={{
            fontSize: 11.5,
            color: colors.textMuted,
            background: "#F9FAFB",
            border: `1px solid ${colors.borderLight}`,
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 10,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {data.reasoning}
        </div>
      )}

      <Markdown className="md-content" text={data.message + (streaming && data.message ? " ▌" : "")} />

      {toolCalls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.borderLight}` }}>
          {toolCalls.map((tc) => (
            <ToolCallChip key={tc.name + JSON.stringify(tc.input)} tc={tc} />
          ))}
        </div>
      )}

      {data.usage && (
        <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 10 }}>
          토큰 {data.usage.inputTokens ?? "—"} in / {data.usage.outputTokens ?? "—"} out
        </div>
      )}
    </div>
  );
}
