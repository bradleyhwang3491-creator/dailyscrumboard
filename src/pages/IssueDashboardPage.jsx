import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ── Gemini 설정 (AIWeeklyReport 동일 패턴) ── */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FALLBACK_MODELS = [
  { ver: "v1beta", name: "gemini-2.5-flash-preview-04-17" },
  { ver: "v1beta", name: "gemini-2.5-flash" },
  { ver: "v1beta", name: "gemini-2.0-flash" },
];
async function callGemini(prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
  });
  let lastErr = "";
  for (const { ver, name } of FALLBACK_MODELS) {
    const url = `https://generativelanguage.googleapis.com/${ver}/models/${name}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body });
      if (!res.ok) { const j = await res.json().catch(()=>({})); lastErr = j?.error?.message ?? `HTTP ${res.status}`; continue; }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) return { ok: true, text };
      lastErr = `${name}: 빈 응답`;
    } catch(e) { lastErr = e.message; }
  }
  return { ok: false, error: lastErr };
}

/* ── 배지 ── */
const LEVEL_STYLE = {
  긴급: { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  상:   { bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },
  중:   { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  하:   { bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
};

function formatDate(val) {
  if (!val) return "-";
  return String(val).slice(0, 10).replace(/-/g, ".");
}

function calcElapsed(reqDate, fixDate) {
  if (!reqDate || !fixDate) return null;
  const d = Math.round((new Date(fixDate) - new Date(reqDate)) / 86400000);
  return d;
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, sub, color, bg, border, icon, large }) {
  return (
    <div style={{
      backgroundColor: bg ?? "#fff",
      border: `1px solid ${border ?? "#E2E8F0"}`,
      borderRadius: "12px",
      padding: large ? "18px 22px" : "14px 18px",
      display: "flex", flexDirection: "column", gap: "6px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      flex: 1, minWidth: 0,
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:"12px", fontWeight:"600", color: color ?? "#64748B" }}>{label}</span>
        {icon && <span style={{ fontSize:"18px" }}>{icon}</span>}
      </div>
      <span style={{ fontSize: large ? "36px" : "28px", fontWeight:"800", color: color ?? "#1E293B", lineHeight:1 }}>{value}</span>
      {sub && <span style={{ fontSize:"12px", color: color ?? "#64748B" }}>{sub}</span>}
    </div>
  );
}

/* ── 진행바 ── */
function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{ flex:1, height:"8px", backgroundColor:"#F1F5F9", borderRadius:"99px", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", backgroundColor: color, borderRadius:"99px", transition:"width 0.5s" }} />
      </div>
      <span style={{ fontSize:"12px", fontWeight:"700", color, minWidth:"36px", textAlign:"right" }}>{pct}%</span>
    </div>
  );
}

const TEST_GUBUN_OPTIONS = ["개발자테스트", "단위테스트", "통합테스트", "MA"];

/* ── 헬퍼 컴포넌트 ── */
function Spinner({ size = 14, thick = 2, color = "#fff" }) {
  return (
    <span style={{
      display: "inline-block",
      width: `${size}px`,
      height: `${size}px`,
      border: `${thick}px solid ${color}`,
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0,
    }} />
  );
}

function AiBlock({ title, children, style }) {
  return (
    <div style={{
      backgroundColor: "#1E293B",
      borderRadius: "12px",
      padding: "16px 20px",
      ...style,
    }}>
      <p style={{
        margin: "0 0 12px",
        fontSize: "12px",
        fontWeight: "700",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>{title}</p>
      {children}
    </div>
  );
}

function ErrTypeBlock({ label, color, bg, border, items }) {
  return (
    <div style={{
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: "10px",
      padding: "12px 14px",
    }}>
      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color }}>
        {label}
        <span style={{ marginLeft: "6px", fontSize: "11px", fontWeight: "500" }}>({items.length}건)</span>
      </p>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>해당 없음</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#CBD5E1" }}>
              <span style={{ fontWeight: "600" }}>{item.title}</span>
              {item.menuNm && <span style={{ color: "#64748B" }}> — {item.menuNm}</span>}
              {item.reason && (
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94A3B8" }}>{item.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IssueDashboardPage() {
  const { user } = useAuth();

  const getToday    = () => new Date().toISOString().split("T")[0];
  const getMonthAgo = () => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().split("T")[0]; };

  const [tm1List,       setTm1List]       = useState([]);
  const [searchTask,    setSearchTask]    = useState("");
  const [searchTest,    setSearchTest]    = useState("");
  const [searchFrom,    setSearchFrom]    = useState(getMonthAgo);
  const [searchTo,      setSearchTo]      = useState(getToday);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);
  const [rows,          setRows]          = useState([]);

  // AI 리포트 상태
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiReport,   setAiReport]   = useState(null);   // 파싱된 JSON
  const [aiError,    setAiError]    = useState(null);
  const aiRef = useRef(null);

  useEffect(() => { loadMasters(); }, [user]);

  async function loadMasters() {
    const dept = user?.deptCd;
    let q = supabase.from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL","1").order("TASK_NAME");
    if (dept) q = q.eq("DEPT_CD", dept);
    const { data } = await q;
    setTm1List(data ?? []);
  }

  async function handleSearch() {
    setLoading(true); setSearched(true); setAiReport(null); setAiError(null);
    let q = supabase.from("SYSTEM_ERRORREPORT").select("*").order("ID", { ascending: false });
    if (searchTask)  q = q.eq("TASK_ID", searchTask);
    if (searchTest)  q = q.eq("TEST_GUBUN", searchTest);
    if (searchFrom)  q = q.gte("INSERT_DT", searchFrom);
    if (searchTo)    q = q.lte("INSERT_DT", searchTo + "T23:59:59");
    const { data, error } = await q;
    if (!error) setRows(data ?? []);
    setLoading(false);
  }

  function handleReset() {
    setSearchTask(""); setSearchTest("");
    setSearchFrom(getMonthAgo()); setSearchTo(getToday());
    setRows([]); setSearched(false); setAiReport(null); setAiError(null);
  }

  // ── 통계 계산 ────────────────────────────────────────────
  const total      = rows.length;
  const errRows    = rows.filter(r => r.ERROR_GUBUN === "오류");
  const impRows    = rows.filter(r => r.ERROR_GUBUN === "개선");
  const byLevel    = { 긴급:0, 상:0, 중:0, 하:0 };
  errRows.forEach(r => { if (byLevel[r.IMPORTANT_LEVEL] !== undefined) byLevel[r.IMPORTANT_LEVEL]++; });

  const completeRows = rows.filter(r => r.COMPLETE_YN === "Y");
  const pendingRows  = rows.filter(r => r.COMPLETE_YN !== "Y");
  const delayedRows  = completeRows.filter(r => {
    const e = calcElapsed(r.FIX_REQUEST_DATE, r.FIX_DATE);
    return e !== null && e > 0;
  });
  const pendingDelayed = pendingRows.filter(r => {
    if (!r.FIX_REQUEST_DATE) return false;
    return new Date(r.FIX_REQUEST_DATE) < new Date();
  });
  const totalDelayed = delayedRows.length + pendingDelayed.length;

  const avgElapsed = (() => {
    const arr = completeRows
      .map(r => calcElapsed(r.FIX_REQUEST_DATE, r.FIX_DATE))
      .filter(n => n !== null);
    if (!arr.length) return null;
    return (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1);
  })();

  const completePct = total > 0 ? Math.round((completeRows.length / total) * 100) : 0;

  // ── AI 리포트 ─────────────────────────────────────────────
  async function handleAiAnalysis() {
    if (!rows.length) { alert("먼저 데이터를 조회해주세요."); return; }
    if (!GEMINI_API_KEY) { setAiError("GEMINI API 키가 설정되지 않았습니다. .env에 VITE_GEMINI_API_KEY를 추가해주세요."); return; }
    setAiLoading(true); setAiReport(null); setAiError(null);
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);

    // RAW DATA 전체 구성
    const errData = errRows.map(r => ({
      id: r.ID,
      title: r.ERROR_TITLE ?? "",
      menuNm: r.MENU_NM ?? "",
      menuPath: r.MENU_PATH ?? "",
      level: r.IMPORTANT_LEVEL ?? "",
      testGubun: r.TEST_GUBUN ?? "",
      content: r.ERROR_CONTENT ?? "",
      fixRequestDate: r.FIX_REQUEST_DATE ?? "",
      fixDate: r.FIX_DATE ?? "",
      completeYn: r.COMPLETE_YN ?? "N",
      leadTimeDays: calcElapsed(r.FIX_REQUEST_DATE, r.FIX_DATE),
    }));
    const impData = impRows.map(r => ({
      id: r.ID,
      title: r.ERROR_TITLE ?? "",
      menuNm: r.MENU_NM ?? "",
      content: r.ERROR_CONTENT ?? "",
      level: r.IMPORTANT_LEVEL ?? "",
      completeYn: r.COMPLETE_YN ?? "N",
    }));

    const prompt = `당신은 소프트웨어 QA/품질 관리 전문가입니다. 아래 이슈 관리 RAW DATA를 분석하여 한국어로 전문적인 분석 리포트를 JSON 형식으로 작성해주세요.

=== 오류(버그) 데이터 (총 ${errData.length}건) ===
${JSON.stringify(errData, null, 2)}

=== 개선요청 데이터 (총 ${impData.length}건) ===
${JSON.stringify(impData, null, 2)}

=== 통계 요약 ===
- 전체 이슈: ${total}건 (오류 ${errRows.length}건 / 개선 ${impRows.length}건)
- 조치완료: ${completeRows.length}건 (${completePct}%)
- 지연건수: ${totalDelayed}건
- 평균 리드타임: ${avgElapsed ?? "N/A"}일

다음 항목을 분석하여 JSON으로 반환해주세요:

1. narrative: 전체 오류/조치 현황을 3~5문장의 전문적인 내러티브 문단으로 요약
2. errAnalysis: 오류 내용 분석
   - backendIssues: 백엔드/서버 오류로 분류되는 항목 배열 [{title, menuNm, reason}]
   - frontIssues: 프론트엔드/퍼블리싱 오류로 분류되는 항목 배열 [{title, menuNm, reason}]
   - planIssues: 기획/설계 오류로 분류되는 항목 배열 [{title, menuNm, reason}]
   - summary: 오류 유형별 분석 요약 문장 (2~3문장)
3. actionAnalysis: 조치 현황 분석
   - summary: 조치 완료율, 리드타임, 지연 현황을 종합한 분석 문장 (2~3문장)
   - highlights: 주목할 만한 조치 현황 포인트 배열 (문자열 2~3개)
   - riskItems: 지연되고 있거나 위험한 미완료 이슈 [{title, menuNm, reason}] (최대 5건)
4. impAnalysis: 개선요청 분석
   - summary: 개선요청 전체 동향 요약 문장 (2~3문장)
   - list: 개선요청 전체 목록 [{title, menuNm, summary}] (content를 1~2문장으로 요약)
5. insights: 핵심 인사이트 [{type:"danger|warning|success", text:"내용"}] (3개)
6. riskLevel: "높음"|"보통"|"낮음"
7. riskReason: 위험도 판단 근거 (1문장)

반드시 유효한 JSON만 반환하세요. 코드블록(\`\`\`)은 사용하지 마세요.`;

    const result = await callGemini(prompt);
    if (!result.ok) { setAiError("Gemini 분석 실패: " + result.error); setAiLoading(false); return; }

    try {
      // JSON 파싱 — 코드블록 제거 후 파싱
      const cleaned = result.text.replace(/```json|```/g, "").trim();
      setAiReport(JSON.parse(cleaned));
    } catch {
      setAiError("AI 응답 파싱 오류: " + result.text.slice(0, 200));
    }
    setAiLoading(false);
  }

  // ── 스타일 상수 ───────────────────────────────────────────
  const sectionCard = {
    backgroundColor: "#fff", border: "1px solid #E2E8F0",
    borderRadius: "14px", padding: "20px 24px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  };
  const sectionTitle = {
    fontSize: "13px", fontWeight: "700", color: "#1E293B",
    marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px",
  };
  const dot = (color) => ({
    width: "8px", height: "8px", borderRadius: "50%",
    backgroundColor: color, display: "inline-block", flexShrink: 0,
  });

  const taskNameMap = Object.fromEntries(tm1List.map(t => [String(t.TASK_ID), t.TASK_NAME]));

  return (
    <div style={{ fontFamily:"'Pretendard', sans-serif", minHeight:"100%", display:"flex", flexDirection:"column", gap:"20px" }}>

      {/* ── 헤더 ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#1E293B", margin:0 }}>이슈 대시보드</h2>
          <p style={{ fontSize:"13px", color:"#94A3B8", margin:"4px 0 0" }}>프로젝트의 전체 이슈 및 조치 현황을 확인합니다.</p>
        </div>
        {searched && !loading && (
          <span style={{ backgroundColor:"#EFF6FF", color:"#2563EB", fontSize:"13px", fontWeight:"600",
            padding:"4px 14px", borderRadius:"20px", border:"1px solid #BFDBFE" }}>
            총 {total}건
          </span>
        )}
      </div>

      {/* ── 조회 조건 ── */}
      <div style={{ ...sectionCard, padding:"16px 24px" }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:"12px 16px" }}>
          {/* 프로젝트명 */}
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            <label style={{ fontSize:"12px", fontWeight:"600", color:"#475569" }}>프로젝트명</label>
            <select value={searchTask} onChange={e => setSearchTask(e.target.value)} style={sel}>
              {tm1List.map(t => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
            </select>
          </div>
          {/* 테스트구분 */}
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            <label style={{ fontSize:"12px", fontWeight:"600", color:"#475569" }}>테스트구분</label>
            <select value={searchTest} onChange={e => setSearchTest(e.target.value)} style={sel}>
              {TEST_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {/* 등록일자 */}
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            <label style={{ fontSize:"12px", fontWeight:"600", color:"#475569" }}>등록일자 (FROM ~ TO)</label>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <input type="date" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} style={dateInp} />
              <span style={{ color:"#94A3B8", fontSize:"13px" }}>~</span>
              <input type="date" value={searchTo}   onChange={e => setSearchTo(e.target.value)}   style={dateInp} />
            </div>
          </div>
          {/* 버튼 */}
          <div style={{ display:"flex", gap:"8px", marginLeft:"auto" }}>
            <button onClick={handleReset} style={resetBtn}>초기화</button>
            <button onClick={handleSearch} disabled={loading} style={searchBtn}>
              {loading ? "조회 중..." : "조회"}
            </button>
          </div>
        </div>
      </div>

      {/* ── 대시보드 본문 ── */}
      {!searched ? (
        <div style={{ ...sectionCard, textAlign:"center", padding:"60px 24px", color:"#94A3B8" }}>
          <div style={{ fontSize:"40px", marginBottom:"12px" }}>📊</div>
          <p style={{ fontSize:"14px", margin:0 }}>조회 조건을 입력하고 조회 버튼을 눌러주세요.</p>
        </div>
      ) : loading ? (
        <div style={{ ...sectionCard, textAlign:"center", padding:"60px 24px", color:"#94A3B8" }}>
          <p style={{ fontSize:"14px", margin:0 }}>데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <>
          {/* ── Row 1: 오류현황 + 조치현황 ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>

            {/* 총 오류현황 */}
            <div style={sectionCard}>
              <div style={sectionTitle}>
                <span style={dot("#DC2626")} />
                총 오류현황
                <span style={{ marginLeft:"auto", fontSize:"12px", color:"#94A3B8", fontWeight:"400" }}>
                  총 {errRows.length}건
                </span>
              </div>
              {/* 중요도 카드 (건수 + % 포함) */}
              <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
                {Object.entries(byLevel).map(([lv, cnt]) => {
                  const s   = LEVEL_STYLE[lv];
                  const pct = errRows.length > 0 ? Math.round((cnt / errRows.length) * 100) : 0;
                  return (
                    <div key={lv} style={{ flex:1, backgroundColor:s.bg, border:`1px solid ${s.border}`,
                      borderRadius:"10px", padding:"12px 10px", textAlign:"center" }}>
                      <p style={{ margin:0, fontSize:"11px", fontWeight:"700", color:s.color }}>{lv}</p>
                      <p style={{ margin:"6px 0 0", fontSize:"26px", fontWeight:"800", color:s.color, lineHeight:1 }}>{cnt}</p>
                      <p style={{ margin:"4px 0 0", fontSize:"10px", color:s.color }}>건</p>
                      {/* % 바 */}
                      <div style={{ marginTop:"8px", height:"4px", backgroundColor:"rgba(0,0,0,0.08)", borderRadius:"99px", overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", backgroundColor:s.color, borderRadius:"99px" }} />
                      </div>
                      <p style={{ margin:"4px 0 0", fontSize:"10px", fontWeight:"700", color:s.color }}>{pct}%</p>
                    </div>
                  );
                })}
              </div>
              {/* 개선 개수 */}
              <div style={{ marginTop:"16px", paddingTop:"14px", borderTop:"1px solid #F1F5F9",
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:"13px", color:"#475569", fontWeight:"600" }}>총 개선개수</span>
                <span style={{ fontSize:"20px", fontWeight:"800", color:"#2563EB" }}>{impRows.length}<span style={{ fontSize:"13px", fontWeight:"500", color:"#64748B" }}> 건 제안됨</span></span>
              </div>
            </div>

            {/* 총 조치현황 */}
            <div style={sectionCard}>
              <div style={sectionTitle}>
                <span style={dot("#16A34A")} />
                총 조치현황
              </div>
              {/* 조치율 진행바 */}
              <div style={{ marginBottom:"20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <span style={{ fontSize:"12px", color:"#64748B" }}>전체 조치 완료율</span>
                  <span style={{ fontSize:"12px", fontWeight:"700", color:"#16A34A" }}>{completePct}%</span>
                </div>
                <div style={{ height:"10px", backgroundColor:"#F1F5F9", borderRadius:"99px", overflow:"hidden" }}>
                  <div style={{ width:`${completePct}%`, height:"100%", backgroundColor:"#16A34A",
                    borderRadius:"99px", transition:"width 0.6s" }} />
                </div>
              </div>
              {/* KPI 카드 3개 */}
              <div style={{ display:"flex", gap:"10px" }}>
                <KpiCard label="총 조치대상" value={total} icon="📋"
                  bg="#F8FAFC" border="#E2E8F0" color="#1E293B" />
                <KpiCard label="조치완료" value={completeRows.length}
                  sub={`(${completePct}%)`} icon="✅"
                  bg="#DCFCE7" border="#86EFAC" color="#16A34A" />
                <KpiCard label="지연건수" value={totalDelayed} icon="🚨"
                  bg={totalDelayed > 0 ? "#FEE2E2" : "#F8FAFC"}
                  border={totalDelayed > 0 ? "#FECACA" : "#E2E8F0"}
                  color={totalDelayed > 0 ? "#DC2626" : "#64748B"}
                  sub={totalDelayed > 0 ? "목표일 초과" : "지연 없음"} />
              </div>
              {/* 평균 소요일 */}
              {avgElapsed !== null && (
                <div style={{ marginTop:"16px", paddingTop:"14px", borderTop:"1px solid #F1F5F9",
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"13px", color:"#475569", fontWeight:"600" }}>평균 조치 소요일</span>
                  <span style={{ fontSize:"20px", fontWeight:"800", color: Number(avgElapsed) <= 0 ? "#16A34A" : Number(avgElapsed) <= 3 ? "#D97706" : "#DC2626" }}>
                    {avgElapsed}<span style={{ fontSize:"13px", fontWeight:"500", color:"#64748B" }}> 일</span>
                  </span>
                </div>
              )}
              {/* 미완료 목록 요약 */}
              {pendingRows.length > 0 && (
                <div style={{ marginTop:"14px", paddingTop:"14px", borderTop:"1px solid #F1F5F9" }}>
                  <p style={{ margin:"0 0 8px", fontSize:"12px", fontWeight:"600", color:"#D97706" }}>
                    ⚠ 미완료 이슈 상위 3건
                  </p>
                  {pendingRows.slice(0,3).map(r => (
                    <div key={r.ID} style={{ display:"flex", alignItems:"center", gap:"8px",
                      padding:"6px 0", borderBottom:"1px solid #F8FAFC" }}>
                      <span style={{ fontSize:"10px", padding:"2px 6px", borderRadius:"4px",
                        backgroundColor: LEVEL_STYLE[r.IMPORTANT_LEVEL]?.bg ?? "#F1F5F9",
                        color: LEVEL_STYLE[r.IMPORTANT_LEVEL]?.color ?? "#64748B", fontWeight:"700" }}>
                        {r.IMPORTANT_LEVEL ?? "-"}
                      </span>
                      <span style={{ fontSize:"12px", color:"#334155", flex:1,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r.ERROR_TITLE}
                      </span>
                      <span style={{ fontSize:"11px", color:"#94A3B8", flexShrink:0 }}>
                        ~{formatDate(r.FIX_REQUEST_DATE)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: AI 분석 리포트 ── */}
          <div ref={aiRef} style={{ ...sectionCard, background:"linear-gradient(135deg,#0F172A 0%,#1E293B 100%)", border:"none" }}>
            {/* 헤더 */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"42px", height:"42px", borderRadius:"10px",
                  background:"linear-gradient(135deg,#6366F1,#8B5CF6)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", flexShrink:0 }}>🤖</div>
                <div>
                  <p style={{ margin:0, fontSize:"15px", fontWeight:"700", color:"#fff" }}>AI 분석 리포트</p>
                  <p style={{ margin:"2px 0 0", fontSize:"12px", color:"#64748B" }}>조회된 RAW DATA 전체를 Gemini AI로 분석합니다</p>
                </div>
              </div>
              <button onClick={handleAiAnalysis} disabled={aiLoading || !rows.length} style={{
                padding:"10px 22px", borderRadius:"8px",
                background: aiLoading ? "#374151" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
                border:"none", color:"#fff", fontSize:"13px", fontWeight:"700",
                cursor: aiLoading || !rows.length ? "not-allowed" : "pointer",
                fontFamily:"'Pretendard', sans-serif", opacity: !rows.length ? 0.5 : 1,
                display:"flex", alignItems:"center", gap:"8px",
              }}>
                {aiLoading
                  ? <><Spinner />분석 중...</>
                  : "✨ AI 리포트 생성"}
              </button>
            </div>

            {/* 대기 상태 */}
            {!aiReport && !aiLoading && !aiError && (
              <div style={{ border:"1px dashed #334155", borderRadius:"12px", padding:"36px", textAlign:"center" }}>
                <p style={{ color:"#64748B", fontSize:"14px", margin:0 }}>
                  {rows.length > 0 ? "\'AI 리포트 생성\' 버튼을 눌러 분석을 시작하세요." : "먼저 데이터를 조회해주세요."}
                </p>
              </div>
            )}

            {/* 로딩 */}
            {aiLoading && (
              <div style={{ border:"1px dashed #334155", borderRadius:"12px", padding:"44px", textAlign:"center" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px" }}>
                  <Spinner size={24} thick={3} color="#6366F1" />
                  <span style={{ color:"#94A3B8", fontSize:"14px" }}>Gemini AI가 {rows.length}건의 이슈 데이터를 분석하고 있습니다...</span>
                </div>
              </div>
            )}

            {/* 에러 */}
            {aiError && (
              <div style={{ backgroundColor:"#450A0A", border:"1px solid #7F1D1D", borderRadius:"12px", padding:"16px 20px" }}>
                <p style={{ color:"#FCA5A5", fontSize:"13px", margin:0 }}>⚠ {aiError}</p>
              </div>
            )}

            {/* ── 리포트 결과 ── */}
            {aiReport && (
              <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

                {/* 0. 핵심 인사이트 + 위험도 */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"12px", alignItems:"start" }}>
                  <AiBlock title="💡 핵심 인사이트">
                    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                      {(aiReport.insights ?? []).map((ins, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                          <span style={{ fontSize:"14px", flexShrink:0 }}>
                            {ins.type==="danger"?"🔴":ins.type==="warning"?"🟡":"🟢"}
                          </span>
                          <p style={{ margin:0, fontSize:"13px", color:"#CBD5E1", lineHeight:"1.7" }}>{ins.text}</p>
                        </div>
                      ))}
                    </div>
                  </AiBlock>
                  <AiBlock title="AI 위험도" style={{ minWidth:"150px" }}>
                    <div style={{ textAlign:"center" }}>
                      <span style={{ display:"inline-block", padding:"6px 20px", borderRadius:"99px", fontWeight:"800", fontSize:"15px",
                        backgroundColor: aiReport.riskLevel==="높음"?"#DC2626":aiReport.riskLevel==="보통"?"#D97706":"#16A34A",
                        color:"#fff", marginBottom:"8px" }}>{aiReport.riskLevel}</span>
                      <p style={{ margin:0, fontSize:"12px", color:"#94A3B8", lineHeight:"1.5" }}>{aiReport.riskReason}</p>
                    </div>
                  </AiBlock>
                </div>

                {/* 1. 종합 내러티브 */}
                <AiBlock title="📝 종합 현황 분석">
                  <p style={{ margin:0, fontSize:"13px", color:"#CBD5E1", lineHeight:"1.9", whiteSpace:"pre-wrap" }}>{aiReport.narrative}</p>
                </AiBlock>

                {/* 2. 오류 내용 분석 — 유형별 분류 */}
                <AiBlock title="🔍 오류 내용 분석">
                  <p style={{ margin:"0 0 14px", fontSize:"13px", color:"#CBD5E1", lineHeight:"1.7" }}>{aiReport.errAnalysis?.summary}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
                    <ErrTypeBlock label="🖥 백엔드 오류" color="#DC2626" bg="#450A0A" border="#7F1D1D"
                      items={aiReport.errAnalysis?.backendIssues ?? []} />
                    <ErrTypeBlock label="🎨 프론트/퍼블 오류" color="#D97706" bg="#431407" border="#92400E"
                      items={aiReport.errAnalysis?.frontIssues ?? []} />
                    <ErrTypeBlock label="📋 기획/설계 오류" color="#0369A1" bg="#082F49" border="#075985"
                      items={aiReport.errAnalysis?.planIssues ?? []} />
                  </div>
                </AiBlock>

                {/* 3. 조치 현황 분석 */}
                <AiBlock title="⚡ 조치 현황 분석">
                  <p style={{ margin:"0 0 12px", fontSize:"13px", color:"#CBD5E1", lineHeight:"1.7" }}>{aiReport.actionAnalysis?.summary}</p>
                  {(aiReport.actionAnalysis?.highlights ?? []).length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginBottom:"14px" }}>
                      {aiReport.actionAnalysis.highlights.map((h, i) => (
                        <span key={i} style={{ padding:"4px 12px", backgroundColor:"#1E3A5F", border:"1px solid #1E40AF",
                          borderRadius:"99px", fontSize:"12px", color:"#93C5FD" }}>• {h}</span>
                      ))}
                    </div>
                  )}
                  {(aiReport.actionAnalysis?.riskItems ?? []).length > 0 && (
                    <>
                      <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:"700", color:"#F87171", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                        ⚠ 위험 미완료 이슈
                      </p>
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        {aiReport.actionAnalysis.riskItems.map((item, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px",
                            backgroundColor:"#2D1515", border:"1px solid #7F1D1D", borderRadius:"8px", padding:"10px 12px" }}>
                            <span style={{ fontSize:"11px", fontWeight:"700", color:"#F87171", flexShrink:0, marginTop:"1px" }}>#{i+1}</span>
                            <div>
                              <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color:"#FCA5A5" }}>
                                {item.title}{item.menuNm ? ` — ${item.menuNm}` : ""}
                              </p>
                              <p style={{ margin:"3px 0 0", fontSize:"12px", color:"#94A3B8" }}>{item.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </AiBlock>

                {/* 4. 개선요청 분석 */}
                <AiBlock title="💡 개선요청 분석">
                  <p style={{ margin:"0 0 14px", fontSize:"13px", color:"#CBD5E1", lineHeight:"1.7" }}>{aiReport.impAnalysis?.summary}</p>
                  {(aiReport.impAnalysis?.list ?? []).length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {aiReport.impAnalysis.list.map((item, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px",
                          backgroundColor:"#0F2A1E", border:"1px solid #14532D", borderRadius:"8px", padding:"10px 12px" }}>
                          <span style={{ fontSize:"11px", fontWeight:"700", color:"#4ADE80",
                            minWidth:"22px", textAlign:"center", marginTop:"1px" }}>#{i+1}</span>
                          <div>
                            <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color:"#86EFAC" }}>
                              {item.title}{item.menuNm ? ` — ${item.menuNm}` : ""}
                            </p>
                            <p style={{ margin:"3px 0 0", fontSize:"12px", color:"#94A3B8" }}>{item.summary}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AiBlock>

              </div>
            )}
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </div>
  );
}

/* ── 인라인 스타일 상수 ── */
const sel = {
  padding:"8px 10px", border:"1px solid #CBD5E1", borderRadius:"8px",
  fontSize:"13px", color:"#1E293B", backgroundColor:"#fff",
  fontFamily:"'Pretendard', sans-serif", cursor:"pointer", outline:"none", minWidth:"160px",
};
const dateInp = {
  padding:"7px 10px", border:"1px solid #CBD5E1", borderRadius:"8px",
  fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard', sans-serif", outline:"none",
};
const resetBtn = {
  padding:"9px 20px", border:"1px solid #E2E8F0", borderRadius:"8px",
  backgroundColor:"#F8FAFC", color:"#64748B", fontSize:"13px", fontWeight:"500",
  cursor:"pointer", fontFamily:"'Pretendard', sans-serif",
};
const searchBtn = {
  padding:"9px 28px", border:"none", borderRadius:"8px",
  backgroundColor:"#1E293B", color:"#fff", fontSize:"13px", fontWeight:"600",
  cursor:"pointer", fontFamily:"'Pretendard', sans-serif",
};
