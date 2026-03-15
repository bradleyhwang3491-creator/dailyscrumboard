import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

/* ═══════════════════ 날짜 유틸 ═══════════════════ */
function fromDate8(s) {
  if (!s) return "";
  const str = String(s);
  if (str.length === 8) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
  return str.slice(0, 10);
}
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

/* ─ 오늘 기준 변수 (렌더 시마다 재계산 방지) ─ */
const TODAY        = new Date();
const TODAY_STR    = TODAY.toISOString().slice(0, 10);
TODAY.setHours(0, 0, 0, 0);

/* ── 월별: 바 위치 (left%, width%) ── */
function getMonthBar(task, year, month) {
  const s = task.regDate    ? new Date(task.regDate)    : null;
  const e = task.plannedEnd ? new Date(task.plannedEnd) : null;
  if (!s && !e) return null;
  const mS = new Date(year, month - 1, 1);
  const mE = new Date(year, month - 1, daysInMonth(year, month));
  const bS = s || mS; const bE = e || mE;
  if (bE < mS || bS > mE) return null;
  const total = daysInMonth(year, month);
  const ds = bS < mS ? 1 : bS.getDate();
  const de = bE > mE ? total : bE.getDate();
  return { left: `${((ds-1)/total)*100}%`, width: `${((de-ds+1)/total)*100}%` };
}

/* ── 주차별: 바 위치 ── */
function getWeekBar(task, wStart, wEnd) {
  const s = task.regDate    ? new Date(task.regDate)    : null;
  const e = task.plannedEnd ? new Date(task.plannedEnd) : null;
  if (!s && !e) return null;
  const bS = s || wStart; const bE = e || wEnd;
  if (bE < wStart || bS > wEnd) return null;
  const total = (wEnd - wStart) / 86400000 + 1;
  const ds = bS < wStart ? 0 : Math.round((bS - wStart) / 86400000);
  const de = bE > wEnd   ? total - 1 : Math.round((bE - wStart) / 86400000);
  return { left: `${(ds/total)*100}%`, width: `${((de-ds+1)/total)*100}%` };
}

/* ── 오늘 라인: 해당 셀 내 left% ── */
function getTodayLine(cellStart, cellEnd) {
  const t = TODAY;
  if (t < cellStart || t > cellEnd) return null;
  const total = (cellEnd - cellStart) / 86400000 + 1;
  const d = Math.round((t - cellStart) / 86400000);
  return `${(d / total) * 100}%`;
}

/* ── 마감일 라인: 해당 셀 내 left% ── */
function getDeadlineLine(deadlineStr, cellStart, cellEnd) {
  if (!deadlineStr) return null;
  const d = new Date(deadlineStr); d.setHours(0, 0, 0, 0);
  if (d < cellStart || d > cellEnd) return null;
  const total = (cellEnd - cellStart) / 86400000 + 1;
  const offset = Math.round((d - cellStart) / 86400000);
  return `${(offset / total) * 100}%`;
}

