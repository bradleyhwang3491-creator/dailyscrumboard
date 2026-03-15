import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

/* ── 날짜 유틸 ──────────────────────────────────────── */
function fromDate8(s) {
  if (!s) return null;
  const str = String(s);
  if (str.length === 8) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  return str.slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 해당 month(1-12)에서 task 바의 left%, width% 계산
 * returns null if task doesn't span this month
 */
function getBarStyle(task, year, month) {
  const start = task.regDate ? new Date(task.regDate) : null;
  const end   = task.plannedEnd ? new Date(task.plannedEnd) : null;
  if (!start && !end) return null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month - 1, daysInMonth(year, month));

  const barStart = start || monthStart;
  const barEnd   = end   || monthEnd;

  if (barEnd < monthStart || barStart > monthEnd) return null;

  const totalDays = daysInMonth(year, month);
  const s = barStart < monthStart ? 1 : barStart.getDate();
  const e = barEnd   > monthEnd   ? totalDays : barEnd.getDate();

  const left  = ((s - 1) / totalDays) * 100;
  const width = ((e - s + 1) / totalDays) * 100;
  return { left: `${left}%`, width: `${width}%` };
}

/* ── 상태별 바 색상 (Grey & White 톤) ─────────────── */
const STATUS_BAR = {
  TODO:     { bg: "#CBD5E1", text: "#475569" },
  PROGRESS: { bg: "#64748B", text: "#FFFFFF" },
  HOLDING:  { bg: "#E2E8F0", text: "#94A3B8" },
  COMPLETE: { bg: "#374151", text: "#FFFFFF" },
};

/* ── 로딩 스피너 ─────────────────────────────────── */
function LoadingState({ label }) {
  return (
    <div style={g.loadingWrap}>
      <div style={g.spinner} />
      <span style={g.loadingText}>{label}</span>
    </div>
  );
}

