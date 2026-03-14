import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../utils/auth";
import { useBreakpoint } from "../hooks/useBreakpoint";
import UserManagementPage from "./UserManagementPage";
import DailyScrumboardPage from "./DailyScrumboardPage";
import AIWeeklyReportPage from "./AIWeeklyReportPage";
import YearlyTaskBoardPage from "./YearlyTaskBoardPage";
import WeeklyTaskBoardPage from "./WeeklyTaskBoardPage";
import CommunicationBoardPage from "./CommunicationBoardPage";

const MENU_ITEMS = [
  { id: "dashboard",    label: "Communication Board", emoji: "◈" },
  { id: "scrumboard",   label: "Daily Scrumboard",    emoji: "▦" },
  { id: "yearly-board", label: "Yearly Task Board",   emoji: "◻" },
  { id: "weekly-board", label: "Weekly Task Board",   emoji: "▤" },
  { id: "ai-report",    label: "AI Weekly Report",    emoji: "◉" },
  { id: "user-mgmt",    label: "사용자 정보 관리",     emoji: "◎", adminOnly: true },
];

const ADMIN_ID = "SUNGHYUN_HWANG";

function MainPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const isMobile = useBreakpoint(768);

  const [activeMenu,  setActiveMenu]  = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const deptNm = user?.deptNm ?? "";
  const name   = user?.name   ?? "";

  function handleLogout() {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  }

  function handleMenuClick(id) {
    setActiveMenu(id);
    setSidebarOpen(false);
  }

  /* 사이드바 (데스크탑: 고정 / 모바일: 슬라이드 오버레이) */
  const sidebarEl = (
    <nav
      style={{
        ...styles.sidebar,
        ...(isMobile ? styles.sidebarMobile : {}),
        ...(isMobile && sidebarOpen ? styles.sidebarMobileOpen : {}),
      }}
    >
      {isMobile && (
        <div style={styles.sidebarMobileHeader}>
          <span style={styles.sidebarMobileTitle}>메뉴</span>
          <button
            style={styles.sidebarCloseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="메뉴 닫기"
          >
            ✕
          </button>
        </div>
      )}

      {MENU_ITEMS.map((item) => {
        const disabled = item.adminOnly && user?.id !== ADMIN_ID;
        return (
          <button
            key={item.id}
            disabled={disabled}
            onClick={() => !disabled && handleMenuClick(item.id)}
            title={disabled ? "관리자만 접근 가능한 메뉴입니다." : undefined}
            style={{
              ...styles.menuItem,
              ...(activeMenu === item.id ? styles.menuItemActive : {}),
              ...(disabled ? styles.menuItemDisabled : {}),
            }}
          >
            {activeMenu === item.id && !disabled && <span style={styles.activeBar} />}
            <span style={{ ...styles.menuEmoji, ...(disabled ? { opacity: 0.4 } : {}) }}>{item.emoji}</span>
            <span style={disabled ? { opacity: 0.4 } : {}}>{item.label}</span>
            {disabled && <span style={styles.lockBadge}>🔒</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={styles.page}>
      {/* 모바일 오버레이 (사이드바 뒤 어둡게) */}
      {isMobile && sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* 상단 헤더 */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {isMobile && (
            <button
              style={styles.hamburgerBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="메뉴 열기"
            >
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
            </button>
          )}
          <span style={isMobile ? styles.serviceNameMobile : styles.serviceName}>
            {isMobile ? "SCRUM BOARD" : "SCRUM MEETING, WORK TOGETHER"}
          </span>
        </div>

        <div style={styles.headerRight}>
          {!isMobile && (
            <span style={styles.userLabel}>{deptNm}_{name}</span>
          )}
          <button onClick={handleLogout} style={styles.logoutButton}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 바디: 사이드바 + 콘텐츠 */}
      <div style={styles.body}>
        {sidebarEl}

        <main style={isMobile ? styles.contentMobile : styles.content}>
          {/* 모바일: 현재 메뉴명 + 사용자 */}
          {isMobile && (
            <div style={styles.mobileTopBar}>
              <span style={styles.mobileMenuLabel}>
                {MENU_ITEMS.find((m) => m.id === activeMenu)?.label ?? ""}
              </span>
              <span style={styles.mobileUserLabel}>{deptNm}_{name}</span>
            </div>
          )}

          {activeMenu === "user-mgmt" ? (
            <UserManagementPage />
          ) : activeMenu === "dashboard" ? (
            <CommunicationBoardPage />
          ) : activeMenu === "scrumboard" ? (
            <DailyScrumboardPage />
          ) : activeMenu === "yearly-board" ? (
            <YearlyTaskBoardPage />
          ) : activeMenu === "weekly-board" ? (
            <WeeklyTaskBoardPage />
          ) : activeMenu === "ai-report" ? (
            <AIWeeklyReportPage />
          ) : (
            <div style={styles.contentArea}>
              {activeMenu ? (
                <p style={styles.comingSoon}>아직 개발 준비중입니다.</p>
              ) : (
                <p style={styles.placeholder}>
                  {isMobile ? "☰ 상단 버튼으로 메뉴를 선택해주세요." : "좌측 메뉴를 선택해주세요."}
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F7F7F7",
    fontFamily: "'Pretendard', sans-serif",
    display: "flex",
    flexDirection: "column",
  },

  /* ── 헤더 ── */
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottom: "1px solid #E8E8E8",
    padding: "0 16px",
    height: "56px",
    flexShrink: 0,
    position: "relative",
    zIndex: 200,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  serviceName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#2F2F2F",
  },
  serviceNameMobile: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#2F2F2F",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userLabel: {
    fontSize: "13px",
    color: "#5A5A5A",
    fontWeight: "500",
  },
  logoutButton: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#5A5A5A",
    backgroundColor: "transparent",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "6px 12px",
    cursor: "pointer",
  },

  /* ── 햄버거 버튼 ── */
  hamburgerBtn: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "5px",
    background: "none",
    border: "none",
    padding: "4px",
    cursor: "pointer",
    width: "32px",
    height: "32px",
    flexShrink: 0,
  },
  hamburgerLine: {
    display: "block",
    width: "20px",
    height: "2px",
    backgroundColor: "#2F2F2F",
    borderRadius: "2px",
  },

  /* ── 바디 ── */
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },

  /* ── 오버레이 ── */
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 299,
  },

  /* ── 사이드바 (데스크탑) ── */
  sidebar: {
    width: "220px",
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    borderRight: "1px solid #E8E8E8",
    padding: "24px 0",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  /* ── 사이드바 (모바일 슬라이드) ── */
  sidebarMobile: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: "260px",
    zIndex: 300,
    transform: "translateX(-100%)",
    transition: "transform 0.25s ease",
    padding: 0,
    boxShadow: "4px 0 20px rgba(0,0,0,0.12)",
  },
  sidebarMobileOpen: {
    transform: "translateX(0)",
  },
  sidebarMobileHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    height: "56px",
    borderBottom: "1px solid #E8E8E8",
    flexShrink: 0,
  },
  sidebarMobileTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#2F2F2F",
  },
  sidebarCloseBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "#94A3B8",
    cursor: "pointer",
    padding: "4px",
    lineHeight: 1,
  },

  /* ── 메뉴 아이템 ── */
  menuItem: {
    position: "relative",
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "14px",
    fontWeight: "400",
    color: "#5A5A5A",
    backgroundColor: "transparent",
    border: "none",
    textAlign: "left",
    padding: "13px 24px",
    cursor: "pointer",
    transition: "background-color 0.12s, color 0.12s",
    width: "100%",
  },
  menuEmoji: {
    display: "inline-block",
    marginRight: "8px",
    fontSize: "13px",
    color: "#2F2F2F",
    lineHeight: 1,
  },
  menuItemActive: {
    backgroundColor: "#F4F4F4",
    color: "#2F2F2F",
    fontWeight: "600",
  },
  menuItemDisabled: {
    cursor: "not-allowed",
    backgroundColor: "transparent",
    color: "#C0C0C0",
  },
  lockBadge: {
    marginLeft: "auto",
    fontSize: "11px",
    opacity: 0.5,
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "6px",
    bottom: "6px",
    width: "3px",
    backgroundColor: "#3A3A3A",
    borderRadius: "0 2px 2px 0",
  },

  /* ── 콘텐츠 ── */
  content: {
    flex: 1,
    padding: "32px",
    minWidth: 0,
    overflowY: "auto",
  },
  contentMobile: {
    flex: 1,
    padding: "16px",
    minWidth: 0,
    overflowY: "auto",
  },

  /* ── 모바일 상단 바 ── */
  mobileTopBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  mobileMenuLabel: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#2F2F2F",
  },
  mobileUserLabel: {
    fontSize: "12px",
    color: "#94A3B8",
  },

  /* ── 빈 화면 ── */
  contentArea: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    border: "1px solid #E8E8E8",
    padding: "60px 28px",
    textAlign: "center",
    minHeight: "300px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoon: {
    fontSize: "15px",
    color: "#5A5A5A",
    margin: 0,
  },
  placeholder: {
    fontSize: "14px",
    color: "#AAAAAA",
    margin: 0,
  },
};

export default MainPage;
