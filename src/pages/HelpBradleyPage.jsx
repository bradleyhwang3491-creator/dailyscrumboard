import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../hooks/useBreakpoint";

const ANSWER_ADMIN_IDS = ["SUNGHYUN_HWANG", "SUNGHYUN_HWANG2"];

function formatDt(dt) {
  if (!dt) return "-";
  return String(dt).slice(0, 16).replace("T", " ");
}

/* ══════════════════════════════════════════════════════════
   HelpBradleyPage — 시스템 개발 요청 게시판
══════════════════════════════════════════════════════════ */
export default function HelpBradleyPage() {
  const { user } = useAuth();
  const isMobile = useBreakpoint(768);

  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [userMap,  setUserMap]  = useState({});

  // 등록/수정 모달
  const [formOpen,  setFormOpen]  = useState(false);
  const [editTarget,setEditTarget]= useState(null);
  const [form,      setForm]      = useState({ TITLE: "", REQUEST_CONTENT: "" });
  const [formErr,   setFormErr]   = useState({});
  const [saving,    setSaving]    = useState(false);

  // 상세/답변 모달
  const [detail,    setDetail]    = useState(null);
  const [answerMode,setAnswerMode]= useState(false);
  const [answerText,setAnswerText]= useState("");
  const [answerSaving,setAnswerSaving] = useState(false);

  const isAnswerAdmin = ANSWER_ADMIN_IDS.includes(user?.id);

  useEffect(() => {
    fetchUsers();
    fetchItems();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase.from("SCRUMBOARD_USER").select("ID,NAME");
    const map = {};
    (data ?? []).forEach(u => { map[u.ID] = u.NAME; });
    setUserMap(map);
  }

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from("SYSTEM_DEV_REQUEST")
      .select("*")
      .order("REQUEST_ID", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  /* ── 등록 모달 오픈 ── */
  function openCreate() {
    setEditTarget(null);
    setForm({ TITLE: "", REQUEST_CONTENT: "" });
    setFormErr({});
    setFormOpen(true);
  }

  /* ── 수정 모달 오픈 ── */
  function openEdit(item) {
    setEditTarget(item);
    setForm({ TITLE: item.TITLE ?? "", REQUEST_CONTENT: item.REQUEST_CONTENT ?? "" });
    setFormErr({});
    setFormOpen(true);
    setDetail(null);
  }

  /* ── 저장 (등록/수정) ── */
  async function handleSave() {
    const errs = {};
    if (!form.TITLE.trim())          errs.TITLE          = "제목을 입력해주세요.";
    if (!form.REQUEST_CONTENT.trim()) errs.REQUEST_CONTENT = "요청사항을 입력해주세요.";
    if (Object.keys(errs).length)    { setFormErr(errs); return; }

    setSaving(true);
    if (editTarget) {
      const { error } = await supabase
        .from("SYSTEM_DEV_REQUEST")
        .update({ TITLE: form.TITLE.trim(), REQUEST_CONTENT: form.REQUEST_CONTENT.trim() })
        .eq("REQUEST_ID", editTarget.REQUEST_ID);
      if (error) { alert("수정 실패: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("SYSTEM_DEV_REQUEST")
        .insert({
          TITLE:           form.TITLE.trim(),
          REQUEST_CONTENT: form.REQUEST_CONTENT.trim(),
          REQUEST_DT:      new Date().toISOString(),
          REQUESTER_ID:    user?.id,
        });
      if (error) { alert("등록 실패: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    setFormOpen(false);
    fetchItems();
  }

  /* ── 삭제 ── */
  async function handleDelete(item) {
    if (!window.confirm("이 요청을 삭제하시겠습니까?\n삭제 후 복구가 불가능합니다.")) return;
    const { error } = await supabase
      .from("SYSTEM_DEV_REQUEST")
      .delete()
      .eq("REQUEST_ID", item.REQUEST_ID);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setDetail(null);
    fetchItems();
  }

  /* ── 상세 오픈 ── */
  function openDetail(item) {
    setDetail(item);
    setAnswerMode(false);
    setAnswerText(item.ANSWER_CONTENT ?? "");
  }

  /* ── 답변 저장 ── */
  async function handleAnswerSave() {
    if (!answerText.trim()) { alert("답변 내용을 입력해주세요."); return; }
    setAnswerSaving(true);
    const { error } = await supabase
      .from("SYSTEM_DEV_REQUEST")
      .update({
        ANSWER_CONTENT: answerText.trim(),
        ANSWERER_ID:    user?.id,
        ANSWER_DT:      new Date().toISOString(),
      })
      .eq("REQUEST_ID", detail.REQUEST_ID);
    if (error) { alert("답변 저장 실패: " + error.message); setAnswerSaving(false); return; }
    setAnswerSaving(false);
    setAnswerMode(false);
    await fetchItems();
    // detail 갱신
    const { data } = await supabase
      .from("SYSTEM_DEV_REQUEST")
      .select("*")
      .eq("REQUEST_ID", detail.REQUEST_ID)
      .single();
    if (data) { setDetail(data); setAnswerText(data.ANSWER_CONTENT ?? ""); }
  }

  const hasAnswer = (item) => !!item?.ANSWER_CONTENT;

  return (
    <div style={p.wrap}>
      {/* 헤더 */}
      <div style={p.topBar}>
        <div>
          <h2 style={p.pageTitle}>HELP BRADLEY!</h2>
          <p style={p.pageSub}>시스템 개발 요청 게시판 · 총 {items.length}건</p>
        </div>
        <button style={p.addBtn} onClick={openCreate}>+ 개발 요청 등록</button>
      </div>

      {/* 목록 */}
      {loading ? (
        <p style={p.loadingMsg}>데이터를 불러오는 중...</p>
      ) : items.length === 0 ? (
        <div style={p.emptyBox}><span style={p.emptyText}>등록된 요청이 없습니다.</span></div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map((item, idx) => (
            <div key={item.REQUEST_ID} style={p.mobileCard}>
              <div style={p.mobileCardTop}>
                <span style={p.mobileCardNo}>{items.length - idx}</span>
                <span style={p.mobileCardTitle} onClick={() => openDetail(item)}>
                  {item.TITLE}
                </span>
                {hasAnswer(item)
                  ? <span style={p.badgeAnswered}>✓ 답변완료</span>
                  : <span style={p.badgePending}>⏳ 대기중</span>}
              </div>
              <div style={p.mobileCardMeta}>
                <span>{userMap[item.REQUESTER_ID] ?? item.REQUESTER_ID}</span>
                <span style={{ color: "#94A3B8" }}>·</span>
                <span>{formatDt(item.REQUEST_DT)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={p.tableWrap}>
          <table style={p.table}>
            <thead>
              <tr>
                <th style={{ ...p.th, width: "48px" }}>No</th>
                <th style={{ ...p.th, width: "220px" }}>제목</th>
                <th style={p.th}>요청사항</th>
                <th style={{ ...p.th, width: "90px" }}>요청자</th>
                <th style={{ ...p.th, width: "145px" }}>요청일시</th>
                <th style={{ ...p.th, width: "90px" }}>답변자</th>
                <th style={{ ...p.th, width: "145px" }}>답변일시</th>
                <th style={{ ...p.th, width: "90px" }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.REQUEST_ID} style={p.tr} onClick={() => openDetail(item)}>
                  <td style={{ ...p.td, textAlign: "center", color: "#94A3B8" }}>{items.length - idx}</td>
                  <td style={{ ...p.td, maxWidth: "220px" }}>
                    <span style={p.titleLink}>
                      {item.TITLE}
                      <span style={p.titleLinkIcon}>↗</span>
                    </span>
                  </td>
                  <td style={{ ...p.td, maxWidth: "320px", color: "#5A5A5A" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.REQUEST_CONTENT}
                    </span>
                  </td>
                  <td style={{ ...p.td, fontWeight: "600" }}>{userMap[item.REQUESTER_ID] ?? item.REQUESTER_ID}</td>
                  <td style={{ ...p.td, color: "#94A3B8", fontSize: "12px" }}>{formatDt(item.REQUEST_DT)}</td>
                  <td style={{ ...p.td }}>{item.ANSWERER_ID ? (userMap[item.ANSWERER_ID] ?? item.ANSWERER_ID) : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                  <td style={{ ...p.td, color: "#94A3B8", fontSize: "12px" }}>{item.ANSWER_DT ? formatDt(item.ANSWER_DT) : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                  <td style={{ ...p.td, textAlign: "center" }}>
                    {hasAnswer(item)
                      ? <span style={p.badgeAnswered}>✓ 답변완료</span>
                      : <span style={p.badgePending}>⏳ 대기중</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 등록/수정 모달 ── */}
      {formOpen && (
        <div style={m.overlay} onClick={() => setFormOpen(false)}>
          <div style={m.modal} onClick={e => e.stopPropagation()}>
            <div style={m.header}>
              <h3 style={m.title}>{editTarget ? "개발 요청 수정" : "개발 요청 등록"}</h3>
              <button style={m.closeBtn} onClick={() => setFormOpen(false)}>✕</button>
            </div>

            <div style={m.fieldWrap}>
              <label style={m.label}>제목 <span style={{ color: "#EF4444" }}>*</span></label>
              <input
                style={{ ...m.input, ...(formErr.TITLE ? m.inputErr : {}) }}
                placeholder="요청 제목을 입력하세요"
                value={form.TITLE}
                onChange={e => setForm(f => ({ ...f, TITLE: e.target.value }))}
              />
              {formErr.TITLE && <span style={m.errMsg}>{formErr.TITLE}</span>}
            </div>

            <div style={m.fieldWrap}>
              <label style={m.label}>요청사항 <span style={{ color: "#EF4444" }}>*</span></label>
              <textarea
                style={{ ...m.textarea, ...(formErr.REQUEST_CONTENT ? m.inputErr : {}) }}
                placeholder="개발 요청 내용을 자세히 입력해주세요"
                rows={7}
                value={form.REQUEST_CONTENT}
                onChange={e => setForm(f => ({ ...f, REQUEST_CONTENT: e.target.value }))}
              />
              {formErr.REQUEST_CONTENT && <span style={m.errMsg}>{formErr.REQUEST_CONTENT}</span>}
            </div>

            <div style={m.footer}>
              <button style={m.cancelBtn} onClick={() => setFormOpen(false)} disabled={saving}>취소</button>
              <button style={m.saveBtn}   onClick={handleSave}              disabled={saving}>
                {saving ? "저장 중..." : editTarget ? "수정 저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상세/답변 모달 ── */}
      {detail && (
        <div style={m.overlay} onClick={() => { setDetail(null); setAnswerMode(false); }}>
          <div style={{ ...m.modal, maxWidth: "640px" }} onClick={e => e.stopPropagation()}>
            <div style={m.header}>
              <div>
                <h3 style={m.title}>{detail.TITLE}</h3>
                <p style={m.detailMeta}>
                  {userMap[detail.REQUESTER_ID] ?? detail.REQUESTER_ID}
                  &nbsp;·&nbsp;{formatDt(detail.REQUEST_DT)}
                </p>
              </div>
              <button style={m.closeBtn} onClick={() => { setDetail(null); setAnswerMode(false); }}>✕</button>
            </div>

            {/* 요청사항 */}
            <div style={m.contentBox}>
              <span style={m.contentLabel}>요청사항</span>
              <p style={m.contentText}>{detail.REQUEST_CONTENT}</p>
            </div>

            {/* 답변 영역 */}
            {hasAnswer(detail) && !answerMode && (
              <div style={m.answerBox}>
                <div style={m.answerHeaderRow}>
                  <span style={m.answerLabel}>✅ 답변</span>
                  <span style={m.answerMeta}>
                    {userMap[detail.ANSWERER_ID] ?? detail.ANSWERER_ID}
                    &nbsp;·&nbsp;{formatDt(detail.ANSWER_DT)}
                  </span>
                </div>
                <p style={m.answerText}>{detail.ANSWER_CONTENT}</p>
              </div>
            )}

            {/* 답변 입력 (관리자) */}
            {isAnswerAdmin && answerMode && (
              <div style={m.fieldWrap}>
                <label style={m.label}>답변 내용 <span style={{ color: "#EF4444" }}>*</span></label>
                <textarea
                  style={m.textarea}
                  placeholder="답변 내용을 입력하세요"
                  rows={5}
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                />
              </div>
            )}

            {/* 버튼 영역 */}
            <div style={m.footer}>
              {/* 요청자 전용 버튼 */}
              {user?.id === detail.REQUESTER_ID && !answerMode && (
                <>
                  <button style={m.editBtn} onClick={() => openEdit(detail)}>수정</button>
                  <button style={m.delBtn}  onClick={() => handleDelete(detail)}>삭제</button>
                </>
              )}

              {/* 관리자 답변 버튼 */}
              {isAnswerAdmin && !answerMode && (
                <button
                  style={m.answerBtn}
                  onClick={() => { setAnswerMode(true); setAnswerText(detail.ANSWER_CONTENT ?? ""); }}
                >
                  {hasAnswer(detail) ? "✏️ 답변 수정" : "💬 답변 등록"}
                </button>
              )}
              {isAnswerAdmin && answerMode && (
                <>
                  <button style={m.cancelBtn} onClick={() => setAnswerMode(false)} disabled={answerSaving}>취소</button>
                  <button style={m.saveBtn}   onClick={handleAnswerSave}           disabled={answerSaving}>
                    {answerSaving ? "저장 중..." : "답변 저장"}
                  </button>
                </>
              )}

              {!isAnswerAdmin && !answerMode && (
                <button style={m.cancelBtn} onClick={() => setDetail(null)}>닫기</button>
              )}
              {isAnswerAdmin && !answerMode && (
                <button style={m.cancelBtn} onClick={() => setDetail(null)}>닫기</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   스타일
══════════════════════════════════════════════════════════ */
const p = {
  wrap:        { padding: "28px 32px", fontFamily: "'Pretendard', sans-serif", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px" },
  topBar:      { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 },
  pageTitle:   { fontSize: "20px", fontWeight: "700", color: "#1E293B", margin: "0 0 2px" },
  pageSub:     { fontSize: "12px", color: "#94A3B8", margin: 0 },
  addBtn:      { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none", borderRadius: "8px", padding: "9px 18px", cursor: "pointer", whiteSpace: "nowrap" },
  loadingMsg:  { color: "#94A3B8", fontSize: "14px", textAlign: "center", padding: "40px 0" },
  emptyBox:    { display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 0" },
  emptyText:   { fontSize: "14px", color: "#94A3B8" },
  tableWrap:   { flex: 1, overflowY: "auto", backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px" },
  table:       { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th:          { padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748B", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1 },
  tr:          { borderBottom: "1px solid #F1F5F9", cursor: "pointer", transition: "background 0.12s" },
  td:          { padding: "12px 14px", fontSize: "13px", color: "#475569", verticalAlign: "middle" },
  titleLink:   { fontWeight: "600", color: "#2563EB", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#93C5FD", textUnderlineOffset: "3px", display: "inline-flex", alignItems: "center", gap: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" },
  titleLinkIcon:{ fontSize: "10px", color: "#93C5FD", flexShrink: 0 },
  badgeAnswered:{ fontSize: "10px", fontWeight: "600", color: "#10B981", backgroundColor: "#10B98112", border: "1px solid #10B98130", borderRadius: "4px", padding: "2px 8px", whiteSpace: "nowrap" },
  badgePending: { fontSize: "10px", fontWeight: "600", color: "#F59E0B", backgroundColor: "#F59E0B12", border: "1px solid #F59E0B30", borderRadius: "4px", padding: "2px 8px", whiteSpace: "nowrap" },
  // 모바일
  mobileCard:      { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  mobileCardTop:   { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  mobileCardNo:    { fontSize: "11px", color: "#94A3B8", flexShrink: 0 },
  mobileCardTitle: { fontSize: "14px", fontWeight: "600", color: "#2563EB", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#93C5FD", flex: 1 },
  mobileCardMeta:  { display: "flex", gap: "6px", fontSize: "11px", color: "#94A3B8" },
};

const m = {
  overlay:    { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" },
  modal:      { backgroundColor: "#FFFFFF", borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "16px", padding: "26px", boxSizing: "border-box", fontFamily: "'Pretendard', sans-serif", maxHeight: "90vh", overflowY: "auto" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title:      { fontSize: "17px", fontWeight: "700", color: "#1E293B", margin: "0 0 2px" },
  detailMeta: { fontSize: "12px", color: "#94A3B8", margin: 0 },
  closeBtn:   { fontFamily: "'Pretendard', sans-serif", fontSize: "16px", color: "#94A3B8", backgroundColor: "transparent", border: "none", cursor: "pointer", padding: "0 4px", lineHeight: 1, flexShrink: 0 },
  fieldWrap:  { display: "flex", flexDirection: "column", gap: "6px" },
  label:      { fontSize: "12px", fontWeight: "600", color: "#475569" },
  input:      { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "7px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" },
  textarea:   { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#1E293B", border: "1px solid #D9D9D9", borderRadius: "7px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7 },
  inputErr:   { borderColor: "#EF4444" },
  errMsg:     { fontSize: "11px", color: "#EF4444" },
  footer:     { display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px", flexWrap: "wrap" },
  cancelBtn:  { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#64748B", backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "9px 20px", cursor: "pointer" },
  saveBtn:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none", borderRadius: "7px", padding: "9px 24px", cursor: "pointer" },
  editBtn:    { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#2563EB", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "7px", padding: "9px 18px", cursor: "pointer" },
  delBtn:     { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#EF4444", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "7px", padding: "9px 18px", cursor: "pointer" },
  answerBtn:  { fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", backgroundColor: "#10B981", border: "none", borderRadius: "7px", padding: "9px 20px", cursor: "pointer" },
  contentBox: { backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "14px 16px" },
  contentLabel:{ fontSize: "10px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "6px", letterSpacing: "0.05em" },
  contentText:{ fontSize: "13px", color: "#1E293B", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  answerBox:  { backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "14px 16px" },
  answerHeaderRow:{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  answerLabel:{ fontSize: "10px", fontWeight: "700", color: "#16A34A", letterSpacing: "0.05em" },
  answerMeta: { fontSize: "11px", color: "#86EFAC" },
  answerText: { fontSize: "13px", color: "#14532D", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" },
};
