import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { logout, updateLastActivity, getLastActivity } from "../utils/auth";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { supabase } from "../lib/supabase";
import UserManagementPage from "./UserManagementPage";
import DailyScrumboardPage from "./DailyScrumboardPage";
import AIWeeklyReportPage from "./AIWeeklyReportPage";
import YearlyTaskBoardPage from "./YearlyTaskBoardPage";
import YearlyTaskBoardCRMPage from "./YearlyTaskBoardCRMPage";
import WeeklyTaskBoardPage from "./WeeklyTaskBoardPage";
import CommunicationBoardPage from "./CommunicationBoardPage";
import GanttChartPage from "./GanttChartPage";
import SystemNoticePage from "./SystemNoticePage";
import HelpBradleyPage from "./HelpBradleyPage";
import IssueManagePage from "./IssueManagePage";
import IssueDashboardPage from "./IssueDashboardPage";

const ADMIN_ID = "SUNGHYUN_HWANG";
const CRM_USER_IDS = ["SUNAH.HAN", "JIYUN.LEE", "SUNBIN.LEE", "YEONHEE.CHOI"];
const NOTICE_ADMIN_IDS = ["SUNGHYUN_HWANG", "SUNGHYUN_HWANG2"];

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

/* ── 신규기능알림 버튼 ────────────────────────────── */
const NOTIFY_SEEN_KEY = "notifyLastSeenAt"; // localStorage 키

