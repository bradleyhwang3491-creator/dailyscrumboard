import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ────────────────────── Gemini 설정 ────────────────────── */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const FALLBACK_MODELS = [
  { ver: "v1beta", name: "gemini-2.5-flash-preview-04-17" },
  { ver: "v1beta", name: "gemini-2.5-flash-preview-05-20" },
  { ver: "v1beta", name: "gemini-2.5-flash" },
  { ver: "v1",     name: "gemini-2.0-flash" },
  { ver: "v1",     name: "gemini-1.5-flash" },
];

/* ────────────────────── 헬퍼 ────────────────────── */
function toDate8(iso) { return iso ? iso.replace(/-/g, "") : ""; }

const STATUS_LABEL = { TODO: "TO-DO", PROGRESS: "진행 중", HOLDING: "보류", COMPLETE: "완료" };

/** Gemini API 호출 (모델 폴백 포함) */
async function callGemini(prompt) {
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.65, maxOutputTokens: 2048 },
  });

  let lastError = "";
  for (const { ver, name } of FALLBACK_MODELS) {
    const url = `https://generativelanguage.googleapis.com/${ver}/models/${name}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reqBody,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson?.error?.message ?? `HTTP ${res.status}`;
        continue;
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) return { ok: true, text };
    } catch (e) {
      lastError = e.message;
    }
  }
  return { ok: false, error: lastError };
}

/* ════════════════════ 메인 컴포넌트 ════════════════════ */
function AIWeeklyReportPage() {
  const { user } = useAuth();

  const today   = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  /* 조회 조건 */
  const [fromDate,     setFromDate]     = useState(weekAgo);
  const [toDate,       setToDate]       = useState(today);
  const [taskType1Cd,  setTaskType1Cd]  = useState("");
  const [searchUserId, setSearchUserId] = useState("");

  /* 마스터 데이터 */
  const [tm1,       setTm1]       = useState([]);
  const [deptUsers, setDeptUsers] = useState([]);
  const [userMap,   setUserMap]   = useState({});

  /* 결과 — 두 리포트 독립 저장 */
  const [reports,    setReports]    = useState({ normal: "", formal: "" });
  const [loadingMap, setLoadingMap] = useState({ normal: false, formal: false });
  const [errorMsg,   setErrorMsg]   = useState("");

  /* 활성 탭 */
  const [activeTab,  setActiveTab]  = useState("normal"); // 'normal' | 'formal'
  const [copiedTab,  setCopiedTab]  = useState("");

  useEffect(() => { fetchMasterData(); }, []);

  async function fetchMasterData() {
    const [{ data: d1 }, { data: users }] = await Promise.all([
      supabase.from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL", "1").order("TASK_NAME"),
      supabase.from("SCRUMBOARD_USER").select("ID, NAME, DEPT_CD"),
    ]);
    if (d1) setTm1(d1);
    if (users) {
      const map = {};
      users.forEach((u) => { map[u.ID] = u.NAME; });
      setUserMap(map);
      const myDept = user?.deptCd;
      setDeptUsers(myDept ? users.filter((u) => u.DEPT_CD === myDept) : users);
    }
  }

  /* ── REPORT 동시 생성 ── */
  async function handleGenerate() {
    setErrorMsg("");
    setReports({ normal: "", formal: "" });

    if (!fromDate || !toDate) { setErrorMsg("조회 기간을 선택해주세요."); return; }
    if (fromDate > toDate)    { setErrorMsg("시작일이 종료일보다 늦을 수 없습니다."); return; }

    setLoadingMap({ normal: true, formal: true });

    try {
      /* 1. TASK_BOARD 조회 */
      let query = supabase
        .from("TASK_BOARD").select("*")
        .gte("INSERT_DATE", toDate8(fromDate))
        .lte("INSERT_DATE", toDate8(toDate))
        .order("INSERT_DATE", { ascending: true });

      if (taskType1Cd)  query = query.eq("TASK_GUBUN1", taskType1Cd);
      if (searchUserId) query = query.eq("ID", searchUserId);

      const { data: tasks, error: dbError } = await query;

      if (dbError) { setErrorMsg("데이터 조회 오류: " + dbError.message); return; }
      if (!tasks || tasks.length === 0) {
        setErrorMsg("조회 조건에 해당하는 업무 데이터가 없습니다. 기간 또는 조건을 변경해 주세요.");
        return;
      }

      /* 2. 데이터 텍스트 변환 */
      const period   = `${fromDate} ~ ${toDate}`;
      const dataText = tasks.map((t, i) => {
        const parts = [
          `[업무 ${i + 1}]`,
          `제목: ${t.TITLE ?? ""}`,
          `상태: ${STATUS_LABEL[t.STATUS] ?? t.STATUS ?? ""}`,
          `중요도: ${t.IMPORTANT_GUBUN ?? "일반"}`,
          `등록자: ${userMap[t.ID] ?? t.ID ?? ""}`,
          `등록일: ${t.INSERT_DATE ?? ""}`,
          t.DUE_EXPECT_DATE        ? `완료예정일: ${t.DUE_EXPECT_DATE}` : null,
          t.COMPLETE_DATE          ? `실제완료일: ${t.COMPLETE_DATE}`   : null,
          t.TASK_CONTENT?.trim()   ? `작업내용: ${t.TASK_CONTENT}`      : null,
          t.LEADER_KNOW?.trim()    ? `팀장공유: ${t.LEADER_KNOW}`       : null,
          t.ISSUE?.trim()
            ? `이슈: ${t.ISSUE} (해결여부: ${t.ISSUE_COMPLETE_YN === "Y" ? "해결" : "미해결"})`
            : null,
        ];
        return parts.filter(Boolean).join("\n");
      }).join("\n\n");

      /* 3. 두 프롬프트 구성 */
      const promptNormal = `다음은 ${period} 기간의 업무 데이터(총 ${tasks.length}건)입니다.\n\n${dataText}\n\n위 데이터를 분석하여 아래 형식으로 보기 좋은 업무 리포트를 한국어로 작성해주세요. 각 섹션은 빈 줄로 구분해주세요.\n\n1. 📊 업무 현황 요약\n   - 전체 업무 수 및 상태별 현황 (TO-DO / 진행 중 / 보류 / 완료)\n   - 중요도별 현황 (일반 / 긴급 / 초긴급)\n\n2. 📝 주요 업무 내용 요약\n   - 각 업무의 핵심 내용을 간결하게 정리\n\n3. 🚨 이슈사항 요약\n   - 이슈가 등록된 업무 목록과 내용 정리\n   - 미해결 이슈와 해결된 이슈를 구분하여 표시\n\n4. ✅ 완료 업무 정리\n   - 완료 처리된 업무 목록을 정리`;

      const promptFormal = `다음은 ${period} 기간의 업무 데이터(총 ${tasks.length}건)입니다.\n\n${dataText}\n\n위 데이터를 바탕으로 팀장님께 보고하는 주간업무보고서를 한국어로 작성해주세요. 아래 형식을 따르되, 전문적이고 간결하며 보고에 적합한 어투로 작성해주세요.\n\n■ 주간업무보고서\n보고기간: ${period}\n\n1. 이번 주 완료 업무\n2. 현재 진행 중인 업무\n3. 보류/지연 업무 및 사유\n4. 이슈 및 리스크 사항\n5. 다음 주 예정 업무\n6. 건의/협조 요청 사항`;

      /* 4. 두 API 동시 호출 */
      const [resNormal, resFormal] = await Promise.allSettled([
        callGemini(promptNormal),
        callGemini(promptFormal),
      ]);

      const normalText = resNormal.status === "fulfilled" && resNormal.value.ok
        ? resNormal.value.text : "";
      const formalText = resFormal.status === "fulfilled" && resFormal.value.ok
        ? resFormal.value.text : "";

      if (!normalText && !formalText) {
        const err = resNormal.status === "fulfilled"
          ? resNormal.value.error
          : resNormal.reason?.message ?? "알 수 없는 오류";
        setErrorMsg("Gemini API 오류: " + err);
        return;
      }

      setReports({ normal: normalText, formal: formalText });

    } catch (e) {
      setErrorMsg("오류가 발생했습니다: " + e.message);
    } finally {
      setLoadingMap({ normal: false, formal: false });
    }
  }

  const isLoading = loadingMap.normal || loadingMap.formal;
  const hasResult = reports.normal || reports.formal;

  /* ── 복사 ── */
  async function handleCopy(type) {
    const text = reports[type];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedTab(type);
    setTimeout(() => setCopiedTab(""), 2200);
  }

  /* ── render ── */
  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>AI Weekly Report</h2>
      </div>

      {/* ── 조회 조건 + 생성 버튼 (한 줄) ── */}
      <div style={s.filterCard}>
        <div style={s.filterRow}>
          {/* 조회 기간 */}
          <div style={s.filterField}>
            <label style={s.filterLabel}>조회 기간</label>
            <div style={s.dateRange}>
              <input type="date" style={s.dateInput} value={fromDate}
                onChange={(e) => setFromDate(e.target.value)} />
              <span style={s.rangeSep}>~</span>
              <input type="date" style={s.dateInput} value={toDate}
                onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          {/* 업무구분 */}
          <div style={s.filterField}>
            <label style={s.filterLabel}>업무구분</label>
            <select style={s.filterSelect} value={taskType1Cd}
              onChange={(e) => setTaskType1Cd(e.target.value)}>
              <option value="">전체</option>
              {tm1.map((t) => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
            </select>
          </div>

          {/* 등록자 */}
          <div style={s.filterField}>
            <label style={s.filterLabel}>등록자</label>
            <select style={s.filterSelect} value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}>
              <option value="">전체</option>
              {deptUsers.map((u) => <option key={u.ID} value={u.ID}>{u.NAME}</option>)}
            </select>
          </div>

          {/* 생성 버튼 — 같은 라인 하단 정렬 */}
          <div style={s.btnField}>
            <button style={isLoading ? s.genBtnDisabled : s.genBtn}
              onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? "⏳  생성 중..." : "✨  REPORT 생성"}
            </button>
          </div>
        </div>
      </div>

      {/* 오류 메시지 */}
      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      {/* 로딩 */}
      {isLoading && (
        <div style={s.loadingBox}>
          <div style={s.dotRow}>
            <span style={{ ...s.dot, animationDelay: "0s" }} />
            <span style={{ ...s.dot, animationDelay: "0.2s" }} />
            <span style={{ ...s.dot, animationDelay: "0.4s" }} />
          </div>
          <p style={s.loadingText}>AI가 일반 REPORT와 보고서를 동시에 작성하고 있습니다...</p>
        </div>
      )}

      {/* ── 결과 탭 ── */}
      {hasResult && !isLoading && (
        <div style={s.resultCard}>
          {/* 탭 헤더 */}
          <div style={s.tabBar}>
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(activeTab === "normal" ? s.tabActive : s.tabInactive) }}
                onClick={() => setActiveTab("normal")}
              >
                📊 일반 REPORT
                {reports.normal && <span style={{ ...s.tabDot, backgroundColor: activeTab === "normal" ? "#3A3A3A" : "#94A3B8" }} />}
              </button>
              <button
                style={{ ...s.tab, ...(activeTab === "formal" ? s.tabActive : s.tabInactive) }}
                onClick={() => setActiveTab("formal")}
              >
                📋 보고서 작성 REPORT
                {reports.formal && <span style={{ ...s.tabDot, backgroundColor: activeTab === "formal" ? "#3A3A3A" : "#94A3B8" }} />}
              </button>
            </div>
            <button
              style={copiedTab === activeTab ? s.copiedBtn : s.copyBtn}
              onClick={() => handleCopy(activeTab)}
              disabled={!reports[activeTab]}
            >
              {copiedTab === activeTab ? "✅  복사됨!" : "📋  복사하기"}
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          <div style={s.resultBody}>
            {reports[activeTab]
              ? reports[activeTab].split("\n").map((line, i) => {
                  const t = line.trim();
                  if (t === "")                         return <div key={i} style={s.emptyLine} />;
                  if (t.startsWith("# "))               return <p key={i} style={s.h1}>{t.slice(2)}</p>;
                  if (t.startsWith("## "))              return <p key={i} style={s.h2}>{t.slice(3)}</p>;
                  if (t.startsWith("### "))             return <p key={i} style={s.h3}>{t.slice(4)}</p>;
                  if (t.startsWith("■"))                return <p key={i} style={s.sectionHead}>{t}</p>;
                  if (/^\d+\./.test(t))                 return <p key={i} style={s.numbered}>{renderBold(t)}</p>;
                  if (t.startsWith("- ") || t.startsWith("• "))
                    return <p key={i} style={s.bullet}>{renderBold(t.slice(2))}</p>;
                  return <p key={i} style={s.bodyLine}>{renderBold(t)}</p>;
                })
              : <p style={s.emptyTabMsg}>이 유형의 REPORT는 생성되지 않았습니다.</p>
            }
          </div>
        </div>
      )}

      <style>{dotAnimation}</style>
    </div>
  );
}

/* 마크다운 **bold** → <strong> */
function renderBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

const dotAnimation = `
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}`;

/* ════════════════════ 스타일 ════════════════════ */
const s = {
  wrap:      { fontFamily: "'Pretendard', sans-serif" },
  topBar:    { display: "flex", alignItems: "center", marginBottom: "16px" },
  pageTitle: { fontSize: "17px", fontWeight: "600", color: "#2F2F2F", margin: 0 },

  /* 필터 카드 */
  filterCard: {
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "10px",
    padding: "16px 20px", marginBottom: "16px",
  },
  filterRow: {
    display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end",
  },
  filterField: { display: "flex", flexDirection: "column", gap: "6px" },
  filterLabel: { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  dateRange:   { display: "flex", alignItems: "center", gap: "8px" },
  dateInput: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B",
    border: "1px solid #D9D9D9", borderRadius: "5px", padding: "7px 10px", outline: "none",
  },
  rangeSep:    { fontSize: "13px", color: "#94A3B8", fontWeight: "600" },
  filterSelect: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F",
    border: "1px solid #D9D9D9", borderRadius: "5px",
    padding: "7px 10px", outline: "none", minWidth: "140px", cursor: "pointer",
  },

  /* 생성 버튼 필드 — 다른 필드들과 하단 정렬 */
  btnField: { display: "flex", flexDirection: "column", justifyContent: "flex-end" },
  genBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none",
    borderRadius: "7px", padding: "8px 24px", cursor: "pointer", whiteSpace: "nowrap",
  },
  genBtnDisabled: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#94A3B8", border: "none",
    borderRadius: "7px", padding: "8px 24px", cursor: "not-allowed", whiteSpace: "nowrap",
  },

  /* 오류 */
  errorBox: {
    backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px",
    padding: "12px 16px", fontSize: "13px", color: "#DC2626", marginBottom: "12px",
  },

  /* 로딩 */
  loadingBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "14px", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8",
    borderRadius: "10px", padding: "48px 24px", marginBottom: "16px",
  },
  dotRow:      { display: "flex", gap: "8px" },
  dot: {
    display: "inline-block", width: "10px", height: "10px",
    borderRadius: "50%", backgroundColor: "#3A3A3A",
    animation: "dotBounce 1.2s infinite ease-in-out",
  },
  loadingText: { fontSize: "13px", color: "#94A3B8", margin: 0 },

  /* 결과 카드 */
  resultCard: {
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8",
    borderRadius: "10px", overflow: "hidden",
  },

  /* 탭 바 */
  tabBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderBottom: "1px solid #E8E8E8", backgroundColor: "#F8FAFC",
    padding: "0 20px",
  },
  tabs: { display: "flex" },
  tab: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500",
    border: "none", backgroundColor: "transparent", cursor: "pointer",
    padding: "14px 18px", display: "flex", alignItems: "center", gap: "6px",
    borderBottom: "2px solid transparent", marginBottom: "-1px",
  },
  tabActive: {
    color: "#1E293B", fontWeight: "700",
    borderBottomColor: "#3A3A3A",
  },
  tabInactive: {
    color: "#94A3B8",
    borderBottomColor: "transparent",
  },
  tabDot: {
    display: "inline-block", width: "6px", height: "6px",
    borderRadius: "50%",
  },
  copyBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500",
    color: "#3A3A3A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9",
    borderRadius: "5px", padding: "6px 14px", cursor: "pointer",
  },
  copiedBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600",
    color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC",
    borderRadius: "5px", padding: "6px 14px", cursor: "pointer",
  },
  resultBody:   { padding: "20px 28px", maxHeight: "640px", overflowY: "auto" },
  emptyTabMsg:  { fontSize: "13px", color: "#CBD5E1", textAlign: "center", padding: "40px 0" },

  /* 리포트 텍스트 */
  h1:         { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: "16px 0 6px" },
  h2:         { fontSize: "15px", fontWeight: "700", color: "#1E293B", margin: "14px 0 4px" },
  h3:         { fontSize: "14px", fontWeight: "600", color: "#334155", margin: "10px 0 4px" },
  sectionHead:{ fontSize: "15px", fontWeight: "700", color: "#1E293B", margin: "14px 0 4px", borderBottom: "1px solid #E2E8F0", paddingBottom: "4px" },
  numbered:   { fontSize: "14px", fontWeight: "600", color: "#1E293B", margin: "10px 0 4px" },
  bullet:     { fontSize: "13px", color: "#334155", margin: "3px 0", paddingLeft: "12px", lineHeight: "1.65" },
  bodyLine:   { fontSize: "13px", color: "#475569", margin: "3px 0", lineHeight: "1.65" },
  emptyLine:  { height: "8px" },
};

export default AIWeeklyReportPage;
