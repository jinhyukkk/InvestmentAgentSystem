import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import { decorate, ASSET_TYPES, REVIEW_LEVELS, COMMITTEES, statusChip } from "./mockData.js";
import { fetchReview, patchReview } from "./api.js";
import { useAsync, AsyncStatus } from "./useAsync.jsx";
import { toDetail, timelineFor, toc } from "./reportView.js";
import { applyEvent, newLiveMessage } from "./streamReducer.js";
import AiMessage from "./AiMessage.jsx";

const card = { background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 14 };
const sectionTitle = (num, title) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: "#AAB2BD" }}>{num}</span>
    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h3>
  </div>
);
const divider = <div style={{ height: 1, background: colors.borderLight, margin: "26px 0" }} />;

const backBtn = { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: colors.textMuted, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", padding: 0, marginBottom: 16 };
const input = { fontFamily: "inherit", fontSize: 12.5, padding: "6px 8px", border: `1px solid ${colors.border}`, borderRadius: 6, width: "100%" };
const empty = (msg = "AI 분석 결과가 아직 없습니다.") => <div style={{ fontSize: 12.5, color: colors.textFaint, padding: "10px 0" }}>{msg}</div>;

export default function CaseDetail({ caseItem, onBack }) {
  const [section, setSection] = useState("s1");
  const { data, error, loading, reload } = useAsync(() => fetchReview(caseItem.id), [caseItem?.id]);

  if (!data) {
    return (
      <div style={{ padding: "22px 28px" }}>
        <button onClick={onBack} style={backBtn}>← 안건 목록</button>
        <AsyncStatus loading={loading} error={error} empty={false} onRetry={reload} />
      </div>
    );
  }
  const review = decorate(data);
  const detail = toDetail(data.reportJson);
  const timeline = timelineFor(review);

  return (
    <div style={{ padding: "22px 28px 70px", maxWidth: 1240, margin: "0 auto" }}>
      <button onClick={onBack} style={backBtn}>
        ← 안건 목록
      </button>

      <div style={{ ...card, padding: "22px 24px", marginBottom: 16, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary, background: colors.primaryLight, border: "1px solid #D3E0EE", padding: "3px 9px", borderRadius: 5 }}>{review.reviewLevel || "검토 수준 미정"}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#5A6473", background: "#EEF1F4", padding: "3px 9px", borderRadius: 5 }}>{review.assetType || "자산유형 미정"}</span>
            <span style={cssStr(statusChip(review.status))}>{review.status}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>{review.company}</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
            {review.sector || "업종 미정"} · 안건번호 IC-{review.received?.slice(0, 4)}-{String(review.id).padStart(3, "0")}
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 20, flexWrap: "wrap" }}>
            {[
              ["총 투자비", review.investStr, ""],
              ["기준가", review.baseStr, ""],
              ["접수일", review.received, ""],
            ].map(([label, val, unit]) => (
              <div key={label}>
                <div style={{ fontSize: 11.5, color: "#9AA3AF" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>
                  {val}
                  {unit && <span style={{ fontSize: 13, fontWeight: 500, color: colors.textMuted }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
          <IntakeForm review={data} onSaved={reload} />
        </div>
        <div style={{ width: 220, flexShrink: 0, background: "#F7F9FB", border: "1px dashed #C9D3E0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3B5A86", background: colors.primaryLight, padding: "2px 6px", borderRadius: 4 }}>AI 분석</span>
            <span style={{ fontSize: 10.5, color: "#9AA3AF" }}>참고 지표</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>{review.scoreStr}</div>
            <div style={{ fontSize: 15, color: "#9AA3AF" }}>/ 100</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={{ ...cssStr(review.recStyle), display: "inline-block", fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8, width: "100%", textAlign: "center" }}>{review.aiRec || "AI 분석 전"}</span>
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: "22px 24px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5A6473", marginBottom: 20 }}>진행 단계</div>
        <div style={{ display: "flex" }}>
          {timeline.map((t, i) => (
            <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {i > 0 && <div style={{ position: "absolute", top: 6, left: "-50%", right: "50%", height: 2, background: t.done ? colors.primary : "#E2E6EB" }} />}
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid",
                  position: "relative",
                  zIndex: 1,
                  background: t.done ? colors.primary : "#fff",
                  borderColor: t.current ? "#C79A3A" : t.done ? colors.primary : "#D8DEE6",
                  boxShadow: t.current ? "0 0 0 4px #FaF0D8" : "none",
                }}
              />
              <div style={{ fontSize: 11, marginTop: 10, textAlign: "center", lineHeight: 1.3, color: t.done || t.current ? colors.text : colors.textFaint, fontWeight: t.done || t.current ? 600 : 500 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 3 }}>{t.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>AI 점수 패널</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{review.scoreStr}</span>
              <span style={{ fontSize: 12, color: "#9AA3AF" }}>/ 100</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail
              ? detail.scores.map((s) => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, color: "#3A4656", fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {s.valStr} <span style={{ fontWeight: 500, color: colors.textFaint }}>/ {s.max}</span>
                      </span>
                    </div>
                    <div style={{ height: 7, background: "#EEF1F4", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              : empty()}
          </div>
          <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${colors.borderLight}`, lineHeight: 1.5 }}>
            미평가 항목은 '자료 미도달'로 표기됩니다. 그린필드 안건은 '가격 매력도' 대신 '투자 효율성'으로 평가합니다.
          </div>
        </div>
        <div style={{ ...card, padding: "20px 22px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3B5A86", background: colors.primaryLight, padding: "2px 6px", borderRadius: 4 }}>AI 권고</span>
            <span style={{ fontSize: 10.5, color: "#9AA3AF" }}>참고 · 최종 의결 아님</span>
          </div>
          <span style={{ display: "inline-block", alignSelf: "flex-start", fontSize: 14, fontWeight: 700, color: colors.amber, background: colors.amberBg, border: `1px solid ${colors.amberBorder}`, padding: "8px 16px", borderRadius: 9 }}>
            {review.aiRec || "AI 분석 전"}
          </span>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5A6473", margin: "16px 0 9px" }}>충족 조건</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {detail
              ? detail.conditions.map((text, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: colors.amberBg, color: colors.amber, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: "#3A4656", lineHeight: 1.45 }}>{text}</span>
                  </div>
                ))
              : empty()}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 20, ...card, padding: "14px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9AA3AF", padding: "4px 10px 10px" }}>보고서 목차</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {toc.map((t) => {
              const on = section === t.id;
              return (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  onClick={() => setSection(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 7, textDecoration: "none", fontSize: 12.5, fontWeight: on ? 600 : 500, color: on ? colors.primary : "#5A6473", background: on ? "#EDF2F8" : "transparent", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: on ? colors.primary : "#AAB2BD", minWidth: 22 }}>{t.num}</span>
                  <span>{t.title}</span>
                </a>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: "30px 34px" }}>
          <div id="s1" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("①", "개요")}
            {detail
              ? detail.summary
                  .split("\n")
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i} style={{ fontSize: 13.5, lineHeight: 1.75, color: "#3A4656", margin: "0 0 12px" }}>
                      {p}
                    </p>
                  ))
              : empty()}
          </div>
          {divider}

          <div id="s2" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("②", "핵심 재무 지표")}
            {detail ? (
              <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: `1.4fr ${"1fr ".repeat(detail.years.length)}`, background: "#F7F9FB", padding: "10px 16px", fontSize: 11.5, fontWeight: 600, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}` }}>
                  <div>항목 (억원)</div>
                  {detail.years.map((y) => (
                    <div key={y} style={{ textAlign: "right" }}>{y}</div>
                  ))}
                </div>
                {detail.financials.map((f) => (
                  <div key={f.label} style={{ display: "grid", gridTemplateColumns: `1.4fr ${"1fr ".repeat(detail.years.length)}`, padding: "11px 16px", fontSize: 12.5, borderBottom: `1px solid ${colors.borderLight}` }}>
                    <div style={{ color: "#3A4656", fontWeight: 500 }}>{f.label}</div>
                    {detail.years.map((y) => (
                      <div key={y} style={{ textAlign: "right", color: f.warn ? "#B02A30" : undefined, fontWeight: f.warn ? 600 : undefined }}>{f.values[y] ?? "—"}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              empty()
            )}
          </div>
          {divider}

          <div id="s3" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("③", "매도자 측 주장 검증")}
            {detail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
                {detail.claims.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px", borderBottom: `1px solid ${colors.borderLight}`, background: "#fff" }}>
                    <span style={{ fontSize: 13, color: "#3A4656", lineHeight: 1.4 }}>{c.claim}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 11, fontWeight: 600, color: c.tagColor.c, background: c.tagColor.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{c.tag}</span>
                  </div>
                ))}
              </div>
            ) : (
              empty()
            )}
          </div>
          {divider}

          <div id="s4" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("④", "4관점 분석")}
            {detail ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
                  {detail.perspectives.map((p, i) => (
                    <div key={i} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, padding: 15 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.primary, marginBottom: 8 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#5A6473", lineHeight: 1.6 }}>{p.summary}</div>
                    </div>
                  ))}
                </div>
                <div style={{ border: "1px solid #EDD3D3", borderRadius: 10, padding: "16px 18px", background: "#FCF6F6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B02A30" }}>레드팀 관점</span>
                    <span style={{ fontSize: 10.5, color: "#C08A87", background: "#F7E7E6", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>반대 관점 전용</span>
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#8A5B58", marginBottom: 7 }}>취약가정 TOP 3</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {detail.redTeam.weak.map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#5A4A48", lineHeight: 1.45 }}>
                        <span style={{ color: "#B02A30", fontWeight: 700 }}>·</span>
                        {w}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #EDD3D3", borderRadius: 8, padding: "11px 13px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B02A30", marginBottom: 4 }}>최악 시나리오</div>
                    <div style={{ fontSize: 12, color: "#5A4A48", lineHeight: 1.55 }}>{detail.redTeam.worst}</div>
                  </div>
                </div>
              </>
            ) : (
              empty()
            )}
          </div>
          {divider}

          <div id="s5" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑤", "찬성 · 반대 논거")}
            {detail ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ border: "1px solid #D6E7DE", borderRadius: 10, padding: 15, background: "#F6FBF8" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.green, marginBottom: 11 }}>찬성 논거</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {detail.pros.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4656", lineHeight: 1.5 }}>
                        <span style={{ color: colors.green, fontWeight: 700, marginTop: -1 }}>+</span>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ border: "1px solid #EDD9C0", borderRadius: 10, padding: 15, background: "#FCF9F3" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.amber, marginBottom: 11 }}>반대 · 유의 논거</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {detail.cons.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4656", lineHeight: 1.5 }}>
                        <span style={{ color: colors.amber, fontWeight: 700, marginTop: -1 }}>–</span>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              empty()
            )}
          </div>
          {divider}

          <div id="s6" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑥", "심의 점수")}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {detail
                ? detail.scores.map((s) => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 12.5, color: "#3A4656", width: 130, flexShrink: 0, fontWeight: 500 }}>{s.label}</span>
                      <div style={{ flex: 1, height: 8, background: "#EEF1F4", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, width: 64, textAlign: "right" }}>
                        {s.valStr} <span style={{ fontWeight: 500, color: colors.textFaint }}>/ {s.max}</span>
                      </span>
                    </div>
                  ))
                : empty()}
            </div>
          </div>
          {divider}

          <div id="s65" style={{ scrollMarginTop: 80 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#AAB2BD" }}>⑥.5</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>취약가정 ↔ 선행조건 매핑</h3>
            </div>
            <p style={{ fontSize: 12, color: "#9AA3AF", margin: "0 0 14px" }}>레드팀이 지적한 취약가정이 어떤 선행조건(충족 조건)으로 해소되는지 대응 관계를 정리합니다.</p>
            {detail ? (
              <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.5fr", background: "#F7F9FB", padding: "10px 16px", fontSize: 11.5, fontWeight: 600, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}` }}>
                  <div>취약가정</div>
                  <div>선행조건</div>
                  <div style={{ textAlign: "right" }}>이행</div>
                </div>
                {detail.mapRows.map((r, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.5fr", padding: "12px 16px", borderBottom: `1px solid ${colors.borderLight}`, alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 12, color: "#3A4656", lineHeight: 1.4 }}>{r.a}</div>
                    <div style={{ fontSize: 12, color: "#5A6473", lineHeight: 1.4 }}>{r.c}</div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 600, color: r.sColor.c, background: r.sColor.bg, padding: "2px 8px", borderRadius: 16, whiteSpace: "nowrap" }}>{r.s}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              empty()
            )}
          </div>
          {divider}

          <div id="s7" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑦", "최종 권고")}
            <div style={{ border: "1px dashed #C9D3E0", background: "#F7F9FB", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#3B5A86", background: colors.primaryLight, padding: "2px 6px", borderRadius: 4 }}>AI 분석 권고</span>
                <span style={{ fontSize: 10.5, color: "#9AA3AF" }}>참고용 — 위원회 의결로 대체됨</span>
              </div>
              <span style={{ display: "inline-block", fontSize: 14, fontWeight: 700, color: colors.amber, background: colors.amberBg, border: `1px solid ${colors.amberBorder}`, padding: "7px 15px", borderRadius: 8 }}>{review.aiRec || "AI 분석 전"}</span>
              <p style={{ fontSize: 12.5, color: "#5A6473", lineHeight: 1.65, margin: "12px 0 0" }}>{detail?.recommendationReason}</p>
            </div>
          </div>
          {divider}

          <div id="s8" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑧", "추가 확인 필요 항목")}
            {detail ? (
              <>
                <div style={{ border: "1px solid #E7C9C9", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ background: "#FBEEED", padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: "#B02A30" }}>⚠ 치명적 정보 부족 · 권고 제한 사유</div>
                  {detail.criticalGaps.map((g, i) => (
                    <div key={i} style={{ padding: "12px 16px", fontSize: 12.5, color: "#5A4A48", lineHeight: 1.5, background: "#fff" }}>
                      {g}
                    </div>
                  ))}
                </div>
                <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: "#F7F9FB", padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: "#5A6473" }}>일반 추가 확인 항목</div>
                  {detail.normalGaps.map((g, i) => (
                    <div key={i} style={{ padding: "11px 16px", fontSize: 12.5, color: "#3A4656", borderTop: `1px solid ${colors.borderLight}`, display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 15, height: 15, border: "1.5px solid #CDD3DB", borderRadius: 4, flexShrink: 0 }} />
                      {g}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              empty()
            )}
          </div>
          {divider}
          <div id="s9" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑨", "대화 이력")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.turns.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "78%", background: colors.primary, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "12px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {t.payload.files?.length > 0 && <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>📎 {t.payload.files.map((f) => f.name).join(", ")}</div>}
                      {t.payload.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: colors.primaryLight, color: "#3B5A86", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>AI</div>
                    <AiMessage data={t.payload.reduce(applyEvent, newLiveMessage())} />
                  </div>
                )
              )}
            </div>

          </div>
        </div>
      </div>

      <div style={{ ...card, marginTop: 16, overflow: "hidden" }}>
        <div style={{ background: colors.navy, color: "#fff", padding: "15px 24px", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>위원회 최종 결정</span>
          <span style={{ fontSize: 11, color: "#9DB0C7", marginLeft: 6 }}>최종 결정 영역 · AI 분석과 별개</span>
        </div>
        <DecisionForm review={data} onSaved={reload} />
      </div>
    </div>
  );
}

// 접수 정보는 AI가 1차 추출하지만 틀릴 수 있다. 한 번 고치면 이후 AI 재파싱이 덮어쓰지 않는다(서버 manual_edited).
function IntakeForm({ review, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!open)
    return (
      <button onClick={() => { setForm({ company: review.company || "", assetType: review.assetType || "", sector: review.sector || "", totalInvest: review.totalInvest ?? "", basePrice: review.basePrice ?? "", reviewLevel: review.reviewLevel || "" }); setOpen(true); }} style={{ ...backBtn, marginTop: 14, marginBottom: 0 }}>
        ✎ 접수 정보 수정
      </button>
    );
  async function save() {
    setSaving(true);
    try {
      await patchReview(review.id, {
        company: form.company || null,
        assetType: form.assetType || null,
        sector: form.sector || null,
        totalInvest: form.totalInvest === "" ? null : Number(form.totalInvest),
        basePrice: form.basePrice === "" ? null : Number(form.basePrice),
        reviewLevel: form.reviewLevel || null,
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14, maxWidth: 560 }}>
      <input style={input} placeholder="안건명" value={form.company} onChange={set("company")} />
      <select style={input} value={form.assetType} onChange={set("assetType")}>
        <option value="">자산유형</option>
        {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input style={input} placeholder="업종" value={form.sector} onChange={set("sector")} />
      <input style={input} type="number" placeholder="총 투자비(억원)" value={form.totalInvest} onChange={set("totalInvest")} />
      <input style={input} type="number" placeholder="기준가(억원)" value={form.basePrice} onChange={set("basePrice")} />
      <select style={input} value={form.reviewLevel} onChange={set("reviewLevel")}>
        <option value="">검토 수준</option>
        {REVIEW_LEVELS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ ...input, width: "auto", background: colors.primary, color: "#fff", border: "none", cursor: "pointer" }}>저장</button>
        <button onClick={() => setOpen(false)} style={{ ...input, width: "auto", cursor: "pointer" }}>취소</button>
      </div>
    </div>
  );
}

// 위원회 결정을 넣으면 status 가 '완료'가 되고, 비우면 '심의 대기'로 돌아간다(서버 규칙).
function DecisionForm({ review, onSaved }) {
  const [committee, setCommittee] = useState(review.committee || "");
  const [note, setNote] = useState(review.committeeNote || "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await patchReview(review.id, { committee: committee || null, committeeNote: note || null });
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ padding: "22px 24px", display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {["", ...COMMITTEES].map((v) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${committee === v ? colors.navy : colors.border}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontSize: 13 }}>
            <input type="radio" name="committee" value={v} checked={committee === v} onChange={() => setCommittee(v)} />
            {v || "미결 (심의 전)"}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea style={{ ...input, minHeight: 120, resize: "vertical" }} placeholder="의결 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={save} disabled={saving} style={{ background: colors.navy, color: "#fff", border: "none", borderRadius: 9, padding: 12, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          {saving ? "저장 중…" : "최종 의결 확정"}
        </button>
        {review.decidedAt && <div style={{ fontSize: 11, color: colors.textMuted }}>결정일 {review.decidedAt}</div>}
      </div>
    </div>
  );
}
