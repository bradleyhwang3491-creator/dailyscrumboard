import { useState } from "react";

/* ─────────────── 섹션 정의 ─────────────── */
const SECTIONS = [
  {
    id:        "received",
    title:     "내가 받은 요청",
    sub:       "Requests Received",
    accent:    "#3B82F6",
    emptyMsg:  "받은 요청이 없습니다.",
    emptyIcon: "inbox",
  },
  {
    id:        "sent",
    title:     "내가 한 요청",
    sub:       "Requests Sent",
    accent:    "#10B981",
    emptyMsg:  "한 요청이 없습니다.",
    emptyIcon: "send",
  },
  {
    id:        "manager",
    title:     "팀장 요청내용",
    sub:       "Manager Requests",
    accent:    "#8B5CF6",
    emptyMsg:  "팀장 요청이 없습니다.",
    emptyIcon: "clipboard",
  },
  {
    id:        "issue",
    title:     "이슈내용",
    sub:       "Issues",
    accent:    "#EF4444",
    emptyMsg:  "등록된 이슈가 없습니다.",
    emptyIcon: "alert",
  },
];

/* SVG 아이콘 */
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
    plus: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  };
  return icons[name] ?? null;
}

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function CommunicationBoardPage() {
  const [hovered, setHovered] = useState(null);

  /* 향후 실데이터 연동 */
  const counts = { received: 0, sent: 0, manager: 0, issue: 0 };

  return (
    <div style={s.wrap}>

      {/* ── 상단 헤더 ── */}
      <div style={s.topBar}>
        <div>
          <h2 style={s.pageTitle}>Communication Board</h2>
          <p style={s.pageDesc}>팀 내 요청 및 이슈를 한눈에 관리하세요.</p>
        </div>
        <div style={s.totalRow}>
          {SECTIONS.map(sec => (
            <div key={sec.id} style={s.totalChip}>
              <span style={{ ...s.totalDot, backgroundColor: sec.accent }} />
              <span style={s.totalLabel}>{sec.title}</span>
              <span style={s.totalCount}>{counts[sec.id]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2×2 그리드 ── */}
      <div style={s.grid}>
        {SECTIONS.map(sec => {
          const isHov = hovered === sec.id;
          return (
            <div
              key={sec.id}
              style={{
                ...s.card,
                boxShadow: isHov
                  ? "0 4px 20px rgba(0,0,0,0.10)"
                  : "0 1px 4px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={() => setHovered(sec.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* 상단 액센트 바 */}
              <div style={{ ...s.accentBar, backgroundColor: sec.accent }} />

              {/* 카드 헤더 */}
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
                <div style={s.cardHeaderRight}>
                  <span style={{
                    ...s.countBadge,
                    color:           counts[sec.id] > 0 ? sec.accent : "#94A3B8",
                    backgroundColor: counts[sec.id] > 0 ? sec.accent + "15" : "#F1F5F9",
                    borderColor:     counts[sec.id] > 0 ? sec.accent + "40" : "#E2E8F0",
                  }}>
                    {counts[sec.id]}건
                  </span>
                  <button
                    style={{ ...s.addBtn, borderColor: isHov ? "#CBD5E1" : "#E2E8F0" }}
                    title="항목 추가"
                  >
                    <Icon name="plus" size={14} color="#64748B" />
                  </button>
                </div>
              </div>

              {/* 구분선 */}
              <div style={s.divider} />

              {/* 카드 바디 */}
              <div style={s.cardBody}>
                {counts[sec.id] === 0 ? (
                  <div style={s.emptyState}>
                    <div style={{ ...s.emptyIconWrap, backgroundColor: sec.accent + "10", border: `1px solid ${sec.accent}20` }}>
                      <Icon name={sec.emptyIcon} size={22} color={sec.accent + "80"} />
                    </div>
                    <p style={s.emptyMsg}>{sec.emptyMsg}</p>
                    <p style={s.emptyHint}>＋ 버튼으로 항목을 추가할 수 있습니다.</p>
                  </div>
                ) : (
                  <div style={s.itemList} />
                )}
              </div>

              {/* 카드 푸터 */}
              <div style={s.cardFooter}>
                <span style={s.footerStatus}>
                  <span style={{ ...s.statusDot, backgroundColor: "#D1D5DB" }} />
                  기능 준비 중
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ 스타일 ═══════════════════════ */
const s = {
  wrap: {
    fontFamily: "'Pretendard', sans-serif",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    gap: "16px",
  },

  /* 상단 헤더 */
  topBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1E293B",
    margin: "0 0 3px 0",
  },
  pageDesc: {
    fontSize: "12px",
    color: "#94A3B8",
    margin: 0,
    fontWeight: "400",
  },
  totalRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  totalChip: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "6px",
    padding: "5px 10px",
  },
  totalDot:   { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  totalLabel: { fontSize: "11px", color: "#64748B", fontWeight: "500", whiteSpace: "nowrap" },
  totalCount: { fontSize: "11px", color: "#1E293B", fontWeight: "700" },

  /* 2×2 그리드 */
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: "14px",
    minHeight: 0,
  },

  /* 카드 */
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    transition: "box-shadow 0.18s ease",
    minHeight: 0,
  },

  /* 상단 액센트 바 (3px) */
  accentBar: {
    height: "3px",
    flexShrink: 0,
  },

  /* 카드 헤더 */
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 12px",
    flexShrink: 0,
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  cardHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  iconWrap: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: "1.2",
  },
  cardSub: {
    fontSize: "10px",
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: "1px",
    letterSpacing: "0.02em",
  },

  /* 건수 뱃지 */
  countBadge: {
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 9px",
    borderRadius: "20px",
    border: "1px solid",
    whiteSpace: "nowrap",
  },

  /* + 버튼 */
  addBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "1px solid",
    backgroundColor: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "border-color 0.12s, background-color 0.12s",
    flexShrink: 0,
  },

  /* 구분선 */
  divider: {
    height: "1px",
    backgroundColor: "#F1F5F9",
    flexShrink: 0,
    margin: "0 16px",
  },

  /* 카드 바디 */
  cardBody: {
    flex: 1,
    padding: "0 16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  /* 빈 상태 */
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "24px 16px",
    textAlign: "center",
  },
  emptyIconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  emptyMsg:  { fontSize: "13px", color: "#64748B", fontWeight: "500", margin: 0 },
  emptyHint: { fontSize: "11px", color: "#CBD5E1", fontWeight: "400", margin: 0 },

  itemList: { flex: 1 },

  /* 카드 푸터 */
  cardFooter: {
    padding: "8px 16px",
    borderTop: "1px solid #F8FAFC",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  footerStatus: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "10px",
    color: "#CBD5E1",
    fontWeight: "500",
  },
  statusDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },
};
