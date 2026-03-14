import { useState } from "react";

/* ─────────────── 섹션 정의 ─────────────── */
const SECTIONS = [
  {
    id:          "received",
    title:       "내가 받은 요청",
    emoji:       "📥",
    noteBg:      "#FFFDE7",   // 연한 노랑
    headerBg:    "#FFD600",
    headerText:  "#5D4037",
    pinColor:    "#F57F17",
    tagBg:       "#FFF9C4",
    tagColor:    "#795548",
    accentColor: "#F9A825",
    emptyMsg:    "받은 요청이 없습니다.",
    emptyIcon:   "📭",
  },
  {
    id:          "sent",
    title:       "내가 한 요청",
    emoji:       "📤",
    noteBg:      "#F1FFF4",   // 연한 초록
    headerBg:    "#43A047",
    headerText:  "#E8F5E9",
    pinColor:    "#2E7D32",
    tagBg:       "#C8E6C9",
    tagColor:    "#1B5E20",
    accentColor: "#388E3C",
    emptyMsg:    "한 요청이 없습니다.",
    emptyIcon:   "📮",
  },
  {
    id:          "manager",
    title:       "팀장 요청내용",
    emoji:       "👔",
    noteBg:      "#EFF6FF",   // 연한 파랑
    headerBg:    "#1E88E5",
    headerText:  "#E3F2FD",
    pinColor:    "#1565C0",
    tagBg:       "#BBDEFB",
    tagColor:    "#0D47A1",
    accentColor: "#1976D2",
    emptyMsg:    "팀장 요청이 없습니다.",
    emptyIcon:   "📋",
  },
  {
    id:          "issue",
    title:       "이슈내용",
    emoji:       "🚨",
    noteBg:      "#FFF5F5",   // 연한 빨강
    headerBg:    "#E53935",
    headerText:  "#FFEBEE",
    pinColor:    "#B71C1C",
    tagBg:       "#FFCDD2",
    tagColor:    "#B71C1C",
    accentColor: "#D32F2F",
    emptyMsg:    "이슈 내용이 없습니다.",
    emptyIcon:   "✅",
  },
];

