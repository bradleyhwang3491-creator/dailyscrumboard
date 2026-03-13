import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../utils/auth";
import UserManagementPage from "./UserManagementPage";
import DailyScrumboardPage from "./DailyScrumboardPage";
import AIWeeklyReportPage from "./AIWeeklyReportPage";

const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard",       emoji: "◈" },
  { id: "scrumboard", label: "Daily Scrumboard", emoji: "▦" },
  { id: "ai-report", label: "AI Weekly Report", emoji: "◉" },
  { id: "user-mgmt", label: "사용자 정보 관리",  emoji: "◎" },
];

function MainPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [activeMenu, setActiveMenu] = useState(null);

  const deptNm = user?.deptNm ?? "";
  const name = user?.name ?? "";

  function handleLogout() {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  }

  return (
    <div style={styles.page}>
      {/* 상단 헤더 */}
      <header style={styles.header}>
        <span style={styles.serviceName}>SCRUM MEETING, WORK TOGETHER</span>
        <div style={styles.headerRight}>
          <span style={styles.userLabel}>{deptNm}_{name}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 바디: 사이드바 + 콘텐츠 */}
      <div style={styles.body}>

        {/* 좌측 사이드바 */}
        <nav style={styles.sidebar}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              style={{
                ...styles.menuItem,
                ...(activeMenu === item.id ? styles.menuItemActive : {}),
              }}
            >
              {activeMenu === item.id && <span style={styles.activeBar} />}
              <span style={styles.menuEmoji}>{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* 우측 콘텐츠 */}
        <main style={styles.content}>
          {/* 메뉴 선택 시 콘텐츠 */}
          {activeMenu === "user-mgmt" ? (
            <UserManagementPage />
          ) : activeMenu === "scrumboard" ? (
            <DailyScrumboardPage />
          ) : activeMenu === "ai-report" ? (
            <AIWeeklyReportPage />
          ) : (
            <div style={styles.contentArea}>
              {activeMenu ? (
                <p style={styles.comingSoon}>아직 개발 준비중입니다.</p>
              ) : (
                <p style={styles.placeholder}>좌측 메뉴를 선택해주세요.</p>
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottom: "1px solid #E8E8E8",
    padding: "0 32px",
    height: "60px",
    flexShrink: 0,
  },
  serviceName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#2F2F2F",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
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
    padding: "6px 14px",
    cursor: "pointer",
  },
  body: {
    display: "flex",
    flex: 1,
  },
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
  menuItem: {
    position: "relative",
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "14px",
    fontWeight: "400",
    color: "#5A5A5A",
    backgroundColor: "transparent",
    border: "none",
    textAlign: "left",
    padding: "11px 24px",
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
  activeBar: {
    position: "absolute",
    left: 0,
    top: "6px",
    bottom: "6px",
    width: "3px",
    backgroundColor: "#3A3A3A",
    borderRadius: "0 2px 2px 0",
  },
  content: {
    flex: 1,
    padding: "32px",
    minWidth: 0,
  },
  welcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    border: "1px solid #E8E8E8",
    padding: "20px 24px",
    marginBottom: "20px",
  },
  welcomeText: {
    fontSize: "18px",
    fontWeight: "400",
    color: "#2F2F2F",
    margin: 0,
  },
  userName: {
    fontWeight: "700",
    color: "#2F2F2F",
  },
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
