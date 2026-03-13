import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ─────────────────────────── 상수 ─────────────────────────── */
const COLUMNS = [
  { id: "TODO",     label: "TO-DO",    color: "#64748B", light: "#F8FAFC" },
  { id: "PROGRESS", label: "PROGRESS", color: "#2563EB", light: "#EFF6FF" },
  { id: "HOLDING",  label: "HOLDING",  color: "#D97706", light: "#FFFBEB" },
  { id: "COMPLETE", label: "COMPLETE", color: "#16A34A", light: "#F0FDF4" },
];

const PRIORITY_STYLES = {
  일반:  { cardBg: "#FFFFFF", cardBorder: "#E2E8F0", txt: "#64748B", bg: "#F1F5F9" },
  긴급:  { cardBg: "#FFFDF0", cardBorder: "#FCD34D", txt: "#B45309", bg: "#FEF3C7" },
  초긴급: { cardBg: "#FFF5F5", cardBorder: "#FCA5A5", txt: "#DC2626", bg: "#FEE2E2" },
};

const INIT_FORM = {
  title: "",
  regDate: new Date().toISOString().split("T")[0],
  taskType1Cd: "",
  taskType2Cd: "",
  content: "", teamNote: "", issue: "",
  issueCompleteYn: "N",
  plannedEnd: "", actualEnd: "",
  status: "TODO",
  priority: "일반",
  relatedLink: "",
};

