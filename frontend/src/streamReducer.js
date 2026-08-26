// 백엔드가 릴레이하는 웍스AI SSE 이벤트를 하나씩 누적해 AiMessage가 바로 그릴 수 있는 형태로 만든다.
// 답변 텍스트와 도구 호출을 하나의 blocks 배열에 도착 순서대로 쌓아 시간순 렌더링이 가능하게 한다.
export function newLiveMessage() {
  return { blocks: [], model: null, finishReason: null, usage: null };
}

// 연속된 같은 종류의 delta는 마지막 블록에 이어 붙이고, 다른 종류를 만나면 새 블록이 시작된다.
// 추론·도구·답변이 번갈아 오는 턴에서 "추론 → 도구 → 추론" 순서가 그대로 보이게 하는 핵심.
function appendDelta(blocks, type, delta) {
  const last = blocks[blocks.length - 1];
  if (last && last.type === type) return [...blocks.slice(0, -1), { ...last, text: last.text + delta }];
  return [...blocks, { type, text: delta }];
}

// 도구 결과 모양이 도구마다 다르다 — MCP 도구는 {content:[{text}]}/{structuredContent},
// 웹 검색처럼 모델이 직접 실행하는 도구는 배열·문자열이 그대로 온다. 못 알아본 모양은
// undefined로 두면 화면이 영영 "실행 중"에 멎으므로 원본을 그대로 넘긴다.
function extractOutput(out) {
  if (out && typeof out === "object" && !Array.isArray(out)) {
    if (out.structuredContent !== undefined) return out.structuredContent;
    if (Array.isArray(out.content)) return out.content.map((c) => c.text ?? c).filter((c) => c !== undefined);
  }
  return out === undefined ? null : out;
}

export function applyEvent(msg, evt) {
  // 문서화되지 않은 이벤트라도 usage 필드를 실어 보내는 경우가 있어 방어적으로 캐치.
  if (evt.usage && evt.type !== "data-usage") msg = { ...msg, usage: evt.usage };

  switch (evt.type) {
    case "data-usage":
      return { ...msg, model: evt.data };
    case "text-delta":
      return { ...msg, blocks: appendDelta(msg.blocks, "text", evt.delta || "") };
    case "reasoning-delta":
      return { ...msg, blocks: appendDelta(msg.blocks, "reasoning", evt.delta || "") };
    case "tool-input-available":
      return {
        ...msg,
        blocks: [
          ...msg.blocks,
          { type: "tool", id: evt.toolCallId, client: evt.toolMetadata?.clientName, name: evt.toolName, input: evt.input },
        ],
      };
    case "tool-output-available":
    case "tool-output-error": {
      const output = evt.type === "tool-output-error" ? `⚠️ ${evt.errorText || "도구 실행이 실패했습니다"}` : extractOutput(evt.output);
      const known = msg.blocks.some((b) => b.type === "tool" && b.id === evt.toolCallId);
      // 웹 검색처럼 모델 쪽에서 바로 실행되는 도구는 input 파트 없이 결과만 오기도 한다.
      if (!known) return { ...msg, blocks: [...msg.blocks, { type: "tool", id: evt.toolCallId, name: evt.toolName || "도구", output }] };
      return {
        ...msg,
        blocks: msg.blocks.map((b) => (b.type === "tool" && b.id === evt.toolCallId ? { ...b, output } : b)),
      };
    }
    case "finish":
      return { ...msg, finishReason: evt.finishReason };
    default:
      return msg;
  }
}