/* ═══════════════════════ 메인 페이지 ═══════════════════════ */
export default function CommunicationBoardPage() {
  const [hovered, setHovered] = useState(null);

  /* 각 섹션의 아이템 수 (향후 실데이터 연동) */
  const counts = { received: 0, sent: 0, manager: 0, issue: 0 };

  return (
    <div style={s.wrap}>
      {/* ── 상단 헤더 ── */}
      <div style={s.topBar}>
        <div style={s.titleArea}>
          <h2 style={s.pageTitle}>Communication Board</h2>
          <span style={s.subTitle}>팀 소통 현황판</span>
        </div>
      </div>

      {/* ── 코르크 보드 ── */}
      <div style={s.board}>
        {SECTIONS.map((sec) => {
          const isHov = hovered === sec.id;
          return (
            <div
              key={sec.id}
              style={{
                ...s.note,
                backgroundColor: sec.noteBg,
                boxShadow: isHov
                  ? `4px 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)`
                  : `3px 5px 14px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.08)`,
                transform: isHov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
              }}
              onMouseEnter={() => setHovered(sec.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* 압정 (pin) */}
              <div style={{ ...s.pin, background: `radial-gradient(circle at 35% 35%, ${sec.pinColor}cc, ${sec.pinColor})` }}>
                <div style={s.pinShine} />
              </div>

              {/* 헤더 */}
              <div style={{ ...s.noteHeader, backgroundColor: sec.headerBg }}>
                <div style={s.noteHeaderLeft}>
                  <span style={s.noteEmoji}>{sec.emoji}</span>
                  <span style={{ ...s.noteTitle, color: sec.headerText }}>{sec.title}</span>
                </div>
                <div style={s.noteHeaderRight}>
                  <span style={{
                    ...s.countBadge,
                    backgroundColor: counts[sec.id] > 0 ? "#FFFFFF33" : "#FFFFFF22",
                    color: sec.headerText,
                  }}>
                    {counts[sec.id]}건
                  </span>
                  <button
                    style={{ ...s.addBtn, color: sec.headerText, borderColor: `${sec.headerText}55` }}
                    title="항목 추가"
                  >
                    ＋
                  </button>
                </div>
              </div>

              {/* 구분선 (테이프 효과) */}
              <div style={{ ...s.tape, backgroundColor: sec.accentColor + "40" }} />

              {/* 바디 */}
              <div style={s.noteBody}>
                {counts[sec.id] === 0 ? (
                  /* 비어있을 때 */
                  <div style={s.emptyState}>
                    <span style={s.emptyIcon}>{sec.emptyIcon}</span>
                    <span style={s.emptyMsg}>{sec.emptyMsg}</span>
                    <span style={s.emptyHint}>＋ 버튼을 눌러 추가해보세요</span>
                  </div>
                ) : (
                  /* 향후 아이템 목록 자리 */
                  <div style={s.itemList} />
                )}
              </div>

              {/* 하단 날짜 라인 */}
              <div style={{ ...s.noteFooter, borderTopColor: sec.accentColor + "30" }}>
                <span style={{ ...s.footerText, color: sec.accentColor }}>
                  기능 준비 중...
                </span>
              </div>

              {/* 접힌 모서리 효과 */}
              <div style={{ ...s.corner, borderLeftColor: sec.noteBg, borderTopColor: sec.noteBg }} />
              <div style={{ ...s.cornerShadow, backgroundColor: sec.accentColor + "25" }} />
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
  },

  /* 상단 헤더 */
  topBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    marginBottom: "16px",
    flexShrink: 0,
  },
  titleArea: { display: "flex", alignItems: "baseline", gap: "10px" },
  pageTitle: { fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0 },
  subTitle:  { fontSize: "12px", color: "#94A3B8", fontWeight: "400" },

  /* 코르크 보드 */
  board: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: "20px",
    minHeight: 0,
    backgroundColor: "#C8A96E",
    backgroundImage: [
      "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.06) 0%, transparent 60%)",
      "radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.06) 0%, transparent 60%)",
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='1' cy='1' r='0.6' fill='rgba(0,0,0,0.06)'/%3E%3C/svg%3E\")",
    ].join(", "),
    borderRadius: "12px",
    padding: "28px",
    border: "6px solid #A07840",
    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.12)",
  },

  /* 포스트잇 노트 */
  note: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: "2px 8px 2px 2px",
    overflow: "hidden",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
    cursor: "default",
    minHeight: "200px",
  },

  /* 압정 */
  pin: {
    position: "absolute",
    top: "-8px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    zIndex: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  },
  pinShine: {
    position: "absolute",
    top: "3px",
    left: "4px",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  /* 헤더 */
  noteHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px 10px 14px",
    marginTop: "6px",
    flexShrink: 0,
  },
  noteHeaderLeft:  { display: "flex", alignItems: "center", gap: "8px" },
  noteHeaderRight: { display: "flex", alignItems: "center", gap: "6px" },
  noteEmoji: { fontSize: "17px", lineHeight: 1 },
  noteTitle: { fontSize: "14px", fontWeight: "700", letterSpacing: "-0.01em" },

  countBadge: {
    fontSize: "11px",
    fontWeight: "700",
    padding: "2px 9px",
    borderRadius: "20px",
    minWidth: "28px",
    textAlign: "center",
  },
  addBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "16px",
    fontWeight: "400",
    background: "rgba(255,255,255,0.25)",
    border: "1px solid",
    borderRadius: "5px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    lineHeight: 1,
    transition: "background 0.12s",
  },

  /* 테이프 */
  tape: {
    height: "4px",
    flexShrink: 0,
  },

  /* 바디 */
  noteBody: {
    flex: 1,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
  },

  /* 비어있는 상태 */
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "20px 0",
  },
  emptyIcon: { fontSize: "32px", lineHeight: 1, opacity: 0.55 },
  emptyMsg:  { fontSize: "13px", color: "#94A3B8", fontWeight: "500" },
  emptyHint: { fontSize: "11px", color: "#B0BEC5", fontWeight: "400" },

  itemList: { flex: 1 },

  /* 하단 */
  noteFooter: {
    padding: "7px 16px",
    borderTop: "1px solid",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  footerText: { fontSize: "10px", fontWeight: "500", opacity: 0.7 },

  /* 접힌 모서리 */
  corner: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderWidth: "0 0 22px 22px",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(0,0,0,0.15)",
  },
  cornerShadow: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "22px",
    height: "22px",
    clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
  },
};
