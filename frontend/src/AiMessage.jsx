import { useState } from "react";
import { colors } from "./theme.js";
import Markdown from "./Markdown.jsx";

const styles = {
  stack: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "#fff", border: `1px solid ${colors.border}`, borderRadius: "4px 14px 14px 14px", padding: "14px 16px" },
  headRow: { display: "flex", alignItems: "center", gap: 8 },
  modelBadge: { fontSize: 10.5, fontWeight: 600, color: "#3B5A86", background: colors.primaryLight, padding: "2px 8px", borderRadius: 20 },
  toolHeader: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#3A4656", background: "#F2F4F7", border: `1px solid ${colors.border}`, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" },
  toolOutput: { fontSize: 11.5, color: colors.text, background: "#F7F9FB", border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "inherit" },
  toggle: { fontSize: 11.5, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 4 },
};

// 도구 결과는 원본 그대로가 아니라 사람이 읽을 수 있는 형태로만 보여준다(입력 JSON은 노출하지 않음).
function formatOutput(out) {
  if (out === undefined || out === null) return "결과 없음";
  // 텍스트 조각 배열(MCP content, 웹 검색 결과)은 줄바꿈으로 이어 붙여 읽기 좋게.
  if (Array.isArray(out) && out.every((v) => typeof v === "string")) return out.join("\n").trim() || "결과 없음";
  if (typeof out === "string") {
    const t = out.trim();
    // 문자열 안에 JSON이 담겨 오는 경우가 많아 파싱되면 들여쓰기해서 보여준다.
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(t), null, 2);
      } catch {
        return t;
      }
    }
    return t;
  }
  return JSON.stringify(out, null, 2);
}

function ToolCallBlock({ tc }) {
  const [open, setOpen] = useState(false);
  const pending = tc.output === undefined;
  return (
    <div>
      <button className={pending ? "step-pulse" : undefined} style={styles.toolHeader} onClick={() => !pending && setOpen((v) => !v)}>
        🔧 {tc.client || "도구"} · {tc.name}
        {pending ? (
          <span className="typing-dots"><span /><span /><span /></span>
        ) : (
          <span style={{ color: colors.textMuted }}>{open ? "결과 숨기기 ▲" : "결과 보기 ▼"}</span>
        )}
      </button>
      {open && <div style={styles.toolOutput}>{formatOutput(tc.output)}</div>}
    </div>
  );
}

export default function AiMessage({ data, streaming }) {
  const [showReasoning, setShowReasoning] = useState(false);
  // 에러 메시지처럼 blocks 없이 message만 담아 보내는 경우도 그대로 그린다.
  const blocks = data.blocks || (data.message ? [{ type: "text", text: data.message }] : []);
  const lastTextIndex = blocks.map((b) => b.type).lastIndexOf("text");
  const thinking = streaming && lastTextIndex === -1 && data.reasoning;

  return (
    <div style={styles.stack}>
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
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {data.reasoning}
        </div>
      )}

      {blocks.map((b, i) =>
        b.type === "tool" ? (
          <ToolCallBlock key={b.id || i} tc={b} />
        ) : (
          <div key={i} style={styles.card}>
            <Markdown className="md-content" text={b.text + (streaming && i === lastTextIndex ? " ▌" : "")} />
          </div>
        )
      )}

      {data.usage && (
        <div style={{ fontSize: 10.5, color: colors.textFaint }}>
          토큰 {data.usage.inputTokens ?? "—"} in / {data.usage.outputTokens ?? "—"} out
        </div>
      )}
    </div>
  );
}
