// 백엔드가 릴레이하는 웍스AI SSE 이벤트를 하나씩 누적해 AiMessage가 바로 그릴 수 있는 형태로 만든다.
export function newLiveMessage() {
  return { message: "", reasoning: "", model: null, toolCalls: [], finishReason: null, usage: null };
}

export function applyEvent(msg, evt) {
  // 문서화되지 않은 이벤트라도 usage 필드를 실어 보내는 경우가 있어 방어적으로 캐치.
  if (evt.usage && evt.type !== "data-usage") msg = { ...msg, usage: evt.usage };

  switch (evt.type) {
    case "data-usage":
      return { ...msg, model: evt.data };
    case "text-delta":
      return { ...msg, message: msg.message + (evt.delta || "") };
    case "reasoning-delta":
      return { ...msg, reasoning: msg.reasoning + (evt.delta || "") };
    case "tool-input-available":
      return {
        ...msg,
        toolCalls: [
          ...msg.toolCalls,
          { id: evt.toolCallId, client: evt.toolMetadata?.clientName, name: evt.toolName, input: evt.input },
        ],
      };
    case "tool-output-available": {
      const content = evt.output?.content || [];
      const output = evt.output?.structuredContent ?? content[0]?.text;
      return {
        ...msg,
        toolCalls: msg.toolCalls.map((tc) => (tc.id === evt.toolCallId ? { ...tc, output } : tc)),
      };
    }
    case "finish":
      return { ...msg, finishReason: evt.finishReason };
    default:
      return msg;
  }
}