/* ── GanttChartPage ────────────────────────────────── */
export default function GanttChartPage() {
  const { user }   = useAuth();
  const { t }      = useLanguage();
  const isMobile   = useBreakpoint(768);

  /* ─ 연도 ─ */
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  /* ─ 필터 ─ */
  const [filterTm1, setFilterTm1] = useState("ALL");
  const [filterAssignee, setFilterAssignee] = useState("ALL");

  /* ─ 데이터 ─ */
  const [tm1List, setTm1List]   = useState([]);
  const [tasks,   setTasks]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const MONTHS = t("gantt.months");

  /* ─ 데이터 로드 ─ */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const dept = user?.deptCd;

      /* TASK_MASTER LEVEL=1 */
      let q1 = supabase
        .from("TASK_MASTER")
        .select("TASK_ID, TASK_NAME, DEADLINE, COWORKERS, OBJECTIVE")
        .eq("LEVEL", "1")
        .order("TASK_NAME");
      if (dept) q1 = q1.eq("DEPT_CD", dept);
      const { data: tm1Data } = await q1;

      const tm1Map = {};
      (tm1Data || []).forEach((r) => {
        tm1Map[r.TASK_ID] = {
          id:        r.TASK_ID,
          name:      r.TASK_NAME ?? "",
          deadline:  fromDate8(r.DEADLINE ?? r.deadline),
          coworkers: r.COWORKERS ?? r.coworkers ?? "",
        };
      });
      setTm1List(Object.values(tm1Map));

      /* TASK_BOARD */
      let q2 = supabase
        .from("TASK_BOARD")
        .select("BOARD_ID, TITLE, STATUS, TASK_GUBUN1, INSERT_DATE, DUE_EXPECT_DATE, COMPLETE_DATE, IMPORTANT_GUBUN")
        .order("BOARD_ID", { ascending: false });
      if (dept) q2 = q2.eq("DEPT_CD", dept);
      const { data: boardData } = await q2;

      const mapped = (boardData || []).map((r) => ({
        id:         r.BOARD_ID,
        title:      r.TITLE ?? "",
        status:     r.STATUS ?? "TODO",
        tm1Cd:      r.TASK_GUBUN1 ?? "",
        regDate:    fromDate8(r.INSERT_DATE),
        plannedEnd: fromDate8(r.DUE_EXPECT_DATE),
        actualEnd:  fromDate8(r.COMPLETE_DATE),
        priority:   r.IMPORTANT_GUBUN ?? "",
        coworkers:  tm1Map[r.TASK_GUBUN1]?.coworkers ?? "",
      }));
      setTasks(mapped);
      setLoading(false);
    }
    load();
  }, [user?.deptCd]);

  /* ─ 담당자 목록 (중복 제거) ─ */
  const assigneeList = useMemo(() => {
    const set = new Set();
    tm1List.forEach((m) => { if (m.coworkers) m.coworkers.split(/[,、\s]+/).forEach((a) => { if (a.trim()) set.add(a.trim()); }); });
    return Array.from(set).sort();
  }, [tm1List]);

  /* ─ 필터링된 태스크 ─ */
  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      /* 연도 범위 체크 */
      const yearStart = new Date(year, 0, 1);
      const yearEnd   = new Date(year, 11, 31);
      const taskStart = task.regDate    ? new Date(task.regDate)    : null;
      const taskEnd   = task.plannedEnd ? new Date(task.plannedEnd) : null;
      const inYear    = (!taskStart || taskStart <= yearEnd) && (!taskEnd || taskEnd >= yearStart);
      if (!inYear) return false;

      /* 업무구분1 필터 */
      if (filterTm1 !== "ALL" && task.tm1Cd !== filterTm1) return false;

      /* 담당자 필터 */
      if (filterAssignee !== "ALL") {
        const names = (task.coworkers || "").split(/[,、\s]+/).map((s) => s.trim());
        if (!names.includes(filterAssignee)) return false;
      }
      return true;
    });
  }, [tasks, year, filterTm1, filterAssignee]);

  /* ─ 업무구분1별 그룹핑 ─ */
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((task) => {
      const key  = task.tm1Cd || "__none__";
      const tm1  = tm1List.find((m) => m.id === key);
      const name = tm1?.name ?? (key === "__none__" ? t("gantt.noCategory") : key);
      if (!map[key]) map[key] = { tm1Name: name, coworkers: tm1?.coworkers ?? "", tasks: [] };
      map[key].tasks.push(task);
    });
    return Object.values(map).sort((a, b) => a.tm1Name.localeCompare(b.tm1Name));
  }, [filtered, tm1List, t]);

  /* ─ 연도 범위 ─ */
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) yearOptions.push(y);

  const LEFT_TM1  = isMobile ? 80  : 140;
  const LEFT_ASGN = isMobile ? 64  : 100;
  const LEFT_TASK = isMobile ? 100 : 180;
  const MONTH_W   = isMobile ? 60  : 80;
  const TOTAL_W   = LEFT_TM1 + LEFT_ASGN + LEFT_TASK + MONTH_W * 12;

  return (
    <div style={g.page}>
      {/* ── 헤더 ── */}
      <div style={isMobile ? g.pageHeaderMobile : g.pageHeader}>
        <h2 style={isMobile ? g.titleMobile : g.title}>{t("gantt.title")}</h2>
      </div>

      {/* ── 필터 바 ── */}
      <div style={isMobile ? g.filterBarMobile : g.filterBar}>
        {/* 연도 */}
        <div style={g.filterGroup}>
          <label style={g.filterLabel}>{t("gantt.year")}</label>
          <select style={g.filterSelect} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* 업무구분1 */}
        <div style={g.filterGroup}>
          <label style={g.filterLabel}>{t("common.task1")}</label>
          <select style={g.filterSelect} value={filterTm1} onChange={(e) => setFilterTm1(e.target.value)}>
            <option value="ALL">{t("common.all")}</option>
            {tm1List.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* 담당자 */}
        <div style={g.filterGroup}>
          <label style={g.filterLabel}>{t("gantt.assignee")}</label>
          <select style={g.filterSelect} value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="ALL">{t("common.all")}</option>
            {assigneeList.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* 초기화 */}
        <button style={g.resetBtn} onClick={() => { setFilterTm1("ALL"); setFilterAssignee("ALL"); setYear(currentYear); }}>
          {t("common.reset")}
        </button>
      </div>

      {/* ── 테이블 ── */}
      {loading ? (
        <LoadingState label={t("common.loading")} />
      ) : groups.length === 0 ? (
        <div style={g.noData}>{t("gantt.noData")}</div>
      ) : (
        <div style={g.tableWrap}>
          <div style={{ minWidth: TOTAL_W }}>
            {/* 헤더 행 */}
            <div style={g.headerRow}>
              <div style={{ ...g.hCell, width: LEFT_TM1, minWidth: LEFT_TM1, position: "sticky", left: 0, zIndex: 3, backgroundColor: "#F3F4F6" }}>
                {t("common.task1")}
              </div>
              <div style={{ ...g.hCell, width: LEFT_ASGN, minWidth: LEFT_ASGN, position: "sticky", left: LEFT_TM1, zIndex: 3, backgroundColor: "#F3F4F6" }}>
                {t("gantt.assignee")}
              </div>
              <div style={{ ...g.hCell, width: LEFT_TASK, minWidth: LEFT_TASK, position: "sticky", left: LEFT_TM1 + LEFT_ASGN, zIndex: 3, backgroundColor: "#F3F4F6" }}>
                {t("gantt.taskTitle")}
              </div>
              {MONTHS.map((m, i) => (
                <div key={i} style={{ ...g.hCell, width: MONTH_W, minWidth: MONTH_W, textAlign: "center" }}>{m}</div>
              ))}
            </div>

            {/* 그룹 & 태스크 행 */}
            {groups.map((grp) => (
              <div key={grp.tm1Name}>
                {/* 업무구분1 그룹 헤더 */}
                <div style={g.groupHeaderRow}>
                  <div style={{ ...g.groupHeaderCell, width: LEFT_TM1 + LEFT_ASGN + LEFT_TASK, position: "sticky", left: 0, zIndex: 2 }}>
                    <span style={g.groupDot} />
                    <span style={g.groupName}>{grp.tm1Name}</span>
                    {grp.coworkers && (
                      <span style={g.groupAssignee}>{grp.coworkers}</span>
                    )}
                    <span style={g.groupCount}>{grp.tasks.length}{t("gantt.taskCount")}</span>
                  </div>
                  {MONTHS.map((_, i) => (
                    <div key={i} style={{ ...g.groupMonthCell, width: MONTH_W, minWidth: MONTH_W }} />
                  ))}
                </div>

                {/* 태스크 행들 */}
                {grp.tasks.map((task, ti) => {
                  const barColor = STATUS_BAR[task.status] || STATUS_BAR.TODO;
                  const isLast   = ti === grp.tasks.length - 1;
                  return (
                    <div key={task.id} style={{ ...g.taskRow, ...(isLast ? { borderBottom: "1px solid #E5E7EB" } : {}) }}>
                      {/* 업무구분1 (비어있는 좌측 고정 셀) */}
                      <div style={{ ...g.fixedCell, width: LEFT_TM1, minWidth: LEFT_TM1, left: 0 }} />
                      {/* 담당자 */}
                      <div style={{ ...g.fixedCell, width: LEFT_ASGN, minWidth: LEFT_ASGN, left: LEFT_TM1 }}>
                        <span style={g.assigneeText}>{grp.coworkers || "-"}</span>
                      </div>
                      {/* 업무 제목 */}
                      <div style={{ ...g.fixedCell, width: LEFT_TASK, minWidth: LEFT_TASK, left: LEFT_TM1 + LEFT_ASGN }}>
                        <div style={g.taskTitleWrap}>
                          <span style={{ ...g.statusDot, backgroundColor: barColor.bg, border: `1px solid ${barColor.bg === "#E2E8F0" || barColor.bg === "#CBD5E1" || barColor.bg === "#F1F5F9" ? "#CBD5E1" : "transparent"}` }} />
                          <span style={g.taskTitleText}>{task.title}</span>
                        </div>
                        <div style={g.taskMeta}>
                          {task.regDate && <span style={g.metaChip}>{task.regDate}</span>}
                          {task.plannedEnd && <span style={g.metaChip}>{task.plannedEnd}</span>}
                        </div>
                      </div>

                      {/* 월별 셀 */}
                      {MONTHS.map((_, i) => {
                        const bar = getBarStyle(task, year, i + 1);
                        return (
                          <div key={i} style={{ ...g.monthCell, width: MONTH_W, minWidth: MONTH_W }}>
                            {bar && (
                              <div style={{
                                ...g.bar,
                                left:            bar.left,
                                width:           bar.width,
                                backgroundColor: barColor.bg,
                                color:           barColor.text,
                              }} title={`${task.title} (${task.status})`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 범례 ── */}
      <div style={g.legend}>
        {Object.entries(STATUS_BAR).map(([key, val]) => {
          const labelMap = { TODO: t("common.todo"), PROGRESS: t("common.inProgress"), HOLDING: t("common.holding"), COMPLETE: t("common.complete") };
          return (
            <div key={key} style={g.legendItem}>
              <span style={{ ...g.legendDot, backgroundColor: val.bg, border: val.bg === "#CBD5E1" || val.bg === "#E2E8F0" ? "1px solid #CBD5E1" : "none" }} />
              <span style={g.legendLabel}>{labelMap[key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 스타일 ─────────────────────────────────────────── */
const g = {
  page: {
    fontFamily: "'Pretendard', sans-serif",
    backgroundColor: "#FFFFFF",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  pageHeader: {
    padding: "20px 24px 0",
  },
  pageHeaderMobile: {
    padding: "14px 16px 0",
  },
  title: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1E293B",
    margin: 0,
  },
  titleMobile: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1E293B",
    margin: 0,
  },

  /* 필터 */
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
    padding: "16px 24px",
    borderBottom: "1px solid #F1F5F9",
  },
  filterBarMobile: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderBottom: "1px solid #F1F5F9",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#64748B",
    whiteSpace: "nowrap",
  },
  filterSelect: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    border: "1px solid #E2E8F0",
    borderRadius: "6px",
    padding: "6px 10px",
    backgroundColor: "#FAFAFA",
    cursor: "pointer",
    outline: "none",
    minWidth: "110px",
  },
  resetBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "12px",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    border: "1px solid #E2E8F0",
    borderRadius: "6px",
    padding: "6px 12px",
    cursor: "pointer",
  },

  /* 테이블 래퍼 */
  tableWrap: {
    flex: 1,
    overflowX: "auto",
    overflowY: "auto",
    margin: "0",
  },

  /* 헤더 행 */
  headerRow: {
    display: "flex",
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#F3F4F6",
    borderBottom: "2px solid #E5E7EB",
  },
  hCell: {
    padding: "10px 12px",
    fontSize: "11px",
    fontWeight: "700",
    color: "#374151",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    borderRight: "1px solid #E5E7EB",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },

  /* 그룹 헤더 */
  groupHeaderRow: {
    display: "flex",
    backgroundColor: "#F8FAFC",
    borderTop: "1px solid #E5E7EB",
    borderBottom: "1px solid #E5E7EB",
  },
  groupHeaderCell: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    boxSizing: "border-box",
    backgroundColor: "#F8FAFC",
    borderRight: "1px solid #E5E7EB",
  },
  groupDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#94A3B8",
    flexShrink: 0,
  },
  groupName: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#374151",
    whiteSpace: "nowrap",
  },
  groupAssignee: {
    fontSize: "11px",
    color: "#94A3B8",
    whiteSpace: "nowrap",
  },
  groupCount: {
    fontSize: "11px",
    color: "#94A3B8",
    marginLeft: "auto",
    whiteSpace: "nowrap",
  },
  groupMonthCell: {
    backgroundColor: "#F8FAFC",
    borderRight: "1px solid #F1F5F9",
    boxSizing: "border-box",
  },

  /* 태스크 행 */
  taskRow: {
    display: "flex",
    borderBottom: "1px solid #F8FAFC",
    minHeight: "44px",
  },
  fixedCell: {
    position: "sticky",
    zIndex: 2,
    backgroundColor: "#FFFFFF",
    borderRight: "1px solid #E5E7EB",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  assigneeText: {
    fontSize: "12px",
    color: "#64748B",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* 업무 제목 셀 내부 */
  taskTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  taskTitleText: {
    fontSize: "12px",
    color: "#2F2F2F",
    fontWeight: "500",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  taskMeta: {
    display: "flex",
    gap: "4px",
    marginTop: "3px",
    flexWrap: "wrap",
  },
  metaChip: {
    fontSize: "10px",
    color: "#94A3B8",
    backgroundColor: "#F8FAFC",
    borderRadius: "3px",
    padding: "1px 5px",
    border: "1px solid #E2E8F0",
  },

  /* 월 셀 & 바 */
  monthCell: {
    position: "relative",
    borderRight: "1px solid #F1F5F9",
    boxSizing: "border-box",
    overflow: "hidden",
    minHeight: "44px",
  },
  bar: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    height: "14px",
    borderRadius: "4px",
    minWidth: "4px",
    cursor: "default",
    transition: "opacity 0.15s",
  },

  /* 범례 */
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    padding: "12px 24px",
    borderTop: "1px solid #F1F5F9",
    backgroundColor: "#FAFAFA",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  legendDot: {
    width: "12px",
    height: "12px",
    borderRadius: "3px",
  },
  legendLabel: {
    fontSize: "11px",
    color: "#64748B",
  },

  /* 로딩 / 빈 데이터 */
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 0",
    gap: "12px",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "3px solid #E2E8F0",
    borderTopColor: "#64748B",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: "13px",
    color: "#94A3B8",
  },
  noData: {
    textAlign: "center",
    padding: "60px 0",
    fontSize: "14px",
    color: "#94A3B8",
  },
};
