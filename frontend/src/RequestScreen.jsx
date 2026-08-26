import { useEffect, useRef, useState } from "react";
import { colors, fontFamily } from "./theme.js";
import { streamStartReview, streamContinueReview } from "./api.js";
import AgentIntro from "./AgentIntro.jsx";
import AiMessage from "./AiMessage.jsx";
import FileBadge from "./FileBadge.jsx";
import { newLiveMessage, applyEvent } from "./streamReducer.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 에러만 오고 끝난 턴은 빈 말풍선을 남기면 안 된다 — 실제로 담긴 게 있는지 본다.
function hasContent(m) {
  return !!(m && (m.message || m.reasoning || m.toolCalls.length));
}

function formatElapsed(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// 이 에이전트는 휴먼인더루프(사전 정보 확인 → 사용자 확정 → 다음 단계)로 진행되므로,
// 대기 중 실제로 어느 단계를 처리하는지 클라이언트는 알 수 없다. 진행 단계를 지어내지 않고
// "응답을 기다리는 중"이라는 사실만 전달한다.
function LoadingIndicator() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      에이전트 응답을 기다리고 있습니다
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

// 스텝 상태에 따른 도트/라벨 스타일 — 목업 requestVals()의 steps 매핑 로직을 그대로 포팅.
function stepStyle(state) {
  if (state === "done") {
    return { dot: { background: colors.primary, borderColor: colors.primary, color: "#fff" }, label: { color: colors.text, fontWeight: 600 } };
  }
  if (state === "running") {
    return { dot: { background: "#fff", borderColor: colors.blue, color: colors.blue }, label: { color: colors.primary, fontWeight: 700 } };
  }
  return { dot: { background: "#fff", borderColor: "#DDE2E9", color: "#C4CBD4" }, label: { color: colors.textFaint, fontWeight: 500 } };
}

const s = {
  grid: { display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, padding: "24px 28px 40px", maxWidth: 1240, margin: "0 auto", alignItems: "start" },
  conversation: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  userBubble: { background: colors.primary, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  aiRow: { display: "flex", gap: 11, alignItems: "flex-start" },
  aiAvatar: { width: 30, height: 30, borderRadius: 8, background: colors.primaryLight, color: "#3B5A86", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 },
  aiCard: { flex: 1, minWidth: 0, background: "#fff", border: `1px solid ${colors.border}`, borderRadius: "4px 14px 14px 14px", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" },
  composer: {
    background: "#fff",
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 4,
    position: "sticky",
    bottom: 20,
    boxShadow: "0 -4px 16px rgba(20,40,70,0.06)",
    zIndex: 5,
    transition: "border-color .15s, background .15s",
  },
  composerRow: { display: "flex", alignItems: "center", gap: 12 },
  attachBtn: { width: 34, height: 34, borderRadius: 8, border: "1px dashed #CDD3DB", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted, cursor: "pointer", flexShrink: 0 },
  sendBtn: { width: 34, height: 34, borderRadius: 8, background: colors.primary, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", flexShrink: 0 },
  textInput: { flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", background: "transparent" },
  panel: { position: "sticky", top: 20, background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 14, overflow: "hidden" },
};

export default function RequestScreen() {
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [steps, setSteps] = useState([
    { label: "접수", state: "pending" },
    { label: "자료 업로드", state: "pending" },
    { label: "AI 사전 스캔", state: "pending" },
    { label: "검토 진행", state: "pending" },
  ]);
  const [caseTitle, setCaseTitle] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [liveMessage, setLiveMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const startedAt = useRef(null);

  function addFiles(fileList) {
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function removeFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (chatId) return;
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  useEffect(() => {
    if (!startedAt.current) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt.current]);

  function setStep(index, state) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, state } : s)));
  }

  // 에러도 에이전트 답변처럼 대화창 안에 message만 노출한다 — 스택/원본 응답은 보여주지 않는다.
  function pushErrorMessage(text) {
    setConversation((c) => [...c, { role: "ai", data: { message: text } }]);
  }

  async function submit() {
    if (!message.trim() || loading) return;
    startedAt.current = Date.now();
    setCaseTitle(message.slice(0, 24));
    setLoading(true);
    const sentMessage = message;
    const files = pendingFiles;
    setConversation([{ role: "user", text: sentMessage, files: files.map((f) => ({ name: f.name, size: formatSize(f.size) })) }]);
    setMessage("");
    setPendingFiles([]);

    setStep(0, "running");
    setStep(1, files.length > 0 ? "running" : "done");
    const hasFiles = files.length > 0;

    let live = null;
    let uploadedCount = 0;

    try {
      await streamStartReview(sentMessage, files, (evt) => {
        if (evt.type === "meta") {
          setChatId(evt.chatId);
          setStep(0, "done");
          return;
        }
        if (evt.type === "turn-start") {
          // 파일이 있으면 파일을 본 뒤의 검토 턴 하나만 스트리밍된다(사전 스캔 단계는 건너뜀).
          if (hasFiles) setStep(3, "running");
          live = newLiveMessage();
          setLiveMessage(live);
          return;
        }
        if (evt.type === "turn-end") {
          const finished = live;
          live = null;
          setLiveMessage(null);
          // 답변이 안 온 턴은 빈 말풍선도, 완료(✓) 표시도 남기지 않는다
          if (!hasContent(finished)) return;
          setConversation((c) => [...c, { role: "ai", data: finished }]);
          setStep(hasFiles ? 3 : 2, "done");
          return;
        }
        // 거절된 파일도 세어야 한다 — 안 그러면 "자료 업로드" 단계가 영영 안 끝난다.
        if (evt.type === "file-uploaded" || evt.type === "file-error") {
          if (evt.type === "file-error") pushErrorMessage(evt.message);
          uploadedCount += 1;
          if (uploadedCount === files.length) {
            setStep(1, "done");
            setStep(2, "done");
          }
          return;
        }
        if (evt.type === "error") {
          pushErrorMessage(evt.message);
          return;
        }
        if (live) {
          live = applyEvent(live, evt);
          setLiveMessage(live);
        }
      });
    } catch (e) {
      pushErrorMessage("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      setLiveMessage(null);
    }
  }

  async function sendFollowUp(text) {
    if (!text.trim() || !chatId || loading) return;
    setLoading(true);
    setConversation((c) => [...c, { role: "user", text }]);
    setMessage("");

    let live = null;
    try {
      await streamContinueReview(chatId, text, (evt) => {
        if (evt.type === "turn-start") {
          live = newLiveMessage();
          setLiveMessage(live);
          return;
        }
        if (evt.type === "turn-end") {
          const finished = live;
          live = null;
          setLiveMessage(null);
          if (hasContent(finished)) setConversation((c) => [...c, { role: "ai", data: finished }]);
          return;
        }
        if (evt.type === "error") {
          pushErrorMessage(evt.message);
          return;
        }
        if (live) {
          live = applyEvent(live, evt);
          setLiveMessage(live);
        }
      });
    } catch (e) {
      pushErrorMessage("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      setLiveMessage(null);
    }
  }

  function onComposerSend() {
    if (chatId) sendFollowUp(message);
    else submit();
  }

  return (
    <div style={{ ...s.grid, fontFamily }}>
      <div style={s.conversation}>
        {conversation.length === 0 && <AgentIntro />}
        {conversation.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ maxWidth: "78%" }}>
                {m.files && m.files.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8, justifyContent: "flex-end" }}>
                    {m.files.map((f) => (
                      <FileBadge key={f.name} name={f.name} size={f.size} />
                    ))}
                  </div>
                )}
                <div style={s.userBubble}>{m.text}</div>
              </div>
            </div>
          ) : (
            <div key={i} style={s.aiRow}>
              <div style={s.aiAvatar}>AI</div>
              <AiMessage data={m.data} />
            </div>
          )
        )}
        {loading && !liveMessage && (
          <div style={s.aiRow}>
            <div className="avatar-pulse" style={s.aiAvatar}>
              AI
            </div>
            <div style={{ ...s.aiCard, color: colors.textMuted }}>
              <LoadingIndicator />
            </div>
          </div>
        )}
        {liveMessage && (
          <div style={s.aiRow}>
            <div className="avatar-pulse" style={s.aiAvatar}>
              AI
            </div>
            <AiMessage data={liveMessage} streaming />
          </div>
        )}
        <div
          style={{
            ...s.composer,
            borderColor: isDragging ? colors.primary : colors.border,
            background: isDragging ? colors.primaryLight : "#fff",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!chatId) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {pendingFiles.length > 0 && !chatId && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {pendingFiles.map((f, i) => (
                <FileBadge key={`${f.name}-${i}`} name={f.name} size={formatSize(f.size)} onRemove={() => removeFile(i)} />
              ))}
            </div>
          )}
          <div style={s.composerRow}>
            <button style={s.attachBtn} onClick={() => fileInputRef.current?.click()} disabled={!!chatId}>
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => addFiles(e.target.files)}
            />
            <input
              style={s.textInput}
              placeholder={
                chatId
                  ? '후속 답변을 입력하세요 (예: "1번으로 진행해 줘")'
                  : isDragging
                    ? "여기에 파일을 놓으세요…"
                    : "메시지를 입력하거나 파일을 첨부하세요…"
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onComposerSend()}
            />
            <button style={s.sendBtn} onClick={onComposerSend} disabled={loading}>
              ➤
            </button>
          </div>
        </div>
      </div>

      <div style={s.panel}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderLight}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>{caseTitle || "새 심의 요청"}</div>
          {startedAt.current && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 7 }}>경과 {formatElapsed(elapsed)}</div>
          )}
        </div>
        <div style={{ padding: "16px 18px" }}>
          {steps.map((step, i) => {
            const st = stepStyle(step.state);
            const isLast = i === steps.length - 1;
            return (
              <div key={step.label} style={{ display: "flex" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flexShrink: 0 }}>
                  <div
                    className={step.state === "running" ? "step-pulse" : undefined}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "2px solid",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      ...st.dot,
                    }}
                  >
                    {step.state === "done" && "✓"}
                    {step.state === "running" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors.blue }} />}
                  </div>
                  {!isLast && <div style={{ width: 2, flex: 1, minHeight: 14, background: step.state === "done" ? colors.primary : "#E4E8ED", margin: "3px 0" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 14, paddingLeft: 11 }}>
                  <span style={{ fontSize: 12.5, ...st.label }}>{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "13px 18px", borderTop: `1px solid ${colors.borderLight}`, background: "#F9FAFB" }}>
          <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.55 }}>
            화면을 떠나도 대화 기록은 chatId로 이어갈 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