/* ── 협업 동료 배열 파싱 ── */
function parseCoworkers(coworkers) {
  if (!coworkers) return [];
  if (Array.isArray(coworkers)) return coworkers.filter(Boolean);
  if (typeof coworkers === "string") {
    try { const p = JSON.parse(coworkers); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
    return coworkers.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/* ── 월별 셀 범위 ── */
function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1); start.setHours(0,0,0,0);
  const end   = new Date(year, month - 1, daysInMonth(year, month)); end.setHours(0,0,0,0);
  return { start, end };
}

/* ── 월별 각 주차(W1~W5) ── */
function getMonthWeeks(year, monthIdx) {
  const total = daysInMonth(year, monthIdx + 1);
  const weeks = [];
  for (let d = 1; d <= total; d += 7) {
    const end = Math.min(d + 6, total);
    weeks.push({
      num:   Math.ceil(d / 7),
      start: new Date(year, monthIdx, d),
      end:   new Date(year, monthIdx, end),
    });
  }
  return weeks;
}

/* ── 연간 월-주 구조 ── */
function buildMonthWeeks(year) {
  return Array.from({ length: 12 }, (_, mi) => ({
    monthIdx: mi,
    weeks: getMonthWeeks(year, mi),
  }));
}

/* ═══════════════════ 상태/색상 ═══════════════════ */
const STATUS_LABEL = { TODO: "TO-DO", PROGRESS: "PROGRESS", HOLDING: "HOLDING", COMPLETE: "COMPLETE" };
const STATUS_BAR   = {
  TODO:     { bg: "#C4B5FD", border: "#A78BFA" },
  PROGRESS: { bg: "#7C3AED", border: "#6D28D9" },
  HOLDING:  { bg: "#DDD6FE", border: "#C4B5FD" },
  COMPLETE: { bg: "#4C1D95", border: "#3B0764" },
};

/* ═══════════════════ 로딩 ═══════════════════════ */
function LoadingState({ label }) {
  return (
    <div style={g.loadingWrap}>
      <div style={g.spinner} />
      <span style={g.loadingText}>{label}</span>
    </div>
  );
}

/* ═══════════════════ 상세 팝업 모달 ═══════════════════════ */
function TaskDetailModal({ task, tm1Map, userMap, onClose }) {
  const { t }    = useLanguage();
  const isMobile = useBreakpoint(768);
  const [copied,   setCopied]   = useState(false);
  const [fullData, setFullData] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data }, { data: cwData }] = await Promise.all([
        supabase.from("TASK_BOARD").select("*").eq("BOARD_ID", task.id).single(),
        supabase.from("TASK_BOARD_COWORKER").select("COWORKER_ID, SEQ_NO").eq("BOARD_ID", task.id).order("SEQ_NO"),
      ]);
      if (data) setFullData({
        ...task,
        regDate:         fromDate8(data.INSERT_DATE),
        plannedEnd:      fromDate8(data.DUE_EXPECT_DATE),
        actualEnd:       fromDate8(data.COMPLETE_DATE),
        status:          data.STATUS          ?? "TODO",
        priority:        data.IMPORTANT_GUBUN ?? "",
        taskType1Cd:     data.TASK_GUBUN1     ?? "",
        taskType2Cd:     data.TASK_GUBUN2     ?? "",
        taskType3Cd:     data.TASK_GUBUN3     ?? "",
        taskType4Cd:     data.TASK_GUBUN4     ?? "",
        relatedLink:     data.LINK_URL        ?? "",
        content:         data.CONTENTS        ?? "",
        teamNote:        data.LEADER_KNOW     ?? "",
        issue:           data.ISSUE           ?? "",
        issueCompleteYn: data.ISSUE_COMPLETE_YN ?? "N",
        coworkerIds:     (cwData || []).map((r) => r.COWORKER_ID),
      });
      setLoading(false);
    })();
  }, [task.id]);

  async function handleCopy() {
    if (!fullData) return;
    const t1  = tm1Map[fullData.taskType1Cd]?.name ?? fullData.taskType1Cd ?? "";
    const ln  = (lbl, val) => val?.trim() ? `${lbl}: ${val.trim()}` : null;
    const sep = "─".repeat(32);
    const hi  = !!fullData.issue?.trim();
    const cwNames = (fullData.coworkerIds || [])
      .map((id) => userMap?.[id] ?? id).filter(Boolean);
    const parts = [
      "■ 업무 상세", sep,
      ln("제목",           fullData.title),
      ln("상태",           STATUS_LABEL[fullData.status] ?? fullData.status),
      ln("중요도",         fullData.priority),
      ln("등록일자",       fullData.regDate),
      ln("업무구분1",      t1),
      ln("작업완료예정일", fullData.plannedEnd),
      ln("작업완료일",     fullData.actualEnd),
      ln("연관페이지링크", fullData.relatedLink),
      cwNames.length > 0 ? `협업 동료: ${cwNames.join(", ")}` : null,
      sep,
      fullData.content?.trim()  ? `[작업내용]\n${fullData.content.trim()}`   : null,
      fullData.teamNote?.trim() ? `[팀장공유내용]\n${fullData.teamNote.trim()}` : null,
      hi ? `[이슈사항]\n${fullData.issue.trim()}\n이슈해결여부: ${fullData.issueCompleteYn === "Y" ? "Y (해결)" : "N (미해결)"}` : null,
      sep,
    ];
    try { await navigator.clipboard.writeText(parts.filter(Boolean).join("\n")); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = parts.filter(Boolean).join("\n"); ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2200);
  }

  const oSt  = isMobile ? { ...dm.overlay, ...dm.overlayMobile } : dm.overlay;
  const mSt  = isMobile ? { ...dm.modal,   ...dm.modalMobile   } : dm.modal;
  const twoC = isMobile ? dm.oneCol : dm.twoCol;
  const fd   = fullData;
  const hi   = !!fd?.issue?.trim();

  return (
    <div style={oSt} onClick={onClose}>
      <div style={mSt} onClick={(e) => e.stopPropagation()}>
        <div style={dm.header}>
          <span style={dm.title}>{t("daily.modal.detail")}</span>
          <button style={dm.closeX} onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div style={{ padding: "40px 0" }}><LoadingState label={t("common.loading")} /></div>
        ) : (
          <div style={dm.body}>
            <div style={dm.fullRow}><label style={dm.label}>제목</label><input style={dm.inputRO} type="text" value={fd?.title ?? ""} readOnly /></div>
            <div style={twoC}>
              <div style={dm.fieldWrap}><label style={dm.label}>등록일자</label><input style={dm.inputRO} type="date" value={fd?.regDate ?? ""} readOnly /></div>
              <div style={dm.fieldWrap}><label style={dm.label}>상태</label><input style={dm.inputRO} type="text" value={STATUS_LABEL[fd?.status] ?? fd?.status ?? ""} readOnly /></div>
            </div>
            <div style={twoC}>
              <div style={dm.fieldWrap}><label style={dm.label}>업무구분1</label><input style={dm.inputRO} type="text" value={tm1Map[fd?.taskType1Cd]?.name ?? fd?.taskType1Cd ?? ""} readOnly /></div>
              <div style={dm.fieldWrap}><label style={dm.label}>업무구분2</label><input style={dm.inputRO} type="text" value={fd?.taskType2Cd ?? ""} readOnly /></div>
            </div>
            <div style={twoC}>
              <div style={dm.fieldWrap}><label style={dm.label}>업무구분3</label><input style={dm.inputRO} type="text" value={fd?.taskType3Cd ?? ""} readOnly /></div>
              <div style={dm.fieldWrap}><label style={dm.label}>업무구분4</label><input style={dm.inputRO} type="text" value={fd?.taskType4Cd ?? ""} readOnly /></div>
            </div>
            <div style={dm.halfRow}>
              <div style={dm.fieldWrap}><label style={dm.label}>중요도</label><input style={dm.inputRO} type="text" value={fd?.priority ?? ""} readOnly /></div>
            </div>
            <div style={dm.fullRow}><label style={dm.label}>연관페이지링크</label><input style={dm.inputRO} type="text" value={fd?.relatedLink ?? ""} readOnly /></div>
            <div style={dm.fullRow}><label style={dm.label}>작업내용</label><textarea style={dm.textareaRO} value={fd?.content ?? ""} readOnly /></div>
            <div style={dm.fullRow}><label style={dm.label}>팀장공유내용</label><textarea style={dm.textareaRO} value={fd?.teamNote ?? ""} readOnly /></div>
            <div style={dm.fullRow}>
              <label style={dm.label}>이슈사항</label>
              <textarea style={dm.textareaRO} value={fd?.issue ?? ""} readOnly />
              {hi && (
                <div style={dm.issueRow}>
                  <span style={dm.issueLabel}>이슈해결여부</span>
                  {fd?.issueCompleteYn === "Y"
                    ? <span style={dm.issueBadgeOk}>✅ Y (해결)</span>
                    : <span style={dm.issueBadgeNg}>🚨 N (미해결)</span>}
                </div>
              )}
            </div>
            {/* 협업 동료 */}
            <div style={dm.fullRow}>
              <label style={dm.label}>협업 동료</label>
              <div style={dm.cwChipRow}>
                {(fd?.coworkerIds || []).length === 0 ? (
                  <span style={{ fontSize: "13px", color: "#94A3B8" }}>없음</span>
                ) : (
                  (fd.coworkerIds || []).map((id) => (
                    <span key={id} style={dm.cwChip}>
                      {userMap?.[id] ?? id}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div style={dm.twoCol}>
              <div style={dm.fieldWrap}><label style={dm.label}>작업완료예정일자</label><input style={dm.inputRO} type="date" value={fd?.plannedEnd ?? ""} readOnly /></div>
              <div style={dm.fieldWrap}><label style={dm.label}>작업완료일자</label><input style={dm.inputRO} type="date" value={fd?.actualEnd ?? ""} readOnly /></div>
            </div>
          </div>
        )}
        <div style={dm.footer}>
          <button style={copied ? dm.copyBtnDone : dm.copyBtn} onClick={handleCopy} disabled={loading}>
            {copied ? t("common.copied") : t("common.copy")}
          </button>
          <button style={dm.closeBtn} onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ GanttChartPage ═══════════════════ */
export default function GanttChartPage() {
  const { user }   = useAuth();
  const { t }      = useLanguage();
  const isMobile   = useBreakpoint(768);

  const currentYear = new Date().getFullYear();
  const [year,           setYear]           = useState(currentYear);
  const [viewMode,       setViewMode]       = useState("monthly");
  const [filterTm1,          setFilterTm1]          = useState("ALL");
  const [filterAssignee,     setFilterAssignee]     = useState("ALL");
  const [filterTm1Coworker,  setFilterTm1Coworker]  = useState("ALL");
  const [selectedTask,       setSelectedTask]       = useState(null);

  const [tm1List,  setTm1List]  = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [userMap,  setUserMap]  = useState({}); // userId → name
  const [loading,  setLoading]  = useState(true);

  const MONTHS = t("gantt.months");

  /* ─ 데이터 로드 ─ */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const dept = user?.deptCd;

      /* TASK_MASTER LEVEL=1 */
      let q1 = supabase.from("TASK_MASTER")
        .select("TASK_ID, TASK_NAME, DEADLINE, COWORKERS")
        .eq("LEVEL", "1").order("TASK_NAME");
      if (dept) q1 = q1.eq("DEPT_CD", dept);
      const { data: tm1Data } = await q1;

      const tm1Map = {};
      (tm1Data || []).forEach((r) => {
        tm1Map[r.TASK_ID] = {
          id:        r.TASK_ID,
          name:      r.TASK_NAME ?? "",
          deadline:  fromDate8(r.DEADLINE ?? r.deadline ?? ""),
          coworkers: parseCoworkers(r.COWORKERS),
        };
      });
      setTm1List(Object.values(tm1Map));

      /* SCRUMBOARD_USER (ID → NAME) */
      const { data: uData } = await supabase.from("SCRUMBOARD_USER").select("ID, NAME");
      const uMap = {};
      (uData || []).forEach((u) => { uMap[u.ID] = u.NAME ?? u.ID; });
      setUserMap(uMap);

      /* TASK_BOARD */
      let q2 = supabase.from("TASK_BOARD")
        .select("BOARD_ID, TITLE, STATUS, ID, TASK_GUBUN1, INSERT_DATE, DUE_EXPECT_DATE, COMPLETE_DATE, IMPORTANT_GUBUN")
        .order("BOARD_ID", { ascending: false });
      if (dept) q2 = q2.eq("DEPT_CD", dept);
      const { data: bd } = await q2;

      setTasks((bd || []).map((r) => ({
        id:         r.BOARD_ID,
        title:      r.TITLE          ?? "",
        status:     r.STATUS         ?? "TODO",
        tm1Cd:      r.TASK_GUBUN1    ?? "",
        regDate:    fromDate8(r.INSERT_DATE),
        plannedEnd: fromDate8(r.DUE_EXPECT_DATE),
        priority:   r.IMPORTANT_GUBUN ?? "",
        writerId:   r.ID              ?? "",        // 등록자 ID
        writerName: uMap[r.ID]        ?? r.ID ?? "",
      })));
      setLoading(false);
    }
    load();
  }, [user?.deptCd]);

  /* ─ tm1Map ─ */
  const tm1Map = useMemo(() => {
    const m = {};
    tm1List.forEach((x) => { m[x.id] = x; });
    return m;
  }, [tm1List]);

  /* ─ 담당자(등록자) 목록 ─ */
  const assigneeList = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => { if (t.writerName) set.add(t.writerName); });
    return Array.from(set).sort();
  }, [tasks]);

  /* ─ 업무구분1 담당자 목록 ─ */
  const tm1CoworkerList = useMemo(() => {
    const set = new Set();
    tm1List.forEach((tm1) => {
      (tm1.coworkers || []).forEach((id) => { if (id) set.add(id); });
    });
    return Array.from(set).sort((a, b) => (userMap[a] || a).localeCompare(userMap[b] || b));
  }, [tm1List, userMap]);

  /* ─ 필터링 ─ */
  const filtered = useMemo(() => {
    const yS = new Date(year, 0, 1);
    const yE = new Date(year, 11, 31);
    return tasks.filter((task) => {
      const ts = task.regDate    ? new Date(task.regDate)    : null;
      const te = task.plannedEnd ? new Date(task.plannedEnd) : null;
      if (ts && ts > yE) return false;
      if (te && te < yS) return false;
      if (!ts && !te) return false;
      if (filterTm1      !== "ALL" && task.tm1Cd     !== filterTm1)      return false;
      if (filterAssignee !== "ALL" && task.writerName !== filterAssignee) return false;
      if (filterTm1Coworker !== "ALL") {
        const cws = tm1Map[task.tm1Cd]?.coworkers ?? [];
        if (!cws.includes(filterTm1Coworker)) return false;
      }
      return true;
    });
  }, [tasks, year, filterTm1, filterAssignee, filterTm1Coworker, tm1Map]);

  /* ─ 업무구분1 그룹 ─ */
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((task) => {
      const key  = task.tm1Cd || "__none__";
      const tm1  = tm1Map[key];
      const name = tm1?.name ?? (key === "__none__" ? t("gantt.noCategory") : key);
      if (!map[key]) map[key] = { key, tm1Name: name, deadline: tm1?.deadline ?? "", coworkers: tm1?.coworkers ?? [], tasks: [] };
      map[key].tasks.push(task);
    });
    return Object.values(map).sort((a, b) => a.tm1Name.localeCompare(b.tm1Name));
  }, [filtered, tm1Map, t]);

  /* ─ 월-주 구조 ─ */
  const monthWeeks = useMemo(() => buildMonthWeeks(year), [year]);

  /* ─ 연도 선택지 ─ */
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) yearOptions.push(y);

  /* ─ 치수 ─ */
  const LEFT_TM1  = isMobile ? 80  : 140;
  const LEFT_ASGN = isMobile ? 64  : 100;
  const LEFT_TASK = isMobile ? 110 : 190;
  const MONTH_W   = isMobile ? 58  : 78;
  const WEEK_W    = isMobile ? 26  : 34;
  const FIXED_W   = LEFT_TM1 + LEFT_ASGN + LEFT_TASK;

  /* ─ 헤더 고정셀 공통 스타일 ─ */
  const fixedHdr = (left, w, extra = {}) => ({
    ...g.hCell, width: w, minWidth: w,
    position: "sticky", left, zIndex: 3,
    backgroundColor: "#F3F4F6", ...extra,
  });

  /* ─ 라인 렌더 헬퍼 ─ */
  function renderLines(todayLeft, deadlineLeft) {
    return (
      <>
        {todayLeft   != null && <div style={{ ...g.todayLine,    left: todayLeft    }} />}
        {deadlineLeft != null && <div style={{ ...g.deadlineLine, left: deadlineLeft }} />}
      </>
    );
  }

  return (
    <div style={g.page}>
      {/* ─ 타이틀 ─ */}
      <div style={isMobile ? g.pageHeaderM : g.pageHeader}>
        <h2 style={isMobile ? g.titleM : g.title}>{t("gantt.title")}</h2>
      </div>

      {/* ─ 필터 바 ─ */}
      <div style={isMobile ? g.filterBarM : g.filterBar}>
        <div style={g.fg}><label style={g.fl}>{t("gantt.year")}</label>
          <select style={g.fs} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={g.fg}><label style={g.fl}>{t("common.task1")}</label>
          <select style={g.fs} value={filterTm1} onChange={(e) => setFilterTm1(e.target.value)}>
            <option value="ALL">{t("common.all")}</option>
            {tm1List.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div style={g.fg}><label style={g.fl}>{t("gantt.assignee")}</label>
          <select style={g.fs} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="ALL">{t("common.all")}</option>
            {assigneeList.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={g.fg}><label style={g.fl}>{t("gantt.tm1Coworker")}</label>
          <select style={g.fs} value={filterTm1Coworker} onChange={(e) => setFilterTm1Coworker(e.target.value)}>
            <option value="ALL">{t("common.all")}</option>
            {tm1CoworkerList.map((id) => <option key={id} value={id}>{userMap[id] ?? id}</option>)}
          </select>
        </div>
        <button style={g.resetBtn} onClick={() => { setFilterTm1("ALL"); setFilterAssignee("ALL"); setFilterTm1Coworker("ALL"); setYear(currentYear); }}>
          {t("common.reset")}
        </button>

        {/* 보기 모드 토글 */}
        <div style={g.viewWrap}>
          <button style={{ ...g.viewBtn, ...(viewMode === "monthly" ? g.viewActive : {}) }} onClick={() => setViewMode("monthly")}>
            {t("gantt.viewMonthly")}
          </button>
          <button style={{ ...g.viewBtn, ...(viewMode === "weekly"  ? g.viewActive : {}) }} onClick={() => setViewMode("weekly")}>
            {t("gantt.viewWeekly")}
          </button>
        </div>
      </div>

      {/* ─ 테이블 ─ */}
      {loading ? (
        <LoadingState label={t("common.loading")} />
      ) : groups.length === 0 ? (
        <div style={g.noData}>{t("gantt.noData")}</div>
      ) : (
        <div style={g.tableWrap}>
          <div style={{ display: "inline-block", minWidth: "100%" }}>

            {/* ═══ 월별 뷰 ═══ */}
            {viewMode === "monthly" && (() => {
              const isThisYear = year === currentYear;
              const todayMonth = TODAY.getMonth() + 1; // 1-12
              return (
                <>
                  {/* 헤더 */}
                  <div style={g.headerRow}>
                    <div style={fixedHdr(0,            LEFT_TM1)}>{t("common.task1")}</div>
                    <div style={fixedHdr(LEFT_TM1,     LEFT_ASGN)}>{t("gantt.assignee")}</div>
                    <div style={fixedHdr(LEFT_TM1+LEFT_ASGN, LEFT_TASK)}>{t("gantt.taskTitle")}</div>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const isCur = isThisYear && m === todayMonth;
                      return (
                        <div key={m} style={{
                          ...g.hCell, width: MONTH_W, minWidth: MONTH_W, textAlign: "center",
                          ...(isCur ? g.hCellToday : {}),
                        }}>
                          {MONTHS[i]}
                          {isCur && <div style={g.todayHeaderDot} />}
                        </div>
                      );
                    })}
                  </div>

                  {/* 그룹 + 태스크 */}
                  {groups.map((grp) => {
                    return (
                      <div key={grp.key}>
                        {/* 그룹 헤더 */}
                        <div style={g.groupRow}>
                          <div style={{ ...g.groupCell, width: FIXED_W, minWidth: FIXED_W, position: "sticky", left: 0, zIndex: 2 }}>
                            <span style={g.groupDot} />
                            <span style={g.groupName}>{grp.tm1Name}</span>
                            {grp.deadline && (
                              <span style={g.deadlineBadge}>
                                🗓 {grp.deadline}
                              </span>
                            )}
                            {grp.coworkers.length > 0 && (
                              <span style={g.coworkersBadge}>
                                👤 {grp.coworkers.map((id) => userMap[id] ?? id).join(", ")}
                              </span>
                            )}
                            <span style={g.groupCount}>{grp.tasks.length}{t("gantt.taskCount")}</span>
                          </div>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = i + 1;
                            const { start, end } = getMonthRange(year, m);
                            const todayLeft    = getTodayLine(start, end);
                            const deadlineLeft = getDeadlineLine(grp.deadline, start, end);
                            return (
                              <div key={m} style={{ ...g.groupMonthCell, width: MONTH_W, minWidth: MONTH_W, position: "relative" }}>
                                {renderLines(todayLeft, deadlineLeft)}
                              </div>
                            );
                          })}
                        </div>

                        {/* 태스크 행 */}
                        {grp.tasks.map((task, ti) => {
                          const bc = STATUS_BAR[task.status] || STATUS_BAR.TODO;
                          return (
                            <div key={task.id} style={{ ...g.taskRow, ...(ti === grp.tasks.length - 1 ? { borderBottom: "1px solid #E5E7EB" } : {}) }}>
                              <div style={{ ...g.fixedCell, width: LEFT_TM1, minWidth: LEFT_TM1, left: 0 }} />
                              <div style={{ ...g.fixedCell, width: LEFT_ASGN, minWidth: LEFT_ASGN, left: LEFT_TM1 }}>
                                <span style={g.assigneeText}>{task.writerName || "-"}</span>
                              </div>
                              <div style={{ ...g.fixedCell, ...g.taskTitleCell, width: LEFT_TASK, minWidth: LEFT_TASK, left: LEFT_TM1 + LEFT_ASGN }}
                                   onClick={() => setSelectedTask(task)}>
                                <div style={g.titleWrap}>
                                  <span style={{ ...g.statusDot, backgroundColor: bc.bg, border: `1px solid ${bc.border}` }} />
                                  <span style={g.titleText}>{task.title}</span>
                                </div>
                                <div style={g.taskMeta}>
                                  {task.regDate    && <span style={g.metaChip}>{task.regDate}</span>}
                                  {task.plannedEnd && <span style={g.metaChip}>{task.plannedEnd}</span>}
                                </div>
                              </div>
                              {Array.from({ length: 12 }, (_, i) => {
                                const m = i + 1;
                                const bar = getMonthBar(task, year, m);
                                const { start, end } = getMonthRange(year, m);
                                const todayLeft = getTodayLine(start, end);
                                return (
                                  <div key={m} style={{ ...g.monthCell, width: MONTH_W, minWidth: MONTH_W }} onClick={() => setSelectedTask(task)}>
                                    {bar && <div style={{ ...g.bar, left: bar.left, width: bar.width, backgroundColor: bc.bg, border: `1px solid ${bc.border}` }} title={task.title} />}
                                    {todayLeft != null && <div style={{ ...g.todayLine, left: todayLeft }} />}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {/* ═══ 주차별 뷰 ═══ */}
            {viewMode === "weekly" && (() => {
              const isThisYear = year === currentYear;
              const todayMonthIdx = TODAY.getMonth();
              const todayDate     = TODAY.getDate();

              return (
                <>
                  {/* 헤더 Row1: 월 */}
                  <div style={{ ...g.headerRow, borderBottom: "1px solid #D1D5DB" }}>
                    <div style={fixedHdr(0,                    FIXED_W, { borderRight: "1px solid #D1D5DB" })} />
                    {monthWeeks.map((mw) => {
                      const isCur = isThisYear && mw.monthIdx === todayMonthIdx;
                      return (
                        <div key={mw.monthIdx} style={{
                          ...g.hCell,
                          width: WEEK_W * mw.weeks.length,
                          minWidth: WEEK_W * mw.weeks.length,
                          textAlign: "center",
                          borderRight: "1px solid #D1D5DB",
                          ...(isCur ? g.hCellToday : {}),
                        }}>
                          {MONTHS[mw.monthIdx]}
                          {isCur && <div style={g.todayHeaderDot} />}
                        </div>
                      );
                    })}
                  </div>
                  {/* 헤더 Row2: 주차 */}
                  <div style={g.headerRow}>
                    <div style={fixedHdr(0,            LEFT_TM1,  { fontSize: "10px" })}>{t("common.task1")}</div>
                    <div style={fixedHdr(LEFT_TM1,     LEFT_ASGN, { fontSize: "10px" })}>{t("gantt.assignee")}</div>
                    <div style={fixedHdr(LEFT_TM1+LEFT_ASGN, LEFT_TASK, { fontSize: "10px" })}>{t("gantt.taskTitle")}</div>
                    {monthWeeks.map((mw) =>
                      mw.weeks.map((w) => {
                        const isCur = isThisYear && mw.monthIdx === todayMonthIdx
                          && todayDate >= w.start.getDate() && todayDate <= w.end.getDate();
                        return (
                          <div key={`${mw.monthIdx}-${w.num}`} style={{
                            ...g.hCell, width: WEEK_W, minWidth: WEEK_W, textAlign: "center",
                            fontSize: "9px", padding: "5px 2px",
                            ...(isCur ? g.hCellToday : {}),
                          }}>
                            W{w.num}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 그룹 + 태스크 */}
                  {groups.map((grp) => (
                    <div key={grp.key}>
                      {/* 그룹 헤더 */}
                      <div style={g.groupRow}>
                        <div style={{ ...g.groupCell, width: FIXED_W, minWidth: FIXED_W, position: "sticky", left: 0, zIndex: 2 }}>
                          <span style={g.groupDot} />
                          <span style={g.groupName}>{grp.tm1Name}</span>
                          {grp.deadline && <span style={g.deadlineBadge}>🗓 {grp.deadline}</span>}
                          {grp.coworkers.length > 0 && (
                            <span style={g.coworkersBadge}>
                              👤 {grp.coworkers.map((id) => userMap[id] ?? id).join(", ")}
                            </span>
                          )}
                          <span style={g.groupCount}>{grp.tasks.length}{t("gantt.taskCount")}</span>
                        </div>
                        {monthWeeks.map((mw) =>
                          mw.weeks.map((w) => {
                            const todayLeft    = getTodayLine(w.start, w.end);
                            const deadlineLeft = getDeadlineLine(grp.deadline, w.start, w.end);
                            return (
                              <div key={`${mw.monthIdx}-${w.num}`} style={{ ...g.groupMonthCell, width: WEEK_W, minWidth: WEEK_W, position: "relative" }}>
                                {renderLines(todayLeft, deadlineLeft)}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 태스크 행 */}
                      {grp.tasks.map((task, ti) => {
                        const bc = STATUS_BAR[task.status] || STATUS_BAR.TODO;
                        return (
                          <div key={task.id} style={{ ...g.taskRow, ...(ti === grp.tasks.length - 1 ? { borderBottom: "1px solid #E5E7EB" } : {}) }}>
                            <div style={{ ...g.fixedCell, width: LEFT_TM1, minWidth: LEFT_TM1, left: 0 }} />
                            <div style={{ ...g.fixedCell, width: LEFT_ASGN, minWidth: LEFT_ASGN, left: LEFT_TM1 }}>
                              <span style={g.assigneeText}>{task.writerName || "-"}</span>
                            </div>
                            <div style={{ ...g.fixedCell, ...g.taskTitleCell, width: LEFT_TASK, minWidth: LEFT_TASK, left: LEFT_TM1 + LEFT_ASGN }}
                                 onClick={() => setSelectedTask(task)}>
                              <div style={g.titleWrap}>
                                <span style={{ ...g.statusDot, backgroundColor: bc.bg, border: `1px solid ${bc.border}` }} />
                                <span style={g.titleText}>{task.title}</span>
                              </div>
                              <div style={g.taskMeta}>
                                {task.regDate    && <span style={g.metaChip}>{task.regDate}</span>}
                                {task.plannedEnd && <span style={g.metaChip}>{task.plannedEnd}</span>}
                              </div>
                            </div>
                            {monthWeeks.map((mw) =>
                              mw.weeks.map((w) => {
                                const bar = getWeekBar(task, w.start, w.end);
                                const todayLeft = getTodayLine(w.start, w.end);
                                return (
                                  <div key={`${mw.monthIdx}-${w.num}`} style={{ ...g.monthCell, width: WEEK_W, minWidth: WEEK_W }} onClick={() => setSelectedTask(task)}>
                                    {bar && <div style={{ ...g.bar, left: bar.left, width: bar.width, backgroundColor: bc.bg, border: `1px solid ${bc.border}`, height: "10px", borderRadius: "3px" }} title={task.title} />}
                                    {todayLeft != null && <div style={{ ...g.todayLine, left: todayLeft }} />}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─ 범례 ─ */}
      <div style={g.legend}>
        {Object.entries(STATUS_BAR).map(([key, val]) => (
          <div key={key} style={g.legendItem}>
            <span style={{ ...g.legendDot, backgroundColor: val.bg, border: `1px solid ${val.border}` }} />
            <span style={g.legendLabel}>{STATUS_LABEL[key]}</span>
          </div>
        ))}
        <div style={g.legendItem}>
          <div style={g.legendTodayLine} />
          <span style={g.legendLabel}>오늘</span>
        </div>
        <div style={g.legendItem}>
          <div style={g.legendDeadlineLine} />
          <span style={g.legendLabel}>업무구분1 마감</span>
        </div>
      </div>

      {/* ─ 상세 팝업 ─ */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} tm1Map={tm1Map} userMap={userMap} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════ 스타일: 페이지 ═══════════════════════ */
const g = {
  page: { fontFamily: "'Pretendard', sans-serif", backgroundColor: "#FFFFFF", minHeight: "100%", display: "flex", flexDirection: "column" },
  pageHeader:  { padding: "20px 24px 0" },
  pageHeaderM: { padding: "14px 16px 0" },
  title:  { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0 },
  titleM: { fontSize: "15px", fontWeight: "700", color: "#1E293B", margin: 0 },

  /* 필터 바 */
  filterBar:  { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", padding: "16px 24px",  borderBottom: "1px solid #E5E7EB" },
  filterBarM: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",  padding: "12px 16px", borderBottom: "1px solid #E5E7EB" },
  fg: { display: "flex", alignItems: "center", gap: "6px" },
  fl: { fontSize: "12px", fontWeight: "500", color: "#64748B", whiteSpace: "nowrap" },
  fs: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F", border: "1px solid #D1D5DB", borderRadius: "6px", padding: "6px 10px", backgroundColor: "#FAFAFA", cursor: "pointer", outline: "none", minWidth: "110px" },
  resetBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "12px", color: "#64748B", backgroundColor: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" },
  viewWrap:   { display: "flex", border: "1px solid #D1D5DB", borderRadius: "6px", overflow: "hidden", marginLeft: "auto" },
  viewBtn:    { fontFamily: "'Pretendard', sans-serif", fontSize: "12px", fontWeight: "500", color: "#374151", backgroundColor: "#FFFFFF", border: "none", padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  viewActive: { backgroundColor: "#374151", color: "#FFFFFF" },

  tableWrap: { flex: 1, overflowX: "auto", overflowY: "auto" },

  /* 헤더 */
  headerRow: { display: "flex", position: "sticky", top: 0, zIndex: 10, backgroundColor: "#F3F4F6", borderBottom: "2px solid #D1D5DB" },
  hCell: {
    padding: "9px 10px", fontSize: "11px", fontWeight: "700", color: "#374151",
    letterSpacing: "0.04em", textTransform: "uppercase",
    borderRight: "1px solid #E5E7EB", whiteSpace: "nowrap",
    boxSizing: "border-box", backgroundColor: "#F3F4F6",
  },
  hCellToday: { backgroundColor: "#EFF6FF", color: "#1D4ED8" },
  todayHeaderDot: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3B82F6", margin: "2px auto 0" },

  /* 그룹 */
  groupRow:  { display: "flex", backgroundColor: "#F9FAFB", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" },
  groupCell: { display: "flex", alignItems: "center", gap: "7px", padding: "7px 12px", backgroundColor: "#F9FAFB", borderRight: "1px solid #E5E7EB", boxSizing: "border-box" },
  groupDot:  { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6B7280", flexShrink: 0 },
  groupName: { fontSize: "12px", fontWeight: "700", color: "#1E293B", whiteSpace: "nowrap" },
  deadlineBadge: { fontSize: "11px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "4px", padding: "1px 6px", whiteSpace: "nowrap" },
  coworkersBadge: { fontSize: "11px", fontWeight: "500", color: "#4338CA", backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "4px", padding: "1px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" },
  groupCount:{ fontSize: "11px", color: "#9CA3AF", marginLeft: "auto", whiteSpace: "nowrap" },
  groupMonthCell: { backgroundColor: "#F9FAFB", borderRight: "1px solid #F3F4F6", boxSizing: "border-box", minHeight: "32px" },

  /* 태스크 행 */
  taskRow:    { display: "flex", borderBottom: "1px solid #F9FAFB", minHeight: "44px" },
  fixedCell:  { position: "sticky", zIndex: 2, backgroundColor: "#FFFFFF", borderRight: "1px solid #F0F0F0", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", boxSizing: "border-box" },
  taskTitleCell: { cursor: "pointer" },
  assigneeText: { fontSize: "12px", color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  titleWrap:  { display: "flex", alignItems: "center", gap: "6px" },
  statusDot:  { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  titleText:  { fontSize: "12px", color: "#1E293B", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: "#C4B5FD", textUnderlineOffset: "2px" },
  taskMeta:   { display: "flex", gap: "4px", marginTop: "3px", flexWrap: "wrap" },
  metaChip:   { fontSize: "10px", color: "#94A3B8", backgroundColor: "#F8FAFC", borderRadius: "3px", padding: "1px 5px", border: "1px solid #E2E8F0" },

  /* 월/주 셀 & 바 */
  monthCell:  { position: "relative", borderRight: "1px solid #F3F4F6", boxSizing: "border-box", overflow: "visible", minHeight: "44px", cursor: "pointer" },
  bar:        { position: "absolute", top: "50%", transform: "translateY(-50%)", height: "14px", borderRadius: "4px", minWidth: "3px", cursor: "pointer", opacity: 0.93, zIndex: 1 },

  /* 오늘 라인 (파란 세로선) */
  todayLine: { position: "absolute", top: 0, bottom: 0, width: "2px", backgroundColor: "#3B82F6", opacity: 0.7, zIndex: 2, pointerEvents: "none" },
  /* 마감일 라인 (빨간 세로 점선) */
  deadlineLine: { position: "absolute", top: 0, bottom: 0, width: "2px", backgroundColor: "#EF4444", opacity: 0.85, zIndex: 2, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(to bottom, #EF4444 0px, #EF4444 4px, transparent 4px, transparent 8px)" },

  /* 범례 */
  legend:     { display: "flex", flexWrap: "wrap", gap: "14px", padding: "12px 24px", borderTop: "1px solid #E5E7EB", backgroundColor: "#F9FAFB" },
  legendItem: { display: "flex", alignItems: "center", gap: "6px" },
  legendDot:  { width: "12px", height: "12px", borderRadius: "3px" },
  legendLabel:{ fontSize: "11px", color: "#6B7280" },
  legendTodayLine:    { width: "2px", height: "14px", backgroundColor: "#3B82F6", opacity: 0.7 },
  legendDeadlineLine: { width: "2px", height: "14px", backgroundImage: "repeating-linear-gradient(to bottom, #EF4444 0px, #EF4444 4px, transparent 4px, transparent 8px)" },

  /* 로딩 / 빈 데이터 */
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" },
  spinner:     { width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#6B7280", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { fontSize: "13px", color: "#94A3B8" },
  noData:      { textAlign: "center", padding: "60px 0", fontSize: "14px", color: "#94A3B8" },
};

/* ═══════════════════════ 스타일: 상세 모달 ═══════════════════════ */
const dm = {
  overlay:       { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  overlayMobile: { alignItems: "flex-end" },
  modal:         { position: "relative", backgroundColor: "#FFFFFF", borderRadius: "10px", width: "660px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
  modalMobile:   { width: "100%", maxWidth: "100%", maxHeight: "92vh", borderRadius: "16px 16px 0 0" },
  header:        { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  title:         { fontSize: "16px", fontWeight: "600", color: "#1E293B" },
  closeX:        { background: "none", border: "none", fontSize: "16px", color: "#94A3B8", cursor: "pointer" },
  body:          { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" },
  footer:        { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px 18px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  fullRow:       { display: "flex", flexDirection: "column", gap: "5px" },
  halfRow:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  twoCol:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  oneCol:        { display: "grid", gridTemplateColumns: "1fr", gap: "14px" },
  fieldWrap:     { display: "flex", flexDirection: "column", gap: "5px" },
  label:         { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  inputRO:       { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#F8FAFC", cursor: "default" },
  textareaRO:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box", backgroundColor: "#F8FAFC", cursor: "default", resize: "vertical", minHeight: "72px" },
  issueRow:      { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" },
  issueLabel:    { fontSize: "12px", fontWeight: "500", color: "#64748B", flexShrink: 0 },
  issueBadgeOk:  { fontSize: "12px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", padding: "2px 9px" },
  issueBadgeNg:  { fontSize: "12px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", padding: "2px 9px" },
  cwChipRow: { display: "flex", flexWrap: "wrap", gap: "6px", padding: "6px 0" },
  cwChip: { fontSize: "12px", fontWeight: "500", color: "#1D4ED8", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "3px 10px" },
  copyBtn:       { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  copyBtnDone:   { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  closeBtn:      { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 20px", cursor: "pointer" },
};
