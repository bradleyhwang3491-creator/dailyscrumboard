import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useLanguage } from "../context/LanguageContext";

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
function fromDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Gemini API 호출 (모델 폴백 포함) */
async function callGemini(prompt) {
  const reqBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
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
  const { user }  = useAuth();
  const isMobile  = useBreakpoint(768);
  const { t }     = useLanguage();

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

  /* 결과 */
  const [report,    setReport]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [copied,    setCopied]    = useState(false);

  const resultRef = useRef(null);

  useEffect(() => { fetchMasterData(); }, []);

  async function fetchMasterData() {
    // 업무구분1: 로그인 사용자 부서만 조회
    let q1 = supabase.from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL", "1").order("TASK_NAME");
    if (user?.deptCd) q1 = q1.eq("DEPT_CD", user.deptCd);

    const [{ data: d1 }, { data: users }] = await Promise.all([
      q1,
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

  /* ── 리포트 생성 ── */
  async function handleGenerate() {
    setErrorMsg("");
    setReport("");

    if (!fromDate || !toDate) { setErrorMsg("조회 기간을 선택해주세요."); return; }
    if (fromDate > toDate)    { setErrorMsg("시작일이 종료일보다 늦을 수 없습니다."); return; }

    setLoading(true);

    try {
      /* 1. TASK_BOARD 조회 */
      let query = supabase
        .from("TASK_BOARD")
        .select("BOARD_ID, TITLE, TASK_GUBUN1, TASK_CONTENT, ISSUE, COMPLETE_DATE, IMPORTANT_GUBUN, PAGE_URL, STATUS, ID, DEPT_CD")
        .gte("INSERT_DATE", toDate8(fromDate))
        .lte("INSERT_DATE", toDate8(toDate))
        .order("INSERT_DATE", { ascending: true });

      if (user?.deptCd)  query = query.eq("DEPT_CD", user.deptCd);
      if (taskType1Cd)   query = query.eq("TASK_GUBUN1", taskType1Cd);
      if (searchUserId)  query = query.eq("ID", searchUserId);

      const { data: tasks, error: dbError } = await query;

      if (dbError) { setErrorMsg("데이터 조회 오류: " + dbError.message); setLoading(false); return; }
      if (!tasks || tasks.length === 0) {
        setErrorMsg("조회 조건에 해당하는 업무 데이터가 없습니다. 기간 또는 조건을 변경해 주세요.");
        setLoading(false);
        return;
      }

      /* 2. TASK_MASTER 코드 → 명칭 맵 */
      const tm1Map = {};
      tm1.forEach((r) => { tm1Map[r.TASK_ID] = r.TASK_NAME; });

      /* 3. 데이터 텍스트 구성 */
      const period   = `${fromDate} ~ ${toDate}`;
      const dataText = tasks.map((task, i) => {
        const gubunName  = tm1Map[task.TASK_GUBUN1] ?? task.TASK_GUBUN1 ?? "미분류";
        const completedt = fromDate8(task.COMPLETE_DATE) || "미완료";
        const importance = task.IMPORTANT_GUBUN ?? "하";
        const lines = [
          `[업무 ${i + 1}]`,
          `1. 제목: ${task.TITLE ?? ""}`,
          `2. 업무구분: ${gubunName}`,
          `3. 작업내용: ${task.TASK_CONTENT?.trim() || "없음"}`,
          `4. 이슈사항: ${task.ISSUE?.trim() || "없음"}`,
          `5. 완료일자: ${completedt}`,
          `6. 중요도: ${importance}`,
          `7. 참고링크: ${task.PAGE_URL?.trim() || "없음"}`,
        ];
        return lines.join("\n");
      }).join("\n\n");

      /* 4. 프롬프트 구성 */
      const prompt = `다음은 ${period} 기간 동안의 업무 데이터(총 ${tasks.length}건)입니다.\n\n${dataText}\n\n위 데이터를 바탕으로 아래 두 파트로 구성된 주간업무보고서를 한국어로 작성해주세요. 두 파트를 구분선(━━━━)으로 구분하고, 하나의 문서로 이어서 작성해주세요.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n【 PART 1. 업무별 내러티브 요약 】\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n각 업무를 자연스러운 한국어 문장(3~5문장)으로 서술해주세요.\n업무의 목적, 진행 내용, 이슈 및 완료 여부를 포함하세요.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n【 PART 2. 주간업무보고서 (표준 형식) 】\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n각 업무를 아래 형식으로 정리해주세요:\n\n──────────────────────────\n1. 제목:\n2. 업무구분:\n3. 작업내용:\n4. 이슈사항:\n5. 완료일자:\n6. 중요도:\n7. 참고링크:\n──────────────────────────\n\n모든 업무를 빠짐없이 포함하고, 전문적이고 간결하게 작성해주세요.`;

      /* 5. Gemini 호출 */
      const result = await callGemini(prompt);

      if (!result.ok) {
        setErrorMsg("Gemini API 오류: " + result.error);
        return;
      }

      setReport(result.text);
      // 결과로 스크롤
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    } catch (e) {
      setErrorMsg("오류가 발생했습니다: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── 복사 ── */
  async function handleCopy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = report;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  /* ── render ── */
  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>AI Weekly Report</h2>
      </div>

      {/* ── 조회 조건 + 생성 버튼 ── */}
      <div style={s.filterCard}>
        <div style={isMobile ? s.filterRowMobile : s.filterRow}>
          {/* 조회 기간 */}
          <div style={isMobile ? s.filterFieldFull : s.filterField}>
            <label style={s.filterLabel}>{t("aiReport.period")}</label>
            <div style={s.dateRange}>
              <input type="date" style={isMobile ? s.dateInputFull : s.dateInput} value={fromDate}
                onChange={(e) => setFromDate(e.target.value)} />
              <span style={s.rangeSep}>~</span>
              <input type="date" style={isMobile ? s.dateInputFull : s.dateInput} value={toDate}
                onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          {/* 업무구분 (부서 필터 적용됨) */}
          <div style={isMobile ? s.filterFieldFull : s.filterField}>
            <label style={s.filterLabel}>{t("aiReport.task")}</label>
            <select style={isMobile ? s.filterSelectFull : s.filterSelect} value={taskType1Cd}
              onChange={(e) => setTaskType1Cd(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {tm1.map((item) => <option key={item.TASK_ID} value={item.TASK_ID}>{item.TASK_NAME}</option>)}
            </select>
          </div>

          {/* 등록자 */}
          <div style={isMobile ? s.filterFieldFull : s.filterField}>
            <label style={s.filterLabel}>{t("common.writer")}</label>
            <select style={isMobile ? s.filterSelectFull : s.filterSelect} value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {deptUsers.map((u) => <option key={u.ID} value={u.ID}>{u.NAME}</option>)}
            </select>
          </div>

          {/* 생성 버튼 */}
          <div style={isMobile ? s.btnFieldFull : s.btnField}>
            <button style={loading ? s.genBtnDisabled : s.genBtn}
              onClick={handleGenerate} disabled={loading}>
              {loading ? "⏳ 생성 중..." : "✨ Report 생성"}
            </button>
          </div>
        </div>
      </div>

      {/* 오류 메시지 */}
      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      {/* 로딩 */}
      {loading && (
        <div style={s.loadingBox}>
          <div style={s.dotRow}>
            <span style={{ ...s.dot, animationDelay: "0s" }} />
            <span style={{ ...s.dot, animationDelay: "0.2s" }} />
            <span style={{ ...s.dot, animationDelay: "0.4s" }} />
          </div>
          <p style={s.loadingText}>
            업무 데이터를 분석하여 주간보고서를 생성하고 있습니다...
          </p>
        </div>
      )}

      {/* ── 결과 영역 ── */}
      {report && !loading && (
        <div ref={resultRef} style={s.resultCard}>
          {/* 결과 헤더 */}
          <div style={s.resultHeader}>
            <div style={s.resultTitleWrap}>
              <span style={s.resultTitle}>📋 주간업무보고서</span>
              <span style={s.resultPeriod}>{fromDate} ~ {toDate}</span>
            </div>
            <button
              style={copied ? s.copiedBtn : s.copyBtn}
              onClick={handleCopy}
            >
              {copied ? "✓ 복사완료" : "📋 텍스트 복사"}
            </button>
          </div>

          {/* 보고서 본문 */}
          <div style={isMobile ? s.resultBodyMobile : s.resultBody}>
            {report.split("\n").map((line, i) => {
              const trimmed = line.trim();
              if (trimmed === "") return <div key={i} style={s.emptyLine} />;
              if (trimmed.startsWith("━")) return <hr key={i} style={s.divider} />;
              if (trimmed.startsWith("【") && trimmed.endsWith("】"))
                return <p key={i} style={s.partHead}>{trimmed}</p>;
              if (trimmed.startsWith("──"))
                return <hr key={i} style={s.subDivider} />;
              if (/^\[업무\s*\d+\]/.test(trimmed))
                return <p key={i} style={s.taskNo}>{trimmed}</p>;
              if (/^[1-7]\.\s/.test(trimmed))
                return <p key={i} style={s.fieldLine}>{renderBold(trimmed)}</p>;
              if (/^\d+\./.test(trimmed))
                return <p key={i} style={s.numbered}>{renderBold(trimmed)}</p>;
              if (trimmed.startsWith("- ") || trimmed.startsWith("• "))
                return <p key={i} style={s.bullet}>{renderBold(trimmed.slice(2))}</p>;
              if (trimmed.startsWith("# "))   return <p key={i} style={s.h1}>{trimmed.slice(2)}</p>;
              if (trimmed.startsWith("## "))  return <p key={i} style={s.h2}>{trimmed.slice(3)}</p>;
              if (trimmed.startsWith("### ")) return <p key={i} style={s.h3}>{trimmed.slice(4)}</p>;
              return <p key={i} style={s.bodyLine}>{renderBold(trimmed)}</p>;
            })}
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
  filterRow:       { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" },
  filterRowMobile: { display: "flex", flexDirection: "column", gap: "12px" },
  filterField:     { display: "flex", flexDirection: "column", gap: "6px" },
  filterFieldFull: { display: "flex", flexDirection: "column", gap: "6px", width: "100%" },
  filterLabel:     { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  dateRange:       { display: "flex", alignItems: "center", gap: "8px" },
  dateInput: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B",
    border: "1px solid #D9D9D9", borderRadius: "5px", padding: "7px 10px", outline: "none",
  },
  dateInputFull: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B",
    border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none",
    flex: 1, minWidth: 0,
  },
  rangeSep: { fontSize: "13px", color: "#94A3B8", fontWeight: "600", flexShrink: 0 },
  filterSelect: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F",
    border: "1px solid #D9D9D9", borderRadius: "5px",
    padding: "7px 10px", outline: "none", minWidth: "140px", cursor: "pointer",
  },
  filterSelectFull: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F",
    border: "1px solid #D9D9D9", borderRadius: "5px",
    padding: "8px 10px", outline: "none", width: "100%", cursor: "pointer",
  },

  /* 생성 버튼 */
  btnField:     { display: "flex", flexDirection: "column", justifyContent: "flex-end" },
  btnFieldFull: { display: "flex", flexDirection: "column", width: "100%" },
  genBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none",
    borderRadius: "7px", padding: "10px 24px", cursor: "pointer", whiteSpace: "nowrap",
  },
  genBtnDisabled: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#94A3B8", border: "none",
    borderRadius: "7px", padding: "10px 24px", cursor: "not-allowed", whiteSpace: "nowrap",
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
  resultHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px", borderBottom: "1px solid #E8E8E8",
    backgroundColor: "#F8FAFC", flexWrap: "wrap", gap: "8px",
  },
  resultTitleWrap: { display: "flex", alignItems: "center", gap: "10px" },
  resultTitle:     { fontSize: "14px", fontWeight: "700", color: "#1E293B" },
  resultPeriod:    { fontSize: "12px", color: "#64748B", backgroundColor: "#E2E8F0", borderRadius: "4px", padding: "2px 8px" },
  copyBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500",
    color: "#3A3A3A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9",
    borderRadius: "5px", padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap",
  },
  copiedBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600",
    color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC",
    borderRadius: "5px", padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap",
  },
  resultBody:       { padding: "20px 28px", maxHeight: "680px", overflowY: "auto" },
  resultBodyMobile: { padding: "16px", maxHeight: "62vh", overflowY: "auto" },

  /* 보고서 텍스트 */
  partHead:  { fontSize: "15px", fontWeight: "800", color: "#1E293B", margin: "18px 0 8px", letterSpacing: "0.04em" },
  taskNo:    { fontSize: "14px", fontWeight: "700", color: "#2563EB", margin: "14px 0 4px", padding: "4px 10px", backgroundColor: "#EFF6FF", borderRadius: "4px", display: "inline-block" },
  fieldLine: { fontSize: "13px", color: "#1E293B", margin: "3px 0 3px 8px", lineHeight: "1.7" },
  h1:        { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: "16px 0 6px" },
  h2:        { fontSize: "15px", fontWeight: "700", color: "#1E293B", margin: "14px 0 4px" },
  h3:        { fontSize: "14px", fontWeight: "600", color: "#334155", margin: "10px 0 4px" },
  numbered:  { fontSize: "14px", fontWeight: "600", color: "#1E293B", margin: "10px 0 4px" },
  bullet:    { fontSize: "13px", color: "#334155", margin: "3px 0", paddingLeft: "12px", lineHeight: "1.65" },
  bodyLine:  { fontSize: "13px", color: "#475569", margin: "3px 0", lineHeight: "1.65" },
  emptyLine: { height: "8px" },
  divider:   { border: "none", borderTop: "2px solid #CBD5E1", margin: "16px 0" },
  subDivider:{ border: "none", borderTop: "1px dashed #E2E8F0", margin: "10px 0" },
};

export default AIWeeklyReportPage;
