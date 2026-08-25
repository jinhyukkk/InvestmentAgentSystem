import { useState } from "react";
import { colors } from "./theme.js";
import { cssStr } from "./cssStr.js";
import {
  timeline,
  scores,
  conditions,
  claims,
  perspectives,
  redTeam,
  pros,
  cons,
  mapRows,
  criticalGaps,
  normalGaps,
  members,
  financials,
  toc,
} from "./detailData.js";

const card = { background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 14 };
const sectionTitle = (num, title) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: "#AAB2BD" }}>{num}</span>
    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h3>
  </div>
);
const divider = <div style={{ height: 1, background: colors.borderLight, margin: "26px 0" }} />;

export default function CaseDetail({ caseItem, onBack }) {
  const [section, setSection] = useState("s1");

  return (
    <div style={{ padding: "22px 28px 70px", maxWidth: 1240, margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: colors.textMuted, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", padding: 0, marginBottom: 16 }}>
        ← 안건 목록
      </button>

      <div style={{ ...card, padding: "22px 24px", marginBottom: 16, display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary, background: colors.primaryLight, border: "1px solid #D3E0EE", padding: "3px 9px", borderRadius: 5 }}>본심의</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#5A6473", background: "#EEF1F4", padding: "3px 9px", borderRadius: 5 }}>{caseItem?.assetType || "M&A"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: colors.amber, background: colors.amberBg, padding: "3px 9px", borderRadius: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C79A3A" }} />
              심의 대기
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>{caseItem?.company || "대성정밀공업 인수"}</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
            {caseItem?.sector || "자동차 부품"} · 안건번호 IC-2026-047
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 20, flexWrap: "wrap" }}>
            {[
              ["총 투자비", "1,850", "억원"],
              ["기준가", "1,720", "억원"],
              ["접수일", "2026.05.12", ""],
              ["인수 배수", "8.4", "x EV/EBITDA"],
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
        </div>
        <div style={{ width: 220, flexShrink: 0, background: "#F7F9FB", border: "1px dashed #C9D3E0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3B5A86", background: colors.primaryLight, padding: "2px 6px", borderRadius: 4 }}>AI 분석</span>
            <span style={{ fontSize: 10.5, color: "#9AA3AF" }}>참고 지표</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em" }}>82</div>
            <div style={{ fontSize: 15, color: "#9AA3AF" }}>/ 100</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, color: colors.amber, background: colors.amberBg, padding: "6px 12px", borderRadius: 8, width: "100%", textAlign: "center" }}>조건부 투자 승인</span>
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
              <span style={{ fontSize: 22, fontWeight: 700 }}>82</span>
              <span style={{ fontSize: 12, color: "#9AA3AF" }}>/ 100</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {scores.map((s) => (
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
            ))}
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
            조건부 투자 승인
          </span>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5A6473", margin: "16px 0 9px" }}>충족 조건</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {conditions.map((text, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: colors.amberBg, color: colors.amber, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: "#3A4656", lineHeight: 1.45 }}>{text}</span>
              </div>
            ))}
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
            <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "#3A4656", margin: "0 0 12px" }}>
              대성정밀공업은 국내 자동차 정밀가공 부품 전문업체로, 현대·기아를 핵심 고객으로 안정적 매출 기반을 확보하고 있다. 본 인수는 유진그룹 자동차 부품 포트폴리오의 수직 계열화를 완성하고, 정밀가공 역량을 내재화하려는 전략적 목적을 가진다.
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "#3A4656", margin: 0 }}>
              총 투자비 1,850억원, 기준가 1,720억원 규모이며 인수 배수는 EV/EBITDA 8.4배다. AI 분석 결과 전략적 적합성과 실행 가능성은 높게 평가되었으나, 특정 고객 의존도와 전기차 전환 리스크가 조건부 승인의 주요 근거로 도출되었다.
            </p>
          </div>
          {divider}

          <div id="s2" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("②", "핵심 재무 지표")}
            <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", background: "#F7F9FB", padding: "10px 16px", fontSize: 11.5, fontWeight: 600, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}` }}>
                <div>항목 (억원)</div>
                <div style={{ textAlign: "right" }}>2023</div>
                <div style={{ textAlign: "right" }}>2024</div>
                <div style={{ textAlign: "right" }}>2025</div>
              </div>
              {financials.map((f) => (
                <div key={f.label} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "11px 16px", fontSize: 12.5, borderBottom: `1px solid ${colors.borderLight}` }}>
                  <div style={{ color: "#3A4656", fontWeight: 500 }}>{f.label}</div>
                  <div style={{ textAlign: "right" }}>{f.y2023}</div>
                  <div style={{ textAlign: "right" }}>{f.y2024}</div>
                  <div style={{ textAlign: "right", color: f.warn ? "#B02A30" : undefined, fontWeight: f.warn ? 600 : undefined }}>{f.y2025}</div>
                </div>
              ))}
            </div>
          </div>
          {divider}

          <div id="s3" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("③", "매도자 측 주장 검증")}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
              {claims.map((c) => (
                <div key={c.claim} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px", borderBottom: `1px solid ${colors.borderLight}`, background: "#fff" }}>
                  <span style={{ fontSize: 13, color: "#3A4656", lineHeight: 1.4 }}>{c.claim}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 11, fontWeight: 600, color: c.tagColor.c, background: c.tagColor.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{c.tag}</span>
                </div>
              ))}
            </div>
          </div>
          {divider}

          <div id="s4" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("④", "4관점 분석")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              {perspectives.map((p) => (
                <div key={p.name} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, padding: 15 }}>
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
                {redTeam.weak.map((w) => (
                  <div key={w} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#5A4A48", lineHeight: 1.45 }}>
                    <span style={{ color: "#B02A30", fontWeight: 700 }}>·</span>
                    {w}
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", border: "1px solid #EDD3D3", borderRadius: 8, padding: "11px 13px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#B02A30", marginBottom: 4 }}>최악 시나리오</div>
                <div style={{ fontSize: 12, color: "#5A4A48", lineHeight: 1.55 }}>{redTeam.worst}</div>
              </div>
            </div>
          </div>
          {divider}

          <div id="s5" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑤", "찬성 · 반대 논거")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ border: "1px solid #D6E7DE", borderRadius: 10, padding: 15, background: "#F6FBF8" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.green, marginBottom: 11 }}>찬성 논거</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {pros.map((p) => (
                    <div key={p} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4656", lineHeight: 1.5 }}>
                      <span style={{ color: colors.green, fontWeight: 700, marginTop: -1 }}>+</span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ border: "1px solid #EDD9C0", borderRadius: 10, padding: 15, background: "#FCF9F3" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.amber, marginBottom: 11 }}>반대 · 유의 논거</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {cons.map((c) => (
                    <div key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4656", lineHeight: 1.5 }}>
                      <span style={{ color: colors.amber, fontWeight: 700, marginTop: -1 }}>–</span>
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {divider}

          <div id="s6" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑥", "심의 점수")}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {scores.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 12.5, color: "#3A4656", width: 130, flexShrink: 0, fontWeight: 500 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 8, background: "#EEF1F4", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, width: 64, textAlign: "right" }}>
                    {s.valStr} <span style={{ fontWeight: 500, color: colors.textFaint }}>/ {s.max}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          {divider}

          <div id="s65" style={{ scrollMarginTop: 80 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#AAB2BD" }}>⑥.5</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>취약가정 ↔ 선행조건 매핑</h3>
            </div>
            <p style={{ fontSize: 12, color: "#9AA3AF", margin: "0 0 14px" }}>레드팀이 지적한 취약가정이 어떤 선행조건(충족 조건)으로 해소되는지 대응 관계를 정리합니다.</p>
            <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.5fr", background: "#F7F9FB", padding: "10px 16px", fontSize: 11.5, fontWeight: 600, color: colors.textMuted, borderBottom: `1px solid ${colors.borderLight}` }}>
                <div>취약가정</div>
                <div>선행조건</div>
                <div style={{ textAlign: "right" }}>이행</div>
              </div>
              {mapRows.map((r) => (
                <div key={r.a} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.5fr", padding: "12px 16px", borderBottom: `1px solid ${colors.borderLight}`, alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "#3A4656", lineHeight: 1.4 }}>{r.a}</div>
                  <div style={{ fontSize: 12, color: "#5A6473", lineHeight: 1.4 }}>{r.c}</div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 600, color: r.sColor.c, background: r.sColor.bg, padding: "2px 8px", borderRadius: 16, whiteSpace: "nowrap" }}>{r.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {divider}

          <div id="s7" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑦", "최종 권고")}
            <div style={{ border: "1px dashed #C9D3E0", background: "#F7F9FB", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#3B5A86", background: colors.primaryLight, padding: "2px 6px", borderRadius: 4 }}>AI 분석 권고</span>
                <span style={{ fontSize: 10.5, color: "#9AA3AF" }}>참고용 — 위원회 의결로 대체됨</span>
              </div>
              <span style={{ display: "inline-block", fontSize: 14, fontWeight: 700, color: colors.amber, background: colors.amberBg, border: `1px solid ${colors.amberBorder}`, padding: "7px 15px", borderRadius: 8 }}>조건부 투자 승인</span>
              <p style={{ fontSize: 12.5, color: "#5A6473", lineHeight: 1.65, margin: "12px 0 0" }}>
                전략적 적합성과 안정적 현금흐름을 근거로 투자 타당성은 인정되나, 고객 의존도·인수가·우발부채 관련 3개 선행조건 충족을 전제로 한다.
              </p>
            </div>
          </div>
          {divider}

          <div id="s8" style={{ scrollMarginTop: 80 }}>
            {sectionTitle("⑧", "추가 확인 필요 항목")}
            <div style={{ border: "1px solid #E7C9C9", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ background: "#FBEEED", padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: "#B02A30" }}>⚠ 치명적 정보 부족 · 권고 제한 사유</div>
              {criticalGaps.map((g) => (
                <div key={g} style={{ padding: "12px 16px", fontSize: 12.5, color: "#5A4A48", lineHeight: 1.5, background: "#fff" }}>
                  {g}
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${colors.borderLight}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#F7F9FB", padding: "9px 16px", fontSize: 11.5, fontWeight: 700, color: "#5A6473" }}>일반 추가 확인 항목</div>
              {normalGaps.map((g) => (
                <div key={g} style={{ padding: "11px 16px", fontSize: 12.5, color: "#3A4656", borderTop: `1px solid ${colors.borderLight}`, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 15, height: 15, border: "1.5px solid #CDD3DB", borderRadius: 4, flexShrink: 0 }} />
                  {g}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginTop: 16, overflow: "hidden" }}>
        <div style={{ background: colors.navy, color: "#fff", padding: "15px 24px", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>위원 심의 · 의결</span>
          <span style={{ fontSize: 11, color: "#9DB0C7", marginLeft: 6 }}>최종 결정 영역 · AI 분석과 별개</span>
        </div>
        <div style={{ padding: "22px 24px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 26 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5A6473", marginBottom: 14 }}>위원별 심의 의견</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {members.map((m) => (
                <div key={m.name} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.opColor.bg, color: m.opColor.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{m.initial}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: "#9AA3AF" }}>{m.role}</span>
                      <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: m.opColor.c, background: m.opColor.bg, padding: "3px 11px", borderRadius: 20 }}>{m.op}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5A6473", lineHeight: 1.5 }}>{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${colors.borderLight}`, paddingLeft: 26 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5A6473", marginBottom: 4 }}>간사 — 위원회 최종 결정</div>
            <div style={{ fontSize: 11, color: "#9AA3AF", marginBottom: 14 }}>이 화면은 목업 데이터입니다. 실제 의결 저장 기능은 아직 연동되지 않았습니다.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["승인", "조건부 승인", "부결", "추가 검토 후 재상정"].map((label) => (
                <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${colors.border}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontSize: 13 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid #CDD3DB" }} />
                  {label}
                </label>
              ))}
            </div>
            <button style={{ width: "100%", marginTop: 16, background: colors.navy, color: "#fff", border: "none", borderRadius: 9, padding: 12, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "not-allowed" }} disabled>
              최종 의결 확정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
