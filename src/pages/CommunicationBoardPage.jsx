import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ─────────────── 섹션 정의 ─────────────── */
const SECTIONS = [
  { id: "received", title: "내가 받은 요청", sub: "Requests Received", accent: "#3B82F6", emptyMsg: "받은 요청이 없습니다.", emptyIcon: "inbox" },
  { id: "sent",     title: "내가 한 요청",   sub: "Requests Sent",     accent: "#10B981", emptyMsg: "한 요청이 없습니다.",   emptyIcon: "send"  },
  { id: "manager",  title: "팀장 요청내용",  sub: "Manager Requests",  accent: "#8B5CF6", emptyMsg: "팀장 요청내용이 없습니다.", emptyIcon: "clipboard" },
  { id: "issue",    title: "이슈내용",       sub: "Issues",            accent: "#EF4444", emptyMsg: "등록된 이슈가 없습니다.", emptyIcon: "alert" },
];

const STATUS_TEXT = { TODO: "TO-DO", PROGRESS: "진행중", HOLDING: "보류", COMPLETE: "완료" };

/* ─────────────── 날짜 헬퍼 ─────────────── */
function fromDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function formatDate8(s) {
  if (!s || s.length < 8) return "";
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function getOneMonthAgoDate8() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
function mapTaskBoardRow(t) {
  return {
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
  };
}

/* ─────────────── SVG 아이콘 ─────────────── */
function Icon({ name, size = 20, color = "currentColor" }) {
  const icons = {
    inbox: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      </svg>
    ),
    send: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
    clipboard: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
    alert: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    search: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    reply: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 00-4-4H4" />
      </svg>
    ),
  };
  return icons[name] ?? null;
}

/* ─────────────── 빈 상태 ─────────────── */
function EmptyState({ sec }) {
  return (
    <div style={s.emptyState}>
      <div style={{ ...s.emptyIconWrap, backgroundColor: sec.accent + "10", border: `1px solid ${sec.accent}20` }}>
        <Icon name={sec.emptyIcon} size={22} color={sec.accent + "80"} />
      </div>
      <p style={s.emptyMsg}>{sec.emptyMsg}</p>
    </div>
  );
}

/* ─────────────── 로딩 스피너 ─────────────── */
function LoadingState() {
  return (
    <div style={s.emptyState}>
      <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "500" }}>불러오는 중...</div>
    </div>
  );
}