function NotifyButton() {
  const [open,        setOpen]        = useState(false);
  const [notices,     setNotices]     = useState([]);
  const [recentCount, setRecentCount] = useState(0); // 마지막 확인 이후 신규 공지 수
  const [detail,      setDetail]      = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    checkRecentNotices();
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /**
   * 마운트 시: localStorage에 저장된 마지막 확인 시각 이후 공지 수 파악.
   * 최초 방문(저장값 없음)이면 5일 이내 기준으로 카운트.
   */
  async function checkRecentNotices() {
    const lastSeen = localStorage.getItem(NOTIFY_SEEN_KEY);
    let since;
    if (lastSeen) {
      since = lastSeen;
    } else {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      since = fiveDaysAgo.toISOString().replace("T", " ").slice(0, 19);
    }
    const { data } = await supabase
      .from("SYSTEM_UPDATE_NOTIFY")
      .select("ID")
      .gte("REG_DATE", since);
    setRecentCount((data || []).length);
  }

  async function fetchRecentNotices() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString().replace("T", " ").slice(0, 19);
    const { data } = await supabase
      .from("SYSTEM_UPDATE_NOTIFY")
      .select("*")
      .gte("REG_DATE", since)
      .order("ID", { ascending: false });
    setNotices(data || []);
  }

  function handleToggle() {
    const willOpen = !open;
    if (willOpen) {
      fetchRecentNotices();
    } else {
      // 드롭다운 닫을 때 현재 시각을 localStorage에 저장
      // → 다음 로그인 시 이 시각 이후 공지만 배지에 반영
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      localStorage.setItem(NOTIFY_SEEN_KEY, now);
      setRecentCount(0); // 세션 내 배지 초기화 (닫는 시점)
    }
    setOpen(willOpen);
  }

  function formatDate(dt) {
    if (!dt) return "";
    return dt.slice(0, 10);
  }

  return (
    <>
      <div ref={ref} style={nb.wrap}>
        <button
          style={{ ...nb.btn, ...(recentCount > 0 ? nb.btnAlert : {}) }}
          onClick={handleToggle}
          title="신규기능알림"
        >
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            {recentCount > 0 ? "🔔" : "🔔"}
            {recentCount > 0 && (
              <span style={nb.badge}>{recentCount}</span>
            )}
          </span>
          <span style={recentCount > 0 ? nb.btnAlertText : {}}>신규기능</span>
        </button>
        {open && (
          <div style={nb.dropdown}>
            <div style={nb.dropHeader}>
              <span style={nb.dropTitle}>최근 1주일 시스템 공지</span>
            </div>
            {notices.length === 0 ? (
              <div style={nb.emptyMsg}>최근 1주일간 공지가 없습니다.</div>
            ) : (
              <div style={nb.list}>
                {notices.map((item) => (
                  <button
                    key={item.ID ?? item.id}
                    style={nb.listItem}
                    onClick={() => { setDetail(item); setOpen(false); }}
                  >
                    <span style={nb.itemTitle}>{item.TITLE ?? item.title}</span>
                    <span style={nb.itemDate}>{formatDate(item.REG_DATE ?? item.reg_date)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상세 팝업 */}
      {detail && (
        <div style={nb.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={nb.modal}>
            <div style={nb.modalHeader}>
              <span style={nb.modalTitle}>{detail.TITLE ?? detail.title}</span>
              <button style={nb.closeBtn} onClick={() => setDetail(null)}>✕</button>
            </div>
            <div style={nb.modalBody}>
              <div style={nb.modalMeta}>
                <span style={nb.metaChip}>등록자: {detail.REG_NM ?? detail.reg_nm}</span>
                <span style={nb.metaChip}>
                  {(detail.REG_DATE ?? detail.reg_date ?? "").slice(0, 16).replace("T", " ")}
                </span>
              </div>
              <div style={nb.modalContent}>
                {(detail.CONTENT ?? detail.content ?? "").split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 6px 0" }}>{line || <br />}</p>
                ))}
              </div>
            </div>
            <div style={nb.modalFooter}>
              <button style={nb.closePrimaryBtn} onClick={() => setDetail(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const nb = {
  wrap: { position: "relative" },
  btn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px", fontWeight: "400", color: "#5A5A5A",
    backgroundColor: "transparent", border: "1px solid #D9D9D9",
    borderRadius: "5px", padding: "6px 10px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap",
  },
  btnAlert: {
    color: "#B45309",
    backgroundColor: "#FFFBEB",
    border: "1px solid #FCD34D",
    boxShadow: "0 0 0 2px rgba(251,191,36,0.25)",
    fontWeight: "600",
  },
  btnAlertText: { color: "#B45309" },
  badge: {
    position: "absolute",
    top: "-7px", right: "-8px",
    minWidth: "16px", height: "16px",
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    fontSize: "9px", fontWeight: "700",
    borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 3px",
    lineHeight: 1,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  },
  dropdown: {
    position: "absolute", top: "calc(100% + 6px)", right: 0,
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8",
    borderRadius: "8px", boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
    zIndex: 500, width: "320px", overflow: "hidden",
  },
  dropHeader: {
    padding: "12px 16px", borderBottom: "1px solid #F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  dropTitle: { fontSize: "12px", fontWeight: "700", color: "#475569" },
  emptyMsg: { padding: "24px 16px", fontSize: "13px", color: "#94A3B8", textAlign: "center" },
  list: { maxHeight: "320px", overflowY: "auto" },
  listItem: {
    display: "flex", flexDirection: "column", alignItems: "flex-start",
    width: "100%", padding: "12px 16px", textAlign: "left",
    background: "none", border: "none", borderBottom: "1px solid #F8FAFC",
    cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
  },
  itemTitle: { fontSize: "13px", fontWeight: "600", color: "#1E293B", marginBottom: "3px" },
  itemDate: { fontSize: "11px", color: "#94A3B8" },

  /* 상세 팝업 */
  overlay: {
    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.40)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    backgroundColor: "#FFFFFF", borderRadius: "10px",
    width: "90%", maxWidth: "520px", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "85vh", overflow: "hidden",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 22px", borderBottom: "1px solid #E8E8E8", flexShrink: 0,
  },
  modalTitle: { fontSize: "16px", fontWeight: "700", color: "#1E293B", lineHeight: "1.4", flex: 1, marginRight: "12px" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", color: "#94A3B8", cursor: "pointer", padding: "2px" },
  modalBody: { padding: "20px 22px", overflowY: "auto", flex: 1 },
  modalMeta: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" },
  metaChip: { fontSize: "12px", color: "#64748B", backgroundColor: "#F1F5F9", borderRadius: "4px", padding: "3px 8px" },
  modalContent: { fontSize: "14px", color: "#374151", lineHeight: "1.7", backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: "6px", padding: "14px 16px", minHeight: "80px", whiteSpace: "pre-wrap" },
  modalFooter: { display: "flex", justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid #E8E8E8", flexShrink: 0 },
  closePrimaryBtn: { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none", borderRadius: "6px", padding: "8px 22px", cursor: "pointer" },
};

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

  const [activeMenu,  setActiveMenu]  = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 자동 로그아웃 메시지 표시
  const [autoLogoutMsg, setAutoLogoutMsg] = useState(false);

  // 어제 시스템 공지 알림 모달
  const [yesterdayNotices,     setYesterdayNotices]     = useState([]);
  const [showYesterdayNotice,  setShowYesterdayNotice]  = useState(false);

  /* ── 한국시간(KST) 날짜 문자열 반환 ── */
  function getKSTDate(offsetDays = 0) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    kst.setDate(kst.getDate() + offsetDays);
    return kst.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  /* ── 자동 로그아웃 (12시간 비활동) ── */
  useEffect(() => {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const EVENTS = ["mousedown", "keydown", "scroll", "touchstart"];

    const onActivity = () => updateLastActivity();
    EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const timer = setInterval(() => {
      const last = getLastActivity();
      if (last && Date.now() - last > TWELVE_HOURS) {
        clearInterval(timer);
        setAutoLogoutMsg(true);
      }
    }, 60 * 1000); // 1분마다 체크

    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearInterval(timer);
    };
  }, []);

  /* ── 어제 시스템 공지 알림 (하루 1회, KST 기준) ── */
  useEffect(() => {
    if (!user) return;
    const todayKST = getKSTDate(0);
    const checkKey = `notice_daily_check_${user.id}`;
    const lastCheck = localStorage.getItem(checkKey);
    if (lastCheck === todayKST) return; // 오늘 이미 확인함

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    async function checkYesterdayNotices() {
      const { data } = await supabase
        .from("SYSTEM_UPDATE_NOTIFY")
        .select("*")
        .gte("REG_DATE", since24h)
        .order("ID", { ascending: false });

      localStorage.setItem(checkKey, todayKST);
      if (data && data.length > 0) {
        setYesterdayNotices(data);
        setShowYesterdayNotice(true);
      }
    }
    checkYesterdayNotices();
  }, [user]);

  const deptNm = user?.deptNm ?? "";
  const name   = user?.name   ?? "";

  /* 전체 메뉴 ID → 라벨 맵 (모바일 상단 표시용) */
  const ALL_MENU_LABELS = {
    "dashboard":        t("nav.menus.communicationBoard"),
    "scrumboard":       t("nav.menus.dailyScrumboard"),
    "gantt":            t("nav.menus.ganttChart"),
    "yearly-board":     t("nav.menus.yearlyTaskBoard"),
    "yearly-board-crm": t("nav.menus.yearlyTaskBoardCRM"),
    "weekly-board":     t("nav.menus.weeklyTaskBoard"),
    "ai-report":        t("nav.menus.aiWeeklyReport"),
    "user-mgmt":        t("nav.menus.userManagement"),
    "system-notice":    "System Notification",
    "help-bradley":     "HELP BOARD",
    "issue-manage":     "Issue Manage",
    "issue-dashboard":  "Issue Dashboard",
  };

  function handleLogout() {
    logout();
    setUser(null);
    navigate("/login", { replace: true });
  }

  const [scrumboardOpen,    setScrumboardOpen]    = useState(false);
  const [projectReportOpen, setProjectReportOpen] = useState(false);
  const [adminOpen,         setAdminOpen]         = useState(false);

  function handleMenuClick(id) {
    setActiveMenu(id);
    setSidebarOpen(false);
  }

  /* 사이드바 — 서브메뉴 버튼 헬퍼 */
  const subBtn = (id, label) => (
    <button
      key={id}
      onClick={() => handleMenuClick(id)}
      style={{
        ...styles.menuItem,
        paddingLeft: "42px",
        fontSize: "13px",
        fontWeight: activeMenu === id ? "600" : "400",
        color: activeMenu === id ? "#2563EB" : "#5A5A5A",
        backgroundColor: activeMenu === id ? "#EFF6FF" : "transparent",
      }}
    >
      {activeMenu === id && <span style={{ ...styles.activeBar, backgroundColor: "#2563EB" }} />}
      <span style={{ marginRight: "8px", color: "#94A3B8" }}>└</span>
      {label}
    </button>
  );

  const accordionHdrStyle = {
    ...styles.menuItem,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontWeight: "600", color: "#2F2F2F",
  };
  const subWrap = {
    backgroundColor: "#F8FAFC",
    borderTop: "1px solid #F1F5F9",
    borderBottom: "1px solid #F1F5F9",
  };

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

      {/* 1. Communication Board */}
      <button
        onClick={() => handleMenuClick("dashboard")}
        style={{ ...styles.menuItem, ...(activeMenu === "dashboard" ? styles.menuItemActive : {}) }}
      >
        {activeMenu === "dashboard" && <span style={styles.activeBar} />}
        <span style={styles.menuEmoji}>◈</span>
        <span>{t("nav.menus.communicationBoard")}</span>
      </button>

      {/* 2. Scrumboard 대메뉴 */}
      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "4px", paddingTop: "4px" }}>
        <button onClick={() => setScrumboardOpen(v => !v)} style={accordionHdrStyle}>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span style={styles.menuEmoji}>▦</span>
            <span>Scrumboard</span>
          </span>
          <span style={{ fontSize: "10px", color: "#94A3B8", marginRight: "4px" }}>
            {scrumboardOpen ? "▲" : "▼"}
          </span>
        </button>
        {scrumboardOpen && (
          <div style={subWrap}>
            {subBtn("scrumboard",   t("nav.menus.dailyScrumboard"))}
            {subBtn("gantt",        t("nav.menus.ganttChart"))}
            {subBtn("weekly-board", t("nav.menus.weeklyTaskBoard"))}
            {subBtn("yearly-board", t("nav.menus.yearlyTaskBoard"))}
            {CRM_USER_IDS.includes(user?.id) && subBtn("yearly-board-crm", t("nav.menus.yearlyTaskBoardCRM"))}
            {subBtn("ai-report",    t("nav.menus.aiWeeklyReport"))}
          </div>
        )}
      </div>

      {/* 3. Project Report 대메뉴 */}
      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "4px", paddingTop: "4px" }}>
        <button onClick={() => setProjectReportOpen(v => !v)} style={accordionHdrStyle}>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span style={styles.menuEmoji}>◐</span>
            <span>Project Report</span>
          </span>
          <span style={{ fontSize: "10px", color: "#94A3B8", marginRight: "4px" }}>
            {projectReportOpen ? "▲" : "▼"}
          </span>
        </button>
        {projectReportOpen && (
          <div style={subWrap}>
            {subBtn("issue-manage",    "Issue Manage")}
            {subBtn("issue-dashboard", "Issue Dashboard")}
          </div>
        )}
      </div>

      {/* 4. System Notification */}
      {NOTICE_ADMIN_IDS.includes(user?.id) && (
        <button
          onClick={() => handleMenuClick("system-notice")}
          style={{ ...styles.menuItem, ...(activeMenu === "system-notice" ? styles.menuItemActive : {}) }}
        >
          {activeMenu === "system-notice" && <span style={styles.activeBar} />}
          <span style={styles.menuEmoji}>◈</span>
          <span>System Notification</span>
        </button>
      )}

      {/* 5. Help Board */}
      <button
        onClick={() => handleMenuClick("help-bradley")}
        style={{ ...styles.menuItem, ...(activeMenu === "help-bradley" ? styles.menuItemActive : {}) }}
      >
        {activeMenu === "help-bradley" && <span style={styles.activeBar} />}
        <span style={styles.menuEmoji}>◇</span>
        <span>HELP BOARD</span>
      </button>

      {/* 6. Admin 대메뉴 — Help Board 하단 */}
      {user?.id === ADMIN_ID && (
        <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "4px", paddingTop: "4px" }}>
          <button onClick={() => setAdminOpen(v => !v)} style={accordionHdrStyle}>
            <span style={{ display: "flex", alignItems: "center" }}>
              <span style={styles.menuEmoji}>◎</span>
              <span>Admin</span>
            </span>
            <span style={{ fontSize: "10px", color: "#94A3B8", marginRight: "4px" }}>
              {adminOpen ? "▲" : "▼"}
            </span>
          </button>
          {adminOpen && (
            <div style={subWrap}>
              {subBtn("user-mgmt", t("nav.menus.userManagement"))}
            </div>
          )}
        </div>
      )}
    </nav>
  );

  return (
    <div style={styles.page}>

      {/* ── 자동 로그아웃 알림 ── */}
      {autoLogoutMsg && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "36px 32px", width: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "18px", alignItems: "center", textAlign: "center" }}>
            <span style={{ fontSize: "40px" }}>⏱️</span>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#1E293B" }}>자동 로그아웃</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: "1.7" }}>
              12시간 이상 사용하지 않아<br />자동 로그아웃 됩니다.
            </p>
            <button
              onClick={() => { logout(); setUser(null); navigate("/login", { replace: true }); }}
              style={{ padding: "10px 32px", backgroundColor: "#1E293B", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
            >확인</button>
          </div>
        </div>
      )}

      {/* ── 어제 시스템 공지 알림 ── */}
      {showYesterdayNotice && yesterdayNotices.length > 0 && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", width: "90%", maxWidth: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E8E8E8", backgroundColor: "#F8FAFC", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>📢</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>어제 등록된 시스템 공지</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94A3B8" }}>총 {yesterdayNotices.length}건의 새 공지가 있습니다.</p>
              </div>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "12px 0" }}>
              {yesterdayNotices.map((item) => (
                <div key={item.ID ?? item.id} style={{ padding: "14px 24px", borderBottom: "1px solid #F1F5F9" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{item.TITLE ?? item.title}</p>
                  <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#475569", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{item.CONTENT ?? item.content}</p>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>{(item.REG_DATE ?? "").slice(0, 10)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #E8E8E8", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowYesterdayNotice(false); setActiveMenu("dashboard"); }}
                style={{ padding: "9px 24px", backgroundColor: "#1E293B", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
              >확인 (Communication Board로 이동)</button>
            </div>
          </div>
        </div>
      )}
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
          {/* 신규기능알림 버튼 */}
          <NotifyButton />
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
                {ALL_MENU_LABELS[activeMenu] ?? ""}
              </span>
              <span style={styles.mobileUserLabel}>{deptNm}_{name}</span>
            </div>
          )}

          {activeMenu === "help-bradley" ? (
            <HelpBradleyPage />
          ) : activeMenu === "system-notice" ? (
            <SystemNoticePage />
          ) : activeMenu === "user-mgmt" ? (
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
          ) : activeMenu === "issue-manage" ? (
            <IssueManagePage />
          ) : activeMenu === "issue-dashboard" ? (
            <IssueDashboardPage />
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