/* ─────────────────────────── 헬퍼 ─────────────────────────── */
function toDate8(iso) { return iso ? iso.replace(/-/g, "") : null; }
function fromDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
function DailyScrumboardPage() {
  const { user } = useAuth();

  const [tasks,     setTasks]     = useState([]);
  const [tm1,       setTm1]       = useState([]);
  const [tm2,       setTm2]       = useState([]);
  const [userMap,   setUserMap]   = useState({});
  const [deptUsers, setDeptUsers] = useState([]); // 같은 부서 사용자 목록

  // 조회 조건
  const [searchType1,  setSearchType1]  = useState("");
  const [searchUserId, setSearchUserId] = useState("");

  // 드래그 상태
  const [dragCardId,  setDragCardId]  = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // 등록 모달
  const [isRegOpen,   setIsRegOpen]   = useState(false);
  const [regForm,     setRegForm]     = useState(INIT_FORM);
  const [regErrors,   setRegErrors]   = useState({});
  const [regLoading,  setRegLoading]  = useState(false);

  // 상세/수정 모달
  const [detailTask,   setDetailTask]  = useState(null);
  const [editForm,     setEditForm]    = useState(null);
  const [isEditing,    setIsEditing]   = useState(false);
  const [editLoading,  setEditLoading] = useState(false);

  useEffect(() => {
    fetchTaskMaster();
    fetchUsers();
    fetchTasks();
  }, []);

  /** TASK_MASTER 조회 */
  async function fetchTaskMaster() {
    const { data: d1 } = await supabase
      .from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL", "1").order("TASK_NAME");
    const { data: d2 } = await supabase
      .from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL", "2").order("TASK_NAME");
    if (d1) setTm1(d1);
    if (d2) setTm2(d2);
  }

  /** 전체 사용자 조회 → ID→NAME 맵 + 같은 부서 필터 */
  async function fetchUsers() {
    const { data } = await supabase.from("SCRUMBOARD_USER").select("ID, NAME, DEPT_CD");
    if (!data) return;

    const map = {};
    data.forEach((u) => { map[u.ID] = u.NAME; });
    setUserMap(map);

    // 로그인 사용자와 같은 부서 사용자만 조회 조건에 표시
    const myDept = user?.deptCd;
    const sameTeam = myDept
      ? data.filter((u) => u.DEPT_CD === myDept)
      : data;
    setDeptUsers(sameTeam);
  }

  /** TASK_BOARD 조회 */
  async function fetchTasks() {
    const { data } = await supabase
      .from("TASK_BOARD").select("*").order("BOARD_ID", { ascending: false });
    if (data) {
      setTasks(data.map((t) => ({
        id:           t.BOARD_ID,
        title:        t.TITLE ?? "",
        regDate:      fromDate8(t.INSERT_DATE),
        taskType1Cd:  t.TASK_GUBUN1 ?? "",
        taskType2Cd:  t.TASK_GUBUN2 ?? "",
        content:      t.TASK_CONTENT ?? "",
        teamNote:     t.LEADER_KNOW ?? "",
        issue:        t.ISSUE ?? "",
        plannedEnd:   fromDate8(t.DUE_EXPECT_DATE),
        actualEnd:    fromDate8(t.COMPLETE_DATE),
        status:          t.STATUS ?? "TODO",
        priority:        t.IMPORTANT_GUBUN ?? "일반",
        relatedLink:     t.PAGE_URL ?? "",
        registrantId:    t.ID ?? "",
        issueCompleteYn: t.ISSUE_COMPLETE_YN ?? "N",
      })));
    }
  }

  /** 조회 조건 적용 */
  const filteredTasks = tasks.filter((t) => {
    if (searchType1  && t.taskType1Cd !== searchType1)  return false;
    if (searchUserId && t.registrantId !== searchUserId) return false;
    return true;
  });

  /* ── 등록 ── */
  async function handleRegister() {
    if (!regForm.title.trim()) { setRegErrors({ title: "제목을 입력해주세요." }); return; }
    setRegLoading(true);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { error } = await supabase.from("TASK_BOARD").insert({
      TITLE:            regForm.title.trim(),
      INSERT_DATE:      today,
      ID:               user?.id ?? "",
      TASK_GUBUN1:      regForm.taskType1Cd || null,
      TASK_GUBUN2:      regForm.taskType2Cd || null,
      TASK_CONTENT:     regForm.content,
      LEADER_KNOW:      regForm.teamNote,
      ISSUE:            regForm.issue,
      ISSUE_COMPLETE_YN: "N",
      DUE_EXPECT_DATE:  toDate8(regForm.plannedEnd) || null,
      COMPLETE_DATE:    toDate8(regForm.actualEnd)  || null,
      STATUS:           regForm.status,
      IMPORTANT_GUBUN:  regForm.priority,
      PAGE_URL:         regForm.relatedLink,
    });
    setRegLoading(false);
    if (error) { setRegErrors({ submit: "등록 오류: " + error.message }); return; }
    setIsRegOpen(false); setRegForm(INIT_FORM); setRegErrors({});
    fetchTasks();
  }

  /* ── 상세 열기 ── */
  function openDetail(task) { setDetailTask(task); setEditForm({ ...task }); setIsEditing(false); }

  /* ── 수정 저장 ── */
  async function handleUpdate() {
    if (!editForm.title.trim()) return;
    setEditLoading(true);
    const { error } = await supabase.from("TASK_BOARD").update({
      TITLE:           editForm.title.trim(),
      TASK_GUBUN1:     editForm.taskType1Cd || null,
      TASK_GUBUN2:     editForm.taskType2Cd || null,
      TASK_CONTENT:    editForm.content,
      LEADER_KNOW:     editForm.teamNote,
      ISSUE:           editForm.issue,
      DUE_EXPECT_DATE: toDate8(editForm.plannedEnd) || null,
      COMPLETE_DATE:   toDate8(editForm.actualEnd)  || null,
      STATUS:          editForm.status,
      IMPORTANT_GUBUN: editForm.priority,
      PAGE_URL:        editForm.relatedLink,
    }).eq("BOARD_ID", editForm.id);
    setEditLoading(false);
    if (error) { console.error("수정 오류:", error.message); return; }
    closeDetail(); fetchTasks();
  }

  function closeDetail()  { setDetailTask(null); setEditForm(null); setIsEditing(false); }
  function cancelEdit()   { setEditForm({ ...detailTask }); setIsEditing(false); }

  /* ── 이슈 해결 ── */
  async function handleResolveIssue(cardId) {
    // 낙관적 업데이트
    setTasks((prev) =>
      prev.map((t) => t.id === cardId ? { ...t, issueCompleteYn: "Y" } : t)
    );
    // 상세 팝업이 열려있으면 동기화
    if (detailTask?.id === cardId) {
      setDetailTask((p) => ({ ...p, issueCompleteYn: "Y" }));
      setEditForm((p)   => ({ ...p, issueCompleteYn: "Y" }));
    }

    const { error } = await supabase
      .from("TASK_BOARD")
      .update({ ISSUE_COMPLETE_YN: "Y" })
      .eq("BOARD_ID", cardId);

    if (error) {
      console.error("이슈 해결 오류:", error.message);
      fetchTasks(); // 실패 시 롤백
    }
  }

  /* ── 드래그 & 드롭 ── */
  function handleDragStart(cardId) {
    setDragCardId(cardId);
  }

  function handleDragOver(e, colId) {
    e.preventDefault();
    setDragOverCol(colId);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e, colId) {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragCardId) return;

    const card = tasks.find((t) => t.id === dragCardId);
    if (!card || card.status === colId) { setDragCardId(null); return; }

    // 낙관적 업데이트: UI 먼저 반영
    setTasks((prev) =>
      prev.map((t) => t.id === dragCardId ? { ...t, status: colId } : t)
    );
    setDragCardId(null);

    // Supabase 업데이트
    const { error } = await supabase
      .from("TASK_BOARD")
      .update({ STATUS: colId })
      .eq("BOARD_ID", dragCardId);

    if (error) {
      console.error("상태 변경 오류:", error.message);
      fetchTasks(); // 실패 시 DB 상태로 롤백
    }
  }

  function handleDragEnd() {
    setDragCardId(null);
    setDragOverCol(null);
  }

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>Daily Scrumboard</h2>
        <button style={s.registerBtn} onClick={() => setIsRegOpen(true)}>+ 등록</button>
      </div>

      {/* ── 조회 조건 ── */}
      <div style={s.searchBar}>
        <div style={s.searchField}>
          <label style={s.searchLabel}>업무구분1</label>
          <select style={s.searchSelect} value={searchType1} onChange={(e) => setSearchType1(e.target.value)}>
            <option value="">전체</option>
            {tm1.map((t) => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
          </select>
        </div>
        <div style={s.searchField}>
          <label style={s.searchLabel}>등록자</label>
          <select style={s.searchSelect} value={searchUserId} onChange={(e) => setSearchUserId(e.target.value)}>
            <option value="">전체</option>
            {deptUsers.map((u) => <option key={u.ID} value={u.ID}>{u.NAME}</option>)}
          </select>
        </div>
        <button style={s.resetBtn} onClick={() => { setSearchType1(""); setSearchUserId(""); }}>초기화</button>
      </div>

      {/* ── 칸반 보드 ── */}
      <div style={s.boardWrap}>
        <div style={s.board}>
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isOver   = dragOverCol === col.id;
            return (
              <div key={col.id} style={s.column}>
                <div style={{ ...s.colHeader, backgroundColor: col.light }}>
                  <span style={{ ...s.colLabel, color: col.color, borderColor: col.color }}>{col.label}</span>
                  <span style={{ ...s.colCount, backgroundColor: col.color }}>{colTasks.length}</span>
                </div>
                <div
                  style={{
                    ...s.cardList,
                    ...(isOver ? s.cardListOver : {}),
                  }}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {colTasks.length === 0 ? (
                    <p style={{ ...s.emptyMsg, ...(isOver ? s.emptyMsgOver : {}) }}>
                      {isOver ? "여기에 놓기" : "항목 없음"}
                    </p>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id} task={task} tm1={tm1} tm2={tm2} userMap={userMap}
                        onClick={openDetail}
                        onResolveIssue={handleResolveIssue}
                        isDragging={dragCardId === task.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  )}
                  {/* 카드가 있고 드롭존 활성 시 하단 표시 */}
                  {isOver && colTasks.length > 0 && (
                    <div style={s.dropIndicator}>여기에 놓기</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 등록 모달 */}
      {isRegOpen && (
        <TaskModal title="업무 등록" form={regForm} setForm={setRegForm} errors={regErrors}
          tm1={tm1} tm2={tm2} readOnly={false}
          submitLabel={regLoading ? "등록 중..." : "등록"} submitDisabled={regLoading}
          onSubmit={handleRegister}
          onClose={() => { setIsRegOpen(false); setRegForm(INIT_FORM); setRegErrors({}); }} />
      )}

      {/* 상세/수정 모달 */}
      {detailTask && editForm && (
        <TaskModal
          title={isEditing ? "업무 수정" : "업무 상세"}
          form={editForm} setForm={setEditForm} errors={{}}
          tm1={tm1} tm2={tm2} readOnly={!isEditing}
          submitLabel={isEditing ? (editLoading ? "저장 중..." : "저장") : "수정"}
          submitDisabled={editLoading}
          onSubmit={isEditing ? handleUpdate : () => setIsEditing(true)}
          onClose={isEditing ? cancelEdit : closeDetail}
          closeLabel={isEditing ? "취소" : "닫기"}
          onResolveIssue={handleResolveIssue} />
      )}
    </div>
  );
}

/* ═══════════════════════ 카드 ═══════════════════════ */
function TaskCard({ task, tm1, tm2, userMap, onClick, onResolveIssue, isDragging, onDragStart, onDragEnd }) {
  const ps = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES["일반"];
  const type1Nm = tm1.find((t) => t.TASK_ID === task.taskType1Cd)?.TASK_NAME ?? task.taskType1Cd ?? "";
  const type2Nm = tm2.find((t) => t.TASK_ID === task.taskType2Cd)?.TASK_NAME ?? task.taskType2Cd ?? "";
  const registrantName = userMap[task.registrantId] || task.registrantId || "";
  const hasIssue    = !!task.issue?.trim();
  const issueResolved = task.issueCompleteYn === "Y";

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(task.id); }}
      onDragEnd={onDragEnd}
      style={{
        ...s.card,
        backgroundColor: ps.cardBg,
        borderColor: isDragging ? "#3A3A3A" : ps.cardBorder,
        opacity: isDragging ? 0.45 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        cursor: "grab",
      }}
      onClick={() => onClick(task)}
    >
      {/* 중요도 + 등록자 */}
      <div style={s.cardTopRow}>
        <span style={s.registrant}>{registrantName && `👤 ${registrantName}`}</span>
        <span style={{ ...s.priorityBadge, color: ps.txt, backgroundColor: ps.bg }}>{task.priority}</span>
      </div>

      {/* 제목 */}
      <p style={s.cardTitle}>{task.title}</p>

      {/* 업무구분 칩 */}
      {(type1Nm || type2Nm) && (
        <div style={s.chipRow}>
          {type1Nm && <span style={s.chip}>{type1Nm}</span>}
          {type2Nm && <span style={s.chip}>{type2Nm}</span>}
        </div>
      )}

      {/* 이슈 영역 */}
      {hasIssue && (
        <div style={s.issueRow}>
          {issueResolved ? (
            <span style={s.issueBadgeOk}>✅ 이슈 해결</span>
          ) : (
            <>
              <span style={s.issueBadgeNg}>🚨 이슈 미해결</span>
              <button
                style={s.resolveBtn}
                onClick={(e) => { e.stopPropagation(); onResolveIssue(task.id); }}
              >
                이슈 해결
              </button>
            </>
          )}
        </div>
      )}

      {/* 날짜 한 줄 */}
      <div style={s.dateRow}>
        {task.regDate   && <span style={s.dateItem}>📅 {task.regDate}</span>}
        {task.plannedEnd && <><span style={s.dateSep}>·</span><span style={s.dateItem}>⏰ {task.plannedEnd}</span></>}
        {task.actualEnd  && <><span style={s.dateSep}>·</span><span style={{ ...s.dateItem, color: "#16A34A" }}>✅ {task.actualEnd}</span></>}
      </div>
    </div>
  );
}

