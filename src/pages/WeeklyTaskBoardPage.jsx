import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

/* ─────────────── 상수 ─────────────── */
const FIRST_W   = 180;
const WEEK_W    = 260;   // 주차별 컬럼 너비
const DAY_W     = 155;   // 일자별 컬럼 너비
const TODAY     = new Date();
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const PRIORITY_STYLE = {
  상:   { color: "#C2410C", background: "#FFEDD5" },
  중:   { color: "#0369A1", background: "#E0F2FE" },
  하:   { color: "#64748B", background: "#F1F5F9" },
  긴급: { color: "#DC2626", background: "#FEE2E2" },
};
const STATUS_COLOR = { TODO: "#94A3B8", PROGRESS: "#3B82F6", HOLDING: "#F59E0B", COMPLETE: "#22C55E" };

/* ── 사용자별 고유 색상 팔레트 ── */
const USER_COLORS = [
  { border: "#3B82F6", badge: "#DBEAFE", text: "#1D4ED8", cardBg: "#F5F9FF" }, // blue
  { border: "#22C55E", badge: "#DCFCE7", text: "#15803D", cardBg: "#F4FBF6" }, // green
  { border: "#F97316", badge: "#FFEDD5", text: "#C2410C", cardBg: "#FFF9F5" }, // orange
  { border: "#A855F7", badge: "#F3E8FF", text: "#7E22CE", cardBg: "#FCF8FF" }, // purple
  { border: "#F43F5E", badge: "#FFE4E6", text: "#BE123C", cardBg: "#FFF7F8" }, // rose
  { border: "#10B981", badge: "#D1FAE5", text: "#065F46", cardBg: "#F4FBF8" }, // emerald
  { border: "#0EA5E9", badge: "#E0F2FE", text: "#0369A1", cardBg: "#F4FAFF" }, // sky
  { border: "#EAB308", badge: "#FEF9C3", text: "#854D0E", cardBg: "#FFFEF4" }, // yellow
  { border: "#EC4899", badge: "#FCE7F3", text: "#9D174D", cardBg: "#FFF6FB" }, // pink
  { border: "#6366F1", badge: "#E0E7FF", text: "#3730A3", cardBg: "#F7F7FF" }, // indigo
];
function getUserColor(userId) {
  if (!userId) return USER_COLORS[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xFFFFFFFF;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

/* ─── 날짜 헬퍼 ─── */
function fromDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

function getDisplayDate(rawActualEnd, rawPlannedEnd, status, rawInsert) {
  if (status === "COMPLETE" && rawActualEnd) return rawActualEnd;
  if (rawPlannedEnd) return rawPlannedEnd;
  return rawInsert ?? "";
}

function getDisplayYYYYMM(rawActualEnd, rawPlannedEnd, status, rawInsert) {
  const d = getDisplayDate(rawActualEnd, rawPlannedEnd, status, rawInsert);
  return d && d.length >= 6 ? d.slice(0, 6) : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** YYYYMMDD 문자열 → 월 내 주차 (1~5) */
function getWeekOfMonth(raw8) {
  if (!raw8 || raw8.length < 8) return null;
  const day = parseInt(raw8.slice(6, 8), 10);
  if (day <= 7)  return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

/** YYYYMMDD 문자열 → 일(day) */
function getDayNum(raw8) {
  if (!raw8 || raw8.length < 8) return null;
  return parseInt(raw8.slice(6, 8), 10);
}

/** 주차의 시작일~끝일 배열 */
function getWeekDays(week, year, month) {
  const total = daysInMonth(year, month);
  const start = (week - 1) * 7 + 1;
  const end   = Math.min(start + 6, total);
  if (start > total) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** 주차 날짜 범위 레이블 */
function weekRangeLabel(week, totalDays) {
  const starts = [1, 8, 15, 22, 29];
  const ends   = [7, 14, 21, 28, totalDays];
  const s = starts[week - 1];
  const e = Math.min(ends[week - 1], totalDays);
  if (s > totalDays) return null;
  return `${s}~${e}일`;
}

function todayWeekOfMonth() {
  const d = TODAY.getDate();
  if (d <= 7)  return 1;
  if (d <= 14) return 2;
  if (d <= 21) return 3;
  if (d <= 28) return 4;
  return 5;
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function WeeklyTaskBoardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const DAY_NAMES = t("weekly.days");
  const STATUS_LABEL = {
    TODO:     t("common.todo"),
    PROGRESS: t("common.inProgress"),
    HOLDING:  t("common.holding"),
    COMPLETE: t("common.complete"),
  };
  const STATUS_TEXT = {
    TODO:     t("common.todo"),
    PROGRESS: t("common.inProgress"),
    HOLDING:  t("common.holding"),
    COMPLETE: t("common.complete"),
  };

  const [tasks,        setTasks]        = useState([]);
  const [tm1,          setTm1]          = useState([]);
  const [tm2,          setTm2]          = useState([]);
  const [tm3,          setTm3]          = useState([]);
  const [tm4,          setTm4]          = useState([]);
  const [userMap,      setUserMap]      = useState({});
  const [year,         setYear]         = useState(TODAY.getFullYear());
  const [month,        setMonth]        = useState(TODAY.getMonth() + 1);
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState(null);
  /* 조회 조건 */
  const [filterTm1,    setFilterTm1]    = useState("");
  const [filterUser,   setFilterUser]   = useState("");
  /* 뷰 모드 */
  const [viewMode,     setViewMode]     = useState("week"); // "week" | "day"
  const [selectedWeek, setSelectedWeek] = useState(todayWeekOfMonth);

  const curYear  = TODAY.getFullYear();
  const curMonth = TODAY.getMonth() + 1;
  const curDay   = TODAY.getDate();
  const curWeek  = todayWeekOfMonth();

  useEffect(() => { fetchData(); }, [year, month, user]);

  /* 뷰 모드 전환 시 selectedWeek 자동 세팅 */
  useEffect(() => {
    if (viewMode === "day") {
      if (year === curYear && month === curMonth) {
        setSelectedWeek(curWeek);
      } else {
        setSelectedWeek(1);
      }
    }
  }, [viewMode, year, month]);

  async function fetchData() {
    setLoading(true);
    const dept = user?.deptCd;

    const qb = (() => {
      let q = supabase.from("TASK_BOARD").select("*");
      if (dept) q = q.eq("DEPT_CD", dept);
      return q;
    })();

    const makeQm = (level) => {
      let q = supabase.from("TASK_MASTER")
        .select("TASK_ID,TASK_NAME,OBJECTIVE,COWORKERS,DEADLINE")
        .eq("LEVEL", level);
      if (dept) q = q.eq("DEPT_CD", dept);
      return q;
    };

    const qu = supabase.from("SCRUMBOARD_USER").select("ID,NAME");

    const [
      { data: bd },
      { data: md1 }, { data: md2 }, { data: md3 }, { data: md4 },
      { data: ud },
    ] = await Promise.all([qb, makeQm("1"), makeQm("2"), makeQm("3"), makeQm("4"), qu]);

    if (ud) {
      const m = {};
      ud.forEach(u => { m[u.ID] = u.NAME; });
      setUserMap(m);
    }

    if (bd) {
      const targetYM = `${year}${String(month).padStart(2, "0")}`;
      const mapped = bd.map(t => ({
        id:              t.BOARD_ID,
        title:           t.TITLE              ?? "",
        taskType1Cd:     String(t.TASK_GUBUN1 ?? ""),
        taskType2Cd:     String(t.TASK_GUBUN2 ?? ""),
        taskType3Cd:     String(t.TASK_GUBUN3 ?? ""),
        taskType4Cd:     String(t.TASK_GUBUN4 ?? ""),
        status:          t.STATUS             ?? "TODO",
        priority:        t.IMPORTANT_GUBUN    ?? "하",
        registrantId:    t.ID                 ?? "",
        content:         t.TASK_CONTENTS      ?? t.TASK_CONTENT ?? "",
        teamNote:        t.TEAM_NOTE          ?? "",
        issue:           t.ISSUE_MATTERS      ?? "",
        relatedLink:     t.PAGE_URL           ?? "",
        issueCompleteYn: t.ISSUE_COMPLETE_YN  ?? "N",
        regDate:         fromDate8(t.INSERT_DATE),
        rawInsert:       t.INSERT_DATE        ?? "",
        rawPlannedEnd:   t.DUE_EXPECT_DATE    ?? "",
        rawActualEnd:    t.COMPLETE_DATE      ?? "",
        insertDate:      fromDate8(t.INSERT_DATE),
        plannedEnd:      fromDate8(t.DUE_EXPECT_DATE),
        actualEnd:       fromDate8(t.COMPLETE_DATE),
      }));
      setTasks(mapped.filter(t =>
        getDisplayYYYYMM(t.rawActualEnd, t.rawPlannedEnd, t.status, t.rawInsert) === targetYM
      ));
    }

    const mapTm = (rows) => (rows ?? []).map(r => ({
      TASK_ID: r.TASK_ID, TASK_NAME: r.TASK_NAME,
      OBJECTIVE: r.OBJECTIVE ?? "", COWORKERS: r.COWORKERS ?? "", DEADLINE: r.DEADLINE ?? "",
    }));
    setTm1(mapTm(md1)); setTm2(mapTm(md2)); setTm3(mapTm(md3)); setTm4(mapTm(md4));
    setLoading(false);
  }

  /* 월 이동 */
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  /* ── 필터 ── */
  const filteredTasks = useMemo(() =>
    tasks.filter(t => {
      if (filterTm1  && t.taskType1Cd  !== filterTm1)  return false;
      if (filterUser && t.registrantId !== filterUser)  return false;
      return true;
    }),
  [tasks, filterTm1, filterUser]);

  const uniqueRegistrants = useMemo(() => {
    const seen = new Set();
    return tasks
      .filter(t => { if (!t.registrantId || seen.has(t.registrantId)) return false; seen.add(t.registrantId); return true; })
      .map(t => ({ id: t.registrantId, name: userMap[t.registrantId] || t.registrantId }));
  }, [tasks, userMap]);

  /* ── 주차/일자 계산 ── */
  const totalDays = daysInMonth(year, month);
  const numWeeks  = totalDays > 28 ? 5 : 4;
  const WEEKS     = Array.from({ length: numWeeks }, (_, i) => i + 1);
  const weekDays  = useMemo(() => getWeekDays(selectedWeek, year, month), [selectedWeek, year, month]);

  /* ── 주차별 행 구조 ── */
  const weekTableRows = useMemo(() => {
    const rowMap = new Map();
    filteredTasks.forEach(task => {
      const key  = task.taskType1Cd || "__none__";
      const disp = getDisplayDate(task.rawActualEnd, task.rawPlannedEnd, task.status, task.rawInsert);
      const week = getWeekOfMonth(disp);
      if (!week) return;
      if (!rowMap.has(key)) rowMap.set(key, {});
      const cell = rowMap.get(key);
      if (!cell[week]) cell[week] = [];
      cell[week].push(task);
    });
    return buildRows(rowMap, "weekMap", tm1);
  }, [filteredTasks, tm1]);

  /* ── 일자별 행 구조 ── */
  const dayTableRows = useMemo(() => {
    const rowMap = new Map();
    filteredTasks.forEach(task => {
      const disp = getDisplayDate(task.rawActualEnd, task.rawPlannedEnd, task.status, task.rawInsert);
      const week = getWeekOfMonth(disp);
      if (week !== selectedWeek) return;
      const day = getDayNum(disp);
      if (!day || !weekDays.includes(day)) return;
      const key = task.taskType1Cd || "__none__";
      if (!rowMap.has(key)) rowMap.set(key, {});
      const cell = rowMap.get(key);
      if (!cell[day]) cell[day] = [];
      cell[day].push(task);
    });
    return buildRows(rowMap, "dayMap", tm1);
  }, [filteredTasks, tm1, selectedWeek, weekDays]);

  function buildRows(rowMap, mapKey, tm1List) {
    return [...rowMap.entries()]
      .map(([key, cellMap]) => ({
        key,
        tm1Item: key === "__none__" ? null : tm1List.find(t => String(t.TASK_ID) === key),
        [mapKey]: cellMap,
      }))
      .sort((a, b) => (a.tm1Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm1Item?.TASK_NAME ?? "\uFFFF", "ko"));
  }

  const isCurWeek  = (w) => year === curYear && month === curMonth && w === curWeek;
  const isCurDay   = (d) => year === curYear && month === curMonth && d === curDay;
  const hasFilter  = filterTm1 || filterUser;

  const tableRows  = viewMode === "week" ? weekTableRows : dayTableRows;
  const colKeys    = viewMode === "week" ? WEEKS : weekDays;
  const colW       = viewMode === "week" ? WEEK_W : DAY_W;
  const totalW     = FIRST_W + colW * colKeys.length;

  return (
    <div style={s.wrap}>
      {/* ── 상단 헤더 ── */}
      <div style={s.topBar}>
        <div style={s.titleArea}>
          <h2 style={s.pageTitle}>Weekly Task Board</h2>
          <span style={s.totalBadge}>{filteredTasks.length}건</span>
        </div>
        <div style={s.headerRight}>
          {/* 월 이동 */}
          <div style={s.monthCtrl}>
            <button style={s.navBtn} onClick={prevMonth}>‹</button>
            <span style={s.monthLabel}>{year}년 {MONTH_NAMES[month - 1]}</span>
            <button style={s.navBtn} onClick={nextMonth}>›</button>
          </div>
          {/* 뷰 모드 토글 */}
          <div style={s.toggleGroup}>
            <button
              style={{ ...s.toggleBtn, ...(viewMode === "week" ? s.toggleActive : {}) }}
              onClick={() => setViewMode("week")}
            >
              {t("weekly.viewWeek")}
            </button>
            <button
              style={{ ...s.toggleBtn, ...(viewMode === "day" ? s.toggleActive : {}) }}
              onClick={() => setViewMode("day")}
            >
              {t("weekly.viewDay")}
            </button>
          </div>
        </div>
      </div>

      {/* ── 조회 조건 ── */}
      <div style={s.filterBar}>
        <div style={s.filterField}>
          <span style={s.filterLabel}>{t("common.task1")}</span>
          <select style={s.filterSelect} value={filterTm1} onChange={e => setFilterTm1(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {tm1.map(t => <option key={t.TASK_ID} value={String(t.TASK_ID)}>{t.TASK_NAME}</option>)}
          </select>
        </div>
        <div style={s.filterField}>
          <span style={s.filterLabel}>{t("common.writer")}</span>
          <select style={s.filterSelect} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {uniqueRegistrants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {hasFilter && (
          <button style={s.resetBtn} onClick={() => { setFilterTm1(""); setFilterUser(""); }}>{t("common.reset")}</button>
        )}
      </div>

      {/* ── 일자별 모드: 주차 탭 선택기 ── */}
      {viewMode === "day" && (
        <div style={s.weekTabs}>
          {WEEKS.map(w => {
            const range = weekRangeLabel(w, totalDays);
            const cur   = isCurWeek(w);
            const act   = selectedWeek === w;
            return (
              <button
                key={w}
                style={{ ...s.weekTab, ...(act ? s.weekTabActive : {}), ...(cur && !act ? s.weekTabCurrent : {}) }}
                onClick={() => setSelectedWeek(w)}
              >
                <span style={s.weekTabLabel}>{w}{t("weekly.week")}</span>
                {range && <span style={s.weekTabRange}>{range}</span>}
                {cur && <span style={s.weekTabTodayDot} />}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={s.loadingBox}>{t("common.loading")}</div>
      ) : (
        <div style={s.tableOuter}>
          <div style={{ minWidth: totalW }}>

            {/* ── 헤더 행 ── */}
            <div style={s.headerRow}>
              <div style={{ ...s.th, ...s.thFirst }}>{t("weekly.task1List")}</div>

              {/* 주차별 헤더 */}
              {viewMode === "week" && WEEKS.map(w => {
                const cnt   = weekTableRows.reduce((sum, r) => sum + (r.weekMap[w]?.length ?? 0), 0);
                const cur   = isCurWeek(w);
                const range = weekRangeLabel(w, totalDays);
                return (
                  <div key={w} style={{ ...s.th, ...(cur ? s.thCurrent : cnt > 0 ? s.thHasData : {}) }}>
                    <div style={s.thInner}>
                      <span style={cur ? s.thLabelCur : s.thLabel}>{w}{t("weekly.week")}</span>
                      {range && <span style={{ ...s.thRange, ...(cur ? s.thRangeCur : {}) }}>{range}</span>}
                    </div>
                    {cnt > 0 && <span style={{ ...s.colCnt, ...(cur ? s.colCntCur : {}) }}>{cnt}</span>}
                  </div>
                );
              })}

              {/* 일자별 헤더 */}
              {viewMode === "day" && weekDays.map(day => {
                const cnt     = dayTableRows.reduce((sum, r) => sum + (r.dayMap[day]?.length ?? 0), 0);
                const isToday = isCurDay(day);
                const dow     = new Date(year, month - 1, day).getDay();
                const isSun   = dow === 0;
                const isSat   = dow === 6;
                return (
                  <div key={day} style={{
                    ...s.th,
                    width: `${DAY_W}px`, minWidth: `${DAY_W}px`,
                    ...(isToday ? s.thToday : cnt > 0 ? s.thHasData : {}),
                  }}>
                    <div style={s.thInner}>
                      <span style={{
                        ...s.thLabel,
                        ...(isToday ? s.thLabelCur : {}),
                        ...(isSun ? s.thSun : isSat ? s.thSat : {}),
                      }}>
                        {day}일
                      </span>
                      <span style={{
                        ...s.thRange,
                        ...(isToday ? s.thRangeCur : {}),
                        ...(isSun ? s.thSun : isSat ? s.thSat : {}),
                      }}>
                        {DAY_NAMES[dow]}
                      </span>
                    </div>
                    {cnt > 0 && <span style={{ ...s.colCnt, ...(isToday ? s.colCntCur : {}) }}>{cnt}</span>}
                  </div>
                );
              })}
            </div>

            {/* ── 데이터 행 ── */}
            {tableRows.length === 0 ? (
              <div style={s.emptyBox}>
                {hasFilter ? t("weekly.noData") : t("weekly.noDataPeriod")}
              </div>
            ) : (
              tableRows.map(row => (
                <div key={row.key} style={s.dataRow}>
                  {/* 업무구분1 */}
                  <div style={{ ...s.td, ...s.type1Cell }}>
                    {row.tm1Item ? (
                      <>
                        <div style={s.t1Name}>{row.tm1Item.TASK_NAME}</div>
                        {row.tm1Item.OBJECTIVE && <div style={s.t1Row}><span style={s.t1Lbl}>목적</span><span style={s.t1Val}>{row.tm1Item.OBJECTIVE}</span></div>}
                        {row.tm1Item.COWORKERS && <div style={s.t1Row}><span style={s.t1Lbl}>담당</span><span style={s.t1Val}>{row.tm1Item.COWORKERS}</span></div>}
                        {row.tm1Item.DEADLINE  && <div style={s.t1Row}><span style={s.t1Lbl}>마감</span><span style={{ ...s.t1Val, color: "#B45309", fontWeight: "600" }}>{row.tm1Item.DEADLINE}</span></div>}
                      </>
                    ) : (
                      <div style={{ ...s.t1Name, color: "#64748B" }}>{t("common.unclassified")}</div>
                    )}
                  </div>

                  {/* 주차별 셀 */}
                  {viewMode === "week" && WEEKS.map(w => {
                    const cur = isCurWeek(w);
                    return (
                      <div key={w} style={{ ...s.td, ...s.dataCell, ...(cur ? s.dataCellCur : {}) }}>
                        {(row.weekMap?.[w] ?? []).map(task => (
                          <TaskCard key={task.id} task={task} userMap={userMap} onClick={() => setSelected({ task, tm1, tm2, tm3, tm4 })} />
                        ))}
                      </div>
                    );
                  })}

                  {/* 일자별 셀 */}
                  {viewMode === "day" && weekDays.map(day => {
                    const isToday = isCurDay(day);
                    const dow     = new Date(year, month - 1, day).getDay();
                    const isSun   = dow === 0;
                    const isSat   = dow === 6;
                    return (
                      <div key={day} style={{
                        ...s.td,
                        ...s.dataCell,
                        width: `${DAY_W}px`, minWidth: `${DAY_W}px`,
                        ...(isToday ? s.dataCellToday : isSun || isSat ? s.dataCellWeekend : {}),
                      }}>
                        {(row.dayMap?.[day] ?? []).map(task => (
                          <TaskCard key={task.id} task={task} userMap={userMap} onClick={() => setSelected({ task, tm1, tm2, tm3, tm4 })} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 상세 팝업 ── */}
      {selected && (
        <ViewModal
          task={selected.task}
          tm1={selected.tm1} tm2={selected.tm2} tm3={selected.tm3} tm4={selected.tm4}
          userMap={userMap}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ 업무 카드 ═══════════════════════ */
function TaskCard({ task, userMap, onClick }) {
  const { t } = useLanguage();
  const STATUS_LABEL = {
    TODO:     t("common.todo"),
    PROGRESS: t("common.inProgress"),
    HOLDING:  t("common.holding"),
    COMPLETE: t("common.complete"),
  };
  const ps  = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE["하"];
  const sc  = STATUS_COLOR[task.status]     || STATUS_COLOR["TODO"];
  const sl  = STATUS_LABEL[task.status]     || task.status;
  const registrantName = userMap[task.registrantId] || task.registrantId || "";
  const uc  = getUserColor(task.registrantId);
  const initial = registrantName ? registrantName.charAt(0) : "?";

  return (
    <div style={{ ...s.card, borderLeft: `3px solid ${uc.border}`, backgroundColor: uc.cardBg }} onClick={onClick}>
      {registrantName && (
        <div style={s.cardWriterRow}>
          <span style={{ ...s.cardAvatar, backgroundColor: uc.border }}>{initial}</span>
          <span style={{ ...s.cardWriterName, color: uc.text, backgroundColor: uc.badge }}>{registrantName}</span>
        </div>
      )}
      <div style={s.cardTitle}>{task.title}</div>
      <div style={s.cardDates}>
        {task.plannedEnd && (
          <div style={s.cardDateRow}>
            <span style={s.dateLbl}>{t("common.dueDate")}</span>
            <span style={{ ...s.dateVal, color: "#2563EB" }}>{task.plannedEnd}</span>
          </div>
        )}
        {task.actualEnd && (
          <div style={s.cardDateRow}>
            <span style={s.dateLbl}>{t("common.completeDate")}</span>
            <span style={{ ...s.dateVal, color: "#16A34A", fontWeight: "600" }}>{task.actualEnd}</span>
          </div>
        )}
      </div>
      <div style={s.cardFooter}>
        <span style={{ ...s.statusBadge, color: sc, borderColor: sc }}>{sl}</span>
        <span style={{ ...s.priorityBadge, color: ps.color, backgroundColor: ps.background }}>{task.priority}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ 상세 팝업 ═══════════════════════ */
function ViewModal({ task, tm1, tm2, tm3, tm4, userMap, onClose }) {
  const { t } = useLanguage();
  const STATUS_TEXT = {
    TODO:     t("common.todo"),
    PROGRESS: t("common.inProgress"),
    HOLDING:  t("common.holding"),
    COMPLETE: t("common.complete"),
  };
  const [textCopied, setTextCopied] = useState(false);
  const hasIssue      = !!task.issue?.trim();
  const issueResolved = task.issueCompleteYn === "Y";
  const getTaskName   = (arr, id) => arr.find(t => String(t.TASK_ID) === String(id))?.TASK_NAME || id || "";
  const inp = { ...ms.input, ...ms.inputRO };

  async function handleCopyText() {
    const line = (label, value) => value?.trim() ? `${label}: ${value.trim()}` : null;
    const sep  = "─".repeat(32);
    const parts = [
      "■ 업무 상세", sep,
      line("제목",           task.title),
      line("상태",           STATUS_TEXT[task.status] ?? task.status),
      line("중요도",         task.priority),
      line("등록일자",       task.regDate),
      line("업무구분1",      getTaskName(tm1, task.taskType1Cd)),
      line("업무구분2",      getTaskName(tm2, task.taskType2Cd)),
      line("작업완료예정일", task.plannedEnd),
      line("작업완료일",     task.actualEnd),
      line("연관페이지링크", task.relatedLink),
      sep,
      task.content?.trim()  ? `[작업내용]\n${task.content.trim()}`    : null,
      task.teamNote?.trim() ? `[팀장공유내용]\n${task.teamNote.trim()}` : null,
      hasIssue ? `[이슈사항]\n${task.issue.trim()}\n이슈해결여부: ${issueResolved ? "Y (해결)" : "N (미해결)"}` : null,
      sep,
    ];
    const text = parts.filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 2200);
  }

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>{t("weekly.detail")}</span>
          <button style={ms.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          <div style={ms.fullRow}><label style={ms.label}>{t("yearly.detail.title")}</label><input style={inp} type="text" readOnly value={task.title} /></div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("yearly.detail.regDate")}</label><input style={inp} type="text" readOnly value={task.regDate} /></div>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("yearly.detail.status")}</label><input style={inp} type="text" readOnly value={STATUS_TEXT[task.status] || task.status} /></div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("common.task1")}</label><input style={inp} type="text" readOnly value={getTaskName(tm1, task.taskType1Cd)} /></div>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("common.task2")}</label><input style={inp} type="text" readOnly value={getTaskName(tm2, task.taskType2Cd)} /></div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("common.task3")}</label><input style={inp} type="text" readOnly value={getTaskName(tm3, task.taskType3Cd)} /></div>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("common.task4")}</label><input style={inp} type="text" readOnly value={getTaskName(tm4, task.taskType4Cd)} /></div>
          </div>
          <div style={ms.halfRow}>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("yearly.detail.priority")}</label><input style={inp} type="text" readOnly value={task.priority} /></div>
          </div>
          <div style={ms.fullRow}><label style={ms.label}>{t("yearly.detail.link")}</label><input style={inp} type="text" readOnly value={task.relatedLink} /></div>
          <div style={ms.fullRow}><label style={ms.label}>{t("yearly.detail.work")}</label><textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.content} /></div>
          <div style={ms.fullRow}><label style={ms.label}>{t("yearly.detail.teamNote")}</label><textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.teamNote} /></div>
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.issue")}</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.issue} />
            {hasIssue && (
              <div style={ms.issueStatusRow}>
                <span style={ms.issueStatusLabel}>이슈해결여부</span>
                {issueResolved
                  ? <span style={ms.issueStatusBadgeOk}>✅ Y (해결)</span>
                  : <span style={ms.issueStatusBadgeNg}>🚨 N (미해결)</span>}
              </div>
            )}
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("yearly.detail.dueDate")}</label><input style={inp} type="text" readOnly value={task.plannedEnd} /></div>
            <div style={ms.fieldWrap}><label style={ms.label}>{t("yearly.detail.completeDate")}</label><input style={inp} type="text" readOnly value={task.actualEnd} /></div>
          </div>
        </div>
        <div style={ms.footer}>
          <button style={textCopied ? ms.copyTextBtnDone : ms.copyTextBtn} onClick={handleCopyText}>
            {textCopied ? t("common.copied") : t("common.copy")}
          </button>
          <div style={ms.footerRight}>
            <button style={ms.cancelBtn} onClick={onClose}>{t("common.close")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 스타일 ═══════════════════════ */
const s = {
  wrap:      { display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Pretendard', sans-serif" },
  topBar:    { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexShrink: 0 },
  titleArea: { display: "flex", alignItems: "center", gap: "10px" },
  pageTitle: { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0 },
  totalBadge:{ fontSize: "12px", fontWeight: "600", color: "#2563EB", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "2px 10px" },
  headerRight:{ display: "flex", alignItems: "center", gap: "10px" },

  /* 월 이동 */
  monthCtrl: { display: "flex", alignItems: "center", gap: "6px" },
  navBtn:    { fontFamily: "'Pretendard', sans-serif", fontSize: "18px", color: "#475569", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  monthLabel:{ fontSize: "15px", fontWeight: "700", color: "#1E293B", minWidth: "110px", textAlign: "center" },

  /* 뷰 모드 토글 */
  toggleGroup:  { display: "flex", borderRadius: "6px", overflow: "hidden", border: "1px solid #D9D9D9" },
  toggleBtn:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#64748B", backgroundColor: "#FFFFFF", border: "none", borderRight: "1px solid #D9D9D9", padding: "7px 14px", cursor: "pointer" },
  toggleActive: { backgroundColor: "#1E293B", color: "#FFFFFF", fontWeight: "600" },

  /* 일자별 주차 탭 */
  weekTabs:         { display: "flex", gap: "6px", marginBottom: "10px", flexShrink: 0, flexWrap: "wrap" },
  weekTab:          { fontFamily: "'Pretendard', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", padding: "7px 16px", border: "1px solid #E2E8F0", borderRadius: "8px", backgroundColor: "#FFFFFF", cursor: "pointer", position: "relative" },
  weekTabActive:    { backgroundColor: "#1E293B", border: "1px solid #1E293B" },
  weekTabCurrent:   { border: "1px solid #3B82F6" },
  weekTabLabel:     { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  weekTabRange:     { fontSize: "10px", color: "#94A3B8" },
  weekTabTodayDot:  { position: "absolute", top: "5px", right: "7px", width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#3B82F6" },

  /* 조회 조건 */
  filterBar:    { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px", padding: "10px 16px", marginBottom: "10px", flexShrink: 0 },
  filterField:  { display: "flex", alignItems: "center", gap: "8px" },
  filterLabel:  { fontSize: "13px", fontWeight: "500", color: "#5A5A5A", whiteSpace: "nowrap" },
  filterSelect: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 10px", outline: "none", minWidth: "140px", cursor: "pointer" },
  resetBtn:     { fontFamily: "'Pretendard', sans-serif", fontSize: "12px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 12px", cursor: "pointer" },

  loadingBox:  { display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#94A3B8", fontSize: "14px" },
  emptyBox:    { padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "14px" },
  tableOuter:  { flex: 1, overflowX: "auto", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "10px" },

  /* 테이블 헤더 */
  headerRow:  { display: "flex", position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1E293B" },
  th: {
    width: `${WEEK_W}px`, minWidth: `${WEEK_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", fontSize: "12px", fontWeight: "700", color: "#CBD5E1",
    borderRight: "1px solid #334155",
  },
  thFirst:   { width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, justifyContent: "center", color: "#F8FAFC", fontSize: "11px" },
  thHasData: { color: "#F8FAFC" },
  thCurrent: { color: "#FFFFFF", backgroundColor: "#1D4ED8" },
  thToday:   { color: "#FFFFFF", backgroundColor: "#1D4ED8" },
  thInner:   { display: "flex", flexDirection: "column", gap: "2px" },
  thLabel:   { fontSize: "13px", fontWeight: "700", color: "#CBD5E1" },
  thLabelCur:{ fontSize: "13px", fontWeight: "800", color: "#FFFFFF" },
  thRange:   { fontSize: "10px", fontWeight: "400", color: "#64748B" },
  thRangeCur:{ color: "#BFDBFE" },
  thSun:     { color: "#F87171" },
  thSat:     { color: "#93C5FD" },
  colCnt:    { fontSize: "10px", fontWeight: "700", backgroundColor: "#334155", color: "#CBD5E1", borderRadius: "10px", padding: "1px 7px", flexShrink: 0 },
  colCntCur: { backgroundColor: "#3B82F6", color: "#FFF" },

  /* 데이터 행 */
  dataRow:        { display: "flex", borderBottom: "1px solid #E2E8F0", minHeight: "100px" },
  td:             { borderRight: "1px solid #E2E8F0", padding: "10px", flexShrink: 0 },
  type1Cell:      { width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", gap: "5px", position: "sticky", left: 0, zIndex: 5, borderRight: "2px solid #E2E8F0" },
  t1Name:         { fontSize: "12px", fontWeight: "700", color: "#1E293B", lineHeight: "1.4", marginBottom: "2px" },
  t1Row:          { display: "flex", alignItems: "flex-start", gap: "4px" },
  t1Lbl:          { fontSize: "10px", fontWeight: "600", color: "#94A3B8", flexShrink: 0, minWidth: "26px" },
  t1Val:          { fontSize: "10px", color: "#475569", lineHeight: "1.4", wordBreak: "break-all" },
  dataCell:       { width: `${WEEK_W}px`, minWidth: `${WEEK_W}px`, backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", gap: "8px" },
  dataCellCur:    { backgroundColor: "#EFF6FF", borderTop: "2px solid #3B82F6" },
  dataCellToday:  { backgroundColor: "#EFF6FF", borderTop: "2px solid #3B82F6" },
  dataCellWeekend:{ backgroundColor: "#FAFAFA" },

  /* 카드 */
  card:           { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "5px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", transition: "box-shadow 0.15s", borderLeft: "3px solid #CBD5E1" },
  cardWriterRow:  { display: "flex", alignItems: "center", gap: "5px" },
  cardAvatar:     { width: "17px", height: "17px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "#fff", flexShrink: 0 },
  cardWriterName: { fontSize: "11px", fontWeight: "600", padding: "1px 7px", borderRadius: "10px", lineHeight: "1.6" },
  cardTitle:     { fontSize: "13px", fontWeight: "600", color: "#1E293B", lineHeight: "1.4" },
  cardDates:     { display: "flex", flexDirection: "column", gap: "2px" },
  cardDateRow:   { display: "flex", alignItems: "center", gap: "5px" },
  dateLbl:       { fontSize: "10px", fontWeight: "500", color: "#94A3B8", flexShrink: 0 },
  dateVal:       { fontSize: "11px" },
  cardFooter:    { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" },
  statusBadge:   { fontSize: "10px", fontWeight: "600", padding: "1px 6px", borderRadius: "4px", border: "1px solid", backgroundColor: "transparent" },
  priorityBadge: { fontSize: "10px", fontWeight: "600", padding: "1px 6px", borderRadius: "4px" },
};

const ms = {
  overlay:         { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:           { position: "relative", backgroundColor: "#FFFFFF", borderRadius: "10px", width: "660px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
  header:          { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  title:           { fontSize: "16px", fontWeight: "600", color: "#1E293B" },
  closeX:          { background: "none", border: "none", fontSize: "16px", color: "#94A3B8", cursor: "pointer" },
  body:            { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" },
  footer:          { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "14px 24px 18px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  footerRight:     { display: "flex", gap: "8px" },
  copyTextBtn:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  copyTextBtnDone: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  fullRow:         { display: "flex", flexDirection: "column", gap: "5px" },
  halfRow:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  twoCol:          { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  fieldWrap:       { display: "flex", flexDirection: "column", gap: "5px" },
  label:           { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  input:           { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box" },
  inputRO:         { backgroundColor: "#F8FAFC", color: "#475569", cursor: "default" },
  textarea:        { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: "72px" },
  cancelBtn:       { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 20px", cursor: "pointer" },
  issueStatusRow:     { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" },
  issueStatusLabel:   { fontSize: "12px", fontWeight: "500", color: "#64748B", flexShrink: 0 },
  issueStatusBadgeOk: { fontSize: "12px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", padding: "2px 9px" },
  issueStatusBadgeNg: { fontSize: "12px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", padding: "2px 9px" },
};
