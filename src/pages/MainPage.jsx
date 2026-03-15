import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { logout } from "../utils/auth";
import { useBreakpoint } from "../hooks/useBreakpoint";
import UserManagementPage from "./UserManagementPage";
import DailyScrumboardPage from "./DailyScrumboardPage";
import AIWeeklyReportPage from "./AIWeeklyReportPage";
import YearlyTaskBoardPage from "./YearlyTaskBoardPage";
import YearlyTaskBoardCRMPage from "./YearlyTaskBoardCRMPage";
import WeeklyTaskBoardPage from "./WeeklyTaskBoardPage";
import CommunicationBoardPage from "./CommunicationBoardPage";
import GanttChartPage from "./GanttChartPage";

const ADMIN_ID = "SUNGHYUN_HWANG";
const CRM_USER_IDS = ["SUNAH.HAN", "JIYUN.LEE", "SUNBIN.LEE", "YEONHEE.CHOI"];

/* ── 언어 선택 드롭다운 ────────────────────────────── */
function LangDropdown() {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = [
    { value: "ko", label: t("lang.ko") },
    { value: "en", label: t("lang.en") },
  ];

  return (
    <div ref={ref} style={ls.wrap}>
      <button style={ls.btn} onClick={() => setOpen((v) => !v)}>
        🌐 {options.find((o) => o.value === lang)?.label}
        <span style={ls.caret}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={ls.dropdown}>
          {options.map((o) => (
            <button
              key={o.value}
              style={{
                ...ls.option,
                ...(lang === o.value ? ls.optionActive : {}),
              }}
              onClick={() => { setLang(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ls = {
  wrap: { position: "relative" },
  btn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#5A5A5A",
    backgroundColor: "transparent",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "6px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
  },
  caret: { fontSize: "10px", color: "#94A3B8" },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E8E8",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
    zIndex: 500,
    minWidth: "110px",
    overflow: "hidden",
  },
  option: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    backgroundColor: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    padding: "10px 14px",
    cursor: "pointer",
  },
  optionActive: {
    backgroundColor: "#F4F4F4",
    fontWeight: "600",
  },
};

/* ── MainPage ───────────────────────────────────────── */
function MainPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const isMobile = useBreakpoint(768);

  const [activeMenu,  setActiveMenu]  = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const deptNm = user?.deptNm ?? "";
  const name   = user?.name   ?? "";

  /* 메뉴 아이템 — label은 t()로 언어 반영 */
  const MENU_ITEMS = [
    { id: "dashboard",        label: t("nav.menus.communicationBoard"),    emoji: "◈" },
    { id: "scrumboard",       label: t("nav.menus.dailyScrumboard"),       emoji: "▦" },
    { id: "gantt",            label: t("nav.menus.ganttChart"),            emoji: "▬" },
    { id: "yearly-board",     label: t("nav.menus.yearlyTaskBoard"),       emoji: "◻" },
    { id: "yearly-board-crm", label: t("nav.menus.yearlyTaskBoardCRM"),   emoji: "◈", crmOnly: true },
    { id: "weekly-board",     label: t("nav.menus.weeklyTaskBoard"),       emoji: "▤" },
    { id: "ai-report",        label: t("nav.menus.aiWeeklyReport"),        emoji: "◉" },
    { id: "user-mgmt",        label: t("nav.menus.userManagement"),        emoji: "◎", adminOnly: true },
  ];

  function handleLogout() {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  }

  function handleMenuClick(id) {
    setActiveMenu(id);
    setSidebarOpen(false);
  }

  /* 사이드바 */
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
          <span style={styles.sidebarMobileTitle}>{t("nav.menu")}</span>
          <button
            style={styles.sidebarCloseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label={t("nav.closeMenu")}
          >
            ✕
          </button>
        </div>
      )}

      {MENU_ITEMS.map((item) => {
        if (item.crmOnly && !CRM_USER_IDS.includes(user?.id)) return null;
        const disabled = item.adminOnly && user?.id !== ADMIN_ID;
        return (
          <button
            key={item.id}
            disabled={disabled}
            onClick={() => !disabled && handleMenuClick(item.id)}
            title={disabled ? t("nav.adminOnly") : undefined}
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
              aria-label={t("nav.openMenu")}
            >
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
              <span style={styles.hamburgerLine} />
            </button>
          )}
          <span style={isMobile ? styles.serviceNameMobile : styles.serviceName}>
            {isMobile ? t("nav.titleMobile") : t("nav.title")}
          </span>
        </div>

        <div style={styles.headerRight}>
          {!isMobile && (
            <span style={styles.userLabel}>{deptNm}_{name}</span>
          )}
          {/* 언어 선택 드롭다운 */}
          <LangDropdown />
          <button onClick={handleLogout} style={styles.logoutButton}>
            {t("common.logout")}
          </button>
        </div>
      </header>

      {/* 바디: 사이드바 + 콘텐츠 */}
      <div style={styles.body}>
        {sidebarEl}

        <main style={isMobile ? styles.contentMobile : styles.content}>
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
          ) : activeMenu === "gantt" ? (
            <GanttChartPage />
          ) : activeMenu === "yearly-board" ? (
            <YearlyTaskBoardPage />
          ) : activeMenu === "yearly-board-crm" ? (
            <YearlyTaskBoardCRMPage />
          ) : activeMenu === "weekly-board" ? (
            <WeeklyTaskBoardPage />
          ) : activeMenu === "ai-report" ? (
            <AIWeeklyReportPage />
          ) : (
            <div style={styles.contentArea}>
              {activeMenu ? (
                <p style={styles.comingSoon}>{t("nav.developing")}</p>
              ) : (
                <p style={styles.placeholder}>
                  {isMobile ? t("nav.selectMenuMobile") : t("nav.selectMenuDesktop")}
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
    gap: "8px",
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
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 299,
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
