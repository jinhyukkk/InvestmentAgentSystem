import { useState } from "react";
import { colors } from "./theme.js";
import Markdown, { stripReportJson } from "./Markdown.jsx";

const styles = {
  stack: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "#fff", border: `1px solid ${colors.border}`, borderRadius: "4px 14px 14px 14px", padding: "14px 16px" },
  headRow: { display: "flex", alignItems: "center", gap: 8 },
  modelBadge: { fontSize: 10.5, fontWeight: 600, color: "#3B5A86", background: colors.primaryLight, padding: "2px 8px", borderRadius: 20 },
  toolHeader: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#3A4656", background: "#F2F4F7", border: `1px solid ${colors.border}`, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" },
  toolOutput: { fontSize: 11.5, color: colors.text, background: "#F7F9FB", border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "inherit" },
  toggle: { fontSize: 11.5, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 4 },
  waiting: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: colors.textMuted, alignSelf: "flex-start", padding: "2px 2px" },
  reasoning: { fontSize: 11.5, color: colors.textMuted, background: "#F9FAFB", border: `1px solid ${colors.borderLight}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" },
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

// 추론도 도구와 같은 레벨의 블록으로 그려야 "추론 → 도구 → 추론" 순서가 화면에 그대로 남는다.
function ReasoningBlock({ text, thinking }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className={thinking ? "step-pulse" : undefined} style={styles.toolHeader} onClick={() => setOpen((v) => !v)}>
        🧠 AI 생각 과정
        {thinking ? (
          <span className="typing-dots"><span /><span /><span /></span>
        ) : (
          <span style={{ color: colors.textMuted }}>{open ? "숨기기 ▲" : "보기 ▼"}</span>
        )}
      </button>
      {open && <div style={styles.reasoning}>{text}</div>}
    </div>
  );
}

export default function AiMessage({ data, streaming }) {
  // 에러 메시지처럼 blocks 없이 message만 담아 보내는 경우도 그대로 그린다.
  const blocks = data.blocks || (data.message ? [{ type: "text", text: data.message }] : []);
  const lastIndex = blocks.length - 1;
  const lastTextIndex = blocks.map((b) => b.type).lastIndexOf("text");
  // 마지막 블록이 추론이면 아직 답변 전이라는 뜻 — 그 블록 자리에서 "생각 중"을 보여준다.
  const thinkingAtEnd = streaming && blocks[lastIndex]?.type === "reasoning";
  const last = blocks[lastIndex];
  // 업로드·도구가 끝나고 다음 응답을 기다리는 사이엔 움직이는 게 하나도 없어 멈춘 것처럼 보인다.
  // 답변 글자가 흐르기 시작할 때까지 "처리 중"을 이어 붙여 진행 중이라는 걸 계속 보여준다.
  const waiting = streaming && (!last || (last.type === "tool" && last.output !== undefined));

  return (
    <div style={styles.stack}>
      {data.model?.modelDisplayName && (
        <div style={styles.headRow}>
          <span style={styles.modelBadge}>{data.model.modelDisplayName}</span>
        </div>
      )}

      {blocks.map((b, i) =>
        b.type === "tool" ? (
          <ToolCallBlock key={b.id || i} tc={b} />
        ) : b.type === "reasoning" ? (
          <ReasoningBlock key={i} text={b.text} thinking={thinkingAtEnd && i === lastIndex} />
        ) : (
          <div key={i} style={styles.card}>
            <Markdown className="md-content" text={stripReportJson(b.text) + (streaming && i === lastTextIndex ? " ▌" : "")} />
          </div>
        )
      )}

      {waiting && (
        <div style={styles.waiting}>
          에이전트가 처리 중입니다
          <span className="typing-dots"><span /><span /><span /></span>
        </div>
      )}

      {data.usage && (
        <div style={{ fontSize: 10.5, color: colors.textFaint }}>
          토큰 {data.usage.inputTokens ?? "—"} in / {data.usage.outputTokens ?? "—"} out
        </div>
      )}
    </div>
  );
}
