// 개발 중에는 VITE_API_BASE 로 백엔드 주소(:8787)를 지정하고, 배포 시엔 같은 오리진(상대경로)을 쓴다.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 백엔드가 NDJSON(줄 단위 JSON)으로 실시간 이벤트를 흘려보내면, 도착하는 즉시 onEvent로 넘긴다.
async function streamNdjson(url, form, onEvent) {
  let res;
  try {
    res = await fetch(url, { method: "POST", body: form });
  } catch (e) {
    // 서버가 안 떠 있으면 fetch 자체가 TypeError로 죽는다 — 스트림 중단과는 원인이 달라 구분해 알린다.
    const err = new Error(`백엔드 서버(${API_BASE})에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.`);
    err.offline = true;
    err.cause = e;
    throw err;
  }
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
