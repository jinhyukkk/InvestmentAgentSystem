import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, statusChip, ASSET_TYPES } from "./mockData.js";
import { fetchReviews } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";

const FILTERS = ["전체", ...ASSET_TYPES];

export default function CaseList({ onOpenCase, onNewRequest }) {
  const [filter, setFilter] = useState("전체");
  const { data, error, loading, reload } = useAsync(fetchReviews, []);
  const dec = (data || []).map(decorate).filter((c) => filter === "전체" || c.assetType === filter);

  return (
    <div style={{ padding: "26px 28px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>안건 목록 · 심의 이력</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 3 }}>
            전체 <span style={{ fontWeight: 600, color: "#5A6473" }}>{dec.length}</span>건
          </div>
        </div>
        <button
          onClick={onNewRequest}
          style={{ display: "flex", alignItems: "center", gap: 7, background: colors.primary, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          + 새 심의 요청
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 600 }}>자산유형</span>
          <div style={{ display: "flex", gap: 7 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  border: `1px solid ${filter === f ? colors.primary : "#DFE3E9"}`,
                  background: filter === f ? colors.primary : "#fff",
                  color: filter === f ? "#fff" : "#5A6473",
                  fontWeight: filter === f ? 600 : 500,
                  fontSize: 12.5,
                  padding: "7px 15px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
        <AsyncStatus loading={loading} error={error} empty={!loading && !error && dec.length === 0} onRetry={reload} />
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1040 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr 1fr 1fr 0.9fr 1.3fr 1.2fr 1fr", padding: "12px 20px", background: "#F7F9FB", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 11, fontWeight: 600, color: colors.textMuted }}>
              <div>회사명</div>
              <div>자산유형</div>
              <div>접수일</div>
              <div>검토 수준</div>
              <div>AI 총점 참고</div>
              <div>AI 권고 참고</div>
              <div>위원회 결정</div>
              <div>상태</div>
            </div>
            {dec.map((c) => (
              <div
                key={c.id}
                onClick={() => onOpenCase(c)}
                style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr 1fr 1fr 0.9fr 1.3fr 1.2fr 1fr", padding: "14px 20px", borderBottom: `1px solid ${colors.borderLight}`, alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company}</div>
                  <div style={{ fontSize: 11, color: "#9AA3AF", marginTop: 1 }}>
                    {c.sector} · {c.investStr}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "#5A6473" }}>{c.assetType}</div>
                <div style={{ fontSize: 12.5, color: "#5A6473" }}>{c.received}</div>
                <div>
                  <span style={cssStr(c.levelStyleStr)}>{c.reviewLevel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{c.scoreStr}</span>
                  <div style={{ width: 36, height: 5, background: "#EEF1F4", borderRadius: 3, overflow: "hidden" }}>
                    <div style={cssStr(c.scoreBar)} />
                  </div>
                </div>
                <div>
                  <span style={cssStr(c.recStyleSm)}>{c.aiRecShort}</span>
                </div>
                <div>
                  <span style={cssStr(c.comStyle)}>{c.comLabel}</span>
                </div>
                <div>
                  <span style={cssStr(statusChip(c.status))}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 14, lineHeight: 1.5 }}>
        AI 총점·권고는 참고 지표입니다. 최종 투자 결정은 투자심의위원회 의결 사항입니다.
      </div>
    </div>
  );
}
