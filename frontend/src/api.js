const API_BASE = "http://localhost:8787";

// 백엔드가 NDJSON(줄 단위 JSON)으로 실시간 이벤트를 흘려보내면, 도착하는 즉시 onEvent로 넘긴다.
async function streamNdjson(url, form, onEvent) {
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

export function streamStartReview(message, files, onEvent) {
  const form = new FormData();
  form.append("message", message);
  files.forEach((f) => form.append("files", f));
  return streamNdjson(`${API_BASE}/api/review`, form, onEvent);
}

export function streamContinueReview(chatId, message, onEvent) {
  const form = new FormData();
  form.append("message", message);
  return streamNdjson(`${API_BASE}/api/review/${chatId}/message`, form, onEvent);
}
