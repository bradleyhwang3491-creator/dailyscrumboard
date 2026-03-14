import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useLanguage } from "../context/LanguageContext";

/* ─────────────── 상수 ─────────────── */
const FIRST_W = 180;   // 좌측 고정 컬럼 너비
const MONTH_W = 130;   // 월 컬럼 너비
const TODAY   = new Date();

const PRIORITY_STYLE = {
  상:   { color: "#C2410C", background: "#FFEDD5" },
  중:   { color: "#0369A1", background: "#E0F2FE" },
  하:   { color: "#64748B", background: "#F1F5F9" },
  긴급: { color: "#DC2626", background: "#FEE2E2" },
};
const STATUS_COLOR = { TODO:"#94A3B8", PROGRESS:"#3B82F6", HOLDING:"#F59E0B", COMPLETE:"#22C55E" };

const USER_COLORS = [
  { border: "#3B82F6", badge: "#DBEAFE", text: "#1D4ED8", cardBg: "#F5F9FF" },
  { border: "#22C55E", badge: "#DCFCE7", text: "#15803D", cardBg: "#F4FBF6" },
  { border: "#F97316", badge: "#FFEDD5", text: "#C2410C", cardBg: "#FFF9F5" },
  { border: "#A855F7", badge: "#F3E8FF", text: "#7E22CE", cardBg: "#FCF8FF" },
  { border: "#F43F5E", badge: "#FFE4E6", text: "#BE123C", cardBg: "#FFF7F8" },
  { border: "#10B981", badge: "#D1FAE5", text: "#065F46", cardBg: "#F4FBF8" },
  { border: "#0EA5E9", badge: "#E0F2FE", text: "#0369A1", cardBg: "#F4FAFF" },
  { border: "#EAB308", badge: "#FEF9C3", text: "#854D0E", cardBg: "#FFFEF4" },
  { border: "#EC4899", badge: "#FCE7F3", text: "#9D174D", cardBg: "#FFF6FB" },
  { border: "#6366F1", badge: "#E0E7FF", text: "#3730A3", cardBg: "#F7F7FF" },
];
function getUserColor(userId) {
  if (!userId) return USER_COLORS[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xFFFFFFFF;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}
function fromDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}
function getDisplayDate(rawActualEnd, rawPlannedEnd, status, rawInsert) {
  if (status === "COMPLETE" && rawActualEnd) return rawActualEnd;
  if (rawPlannedEnd) return rawPlannedEnd;
  return rawInsert ?? "";
}
function getDisplayMonth(rawActualEnd, rawPlannedEnd, status, rawInsert) {
  const d = getDisplayDate(rawActualEnd, rawPlannedEnd, status, rawInsert);
  return d && d.length >= 6 ? parseInt(d.slice(4,6), 10) : null;
}
function getDisplayYear(rawActualEnd, rawPlannedEnd, status, rawInsert) {
  const d = getDisplayDate(rawActualEnd, rawPlannedEnd, status, rawInsert);
  return d && d.length >= 4 ? parseInt(d.slice(0,4), 10) : null;
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function YearlyTaskBoardCRMPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isMobile = useBreakpoint(768);
  const MONTHS = t("yearly.months");

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

  const [tasks,      setTasks]      = useState([]);
  const [tm1,        setTm1]        = useState([]);
  const [tm2,        setTm2]        = useState([]);
  const [tm3,        setTm3]        = useState([]);
  const [tm4,        setTm4]        = useState([]);
  const [userMap,    setUserMap]    = useState({});
  const [year,       setYear]       = useState(TODAY.getFullYear());
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState(null);

  /* 조회 조건 */
  const [filterTm4,  setFilterTm4]  = useState("");
  const [filterUser, setFilterUser] = useState("");

  const curYear  = TODAY.getFullYear();
  const curMonth = TODAY.getMonth() + 1;

  useEffect(() => { fetchData(); }, [year, user]);

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
      const mapped = bd.map(r => ({
        id:              r.BOARD_ID,
        title:           r.TITLE              ?? "",
        taskType1Cd:     String(r.TASK_GUBUN1 ?? ""),
        taskType2Cd:     String(r.TASK_GUBUN2 ?? ""),
        taskType3Cd:     String(r.TASK_GUBUN3 ?? ""),
        taskType4Cd:     String(r.TASK_GUBUN4 ?? ""),
        status:          r.STATUS             ?? "TODO",
        priority:        r.IMPORTANT_GUBUN    ?? "하",
        registrantId:    r.ID                 ?? "",
        content:         r.TASK_CONTENTS      ?? r.TASK_CONTENT ?? "",
        teamNote:        r.LEADER_KNOW        ?? "",
        issue:           r.ISSUE              ?? "",
        relatedLink:     r.PAGE_URL           ?? "",
        issueCompleteYn: r.ISSUE_COMPLETE_YN  ?? "N",
        regDate:         fromDate8(r.INSERT_DATE),
        rawInsert:       r.INSERT_DATE        ?? "",
        rawPlannedEnd:   r.DUE_EXPECT_DATE    ?? "",
        rawActualEnd:    r.COMPLETE_DATE      ?? "",
        insertDate:      fromDate8(r.INSERT_DATE),
        plannedEnd:      fromDate8(r.DUE_EXPECT_DATE),
        actualEnd:       fromDate8(r.COMPLETE_DATE),
      }));
      setTasks(mapped.filter(r =>
        getDisplayYear(r.rawActualEnd, r.rawPlannedEnd, r.status, r.rawInsert) === year
      ));
    }

    const mapTm = (rows) => (rows ?? []).map(r => ({
      TASK_ID:   r.TASK_ID,
      TASK_NAME: r.TASK_NAME,
      OBJECTIVE: r.OBJECTIVE ?? "",
      COWORKERS: r.COWORKERS ?? "",
      DEADLINE:  r.DEADLINE  ?? "",
    }));
    setTm1(mapTm(md1));
    setTm2(mapTm(md2));
    setTm3(mapTm(md3));
    setTm4(mapTm(md4));
    setLoading(false);
  }

  /* ── 필터 적용 ── */
  const filteredTasks = useMemo(() =>
    tasks.filter(r => {
      if (filterTm4  && r.taskType4Cd !== filterTm4) return false;
      if (filterUser && r.registrantId !== filterUser) return false;
      return true;
    }),
  [tasks, filterTm4, filterUser]);

  /* 등록자 목록 */
  const uniqueRegistrants = useMemo(() => {
    const seen = new Set();
    return tasks
      .filter(r => { if (!r.registrantId || seen.has(r.registrantId)) return false; seen.add(r.registrantId); return true; })
      .map(r => ({ id: r.registrantId, name: userMap[r.registrantId] || r.registrantId }));
  }, [tasks, userMap]);

  /* ── 업무구분4(outer) → 업무구분1(inner rows) → 월별 ── */
  const groupedByTm4 = useMemo(() => {
    const outerMap = new Map();
    filteredTasks.forEach(task => {
      const tm4Key = task.taskType4Cd || "__none4__";
      const tm1Key = task.taskType1Cd || "__none1__";
      const month  = getDisplayMonth(task.rawActualEnd, task.rawPlannedEnd, task.status, task.rawInsert);
      if (!month || month < 1 || month > 12) return;
      if (!outerMap.has(tm4Key)) outerMap.set(tm4Key, new Map());
      const innerMap = outerMap.get(tm4Key);
      if (!innerMap.has(tm1Key)) innerMap.set(tm1Key, {});
      const cell = innerMap.get(tm1Key);
      if (!cell[month]) cell[month] = [];
      cell[month].push(task);
    });
    return [...outerMap.entries()]
      .map(([tm4Key, innerMap]) => {
        const tm4Item = tm4Key === "__none4__" ? null : tm4.find(r => String(r.TASK_ID) === tm4Key);
        const rows = [...innerMap.entries()]
          .map(([tm1Key, monthMap]) => ({
            tm1Key,
            tm1Item: tm1Key === "__none1__" ? null : tm1.find(r => String(r.TASK_ID) === tm1Key),
            monthMap,
          }))
          .sort((a, b) => (a.tm1Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm1Item?.TASK_NAME ?? "\uFFFF", "ko"));
        return { tm4Key, tm4Item, rows };
      })
      .sort((a, b) => (a.tm4Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm4Item?.TASK_NAME ?? "\uFFFF", "ko"));
  }, [filteredTasks, tm1, tm4]);

  const isCurMonth = (month) => year === curYear && month === curMonth;
  const hasFilter  = filterTm4 || filterUser;
  const totalCount = filteredTasks.length;
  const MONTHS_IDX = [1,2,3,4,5,6,7,8,9,10,11,12];

  return (
    <div style={s.wrap}>
      {/* ── 상단 헤더 ── */}
      <div style={{ ...s.topBar, ...(isMobile ? s.topBarMobile : {}) }}>
        <div style={s.titleArea}>
          <h2 style={{ ...s.pageTitle, ...(isMobile ? { fontSize: "15px" } : {}) }}>
            Yearly Task Board <span style={s.crmBadge}>CRM</span>
          </h2>
          <span style={s.totalBadge}>{totalCount}건</span>
        </div>
        <div style={s.yearCtrl}>
          <button style={s.yearBtn} onClick={() => setYear(y => y - 1)}>‹</button>
          <span style={s.yearLabel}>{year}</span>
          <button style={s.yearBtn} onClick={() => setYear(y => y + 1)}>›</button>
        </div>
      </div>

      {/* ── 조회 조건 ── */}
      <div style={{ ...s.filterBar, ...(isMobile ? s.filterBarMobile : {}) }}>
        <div style={isMobile ? s.filterFieldMobile : s.filterField}>
          <span style={s.filterLabel}>{t("common.task4")}</span>
          <select style={isMobile ? s.filterSelectFull : s.filterSelect} value={filterTm4} onChange={e => setFilterTm4(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {tm4.map(r => (
              <option key={r.TASK_ID} value={String(r.TASK_ID)}>{r.TASK_NAME}</option>
            ))}
          </select>
        </div>
        <div style={isMobile ? s.filterFieldMobile : s.filterField}>
          <span style={s.filterLabel}>{t("common.writer")}</span>
          <select style={isMobile ? s.filterSelectFull : s.filterSelect} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {uniqueRegistrants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        {hasFilter && (
          <button style={isMobile ? s.resetBtnFull : s.resetBtn} onClick={() => { setFilterTm4(""); setFilterUser(""); }}>
            {t("common.reset")}
          </button>
        )}
      </div>

      {loading ? (
        <div style={s.loadingBox}>{t("common.loading")}</div>
      ) : (
        <div style={s.tableOuter}>
          <div style={{ minWidth: FIRST_W + MONTH_W * 12 }}>

            {/* ── 헤더 행 ── */}
            <div style={s.headerRow}>
              <div style={{ ...s.th, ...s.thFirst }}></div>
              {MONTHS.map((m, i) => {
                const cur = isCurMonth(i + 1);
                const cnt = filteredTasks.filter(r => {
                  const mo = getDisplayMonth(r.rawActualEnd, r.rawPlannedEnd, r.status, r.rawInsert);
                  return mo === i + 1;
                }).length;
                return (
                  <div key={m} style={{ ...s.th, ...(cur ? s.thCurrent : cnt > 0 ? s.thHasData : {}) }}>
                    <span style={cur ? s.thLabelCur : {}}>{m}</span>
                    {cnt > 0 && (
                      <span style={{ ...s.monthCnt, ...(cur ? s.monthCntCur : {}) }}>{cnt}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── 데이터 없을 때 ── */}
            {groupedByTm4.length === 0 ? (
              <div style={s.emptyBox}>
                {hasFilter ? t("yearlyCRM.noData") : t("yearlyCRM.noDataYear")}
              </div>
            ) : (
              groupedByTm4.map(group => (
                <div key={group.tm4Key}>

                  {/* 업무구분4 그룹 헤더 행 */}
                  <div style={s.groupHeaderRow}>
                    <div style={s.groupHeaderCell}>
                      <span style={s.groupHeaderText}>
                        {group.tm4Item ? group.tm4Item.TASK_NAME : t("common.unclassified")}
                      </span>
                    </div>
                    {MONTHS_IDX.map(month => {
                      const cnt = group.rows.reduce((sum, row) => sum + (row.monthMap[month]?.length ?? 0), 0);
                      const cur = isCurMonth(month);
                      return (
                        <div key={month} style={{ ...s.groupHeaderMonthCell, ...(cur ? s.groupHeaderMonthCellCur : {}) }}>
                          {cnt > 0 && <span style={s.groupMonthCnt}>{cnt}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* 업무구분1 행들 */}
                  {group.rows.map(row => (
                    <div key={`${group.tm4Key}-${row.tm1Key}`} style={s.dataRow}>

                      {/* 좌측 고정 셀: 업무구분1명 + 담당자 + 마감 */}
                      <div style={{ ...s.td, ...s.type1Cell }}>
                        <div style={s.t1Name}>
                          {row.tm1Item ? row.tm1Item.TASK_NAME : (
                            <span style={{ color: "#94A3B8" }}>{t("common.unclassified")}</span>
                          )}
                        </div>
                        {row.tm1Item?.COWORKERS && (
                          <div style={s.t1Meta}>
                            <span style={s.t1MetaLabel}>{t("weekly.card.assignee")}</span>
                            <span style={s.t1MetaVal}>{row.tm1Item.COWORKERS}</span>
                          </div>
                        )}
                        {row.tm1Item?.DEADLINE && (
                          <div style={s.t1Meta}>
                            <span style={s.t1MetaLabel}>{t("weekly.card.deadline")}</span>
                            <span style={s.t1MetaVal}>{row.tm1Item.DEADLINE}</span>
                          </div>
                        )}
                      </div>

                      {/* 월별 셀 */}
                      {MONTHS_IDX.map(month => {
                        const cur = isCurMonth(month);
                        return (
                          <div key={month} style={{ ...s.td, ...s.monthCell, ...(cur ? s.monthCellCur : {}) }}>
                            {(row.monthMap[month] ?? []).map(task => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                userMap={userMap}
                                onClick={() => setSelected({ task, tm1, tm2, tm3, tm4 })}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
          tm1={selected.tm1}
          tm2={selected.tm2}
          tm3={selected.tm3}
          tm4={selected.tm4}
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
  const uc  = getUserColor(task.registrantId);

  return (
    <div
      style={{ ...s.card, borderLeft: `3px solid ${uc.border}`, backgroundColor: uc.cardBg }}
      onClick={onClick}
    >
      <div style={s.cardTitle}>{task.title}</div>
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
  const getTaskName   = (arr, id) => arr.find(r => String(r.TASK_ID) === String(id))?.TASK_NAME || id || "";
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
      line("업무구분4",      getTaskName(tm4, task.taskType4Cd)),
      line("작업완료예정일", task.plannedEnd),
      line("작업완료일",     task.actualEnd),
      line("연관페이지링크", task.relatedLink),
      sep,
      task.content?.trim()  ? `[작업내용]\n${task.content.trim()}`     : null,
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
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.title")}</label>
            <input style={inp} type="text" readOnly value={task.title} />
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("yearly.detail.regDate")}</label>
              <input style={inp} type="text" readOnly value={task.regDate} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("yearly.detail.status")}</label>
              <input style={inp} type="text" readOnly value={STATUS_TEXT[task.status] || task.status} />
            </div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("common.task1")}</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm1, task.taskType1Cd)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("common.task2")}</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm2, task.taskType2Cd)} />
            </div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("common.task3")}</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm3, task.taskType3Cd)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("common.task4")}</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm4, task.taskType4Cd)} />
            </div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("yearly.detail.priority")}</label>
              <input style={inp} type="text" readOnly value={task.priority} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("common.writer")}</label>
              <input style={inp} type="text" readOnly value={userMap[task.registrantId] ?? task.registrantId} />
            </div>
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.link")}</label>
            <input style={inp} type="text" readOnly value={task.relatedLink} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.work")}</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.content} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.teamNote")}</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.teamNote} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>{t("yearly.detail.issue")}</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.issue} />
            {hasIssue && (
              <div style={ms.issueStatusRow}>
                <span style={ms.issueStatusLabel}>이슈해결여부</span>
                {issueResolved
                  ? <span style={ms.issueStatusBadgeOk}>{t("yearlyCRM.issue.resolved")}</span>
                  : <span style={ms.issueStatusBadgeNg}>{t("yearlyCRM.issue.unresolved")}</span>}
              </div>
            )}
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("yearly.detail.dueDate")}</label>
              <input style={inp} type="text" readOnly value={task.plannedEnd} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>{t("yearly.detail.completeDate")}</label>
              <input style={inp} type="text" readOnly value={task.actualEnd} />
            </div>
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
  wrap:      { display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", padding: "0 0 24px" },
  topBar:       { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexShrink: 0 },
  topBarMobile: { flexDirection: "column", alignItems: "flex-start", gap: "8px" },
  titleArea: { display: "flex", alignItems: "center", gap: "10px" },
  pageTitle: { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0, display: "flex", alignItems: "center", gap: "8px" },
  crmBadge:  { fontSize: "11px", fontWeight: "700", color: "#7E22CE", backgroundColor: "#F3E8FF", border: "1px solid #D8B4FE", borderRadius: "4px", padding: "2px 7px", letterSpacing: "0.04em" },
  totalBadge:{ fontSize: "12px", fontWeight: "600", color: "#2563EB", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "2px 10px" },
  yearCtrl:  { display: "flex", alignItems: "center", gap: "6px" },
  yearBtn:   { fontFamily: "'Pretendard', sans-serif", fontSize: "18px", color: "#475569", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  yearLabel: { fontSize: "16px", fontWeight: "700", color: "#1E293B", minWidth: "52px", textAlign: "center" },

  filterBar:        { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px", padding: "10px 16px", marginBottom: "12px", flexShrink: 0 },
  filterBarMobile:  { flexDirection: "column", alignItems: "stretch", gap: "8px" },
  filterField:      { display: "flex", alignItems: "center", gap: "8px" },
  filterFieldMobile:{ display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel:      { fontSize: "13px", fontWeight: "500", color: "#5A5A5A", whiteSpace: "nowrap" },
  filterSelect:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 10px", outline: "none", minWidth: "140px", cursor: "pointer" },
  filterSelectFull: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", cursor: "pointer" },
  resetBtn:         { fontFamily: "'Pretendard', sans-serif", fontSize: "12px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 12px", cursor: "pointer" },
  resetBtnFull:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "9px 12px", cursor: "pointer", width: "100%" },

  loadingBox: { display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#94A3B8", fontSize: "14px" },
  emptyBox:   { padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "14px" },

  /* 테이블 */
  tableOuter: { overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)", border: "1px solid #E2E8F0", borderRadius: "10px" },

  /* 헤더 행 */
  headerRow: {
    display: "flex", position: "sticky", top: 0, zIndex: 10,
    backgroundColor: "#374151",
  },
  th: {
    width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 10px", fontSize: "12px", fontWeight: "700", color: "#CBD5E1",
    borderRight: "1px solid #4B5563",
  },
  thFirst:    { width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, justifyContent: "center", color: "#F9FAFB", position: "sticky", left: 0, zIndex: 11, backgroundColor: "#374151" },
  thHasData:  { color: "#F9FAFB" },
  thCurrent:  { color: "#FFFFFF", backgroundColor: "#2563EB" },
  thLabelCur: { color: "#FFFFFF", fontWeight: "800" },
  monthCnt:   { fontSize: "10px", fontWeight: "700", backgroundColor: "#4B5563", color: "#D1D5DB", borderRadius: "10px", padding: "1px 5px" },
  monthCntCur:{ backgroundColor: "#3B82F6", color: "#FFF" },

  /* 업무구분4 그룹 헤더 행 */
  groupHeaderRow: {
    display: "flex",
    backgroundColor: "#F3F4F6",
    borderBottom: "1px solid #D1D5DB",
    borderTop: "1px solid #D1D5DB",
    minHeight: "32px",
    position: "sticky",
    top: "40px",
    zIndex: 8,
  },
  groupHeaderCell: {
    width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center",
    padding: "6px 12px",
    borderRight: "1px solid #D1D5DB",
    position: "sticky", left: 0, zIndex: 9,
    backgroundColor: "#F3F4F6",
  },
  groupHeaderText: { fontSize: "12px", fontWeight: "700", color: "#1F2937" },
  groupHeaderMonthCell: {
    width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    padding: "6px 8px",
    borderRight: "1px solid #D1D5DB",
  },
  groupHeaderMonthCellCur: { backgroundColor: "#DBEAFE" },
  groupMonthCnt: { fontSize: "10px", fontWeight: "600", color: "#374151", backgroundColor: "#D1D5DB", borderRadius: "8px", padding: "1px 5px" },

  /* 데이터 행 */
  dataRow: { display: "flex", borderBottom: "1px solid #E5E7EB", minHeight: "64px" },
  td:      { borderRight: "1px solid #E5E7EB", padding: "8px", flexShrink: 0 },

  /* 좌측 셀: 업무구분1 + 담당자 + 마감 */
  type1Cell: {
    width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`,
    backgroundColor: "#FAFAFA",
    display: "flex", flexDirection: "column", gap: "3px",
    position: "sticky", left: 0, zIndex: 5,
    borderRight: "1px solid #D1D5DB",
    padding: "8px 10px",
  },
  t1Name:     { fontSize: "11px", fontWeight: "600", color: "#1F2937", lineHeight: "1.4", wordBreak: "break-word" },
  t1Meta:     { display: "flex", alignItems: "baseline", gap: "3px" },
  t1MetaLabel:{ fontSize: "9px", fontWeight: "600", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 },
  t1MetaVal:  { fontSize: "10px", color: "#6B7280", lineHeight: "1.3", wordBreak: "break-word" },

  monthCell:    { width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", gap: "5px" },
  monthCellCur: { backgroundColor: "#EFF6FF", borderTop: "2px solid #3B82F6" },

  /* 카드 */
  card: {
    backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "6px",
    padding: "7px 8px", display: "flex", flexDirection: "column", gap: "4px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)", cursor: "pointer", transition: "box-shadow 0.15s",
    borderLeft: "3px solid #CBD5E1",
  },
  cardTitle:    { fontSize: "11px", fontWeight: "600", color: "#1E293B", lineHeight: "1.4", wordBreak: "break-word" },
  cardFooter:   { display: "flex", gap: "3px", flexWrap: "wrap" },
  statusBadge:  { fontSize: "9px", fontWeight: "600", padding: "1px 5px", borderRadius: "3px", border: "1px solid", backgroundColor: "transparent" },
  priorityBadge:{ fontSize: "9px", fontWeight: "600", padding: "1px 5px", borderRadius: "3px" },
};

const ms = {
  overlay:  { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:    { position: "relative", backgroundColor: "#FFFFFF", borderRadius: "10px", width: "660px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
  header:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  title:    { fontSize: "16px", fontWeight: "600", color: "#1E293B" },
  closeX:   { background: "none", border: "none", fontSize: "16px", color: "#94A3B8", cursor: "pointer" },
  body:     { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" },
  footer:   { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "14px 24px 18px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  footerRight: { display: "flex", gap: "8px" },
  copyTextBtn:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  copyTextBtnDone: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  fullRow:   { display: "flex", flexDirection: "column", gap: "5px" },
  twoCol:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "5px" },
  label:     { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  input:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box" },
  inputRO:   { backgroundColor: "#F8FAFC", color: "#475569", cursor: "default" },
  textarea:  { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: "72px" },
  cancelBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 20px", cursor: "pointer" },
  issueStatusRow:     { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" },
  issueStatusLabel:   { fontSize: "12px", fontWeight: "500", color: "#64748B", flexShrink: 0 },
  issueStatusBadgeOk: { fontSize: "12px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", padding: "2px 9px" },
  issueStatusBadgeNg: { fontSize: "12px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", padding: "2px 9px" },
};