/* ─────────────── 받은 요청 카드 아이템 ─────────────── */
function ReceivedItem({ item, userMap, onReply }) {
  const fromName = userMap[item.REQUEST_FROM_ID] ?? item.REQUEST_FROM_ID;
  const replied  = !!item.REPLY_CONTEXT;

  return (
    <div style={s.reqItem}>
      <div style={s.reqMetaRow}>
        <div style={s.reqAvatarWrap}>
          <div style={{ ...s.reqAvatar, backgroundColor: "#3B82F620", color: "#3B82F6" }}>
            {fromName?.charAt(0) ?? "?"}
          </div>
          <span style={s.reqFromName}>{fromName}</span>
        </div>
        <span style={s.reqDate}>{formatDate(item.SYS_DT)}</span>
      </div>
      <div style={s.reqTitle}>{item.REQUEST_TITLE}</div>
      <div style={s.reqContext}>{item.REQUEST_CONTEXT}</div>
      <div style={s.reqItemFooter}>
        {replied ? (
          <span style={s.repliedBadge}>✓ 답변완료</span>
        ) : (
          <button style={s.replyBtn} onClick={() => onReply(item)}>
            <Icon name="reply" size={12} color="#FFFFFF" />
            답변
          </button>
        )}
        {replied && (
          <button style={s.viewReplyBtn} onClick={() => onReply(item)}>
            답변 수정
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────── 보낸 요청 카드 아이템 ─────────────── */
function SentItem({ item, userMap }) {
  const toName  = userMap[item.REQUEST_TO_ID] ?? item.REQUEST_TO_ID;
  const replied = !!item.REPLY_CONTEXT;

  return (
    <div style={s.reqItem}>
      <div style={s.reqMetaRow}>
        <div style={s.reqAvatarWrap}>
          <div style={{ ...s.reqAvatar, backgroundColor: "#10B98120", color: "#10B981" }}>
            {toName?.charAt(0) ?? "?"}
          </div>
          <span style={s.reqFromName}>{toName}</span>
        </div>
        <span style={s.reqDate}>{formatDate(item.SYS_DT)}</span>
      </div>
      <div style={s.reqTitle}>{item.REQUEST_TITLE}</div>
      <div style={s.reqContext}>{item.REQUEST_CONTEXT}</div>
      <div style={s.reqItemFooter}>
        {replied ? (
          <span style={s.repliedBadge}>✓ 답변완료</span>
        ) : (
          <span style={s.pendingBadge}>⏳ 미답변</span>
        )}
      </div>
      {replied && (
        <div style={s.replyPreview}>
          <span style={s.replyPreviewLabel}>답변</span>
          <span style={s.replyPreviewText}>{item.REPLY_CONTEXT}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────── 팀장 요청내용 카드 아이템 ─────────────── */
function ManagerItem({ task, userMap, onClick }) {
  const name = userMap[task.registrantId] ?? task.registrantId;
  return (
    <div style={{ ...s.reqItem, cursor: "pointer" }} onClick={onClick}>
      <div style={s.reqMetaRow}>
        <div style={s.reqAvatarWrap}>
          <div style={{ ...s.reqAvatar, backgroundColor: "#8B5CF620", color: "#8B5CF6" }}>
            {name?.charAt(0) ?? "?"}
          </div>
          <span style={s.reqFromName}>{name}</span>
        </div>
        <span style={s.reqDate}>{formatDate8(task.rawInsert)}</span>
      </div>
      <div style={s.reqContext}>{task.teamNote}</div>
    </div>
  );
}

/* ─────────────── 이슈내용 카드 아이템 ─────────────── */
function IssueItem({ task, userMap, onClick }) {
  const name     = userMap[task.registrantId] ?? task.registrantId;
  const resolved = task.issueCompleteYn === "Y";
  return (
    <div style={{ ...s.reqItem, cursor: "pointer" }} onClick={onClick}>
      <div style={s.reqMetaRow}>
        <div style={s.reqAvatarWrap}>
          <div style={{ ...s.reqAvatar, backgroundColor: "#EF444420", color: "#EF4444" }}>
            {name?.charAt(0) ?? "?"}
          </div>
          <span style={s.reqFromName}>{name}</span>
        </div>
        <span style={s.reqDate}>{formatDate8(task.rawInsert)}</span>
      </div>
      <div style={s.reqContext}>{task.issue}</div>
      <div style={s.reqItemFooter}>
        {resolved
          ? <span style={s.repliedBadge}>✓ 이슈해결</span>
          : <span style={s.pendingBadge}>⏳ 미해결</span>
        }
      </div>
    </div>
  );
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function CommunicationBoardPage() {
  const { user } = useAuth();
  const [hovered,          setHovered]          = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showReplyModal,   setShowReplyModal]   = useState(false);
  const [replyTarget,      setReplyTarget]      = useState(null);
  const [selectedTask,     setSelectedTask]     = useState(null);

  /* 데이터 상태 */
  const [received,        setReceived]        = useState([]);
  const [sent,            setSent]            = useState([]);
  const [managerItems,    setManagerItems]    = useState([]);
  const [issueItems,      setIssueItems]      = useState([]);
  const [userMap,         setUserMap]         = useState({});
  const [tm1, setTm1]   = useState([]);
  const [tm2, setTm2]   = useState([]);
  const [tm3, setTm3]   = useState([]);
  const [tm4, setTm4]   = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [loadingSent,     setLoadingSent]     = useState(false);
  const [loadingBoard,    setLoadingBoard]    = useState(false);

  /* 전체 유저 맵 로드 */
  useEffect(() => {
    async function loadUserMap() {
      const { data } = await supabase.from("SCRUMBOARD_USER").select("ID,NAME");
      const map = {};
      (data ?? []).forEach(u => { map[u.ID] = u.NAME; });
      setUserMap(map);
    }
    if (user) loadUserMap();
  }, [user]);

  /* 내가 받은 요청 */
  const fetchReceived = useCallback(async () => {
    if (!user?.id) return;
    setLoadingReceived(true);
    const { data } = await supabase
      .from("TASK_BOARD_REQUEST")
      .select("*")
      .eq("REQUEST_TO_ID", user.id)
      .order("SYS_DT", { ascending: false });
    setReceived(data ?? []);
    setLoadingReceived(false);
  }, [user]);

  /* 내가 한 요청 */
  const fetchSent = useCallback(async () => {
    if (!user?.id) return;
    setLoadingSent(true);
    const { data } = await supabase
      .from("TASK_BOARD_REQUEST")
      .select("*")
      .eq("REQUEST_FROM_ID", user.id)
      .order("SYS_DT", { ascending: false });
    setSent(data ?? []);
    setLoadingSent(false);
  }, [user]);

  /* 팀장요청 + 이슈 + TASK_MASTER */
  const fetchBoardData = useCallback(async () => {
    const dept = user?.deptCd;
    if (!dept) return;
    setLoadingBoard(true);
    const oneMonthAgo = getOneMonthAgoDate8();

    const makeQm = (level) =>
      supabase.from("TASK_MASTER")
        .select("TASK_ID,TASK_NAME,OBJECTIVE,COWORKERS,DEADLINE")
        .eq("LEVEL", level)
        .eq("DEPT_CD", dept);

    const [
      { data: bd },
      { data: md1 }, { data: md2 }, { data: md3 }, { data: md4 },
    ] = await Promise.all([
      supabase.from("TASK_BOARD").select("*")
        .eq("DEPT_CD", dept)
        .gte("INSERT_DATE", oneMonthAgo)
        .order("INSERT_DATE", { ascending: false }),
      makeQm("1"), makeQm("2"), makeQm("3"), makeQm("4"),
    ]);

    if (bd) {
      const mapped = bd.map(mapTaskBoardRow);
      setManagerItems(mapped.filter(t => t.teamNote?.trim()));
      setIssueItems(mapped.filter(t => t.issue?.trim()));
    }
    const mapTm = rows => (rows ?? []).map(r => ({
      TASK_ID:   r.TASK_ID,
      TASK_NAME: r.TASK_NAME,
      OBJECTIVE: r.OBJECTIVE ?? "",
      COWORKERS: r.COWORKERS ?? "",
      DEADLINE:  r.DEADLINE  ?? "",
    }));
    setTm1(mapTm(md1)); setTm2(mapTm(md2)); setTm3(mapTm(md3)); setTm4(mapTm(md4));
    setLoadingBoard(false);
  }, [user]);

  useEffect(() => { fetchReceived();  }, [fetchReceived]);
  useEffect(() => { fetchSent();      }, [fetchSent]);
  useEffect(() => { fetchBoardData(); }, [fetchBoardData]);

  function handleRequestSuccess() {
    setShowRequestModal(false);
    fetchSent();
  }
  function handleReplySuccess() {
    setShowReplyModal(false);
    setReplyTarget(null);
    fetchReceived();
    fetchSent();
  }

  const counts = {
    received: received.length,
    sent:     sent.length,
    manager:  managerItems.length,
    issue:    issueItems.length,
  };

  function renderCardBody(sec) {
    if (sec.id === "received") {
      if (loadingReceived) return <LoadingState />;
      if (received.length === 0) return <EmptyState sec={sec} />;
      return received.map(item => (
        <ReceivedItem
          key={item.TASK_REQUEST_ID}
          item={item}
          userMap={userMap}
          onReply={r => { setReplyTarget(r); setShowReplyModal(true); }}
        />
      ));
    }
    if (sec.id === "sent") {
      if (loadingSent) return <LoadingState />;
      if (sent.length === 0) return <EmptyState sec={sec} />;
      return sent.map(item => (
        <SentItem key={item.TASK_REQUEST_ID} item={item} userMap={userMap} />
      ));
    }
    if (sec.id === "manager") {
      if (loadingBoard) return <LoadingState />;
      if (managerItems.length === 0) return <EmptyState sec={sec} />;
      return managerItems.map(t => (
        <ManagerItem key={t.id} task={t} userMap={userMap} onClick={() => setSelectedTask(t)} />
      ));
    }
    if (sec.id === "issue") {
      if (loadingBoard) return <LoadingState />;
      if (issueItems.length === 0) return <EmptyState sec={sec} />;
      return issueItems.map(t => (
        <IssueItem key={t.id} task={t} userMap={userMap} onClick={() => setSelectedTask(t)} />
      ));
    }
  }

  function renderFooter(sec) {
    if (sec.id === "received") {
      return (
        <span style={s.footerStatus}>
          <span style={{ ...s.statusDot, backgroundColor: "#3B82F6" }} />
          총 {received.length}건 · 미답변 {received.filter(r => !r.REPLY_CONTEXT).length}건
        </span>
      );
    }
    if (sec.id === "sent") {
      return (
        <span style={s.footerStatus}>
          <span style={{ ...s.statusDot, backgroundColor: "#10B981" }} />
          총 {sent.length}건 · 답변대기 {sent.filter(r => !r.REPLY_CONTEXT).length}건
        </span>
      );
    }
    if (sec.id === "manager") {
      return (
        <span style={s.footerStatus}>
          <span style={{ ...s.statusDot, backgroundColor: "#8B5CF6" }} />
          최근 1개월 · {managerItems.length}건
        </span>
      );
    }
    if (sec.id === "issue") {
      const unresolved = issueItems.filter(t => t.issueCompleteYn !== "Y").length;
      return (
        <span style={s.footerStatus}>
          <span style={{ ...s.statusDot, backgroundColor: "#EF4444" }} />
          최근 1개월 · 미해결 {unresolved}건
        </span>
      );
    }
  }

  return (
    <div style={s.wrap}>

      {/* ── 상단 헤더 ── */}
      <div style={s.topBar}>
        <div>
          <h2 style={s.pageTitle}>Communication Board</h2>
          <p style={s.pageDesc}>팀 내 요청 및 이슈를 한눈에 관리하세요.</p>
        </div>
        <div style={s.topRight}>
          <div style={s.totalRow}>
            {SECTIONS.map(sec => (
              <div key={sec.id} style={s.totalChip}>
                <span style={{ ...s.totalDot, backgroundColor: sec.accent }} />
                <span style={s.totalLabel}>{sec.title}</span>
                <span style={s.totalCount}>{counts[sec.id]}</span>
              </div>
            ))}
          </div>
          <button style={s.requestBtn} onClick={() => setShowRequestModal(true)}>
            + 업무 요청
          </button>
        </div>
      </div>

      {/* ── 2×2 그리드 ── */}
      <div style={s.grid}>
        {SECTIONS.map(sec => {
          const isHov = hovered === sec.id;
          return (
            <div
              key={sec.id}
              style={{ ...s.card, boxShadow: isHov ? "0 4px 20px rgba(0,0,0,0.10)" : "0 1px 4px rgba(0,0,0,0.06)" }}
              onMouseEnter={() => setHovered(sec.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ ...s.accentBar, backgroundColor: sec.accent }} />
              <div style={s.cardHeader}>
                <div style={s.cardHeaderLeft}>
                  <div style={{ ...s.iconWrap, backgroundColor: sec.accent + "15" }}>
                    <Icon name={sec.emptyIcon} size={16} color={sec.accent} />
                  </div>
                  <div>
                    <div style={s.cardTitle}>{sec.title}</div>
                    <div style={s.cardSub}>{sec.sub}</div>
                  </div>
                </div>
                <span style={{
                  ...s.countBadge,
                  color:           counts[sec.id] > 0 ? sec.accent : "#94A3B8",
                  backgroundColor: counts[sec.id] > 0 ? sec.accent + "15" : "#F1F5F9",
                  borderColor:     counts[sec.id] > 0 ? sec.accent + "40" : "#E2E8F0",
                }}>
                  {counts[sec.id]}건
                </span>
              </div>
              <div style={s.divider} />
              <div style={s.cardBody}>
                {renderCardBody(sec)}
              </div>
              <div style={s.cardFooter}>
                {renderFooter(sec)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 업무 요청 팝업 ── */}
      {showRequestModal && (
        <RequestModal
          user={user}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleRequestSuccess}
        />
      )}

      {/* ── 답변 팝업 ── */}
      {showReplyModal && replyTarget && (
        <ReplyModal
          item={replyTarget}
          userMap={userMap}
          onClose={() => { setShowReplyModal(false); setReplyTarget(null); }}
          onSuccess={handleReplySuccess}
        />
      )}

      {/* ── 업무 상세 팝업 (팀장요청/이슈) ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          tm1={tm1} tm2={tm2} tm3={tm3} tm4={tm4}
          userMap={userMap}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ 업무 상세 팝업 (읽기전용) ═══════════════════════ */
function TaskDetailModal({ task, tm1, tm2, tm3, tm4, userMap, onClose }) {
  const [textCopied, setTextCopied] = useState(false);
  const hasIssue      = !!task.issue?.trim();
  const issueResolved = task.issueCompleteYn === "Y";
  const getTaskName   = (arr, id) => arr.find(t => String(t.TASK_ID) === String(id))?.TASK_NAME || id || "";
  const inp = { ...vs.input, ...vs.inputRO };

  async function handleCopyText() {
    const line = (label, value) => value?.trim() ? `${label}: ${value.trim()}` : null;
    const sep  = "─".repeat(32);
    const registrantName = userMap[task.registrantId] ?? task.registrantId ?? "";
    const parts = [
      "■ 업무 상세", sep,
      line("등록자",         registrantName),
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
    <div style={vs.overlay} onClick={onClose}>
      <div style={vs.modal} onClick={e => e.stopPropagation()}>
        <div style={vs.header}>
          <span style={vs.title}>업무 상세</span>
          <button style={vs.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={vs.body}>
          <div style={vs.fullRow}>
            <label style={vs.label}>제목</label>
            <input style={inp} type="text" readOnly value={task.title} />
          </div>
          <div style={vs.twoCol}>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>등록일자</label>
              <input style={inp} type="text" readOnly value={task.regDate} />
            </div>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>상태</label>
              <input style={inp} type="text" readOnly value={STATUS_TEXT[task.status] || task.status} />
            </div>
          </div>
          <div style={vs.twoCol}>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>업무구분1</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm1, task.taskType1Cd)} />
            </div>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>업무구분2</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm2, task.taskType2Cd)} />
            </div>
          </div>
          <div style={vs.twoCol}>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>업무구분3</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm3, task.taskType3Cd)} />
            </div>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>업무구분4</label>
              <input style={inp} type="text" readOnly value={getTaskName(tm4, task.taskType4Cd)} />
            </div>
          </div>
          <div style={vs.twoCol}>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>중요도</label>
              <input style={inp} type="text" readOnly value={task.priority} />
            </div>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>등록자</label>
              <input style={inp} type="text" readOnly value={userMap[task.registrantId] ?? task.registrantId} />
            </div>
          </div>
          <div style={vs.fullRow}>
            <label style={vs.label}>연관페이지링크</label>
            <input style={inp} type="text" readOnly value={task.relatedLink} />
          </div>
          <div style={vs.fullRow}>
            <label style={vs.label}>작업내용</label>
            <textarea style={{ ...vs.textarea, ...vs.inputRO }} readOnly value={task.content} />
          </div>
          <div style={vs.fullRow}>
            <label style={vs.label}>팀장공유내용</label>
            <textarea style={{ ...vs.textarea, ...vs.inputRO }} readOnly value={task.teamNote} />
          </div>
          <div style={vs.fullRow}>
            <label style={vs.label}>이슈사항</label>
            <textarea style={{ ...vs.textarea, ...vs.inputRO }} readOnly value={task.issue} />
            {hasIssue && (
              <div style={vs.issueStatusRow}>
                <span style={vs.issueStatusLabel}>이슈해결여부</span>
                {issueResolved
                  ? <span style={vs.issueStatusBadgeOk}>✅ Y (해결)</span>
                  : <span style={vs.issueStatusBadgeNg}>🚨 N (미해결)</span>}
              </div>
            )}
          </div>
          <div style={vs.twoCol}>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>작업완료예정일자</label>
              <input style={inp} type="text" readOnly value={task.plannedEnd} />
            </div>
            <div style={vs.fieldWrap}>
              <label style={vs.label}>작업완료일자</label>
              <input style={inp} type="text" readOnly value={task.actualEnd} />
            </div>
          </div>
        </div>
        <div style={vs.footer}>
          <button style={textCopied ? vs.copyTextBtnDone : vs.copyTextBtn} onClick={handleCopyText}>
            {textCopied ? "✅ 복사됨!" : "📄 텍스트 복사"}
          </button>
          <div style={vs.footerRight}>
            <button style={vs.cancelBtn} onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 답변 팝업 ═══════════════════════ */
function ReplyModal({ item, userMap, onClose, onSuccess }) {
  const [reply,      setReply]      = useState(item.REPLY_CONTEXT ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const fromName = userMap[item.REQUEST_FROM_ID] ?? item.REQUEST_FROM_ID;

  async function handleSubmit() {
    if (!reply.trim()) { setError("답변 내용을 입력하세요."); return; }
    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from("TASK_BOARD_REQUEST")
        .update({ REPLY_CONTEXT: reply.trim() })
        .eq("TASK_REQUEST_ID", item.TASK_REQUEST_ID);
      if (err) throw err;
      onSuccess();
    } catch (err) {
      setError(`저장 중 오류가 발생했습니다. (${err?.message ?? "알 수 없는 오류"})`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={{ ...ms.modal, width: "500px" }} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <div>
            <span style={ms.title}>요청 답변</span>
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
              요청자: <strong style={{ color: "#475569" }}>{fromName}</strong>
            </div>
          </div>
          <button style={ms.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={rm.requestPreview}>
          <div style={rm.previewLabel}>요청 내용</div>
          <div style={rm.previewTitle}>{item.REQUEST_TITLE}</div>
          <div style={rm.previewContext}>{item.REQUEST_CONTEXT}</div>
          <div style={rm.previewDate}>{formatDate(item.SYS_DT)}</div>
        </div>
        <div style={{ ...ms.body, paddingTop: "16px" }}>
          <div style={ms.fieldWrap}>
            <label style={ms.label}>답변 내용 <span style={ms.req}>*</span></label>
            <textarea
              style={{ ...ms.textarea, minHeight: "120px", ...(error ? ms.inputErr : {}) }}
              placeholder="답변 내용을 입력하세요"
              value={reply}
              autoFocus
              onChange={e => { setReply(e.target.value); setError(""); }}
            />
            {error && <p style={ms.err}>{error}</p>}
          </div>
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>취소</button>
          <button
            style={{ ...ms.submitBtn, opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "저장 중..." : "답변 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 업무 요청 팝업 ═══════════════════════ */
function RequestModal({ user, onClose, onSuccess }) {
  const [form,       setForm]       = useState({ title: "", toUserId: "", toUserName: "", context: "" });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deptUsers,  setDeptUsers]  = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      const dept = user?.deptCd;
      if (!dept) return;
      const { data } = await supabase
        .from("SCRUMBOARD_USER")
        .select("ID,NAME,DEPT_CD")
        .eq("DEPT_CD", dept);
      setDeptUsers((data ?? []).filter(u => u.ID !== user?.id));
    }
    fetchUsers();
  }, [user]);

  const filteredUsers = deptUsers.filter(u =>
    !searchText.trim() || u.NAME?.includes(searchText.trim())
  );

  function setField(field, value) {
    setForm(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: "" }));
  }

  function validate() {
    const errs = {};
    if (!form.title.trim())   errs.title    = "제목을 입력하세요.";
    if (!form.toUserId)       errs.toUserId = "수신자를 선택하세요.";
    if (!form.context.trim()) errs.context  = "요청내용을 입력하세요.";
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const { data: maxData } = await supabase
        .from("TASK_BOARD_REQUEST")
        .select("TASK_REQUEST_ID")
        .order("TASK_REQUEST_ID", { ascending: false })
        .limit(1);
      const newId = (maxData?.[0]?.TASK_REQUEST_ID ?? 0) + 1;

      const { error } = await supabase.from("TASK_BOARD_REQUEST").insert({
        TASK_REQUEST_ID: newId,
        REQUEST_FROM_ID: user?.id      ?? "",
        REQUEST_TITLE:   form.title.trim(),
        REQUEST_TO_ID:   form.toUserId,
        REQUEST_CONTEXT: form.context.trim(),
        SYS_DT:          new Date().toISOString(),
        DEPT_CD:         user?.deptCd  ?? "",
      });

      if (error) throw error;
      onSuccess();
    } catch (err) {
      setErrors({ submit: `저장 중 오류가 발생했습니다. (${err?.message ?? "알 수 없는 오류"})` });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>업무 요청</span>
          <button style={ms.closeX} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          <div style={ms.fieldWrap}>
            <label style={ms.label}>제목 <span style={ms.req}>*</span></label>
            <input
              style={{ ...ms.input, ...(errors.title ? ms.inputErr : {}) }}
              type="text"
              placeholder="요청 제목을 입력하세요"
              value={form.title}
              autoFocus
              onChange={e => setField("title", e.target.value)}
            />
            {errors.title && <p style={ms.err}>{errors.title}</p>}
          </div>
          <div style={ms.fieldWrap}>
            <label style={ms.label}>수신자 <span style={ms.req}>*</span></label>
            <div style={ms.recipientRow}>
              <input
                style={{ ...ms.input, ...(errors.toUserId ? ms.inputErr : {}), flex: 1, backgroundColor: "#F8FAFC", cursor: "default", color: form.toUserName ? "#1E293B" : "#94A3B8" }}
                type="text"
                placeholder="돋보기 버튼으로 사용자를 선택하세요"
                value={form.toUserName}
                readOnly
              />
              <button
                style={{ ...ms.searchBtn, ...(showSearch ? ms.searchBtnActive : {}) }}
                onClick={() => { setShowSearch(v => !v); setSearchText(""); }}
                title="사용자 검색"
              >
                <Icon name="search" size={15} color={showSearch ? "#FFFFFF" : "#475569"} />
              </button>
            </div>
            {errors.toUserId && <p style={ms.err}>{errors.toUserId}</p>}
            {showSearch && (
              <div style={ms.searchBox}>
                <div style={ms.searchInputWrap}>
                  <Icon name="search" size={14} color="#94A3B8" />
                  <input
                    style={ms.searchInput}
                    type="text"
                    placeholder="이름으로 검색"
                    value={searchText}
                    autoFocus
                    onChange={e => setSearchText(e.target.value)}
                  />
                </div>
                <div style={ms.userList}>
                  {filteredUsers.length === 0 ? (
                    <div style={ms.userEmpty}>
                      {deptUsers.length === 0 ? "같은 부서 사용자가 없습니다." : "검색 결과가 없습니다."}
                    </div>
                  ) : (
                    filteredUsers.map(u => {
                      const selected = form.toUserId === u.ID;
                      return (
                        <div
                          key={u.ID}
                          style={{ ...ms.userItem, ...(selected ? ms.userItemSelected : {}) }}
                          onClick={() => { setField("toUserId", u.ID); setField("toUserName", u.NAME); setShowSearch(false); setSearchText(""); }}
                        >
                          <div style={{ ...ms.userAvatar, backgroundColor: selected ? "#1E293B" : "#E2E8F0", color: selected ? "#FFFFFF" : "#475569" }}>
                            {u.NAME?.charAt(0) ?? "?"}
                          </div>
                          <span style={{ ...ms.userName, fontWeight: selected ? "700" : "500", color: selected ? "#1E293B" : "#475569" }}>{u.NAME}</span>
                          {selected && <span style={ms.selectedCheck}>✓</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={ms.fieldWrap}>
            <label style={ms.label}>요청내용 <span style={ms.req}>*</span></label>
            <textarea
              style={{ ...ms.textarea, ...(errors.context ? ms.inputErr : {}) }}
              placeholder="요청 내용을 자세히 입력하세요"
              value={form.context}
              onChange={e => setField("context", e.target.value)}
            />
            {errors.context && <p style={ms.err}>{errors.context}</p>}
          </div>
          {errors.submit && <p style={{ ...ms.err, marginTop: 0 }}>{errors.submit}</p>}
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>취소</button>
          <button style={{ ...ms.submitBtn, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 페이지 스타일 ═══════════════════════ */
const s = {
  wrap:        { fontFamily: "'Pretendard', sans-serif", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: "16px" },
  topBar:      { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", flexShrink: 0 },
  pageTitle:   { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: "0 0 3px 0" },
  pageDesc:    { fontSize: "12px", color: "#94A3B8", margin: 0, fontWeight: "400" },
  topRight:    { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  totalRow:    { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  totalChip:   { display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "5px 10px" },
  totalDot:    { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  totalLabel:  { fontSize: "11px", color: "#64748B", fontWeight: "500", whiteSpace: "nowrap" },
  totalCount:  { fontSize: "11px", color: "#1E293B", fontWeight: "700" },
  requestBtn:  { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#1E293B", border: "none", borderRadius: "7px", padding: "9px 18px", cursor: "pointer", whiteSpace: "nowrap" },

  grid:        { flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "14px", minHeight: 0 },
  card:        { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.18s ease", minHeight: 0 },
  accentBar:   { height: "3px", flexShrink: 0 },
  cardHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", flexShrink: 0 },
  cardHeaderLeft: { display: "flex", alignItems: "center", gap: "10px" },
  iconWrap:    { width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle:   { fontSize: "14px", fontWeight: "700", color: "#1E293B", lineHeight: "1.2" },
  cardSub:     { fontSize: "10px", fontWeight: "500", color: "#94A3B8", marginTop: "1px", letterSpacing: "0.02em" },
  countBadge:  { fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "20px", border: "1px solid", whiteSpace: "nowrap" },
  divider:     { height: "1px", backgroundColor: "#F1F5F9", flexShrink: 0, margin: "0 16px" },
  cardBody:    { flex: 1, padding: "8px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 },
  cardFooter:  { padding: "8px 16px", borderTop: "1px solid #F8FAFC", flexShrink: 0, display: "flex", alignItems: "center" },
  footerStatus:{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#94A3B8", fontWeight: "500" },
  statusDot:   { width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0 },

  emptyState:    { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 16px", textAlign: "center" },
  emptyIconWrap: { width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" },
  emptyMsg:      { fontSize: "13px", color: "#64748B", fontWeight: "500", margin: 0 },

  reqItem: {
    backgroundColor: "#FAFBFD",
    border: "1px solid #EEF2F7",
    borderRadius: "8px",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flexShrink: 0,
    transition: "border-color 0.15s",
  },
  reqMetaRow:   { display: "flex", alignItems: "center", justifyContent: "space-between" },
  reqAvatarWrap:{ display: "flex", alignItems: "center", gap: "6px" },
  reqAvatar:    { width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", flexShrink: 0 },
  reqFromName:  { fontSize: "12px", fontWeight: "600", color: "#475569" },
  reqDate:      { fontSize: "10px", color: "#94A3B8", flexShrink: 0 },
  reqTitle:     { fontSize: "13px", fontWeight: "700", color: "#1E293B", lineHeight: "1.3" },
  reqContext:   { fontSize: "12px", color: "#64748B", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  reqItemFooter:{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "2px" },

  repliedBadge: { fontSize: "10px", fontWeight: "600", color: "#10B981", backgroundColor: "#10B98112", border: "1px solid #10B98130", borderRadius: "4px", padding: "2px 7px" },
  pendingBadge: { fontSize: "10px", fontWeight: "600", color: "#F59E0B", backgroundColor: "#F59E0B12", border: "1px solid #F59E0B30", borderRadius: "4px", padding: "2px 7px" },
  replyBtn: {
    fontFamily: "'Pretendard', sans-serif",
    display: "flex", alignItems: "center", gap: "4px",
    fontSize: "10px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#3B82F6",
    border: "none", borderRadius: "4px",
    padding: "3px 8px", cursor: "pointer",
  },
  viewReplyBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "10px", fontWeight: "500",
    color: "#64748B", backgroundColor: "transparent",
    border: "1px solid #E2E8F0", borderRadius: "4px",
    padding: "2px 7px", cursor: "pointer",
  },
  replyPreview: {
    backgroundColor: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: "6px",
    padding: "7px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  replyPreviewLabel: { fontSize: "10px", fontWeight: "700", color: "#10B981" },
  replyPreviewText:  { fontSize: "11px", color: "#475569", lineHeight: "1.5" },
};

/* ═══════════════════════ 답변 팝업 스타일 ═══════════════════════ */
const rm = {
  requestPreview: {
    margin: "0 24px",
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  previewLabel:   { fontSize: "10px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase" },
  previewTitle:   { fontSize: "14px", fontWeight: "700", color: "#1E293B" },
  previewContext: { fontSize: "12px", color: "#64748B", lineHeight: "1.6", marginTop: "2px" },
  previewDate:    { fontSize: "10px", color: "#94A3B8", marginTop: "4px" },
};

/* ═══════════════════════ 요청 팝업 공통 스타일 ═══════════════════════ */
const ms = {
  overlay:  { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:    { position: "relative", backgroundColor: "#FFFFFF", borderRadius: "10px", width: "520px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
  header:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: "1px solid #E8E8E8", flexShrink: 0 },
  title:    { fontSize: "16px", fontWeight: "700", color: "#1E293B" },
  closeX:   { background: "none", border: "none", fontSize: "16px", color: "#94A3B8", cursor: "pointer", padding: "2px 4px" },
  body:     { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" },
  footer:   { display: "flex", justifyContent: "flex-end", gap: "8px", padding: "14px 24px 18px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  fieldWrap:{ display: "flex", flexDirection: "column", gap: "5px" },
  label:    { fontSize: "12px", fontWeight: "600", color: "#475569" },
  req:      { color: "#EF4444", marginLeft: "2px" },
  input:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "6px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" },
  inputErr: { borderColor: "#EF4444" },
  textarea: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "6px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: "100px" },
  err:      { fontSize: "12px", color: "#EF4444", margin: "2px 0 0" },
  recipientRow:   { display: "flex", gap: "6px" },
  searchBtn:      { fontFamily: "'Pretendard', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", flexShrink: 0, border: "1px solid #D9D9D9", borderRadius: "6px", backgroundColor: "#FFFFFF", cursor: "pointer" },
  searchBtnActive:{ backgroundColor: "#1E293B", borderColor: "#1E293B" },
  searchBox:      { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden", marginTop: "2px" },
  searchInputWrap:{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderBottom: "1px solid #F1F5F9" },
  searchInput:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "none", outline: "none", flex: 1, backgroundColor: "transparent" },
  userList:       { maxHeight: "180px", overflowY: "auto" },
  userEmpty:      { padding: "16px", textAlign: "center", fontSize: "12px", color: "#94A3B8" },
  userItem:       { display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" },
  userItemSelected:{ backgroundColor: "#F8FAFC" },
  userAvatar:     { width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 },
  userName:       { fontSize: "13px", flex: 1 },
  selectedCheck:  { fontSize: "13px", color: "#1E293B", fontWeight: "700", flexShrink: 0 },
  cancelBtn:      { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A", backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9", borderRadius: "6px", padding: "9px 22px", cursor: "pointer" },
  submitBtn:      { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#1E293B", border: "none", borderRadius: "6px", padding: "9px 22px", cursor: "pointer" },
};

/* ═══════════════════════ 업무 상세 팝업 스타일 ═══════════════════════ */
const vs = {
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
