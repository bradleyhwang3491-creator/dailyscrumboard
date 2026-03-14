import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ─────────────── 상수 ─────────────── */
const MONTHS  = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const FIRST_W = 170;
const MONTH_W = 200;
const TODAY   = new Date();

const PRIORITY_STYLE = {
  상:   { color: "#C2410C", background: "#FFEDD5" },
  중:   { color: "#0369A1", background: "#E0F2FE" },
  하:   { color: "#64748B", background: "#F1F5F9" },
  긴급: { color: "#DC2626", background: "#FEE2E2" },
};
const STATUS_COLOR = { TODO:"#94A3B8", PROGRESS:"#3B82F6", HOLDING:"#F59E0B", COMPLETE:"#22C55E" };
const STATUS_LABEL = { TODO:"TO-DO", PROGRESS:"진행중", HOLDING:"보류", COMPLETE:"완료" };
const STATUS_TEXT  = { TODO:"TO-DO", PROGRESS:"진행중", HOLDING:"보류", COMPLETE:"완료" };

/* ── 사용자별 고유 색상 팔레트 ── */
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
        teamNote:        t.LEADER_KNOW        ?? "",
        issue:           t.ISSUE              ?? "",
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
        getDisplayYear(t.rawActualEnd, t.rawPlannedEnd, t.status, t.rawInsert) === year
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
    tasks.filter(t => {
      if (filterTm4  && t.taskType4Cd !== filterTm4) return false;
      if (filterUser && t.registrantId !== filterUser) return false;
      return true;
    }),
  [tasks, filterTm4, filterUser]);

  /* 등록자 목록 (tasks 기준 unique) */
  const uniqueRegistrants = useMemo(() => {
    const seen = new Set();
    return tasks
      .filter(t => { if (!t.registrantId || seen.has(t.registrantId)) return false; seen.add(t.registrantId); return true; })
      .map(t => ({ id: t.registrantId, name: userMap[t.registrantId] || t.registrantId }));
  }, [tasks, userMap]);

  /* ── 섹션1: 업무구분4(outer) → 업무구분1(inner rows) → 월별 ── */
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
        const tm4Item = tm4Key === "__none4__" ? null : tm4.find(t => String(t.TASK_ID) === tm4Key);
        const rows = [...innerMap.entries()]
          .map(([tm1Key, monthMap]) => ({
            tm1Key,
            tm1Item: tm1Key === "__none1__" ? null : tm1.find(t => String(t.TASK_ID) === tm1Key),
            monthMap,
          }))
          .sort((a, b) => (a.tm1Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm1Item?.TASK_NAME ?? "\uFFFF", "ko"));
        return { tm4Key, tm4Item, rows };
      })
      .sort((a, b) => (a.tm4Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm4Item?.TASK_NAME ?? "\uFFFF", "ko"));
  }, [filteredTasks, tm1, tm4]);

  /* ── 섹션2: 업무구분1(rows) → 월별 ── */
  const groupedByTm1 = useMemo(() => {
    const rowMap = new Map();
    filteredTasks.forEach(task => {
      const tm1Key = task.taskType1Cd || "__none1__";
      const month  = getDisplayMonth(task.rawActualEnd, task.rawPlannedEnd, task.status, task.rawInsert);
      if (!month || month < 1 || month > 12) return;
      if (!rowMap.has(tm1Key)) rowMap.set(tm1Key, {});
      const cell = rowMap.get(tm1Key);
      if (!cell[month]) cell[month] = [];
      cell[month].push(task);
    });
    return [...rowMap.entries()]
      .map(([tm1Key, monthMap]) => ({
        tm1Key,
        tm1Item: tm1Key === "__none1__" ? null : tm1.find(t => String(t.TASK_ID) === tm1Key),
        monthMap,
      }))
      .sort((a, b) => (a.tm1Item?.TASK_NAME ?? "\uFFFF").localeCompare(b.tm1Item?.TASK_NAME ?? "\uFFFF", "ko"));
  }, [filteredTasks, tm1]);

  const isCurMonth = (month) => year === curYear && month === curMonth;
  const hasFilter  = filterTm4 || filterUser;
  const totalCount = filteredTasks.length;

  /* ── 공통: 헤더 행 렌더 ── */
  function renderHeaderRow(firstLabel) {
    return (
      <div style={s.headerRow}>
        <div style={{ ...s.th, ...s.thFirst }}>{firstLabel}</div>
        {MONTHS.map((m, i) => {
          const cnt = filteredTasks.filter(t => {
            const mo = getDisplayMonth(t.rawActualEnd, t.rawPlannedEnd, t.status, t.rawInsert);
            return mo === i + 1;
          }).length;
          const cur = isCurMonth(i + 1);
          return (
            <div key={m} style={{ ...s.th, ...(cur ? s.thCurrent : cnt > 0 ? s.thHasData : {}) }}>
              <span style={cur ? s.thLabelCur : {}}>{m}</span>
              {cnt > 0 && <span style={{ ...s.monthCnt, ...(cur ? s.monthCntCur : {}) }}>{cnt}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* ── 상단 헤더 ── */}
      <div style={s.topBar}>
        <div style={s.titleArea}>
          <h2 style={s.pageTitle}>Yearly Task Board <span style={s.crmBadge}>CRM</span></h2>
          <span style={s.totalBadge}>{totalCount}건</span>
        </div>
        <div style={s.yearCtrl}>
          <button style={s.yearBtn} onClick={() => setYear(y => y - 1)}>‹</button>
          <span style={s.yearLabel}>{year}</span>
          <button style={s.yearBtn} onClick={() => setYear(y => y + 1)}>›</button>
        </div>
      </div>

      {/* ── 조회 조건 ── */}
      <div style={s.filterBar}>
        <div style={s.filterField}>
          <span style={s.filterLabel}>업무구분4</span>
          <select style={s.filterSelect} value={filterTm4} onChange={e => setFilterTm4(e.target.value)}>
            <option value="">전체</option>
            {tm4.map(t => (
              <option key={t.TASK_ID} value={String(t.TASK_ID)}>{t.TASK_NAME}</option>
            ))}
          </select>
        </div>
        <div style={s.filterField}>
          <span style={s.filterLabel}>등록자</span>
          <select style={s.filterSelect} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">전체</option>
            {uniqueRegistrants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        {hasFilter && (
          <button style={s.resetBtn} onClick={() => { setFilterTm4(""); setFilterUser(""); }}>
            초기화
          </button>
        )}
      </div>

      {loading ? (
        <div style={s.loadingBox}>데이터를 불러오는 중...</div>
      ) : (
        <>
          {/* ══════════════ 섹션 1: 업무구분4 영역 ══════════════ */}
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>◈</span>
            <span style={s.sectionTitle}>업무구분4</span>
            <span style={s.sectionSub}>업무구분4 그룹 → 업무구분1 월별 현황</span>
          </div>
          <div style={s.tableOuter}>
            <div style={{ minWidth: FIRST_W + MONTH_W * 12 }}>
              {renderHeaderRow("업무구분4 / 업무구분1")}

              {groupedByTm4.length === 0 ? (
                <div style={s.emptyBox}>
                  {hasFilter ? "조회 조건에 해당하는 업무가 없습니다." : "해당 연도에 등록된 업무가 없습니다."}
                </div>
              ) : (
                groupedByTm4.map(group => (
                  <div key={group.tm4Key}>
                    {/* ── 업무구분4 그룹 헤더 ── */}
                    <div style={s.groupHeaderRow}>
                      <div style={s.groupHeaderCell}>
                        <span style={s.groupHeaderIcon}>▸</span>
                        <span style={s.groupHeaderText}>
                          {group.tm4Item ? group.tm4Item.TASK_NAME : "미분류"}
                        </span>
                        {group.tm4Item?.DEADLINE && (
                          <span style={s.groupHeaderSub}>~{group.tm4Item.DEADLINE}</span>
                        )}
                      </div>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
                        const cnt = group.rows.reduce((sum, row) => sum + (row.monthMap[month]?.length ?? 0), 0);
                        const cur = isCurMonth(month);
                        return (
                          <div key={month} style={{
                            ...s.groupHeaderMonthCell,
                            ...(cur ? s.groupHeaderMonthCellCur : {}),
                          }}>
                            {cnt > 0 && <span style={s.groupMonthCnt}>{cnt}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── 업무구분1 행들 ── */}
                    {group.rows.map(row => (
                      <div key={`${group.tm4Key}-${row.tm1Key}`} style={s.dataRow}>
                        {/* 업무구분1 셀 */}
                        <div style={{ ...s.td, ...s.type1Cell }}>
                          {row.tm1Item ? (
                            <>
                              <div style={s.t1Name}>{row.tm1Item.TASK_NAME}</div>
                              {row.tm1Item.OBJECTIVE && (
                                <div style={s.t1Obj}>{row.tm1Item.OBJECTIVE}</div>
                              )}
                            </>
                          ) : (
                            <div style={{ ...s.t1Name, color: "#94A3B8" }}>미분류</div>
                          )}
                        </div>

                        {/* 월별 셀 */}
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
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

          {/* ══════════════ 섹션 2: 업무구분1 영역 ══════════════ */}
          <div style={{ ...s.sectionHeader, ...s.sectionHeader2 }}>
            <span style={{ ...s.sectionIcon, ...s.sectionIcon2 }}>◈</span>
            <span style={{ ...s.sectionTitle, ...s.sectionTitle2 }}>업무구분1</span>
            <span style={s.sectionSub}>업무구분1 월별 현황</span>
          </div>
          <div style={s.tableOuter}>
            <div style={{ minWidth: FIRST_W + MONTH_W * 12 }}>
              {renderHeaderRow("업무구분1")}

              {groupedByTm1.length === 0 ? (
                <div style={s.emptyBox}>
                  {hasFilter ? "조회 조건에 해당하는 업무가 없습니다." : "해당 연도에 등록된 업무가 없습니다."}
                </div>
              ) : (
                groupedByTm1.map(row => (
                  <div key={row.tm1Key} style={s.dataRow}>
                    {/* 업무구분1 셀 */}
                    <div style={{ ...s.td, ...s.type1Cell }}>
                      {row.tm1Item ? (
                        <>
                          <div style={s.t1Name}>{row.tm1Item.TASK_NAME}</div>
                          {row.tm1Item.OBJECTIVE && (
                            <div style={s.t1Obj}>{row.tm1Item.OBJECTIVE}</div>
                          )}
                        </>
                      ) : (
                        <div style={{ ...s.t1Name, color: "#94A3B8" }}>미분류</div>
                      )}
                    </div>

                    {/* 월별 셀 */}
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
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
                ))
              )}
            </div>
          </div>
        </>
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
            <span style={s.dateLbl}>완료예정</span>
            <span style={{ ...s.dateVal, color: "#2563EB" }}>{task.plannedEnd}</span>
          </div>
        )}
        {task.actualEnd && (
          <div style={s.cardDateRow}>
            <span style={s.dateLbl}>완&nbsp;&nbsp;&nbsp;료일</span>
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
      line("업무구분4",      getTaskName(tm4, task.taskType4Cd)),
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
          <span style={ms.title}>업무 상세</span>
          <button style={ms.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          <div style={ms.fullRow}>
            <label style={ms.label}>제목</label>
            <input style={inp} type="text" readOnly value={task.title} />
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>등록일자</label>
              <input style={inp} type="text" readOnly value={task.regDate} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>상태</label>
              <input style={inp} type="text" readOnly value={STATUS_TEXT[task.status] || task.status} />
            </div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분1</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm1, task.taskType1Cd)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분2</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm2, task.taskType2Cd)} />
            </div>
          </div>
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분3</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm3, task.taskType3Cd)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분4</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm4, task.taskType4Cd)} />
            </div>
          </div>
          <div style={ms.halfRow}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>중요도</label>
              <input style={inp} type="text" readOnly value={task.priority} />
            </div>
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>연관페이지링크</label>
            <input style={inp} type="text" readOnly value={task.relatedLink} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>작업내용</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.content} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>팀장공유내용</label>
            <textarea style={{ ...ms.textarea, ...ms.inputRO }} readOnly value={task.teamNote} />
          </div>
          <div style={ms.fullRow}>
            <label style={ms.label}>이슈사항</label>
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
            <div style={ms.fieldWrap}>
              <label style={ms.label}>작업완료예정일자</label>
              <input style={inp} type="text" readOnly value={task.plannedEnd} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>작업완료일자</label>
              <input style={inp} type="text" readOnly value={task.actualEnd} />
            </div>
          </div>
        </div>
        <div style={ms.footer}>
          <button style={textCopied ? ms.copyTextBtnDone : ms.copyTextBtn} onClick={handleCopyText}>
            {textCopied ? "✅ 복사됨!" : "📄 텍스트 복사"}
          </button>
          <div style={ms.footerRight}>
            <button style={ms.cancelBtn} onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 스타일 ═══════════════════════ */
const s = {
  wrap:      { display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", padding: "0 0 24px" },
  topBar:    { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexShrink: 0 },
  titleArea: { display: "flex", alignItems: "center", gap: "10px" },
  pageTitle: { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0, display: "flex", alignItems: "center", gap: "8px" },
  crmBadge:  { fontSize: "11px", fontWeight: "700", color: "#7E22CE", backgroundColor: "#F3E8FF", border: "1px solid #D8B4FE", borderRadius: "4px", padding: "2px 7px", letterSpacing: "0.04em" },
  totalBadge:{ fontSize: "12px", fontWeight: "600", color: "#2563EB", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "2px 10px" },
  yearCtrl:  { display: "flex", alignItems: "center", gap: "6px" },
  yearBtn:   { fontFamily: "'Pretendard', sans-serif", fontSize: "18px", color: "#475569", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  yearLabel: { fontSize: "16px", fontWeight: "700", color: "#1E293B", minWidth: "52px", textAlign: "center" },

  /* 조회 조건 */
  filterBar:    { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px", padding: "10px 16px", marginBottom: "12px", flexShrink: 0 },
  filterField:  { display: "flex", alignItems: "center", gap: "8px" },
  filterLabel:  { fontSize: "13px", fontWeight: "500", color: "#5A5A5A", whiteSpace: "nowrap" },
  filterSelect: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 10px", outline: "none", minWidth: "140px", cursor: "pointer" },
  resetBtn:     { fontFamily: "'Pretendard', sans-serif", fontSize: "12px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "6px 12px", cursor: "pointer" },

  loadingBox:{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#94A3B8", fontSize: "14px" },
  emptyBox:  { padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "14px" },

  /* 섹션 헤더 */
  sectionHeader: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 14px", marginBottom: "8px",
    backgroundColor: "#EDE9FE", border: "1px solid #C4B5FD",
    borderRadius: "8px", flexShrink: 0,
  },
  sectionHeader2: { backgroundColor: "#E0F2FE", border: "1px solid #93C5FD", marginTop: "20px" },
  sectionIcon:    { fontSize: "13px", color: "#7C3AED" },
  sectionIcon2:   { color: "#0369A1" },
  sectionTitle:   { fontSize: "14px", fontWeight: "700", color: "#4C1D95" },
  sectionTitle2:  { color: "#0C4A6E" },
  sectionSub:     { fontSize: "12px", color: "#6D28D9", marginLeft: "4px" },

  tableOuter: { overflowX: "auto", overflowY: "auto", maxHeight: "480px", border: "1px solid #E2E8F0", borderRadius: "10px", marginBottom: "4px" },

  /* 헤더 행 */
  headerRow: { display: "flex", position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1E293B" },
  th: {
    width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "11px 12px", fontSize: "12px", fontWeight: "700", color: "#CBD5E1",
    borderRight: "1px solid #334155", letterSpacing: "0.06em",
  },
  thFirst:    { width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, justifyContent: "center", color: "#F8FAFC", fontSize: "10px", textAlign: "center" },
  thHasData:  { color: "#F8FAFC" },
  thCurrent:  { color: "#FFFFFF", backgroundColor: "#1D4ED8" },
  thLabelCur: { color: "#FFFFFF", fontWeight: "800" },
  monthCnt:   { fontSize: "10px", fontWeight: "700", backgroundColor: "#334155", color: "#CBD5E1", borderRadius: "10px", padding: "1px 6px" },
  monthCntCur:{ backgroundColor: "#3B82F6", color: "#FFF" },

  /* 업무구분4 그룹 헤더 행 */
  groupHeaderRow: {
    display: "flex",
    backgroundColor: "#EDE9FE",
    borderBottom: "1px solid #C4B5FD",
    borderTop: "2px solid #7C3AED",
    minHeight: "36px",
    position: "sticky",
    top: "40px",
    zIndex: 8,
  },
  groupHeaderCell: {
    width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 10px",
    borderRight: "2px solid #C4B5FD",
    position: "sticky", left: 0, zIndex: 9,
    backgroundColor: "#EDE9FE",
  },
  groupHeaderIcon: { fontSize: "10px", color: "#7C3AED", flexShrink: 0 },
  groupHeaderText: { fontSize: "12px", fontWeight: "700", color: "#4C1D95", flex: 1 },
  groupHeaderSub:  { fontSize: "10px", color: "#6D28D9", fontStyle: "italic", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  groupHeaderMonthCell: {
    width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "flex-end",
    padding: "6px 10px",
    borderRight: "1px solid #C4B5FD",
  },
  groupHeaderMonthCellCur: { backgroundColor: "#DDD6FE" },
  groupMonthCnt: { fontSize: "10px", fontWeight: "700", color: "#5B21B6", backgroundColor: "#C4B5FD", borderRadius: "8px", padding: "1px 6px" },

  /* 데이터 행 */
  dataRow:   { display: "flex", borderBottom: "1px solid #E2E8F0", minHeight: "70px" },
  td:        { borderRight: "1px solid #E2E8F0", padding: "8px", flexShrink: 0 },

  /* 업무구분1 셀 (고정 left) */
  type1Cell: {
    width: `${FIRST_W}px`, minWidth: `${FIRST_W}px`, backgroundColor: "#FAFAFA",
    display: "flex", flexDirection: "column", gap: "4px",
    position: "sticky", left: 0, zIndex: 5, borderRight: "2px solid #E2E8F0",
    paddingLeft: "18px",
  },
  t1Name: { fontSize: "11px", fontWeight: "600", color: "#334155", lineHeight: "1.4" },
  t1Obj:  { fontSize: "10px", color: "#94A3B8", fontStyle: "italic", lineHeight: "1.4" },

  monthCell:    { width: `${MONTH_W}px`, minWidth: `${MONTH_W}px`, backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column", gap: "7px" },
  monthCellCur: { backgroundColor: "#EFF6FF", borderTop: "2px solid #3B82F6" },

  card: {
    backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "7px",
    padding: "9px 10px", display: "flex", flexDirection: "column", gap: "5px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", transition: "box-shadow 0.15s",
    borderLeft: "3px solid #CBD5E1",
  },
  cardWriterRow:  { display: "flex", alignItems: "center", gap: "5px" },
  cardAvatar:     { width: "17px", height: "17px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "#fff", flexShrink: 0 },
  cardWriterName: { fontSize: "11px", fontWeight: "600", padding: "1px 7px", borderRadius: "10px", lineHeight: "1.6" },
  cardTitle:    { fontSize: "12px", fontWeight: "600", color: "#1E293B", lineHeight: "1.4" },
  cardDates:    { display: "flex", flexDirection: "column", gap: "2px" },
  cardDateRow:  { display: "flex", alignItems: "center", gap: "5px" },
  dateLbl:      { fontSize: "10px", fontWeight: "500", color: "#94A3B8", flexShrink: 0 },
  dateVal:      { fontSize: "11px" },
  cardFooter:   { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" },
  statusBadge:  { fontSize: "10px", fontWeight: "600", padding: "1px 6px", borderRadius: "4px", border: "1px solid", backgroundColor: "transparent" },
  priorityBadge:{ fontSize: "10px", fontWeight: "600", padding: "1px 6px", borderRadius: "4px" },
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
  copyTextBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  copyTextBtnDone: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "5px", padding: "8px 16px", cursor: "pointer" },
  fullRow:   { display: "flex", flexDirection: "column", gap: "5px" },
  halfRow:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
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