/* ═══════════════════════ 폼 모달 ═══════════════════════ */
const STATUS_TEXT = { TODO: "TO-DO", PROGRESS: "PROGRESS", HOLDING: "HOLDING", COMPLETE: "COMPLETE" };

function TaskModal({ title, form, setForm, errors, tm1, tm2, readOnly,
                     submitLabel, submitDisabled, onSubmit, onClose, closeLabel = "취소",
                     onResolveIssue }) {
  const [textCopied, setTextCopied] = useState(false);

  function f(field, value) { setForm((p) => ({ ...p, [field]: value })); }
  const inp = (err) => ({ ...ms.input, ...(err ? ms.inputErr : {}), ...(readOnly ? ms.inputRO : {}) });
  const hasIssue     = !!form.issue?.trim();
  const issueResolved = form.issueCompleteYn === "Y";

  /* ── 텍스트 복사 ── */
  async function handleCopyText() {
    const type1Nm = tm1.find((t) => t.TASK_ID === form.taskType1Cd)?.TASK_NAME ?? form.taskType1Cd ?? "";
    const type2Nm = tm2.find((t) => t.TASK_ID === form.taskType2Cd)?.TASK_NAME ?? form.taskType2Cd ?? "";

    const line = (label, value) => value?.trim() ? `${label}: ${value.trim()}` : null;
    const sep  = "─".repeat(32);

    const parts = [
      "■ 업무 상세",
      sep,
      line("제목",           form.title),
      line("상태",           STATUS_TEXT[form.status] ?? form.status),
      line("중요도",         form.priority),
      line("등록일자",       form.regDate),
      line("업무구분1",      type1Nm),
      line("업무구분2",      type2Nm),
      line("작업완료예정일", form.plannedEnd),
      line("작업완료일",     form.actualEnd),
      line("연관페이지링크", form.relatedLink),
      sep,
      form.content?.trim()  ? `[작업내용]\n${form.content.trim()}`   : null,
      form.teamNote?.trim() ? `[팀장공유내용]\n${form.teamNote.trim()}` : null,
      hasIssue
        ? `[이슈사항]\n${form.issue.trim()}\n이슈해결여부: ${issueResolved ? "Y (해결)" : "N (미해결)"}`
        : null,
      sep,
    ];

    const text = parts.filter(Boolean).join("\n");

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
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 2200);
  }

  return (
    <div style={ms.overlay} onClick={readOnly ? onClose : undefined}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>{title}</span>
          <button style={ms.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          {/* 제목 */}
          <div style={ms.fullRow}>
            <label style={ms.label}>제목 <span style={ms.req}>*</span></label>
            <input style={inp(errors.title)} type="text" value={form.title}
              placeholder="업무 제목을 입력하세요" readOnly={readOnly}
              onChange={(e) => f("title", e.target.value)} />
            {errors.title && <p style={ms.err}>{errors.title}</p>}
          </div>
          {/* 등록일자 | 상태 */}
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>등록일자</label>
              <input style={inp()} type="date" value={form.regDate} readOnly={readOnly}
                onChange={(e) => f("regDate", e.target.value)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>상태</label>
              <select style={{ ...ms.input, ...(readOnly ? ms.inputRO : {}) }}
                value={form.status} disabled={readOnly} onChange={(e) => f("status", e.target.value)}>
                <option value="TODO">TO-DO</option>
                <option value="PROGRESS">PROGRESS</option>
                <option value="HOLDING">HOLDING</option>
                <option value="COMPLETE">COMPLETE</option>
              </select>
            </div>
          </div>
          {/* 업무구분1 | 업무구분2 */}
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분1</label>
              <select style={{ ...ms.input, ...(readOnly ? ms.inputRO : {}) }}
                value={form.taskType1Cd} disabled={readOnly}
                onChange={(e) => f("taskType1Cd", e.target.value)}>
                <option value="">선택</option>
                {tm1.map((t) => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
              </select>
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>업무구분2</label>
              <select style={{ ...ms.input, ...(readOnly ? ms.inputRO : {}) }}
                value={form.taskType2Cd} disabled={readOnly}
                onChange={(e) => f("taskType2Cd", e.target.value)}>
                <option value="">선택</option>
                {tm2.map((t) => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
              </select>
            </div>
          </div>
          {/* 중요도 (절반) */}
          <div style={ms.halfRow}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>중요도</label>
              <select style={{ ...ms.input, ...(readOnly ? ms.inputRO : {}) }}
                value={form.priority} disabled={readOnly} onChange={(e) => f("priority", e.target.value)}>
                <option value="일반">일반</option>
                <option value="긴급">긴급</option>
                <option value="초긴급">초긴급</option>
              </select>
            </div>
          </div>
          {/* 연관페이지링크 (전체) */}
          <div style={ms.fullRow}>
            <label style={ms.label}>연관페이지링크</label>
            <input style={inp()} type="text" value={form.relatedLink}
              placeholder="https://" readOnly={readOnly} onChange={(e) => f("relatedLink", e.target.value)} />
          </div>
          {/* 작업내용 */}
          <div style={ms.fullRow}>
            <label style={ms.label}>작업내용</label>
            <textarea style={{ ...ms.textarea, ...(readOnly ? ms.inputRO : {}) }}
              value={form.content} readOnly={readOnly} placeholder="작업 내용을 입력하세요"
              onChange={(e) => f("content", e.target.value)} />
          </div>
          {/* 팀장공유내용 */}
          <div style={ms.fullRow}>
            <label style={ms.label}>팀장공유내용</label>
            <textarea style={{ ...ms.textarea, ...(readOnly ? ms.inputRO : {}) }}
              value={form.teamNote} readOnly={readOnly} placeholder="팀장 공유 내용을 입력하세요"
              onChange={(e) => f("teamNote", e.target.value)} />
          </div>
          {/* 이슈사항 */}
          <div style={ms.fullRow}>
            <label style={ms.label}>이슈사항</label>
            <textarea style={{ ...ms.textarea, ...(readOnly ? ms.inputRO : {}) }}
              value={form.issue} readOnly={readOnly} placeholder="이슈 내용을 입력하세요"
              onChange={(e) => f("issue", e.target.value)} />
            {/* 이슈해결여부 — 이슈 내용이 있을 때만 표시 */}
            {hasIssue && (
              <div style={ms.issueStatusRow}>
                <span style={ms.issueStatusLabel}>이슈해결여부</span>
                {issueResolved ? (
                  <span style={ms.issueStatusBadgeOk}>✅ Y (해결)</span>
                ) : (
                  <>
                    <span style={ms.issueStatusBadgeNg}>🚨 N (미해결)</span>
                    {readOnly && onResolveIssue && (
                      <button
                        style={ms.resolveBtn}
                        onClick={() => onResolveIssue(form.id)}
                      >
                        이슈 해결
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {/* 예정일 | 완료일 */}
          <div style={ms.twoCol}>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>작업완료예정일자</label>
              <input style={inp()} type="date" value={form.plannedEnd} readOnly={readOnly}
                onChange={(e) => f("plannedEnd", e.target.value)} />
            </div>
            <div style={ms.fieldWrap}>
              <label style={ms.label}>작업완료일자</label>
              <input style={inp()} type="date" value={form.actualEnd} readOnly={readOnly}
                onChange={(e) => f("actualEnd", e.target.value)} />
            </div>
          </div>
          {errors.submit && <p style={ms.err}>{errors.submit}</p>}
        </div>
        <div style={ms.footer}>
          {/* 텍스트 복사 버튼 — 상세 보기(readOnly) 모드에서만 표시 */}
          {readOnly && (
            <button
              style={textCopied ? ms.copyTextBtnDone : ms.copyTextBtn}
              onClick={handleCopyText}
            >
              {textCopied ? "✅ 복사됨!" : "📄 텍스트 복사"}
            </button>
          )}
          <div style={ms.footerRight}>
            <button style={ms.cancelBtn} onClick={onClose}>{closeLabel}</button>
            <button style={ms.submitBtn} onClick={onSubmit} disabled={submitDisabled}>{submitLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 스타일 ═══════════════════════ */
const s = {
  wrap: { fontFamily: "'Pretendard', sans-serif" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
  pageTitle: { fontSize: "17px", fontWeight: "600", color: "#2F2F2F", margin: 0 },
  registerBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500",
    color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none",
    borderRadius: "5px", padding: "8px 16px", cursor: "pointer",
  },
  // 조회 조건
  searchBar: {
    display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px",
    padding: "14px 18px", marginBottom: "16px",
  },
  searchField: { display: "flex", alignItems: "center", gap: "8px" },
  searchLabel: { fontSize: "13px", fontWeight: "500", color: "#5A5A5A", whiteSpace: "nowrap" },
  searchSelect: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2F2F2F",
    border: "1px solid #D9D9D9", borderRadius: "5px",
    padding: "6px 10px", outline: "none", minWidth: "140px", cursor: "pointer",
  },
  resetBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A",
    backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9",
    borderRadius: "5px", padding: "6px 14px", cursor: "pointer",
  },
  // 보드
  boardWrap: { overflowX: "auto" },
  board: { display: "grid", gridTemplateColumns: "repeat(4, minmax(210px, 1fr))", gap: "14px", alignItems: "start", minWidth: "860px" },
  column: { display: "flex", flexDirection: "column", minHeight: "400px" },
  colHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", borderRadius: "8px 8px 0 0", borderBottom: "2px solid #E2E8F0",
  },
  colLabel: { fontSize: "12px", fontWeight: "700", letterSpacing: "0.08em", border: "1px solid", borderRadius: "4px", padding: "2px 8px" },
  colCount: { fontSize: "12px", fontWeight: "700", color: "#FFFFFF", borderRadius: "10px", padding: "1px 8px", minWidth: "20px", textAlign: "center" },
  cardList: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: "0 0 8px 8px",
    border: "1px solid #E2E8F0", borderTop: "none",
    padding: "10px", display: "flex", flexDirection: "column", gap: "10px",
  },
  emptyMsg: { fontSize: "12px", color: "#CBD5E1", textAlign: "center", margin: "20px 0" },
  emptyMsgOver: { color: "#3A3A3A", fontWeight: "600" },
  cardListOver: { backgroundColor: "#EFF6FF", borderColor: "#93C5FD", borderStyle: "dashed" },
  dropIndicator: {
    fontSize: "12px", color: "#3A3A3A", fontWeight: "600",
    textAlign: "center", padding: "8px",
    border: "2px dashed #94A3B8", borderRadius: "6px",
    backgroundColor: "#F8FAFC",
  },
  // 카드
  card: { borderRadius: "8px", border: "1px solid", padding: "12px 14px", cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "opacity 0.15s, transform 0.15s" },
  cardTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" },
  registrant: { fontSize: "13px", fontWeight: "700", color: "#1E293B" }, // ← 크고 눈에 띄게
  priorityBadge: { fontSize: "11px", fontWeight: "600", borderRadius: "4px", padding: "2px 7px", letterSpacing: "0.04em" },
  cardTitle: { fontSize: "13px", fontWeight: "600", color: "#1E293B", margin: "0 0 8px", lineHeight: 1.4 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" },
  chip: { fontSize: "11px", color: "#475569", backgroundColor: "#F1F5F9", borderRadius: "4px", padding: "2px 7px", border: "1px solid #E2E8F0" },
  // 이슈 영역
  issueRow: { display: "flex", alignItems: "center", gap: "6px", margin: "6px 0" },
  issueBadgeOk: { fontSize: "11px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", padding: "2px 7px" },
  issueBadgeNg: { fontSize: "11px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", padding: "2px 7px" },
  resolveBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "11px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#DC2626", border: "none",
    borderRadius: "4px", padding: "3px 9px", cursor: "pointer",
  },
  // 날짜 한 줄
  dateRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", marginTop: "2px" },
  dateItem: { fontSize: "11px", color: "#94A3B8" },
  dateSep: { fontSize: "10px", color: "#CBD5E1" },
};

const ms = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { backgroundColor: "#FFFFFF", borderRadius: "10px", width: "660px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  title:  { fontSize: "16px", fontWeight: "600", color: "#1E293B" },
  closeX: { background: "none", border: "none", fontSize: "16px", color: "#94A3B8", cursor: "pointer" },
  body:   { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "14px 24px 18px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  footerRight: { display: "flex", gap: "8px" },
  copyTextBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500",
    color: "#475569", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0",
    borderRadius: "5px", padding: "8px 16px", cursor: "pointer",
  },
  copyTextBtnDone: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600",
    color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC",
    borderRadius: "5px", padding: "8px 16px", cursor: "pointer",
  },
  fullRow:   { display: "flex", flexDirection: "column", gap: "5px" },
  halfRow:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  twoCol:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "12px", fontWeight: "500", color: "#64748B" },
  req:   { color: "#DC2626" },
  input: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box" },
  inputErr: { borderColor: "#DC2626" },
  inputRO:  { backgroundColor: "#F8FAFC", color: "#475569", cursor: "default" },
  textarea: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: "72px" },
  err: { fontSize: "12px", color: "#DC2626", margin: "2px 0 0" },
  cancelBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "5px", padding: "8px 20px", cursor: "pointer" },
  submitBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "500", color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none", borderRadius: "5px", padding: "8px 20px", cursor: "pointer" },
  // 이슈해결여부 (모달)
  issueStatusRow:     { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0" },
  issueStatusLabel:   { fontSize: "12px", fontWeight: "500", color: "#64748B", flexShrink: 0 },
  issueStatusBadgeOk: { fontSize: "12px", fontWeight: "600", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "4px", padding: "2px 9px" },
  issueStatusBadgeNg: { fontSize: "12px", fontWeight: "600", color: "#DC2626", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "4px", padding: "2px 9px" },
  resolveBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "12px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#DC2626", border: "none",
    borderRadius: "4px", padding: "4px 12px", cursor: "pointer", marginLeft: "4px",
  },
};

export default DailyScrumboardPage;
