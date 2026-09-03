import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, computeStats, quarterLabel } from "./mockData.js";
import { fetchReviews } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";

const seg = (on) => ({
  border: "none",
  background: on ? "#fff" : "transparent",
  boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  color: on ? colors.text : colors.textMuted,
  fontWeight: on ? 600 : 500,
  fontSize: 12.5,
  padding: "6px 16px",
  borderRadius: 7,
  cursor: "pointer",
  fontFamily: "inherit",
});

export default function Dashboard({ onOpenCase, onNewRequest }) {
  const [variant, setVariant] = useState("a");
  const { data, error, loading, reload } = useAsync(fetchReviews, []);
  const dec = (data || []).map(decorate);
  const stats = computeStats(dec);
  const active = dec.filter((c) => c.status !== "완료");
  const recent = dec.filter((c) => c.status === "완료").slice(0, 5);
  const boardColumns = [
    { title: "검토 중", dot: "#3B5A86", list: dec.filter((c) => c.status === "검토 중") },
    { title: "심의 대기", dot: "#C79A3A", list: dec.filter((c) => c.status === "심의 대기") },
    { title: "완료", dot: "#0F7A55", list: dec.filter((c) => c.status === "완료").slice(0, 3) },
  ];

  return (
    <div style={{ padding: "26px 28px 60px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>투자심의 현황</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 3 }}>{quarterLabel()} · 전체 {dec.length}건</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", background: "#EBEEF2", borderRadius: 9, padding: 3 }}>
            <button style={seg(variant === "a")} onClick={() => setVariant("a")}>
              지표 중심
            </button>
            <button style={seg(variant === "b")} onClick={() => setVariant("b")}>
              안건 보드
            </button>
          </div>
          <button
            onClick={onNewRequest}
            style={{ display: "flex", alignItems: "center", gap: 7, background: colors.primary, color: "#fff", border: "none", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            + 새 심의 요청
          </button>
        </div>
      </div>

      <AsyncStatus loading={loading} error={error} empty={!loading && !error && dec.length === 0} onRetry={reload} />

      {variant === "a" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 26 }}>
            {stats.statCards.map((s) => (
              <div key={s.label} style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 18px 16px" }}>
                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>{s.unit}</div>
                </div>
                <div style={{ fontSize: 11, color: s.deltaColor, marginTop: 8, fontWeight: 500 }}>{s.delta}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            진행 중 안건{" "}
            <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, background: "#EEF1F4", padding: "2px 8px", borderRadius: 20 }}>{active.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 30 }}>
            {active.map((c) => (
              <div key={c.id} onClick={() => onOpenCase(c)} style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, padding: "16px 16px 14px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                      {c.assetType} · {c.sector}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                    <span style={cssStr(c.levelStyleStr)}>{c.reviewLevel}</span>
                    {c.awaitInput && (
                      <span style={cssStr(c.awaitStyle)}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C79A3A" }} />
                        {c.awaitLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "13px 0 11px" }}>
                  <span style={{ fontSize: 10.5, whiteSpace: "nowrap", color: "#9AA3AF", background: "#F2F4F7", border: `1px solid ${colors.border}`, padding: "1.5px 6px", borderRadius: 5, fontWeight: 600 }}>
                    AI 참고
                  </span>
                  <span style={{ fontSize: 12, color: "#5A6473" }}>총점</span>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{c.scoreStr}</span>
                  <span style={{ fontSize: 11, color: colors.textFaint }}>/ 100</span>
                  <div style={{ flex: 1, height: 5, background: "#EEF1F4", borderRadius: 3, overflow: "hidden", marginLeft: 2 }}>
                    <div style={cssStr(c.scoreBar)} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTop: `1px solid ${colors.borderLight}` }}>
                  <span style={cssStr(c.recStyle)}>{c.aiRecShort}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{c.stageLabel}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>최근 완료 안건</div>
          <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.3fr 1.3fr 0.9fr", padding: "11px 18px", background: "#F7F9FB", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 11, fontWeight: 600, color: colors.textMuted }}>
              <div>안건</div>
              <div>자산유형</div>
              <div>AI 권고 참고</div>
              <div>위원회 결정</div>
              <div style={{ textAlign: "right" }}>일치</div>
            </div>
            {recent.map((c) => (
              <div key={c.id} onClick={() => onOpenCase(c)} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.3fr 1.3fr 0.9fr", padding: "13px 18px", borderBottom: `1px solid ${colors.borderLight}`, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{c.company}</div>
                  <div style={{ fontSize: 11, color: "#9AA3AF", marginTop: 1 }}>{c.received} 접수</div>
                </div>
                <div style={{ fontSize: 12, color: "#5A6473" }}>{c.assetType}</div>
                <div>
                  <span style={cssStr(c.recStyleSm)}>{c.aiRecShort}</span>
                </div>
                <div>
                  <span style={cssStr(c.comStyle)}>{c.comLabel}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={cssStr(c.matchStyle)}>{c.matchLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "b" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {boardColumns.map((col) => (
              <div key={col.title} style={{ background: "#EEF1F4", borderRadius: 12, padding: "10px 10px 14px", minHeight: 400 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{col.title}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, background: "#fff", padding: "2px 8px", borderRadius: 20 }}>{col.list.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {col.list.map((c) => (
                    <div key={c.id} onClick={() => onOpenCase(c)} style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{c.company}</div>
                        <span style={cssStr(c.levelStyleSmStr)}>{c.reviewLevel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#9AA3AF", marginTop: 3 }}>
                        {c.assetType} · {c.investStr}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11 }}>
                        <span style={{ fontSize: 9.5, color: "#9AA3AF", background: "#F2F4F7", border: `1px solid ${colors.border}`, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>AI</span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{c.scoreStr}</span>
                        <div style={{ flex: 1, height: 4, background: "#EEF1F4", borderRadius: 3, overflow: "hidden" }}>
                          <div style={cssStr(c.scoreBar)} />
                        </div>
                      </div>
                      <div style={{ marginTop: 9 }}>
                        <span style={cssStr(c.recStyleSm)}>{c.aiRecShort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>
            <div style={{ background: colors.navy, color: "#fff", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#9DB0C7" }}>이번 분기 승인율</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 14px" }}>
                <div style={{ fontSize: 38, fontWeight: 700 }}>{stats.approvalRate}</div>
                <div style={{ fontSize: 18, color: "#9DB0C7" }}>%</div>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${stats.approvalRate}%`, height: "100%", background: "linear-gradient(90deg,#3E8ED0,#5FB39A)" }} />
              </div>
              <div style={{ fontSize: 11, color: "#7E93AD", marginTop: 9 }}>{stats.approvedText}</div>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>AI 권고 ↔ 위원회 결정</div>
              <div style={{ fontSize: 11, color: "#9AA3AF", marginBottom: 14 }}>최근 완료 안건 일치율</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#2E6BB0" }}>{stats.matchRate}</div>
                <div style={{ fontSize: 13, color: colors.textMuted }}>%</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                {stats.matchBars.map((m) => (
                  <div key={m.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#5A6473", marginBottom: 4 }}>
                      <span>{m.label}</span>
                      <span>{m.count}</span>
                    </div>
                    <div style={{ height: 6, background: "#EEF1F4", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.borderLight}`, lineHeight: 1.5 }}>
                AI 점수·권고는 참고 지표이며 최종 의결은 투심위 결정을 따릅니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
