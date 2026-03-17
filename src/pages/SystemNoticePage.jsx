import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";

const REG_NM = "황성현";

/* ══════════════════════════════════════════════════════════
   SystemNoticePage — 시스템공지 관리
   ══════════════════════════════════════════════════════════ */
export default function SystemNoticePage() {
  const isMobile = useBreakpoint(768);

  const [notices,     setNotices]     = useState([]);
  const [loading,     setLoading]     = useState(false);

  // 등록/수정 모달
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null); // null = 등록, object = 수정
  const [form,        setForm]        = useState({ TITLE: "", CONTENT: "" });
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState({});
  const [saveErr,     setSaveErr]     = useState("");   // DB 오류 메시지 표시용

  // 상세 보기 모달
  const [detailItem,  setDetailItem]  = useState(null);

  useEffect(() => { fetchNotices(); }, []);

  async function fetchNotices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("SYSTEM_UPDATE_NOTIFY")
      .select("*")
      .order("ID", { ascending: false });
    if (!error) setNotices(data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditTarget(null);
    setForm({ TITLE: "", CONTENT: "" });
    setFormErr({});
    setSaveErr("");
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditTarget(item);
    setForm({ TITLE: item.TITLE ?? item.title ?? "", CONTENT: item.CONTENT ?? item.content ?? "" });
    setFormErr({});
    setSaveErr("");
    setModalOpen(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.TITLE.trim())   errs.TITLE   = "제목을 입력해주세요.";
    if (!form.CONTENT.trim()) errs.CONTENT = "수정사항을 입력해주세요.";
    if (Object.keys(errs).length) { setFormErr(errs); return; }

    setSaving(true);
    setSaveErr("");

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (editTarget) {
      // 수정 — 대/소문자 두 가지 시도
      let { error } = await supabase
        .from("SYSTEM_UPDATE_NOTIFY")
        .update({ TITLE: form.TITLE.trim(), CONTENT: form.CONTENT.trim() })
        .eq("ID", editTarget.ID);

      if (error) {
        // 소문자 컬럼명 fallback
        const res2 = await supabase
          .from("SYSTEM_UPDATE_NOTIFY")
          .update({ title: form.TITLE.trim(), content: form.CONTENT.trim() })
          .eq("id", editTarget.ID ?? editTarget.id);
        if (res2.error) {
          setSaveErr(`수정 실패: ${error.message}`);
          setSaving(false); return;
        }
      }
    } else {
      // 등록 — 대문자 컬럼명으로 시도
      let { error } = await supabase
        .from("SYSTEM_UPDATE_NOTIFY")
        .insert({ TITLE: form.TITLE.trim(), CONTENT: form.CONTENT.trim(), REG_NM, REG_DATE: now });

      if (error) {
        // 소문자 컬럼명 fallback (Supabase UI로 테이블 생성 시 소문자)
        const res2 = await supabase
          .from("SYSTEM_UPDATE_NOTIFY")
          .insert({ title: form.TITLE.trim(), content: form.CONTENT.trim(), reg_nm: REG_NM, reg_date: now });
        if (res2.error) {
          setSaveErr(`등록 실패 (${error.message}) — Supabase SQL Editor에서 아래 SQL을 실행해주세요:\nGRANT ALL ON TABLE "SYSTEM_UPDATE_NOTIFY" TO anon;\nGRANT ALL ON TABLE "SYSTEM_UPDATE_NOTIFY" TO authenticated;\nGRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;\nGRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;`);
          setSaving(false); return;
        }
      }
    }
    setSaving(false);
    setModalOpen(false);
    fetchNotices();
  }

  async function handleDelete(id) {
    if (!window.confirm("이 공지를 삭제하시겠습니까?\n삭제 후 복구가 불가능합니다.")) return;
    let { error } = await supabase.from("SYSTEM_UPDATE_NOTIFY").delete().eq("ID", id);
    if (error) {
      const res2 = await supabase.from("SYSTEM_UPDATE_NOTIFY").delete().eq("id", id);
      if (res2.error) { console.error("삭제 오류:", res2.error.message); return; }
    }
    fetchNotices();
  }

  function formatDate(dt) {
    if (!dt) return "-";
    return dt.slice(0, 16).replace("T", " ");
  }

  /* ── JSX ── */
  return (
    <div style={p.wrap}>
      {/* 헤더 */}
      <div style={p.topBar}>
        <h2 style={p.pageTitle}>시스템공지</h2>
        <button style={p.addBtn} onClick={openCreate}>+ 공지 등록</button>
      </div>

      {/* 테이블 */}
      {loading ? (
        <p style={p.loadingMsg}>데이터를 불러오는 중...</p>
      ) : notices.length === 0 ? (
        <div style={p.emptyBox}><span style={p.emptyText}>등록된 공지가 없습니다.</span></div>
      ) : isMobile ? (
        /* 모바일 카드 리스트 */
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {notices.map((item, idx) => (
            <div key={item.ID ?? item.id} style={p.mobileCard}>
              <div style={p.mobileCardTop}>
                <span style={p.mobileCardNo}>{notices.length - idx}</span>
                <span style={p.mobileCardTitle} onClick={() => setDetailItem(item)}>{item.TITLE ?? item.title}</span>
              </div>
              <div style={p.mobileCardMeta}>
                <span>{item.REG_NM ?? item.reg_nm}</span>
                <span style={{ color: "#94A3B8" }}>·</span>
                <span>{formatDate(item.REG_DATE ?? item.reg_date)}</span>
              </div>
              <div style={p.mobileCardActions}>
                <button style={p.editBtn} onClick={() => openEdit(item)}>수정</button>
                <button style={p.delBtn}  onClick={() => handleDelete(item.ID ?? item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 데스크탑 테이블 */
        <div style={p.tableWrap}>
          <table style={p.table}>
            <thead>
              <tr>
                {["No", "제목", "수정사항", "등록자명", "등록일시", "관리"].map((h) => (
                  <th key={h} style={p.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.map((item, idx) => (
                <tr key={item.ID ?? item.id} style={p.tr}>
                  <td style={{ ...p.td, width: "52px", textAlign: "center", color: "#94A3B8" }}>{notices.length - idx}</td>
                  <td style={{ ...p.td, fontWeight: "600", cursor: "pointer", color: "#1E293B", maxWidth: "200px" }}
                      onClick={() => setDetailItem(item)}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.TITLE ?? item.title}
                    </span>
                  </td>
                  <td style={{ ...p.td, maxWidth: "320px", color: "#5A5A5A" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.CONTENT ?? item.content}
                    </span>
                  </td>
                  <td style={{ ...p.td, width: "90px", textAlign: "center" }}>{item.REG_NM ?? item.reg_nm}</td>
                  <td style={{ ...p.td, width: "140px", textAlign: "center", color: "#64748B" }}>{formatDate(item.REG_DATE ?? item.reg_date)}</td>
                  <td style={{ ...p.td, width: "110px", textAlign: "center" }}>
                    <button style={p.editBtn} onClick={() => openEdit(item)}>수정</button>
                    <button style={{ ...p.delBtn, marginLeft: "6px" }} onClick={() => handleDelete(item.ID ?? item.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {modalOpen && (
        <div style={m.overlay} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={m.modal}>
            <div style={m.header}>
              <span style={m.title}>{editTarget ? "공지 수정" : "공지 등록"}</span>
              <button style={m.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div style={m.body}>
              <div style={m.fieldWrap}>
                <label style={m.label}>제목 <span style={{ color: "#DC2626" }}>*</span></label>
                <input
                  style={{ ...m.input, ...(formErr.TITLE ? m.inputErr : {}) }}
                  placeholder="공지 제목을 입력해주세요"
                  value={form.TITLE}
                  onChange={(e) => { setForm((f) => ({ ...f, TITLE: e.target.value })); setFormErr((f) => ({ ...f, TITLE: "" })); }}
                />
                {formErr.TITLE && <span style={m.errMsg}>{formErr.TITLE}</span>}
              </div>
              <div style={m.fieldWrap}>
                <label style={m.label}>수정사항 <span style={{ color: "#DC2626" }}>*</span></label>
                <textarea
                  style={{ ...m.textarea, ...(formErr.CONTENT ? m.inputErr : {}) }}
                  placeholder="수정/변경 사항을 입력해주세요"
                  rows={8}
                  value={form.CONTENT}
                  onChange={(e) => { setForm((f) => ({ ...f, CONTENT: e.target.value })); setFormErr((f) => ({ ...f, CONTENT: "" })); }}
                />
                {formErr.CONTENT && <span style={m.errMsg}>{formErr.CONTENT}</span>}
              </div>
              <div style={m.metaRow}>
                <span style={m.metaItem}>등록자: <strong>황성현</strong></span>
                {editTarget && <span style={m.metaItem}>등록일시: {formatDate(editTarget.REG_DATE ?? editTarget.reg_date)}</span>}
              </div>
              {saveErr && (
                <div style={m.saveErrBox}>
                  <pre style={{ margin: 0, fontFamily: "'Pretendard', sans-serif", whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: "1.6" }}>
                    {saveErr}
                  </pre>
                </div>
              )}
            </div>
            <div style={m.footer}>
              <button style={m.cancelBtn} onClick={() => setModalOpen(false)}>취소</button>
              <button style={m.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : (editTarget ? "수정 완료" : "등록")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {detailItem && (
        <div style={m.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDetailItem(null); }}>
          <div style={m.modal}>
            <div style={m.header}>
              <span style={m.title}>공지 상세</span>
              <button style={m.closeBtn} onClick={() => setDetailItem(null)}>✕</button>
            </div>
            <div style={m.body}>
              <div style={d.titleBox}>{detailItem.TITLE ?? detailItem.title}</div>
              <div style={d.metaRow}>
                <span style={d.metaChip}>등록자: {detailItem.REG_NM ?? detailItem.reg_nm}</span>
                <span style={d.metaChip}>등록일시: {formatDate(detailItem.REG_DATE ?? detailItem.reg_date)}</span>
              </div>
              <div style={d.contentBox}>
                {(detailItem.CONTENT ?? detailItem.content ?? "").split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 6px 0" }}>{line || <br />}</p>
                ))}
              </div>
            </div>
            <div style={m.footer}>
              <button style={m.cancelBtn} onClick={() => setDetailItem(null)}>닫기</button>
              <button style={m.saveBtn} onClick={() => { setDetailItem(null); openEdit(detailItem); }}>수정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 스타일 ── */
const p = {
  wrap: { fontFamily: "'Pretendard', sans-serif" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" },
  pageTitle: { margin: 0, fontSize: "18px", fontWeight: "700", color: "#1E293B" },
  addBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#3A3A3A", border: "none",
    borderRadius: "6px", padding: "8px 16px", cursor: "pointer",
  },
  loadingMsg: { textAlign: "center", fontSize: "14px", color: "#94A3B8", padding: "40px 0" },
  emptyBox: {
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px",
    padding: "60px 28px", textAlign: "center",
  },
  emptyText: { fontSize: "14px", color: "#94A3B8" },

  /* 데스크탑 테이블 */
  tableWrap: {
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8",
    borderRadius: "8px", overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: "'Pretendard', sans-serif" },
  th: {
    fontSize: "12px", fontWeight: "600", color: "#64748B",
    backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
    padding: "11px 14px", textAlign: "left", whiteSpace: "nowrap",
  },
  td: {
    fontSize: "13px", color: "#2F2F2F", padding: "12px 14px",
    borderBottom: "1px solid #F1F5F9",
  },
  tr: {},

  /* 모바일 카드 */
  mobileCard: {
    backgroundColor: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: "8px",
    padding: "14px 16px",
  },
  mobileCardTop: { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" },
  mobileCardNo: { fontSize: "11px", color: "#94A3B8", flexShrink: 0, paddingTop: "2px" },
  mobileCardTitle: { fontSize: "14px", fontWeight: "600", color: "#1E293B", cursor: "pointer", lineHeight: "1.4" },
  mobileCardMeta: { fontSize: "11px", color: "#64748B", display: "flex", gap: "6px", marginBottom: "10px" },
  mobileCardActions: { display: "flex", gap: "8px" },

  /* 버튼 */
  editBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "12px", fontWeight: "500",
    color: "#2563EB", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE",
    borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
  },
  delBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "12px", fontWeight: "500",
    color: "#DC2626", backgroundColor: "#FFF5F5", border: "1px solid #FCA5A5",
    borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
  },
};

const m = {
  overlay: {
    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.40)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    backgroundColor: "#FFFFFF", borderRadius: "10px",
    width: "90%", maxWidth: "560px", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 22px", borderBottom: "1px solid #E8E8E8", flexShrink: 0,
  },
  title: { fontSize: "16px", fontWeight: "700", color: "#1E293B" },
  closeBtn: {
    background: "none", border: "none", fontSize: "18px",
    color: "#94A3B8", cursor: "pointer", padding: "2px",
  },
  body: { padding: "20px 22px", overflowY: "auto", flex: 1 },
  fieldWrap: { marginBottom: "16px" },
  label: {
    display: "block", fontSize: "13px", fontWeight: "600",
    color: "#374151", marginBottom: "6px",
  },
  input: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", color: "#1E293B",
    border: "1px solid #D9D9D9", borderRadius: "6px",
    padding: "9px 12px", width: "100%", boxSizing: "border-box", outline: "none",
  },
  textarea: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "14px", color: "#1E293B",
    border: "1px solid #D9D9D9", borderRadius: "6px",
    padding: "9px 12px", width: "100%", boxSizing: "border-box",
    outline: "none", resize: "vertical", lineHeight: "1.6",
  },
  inputErr: { borderColor: "#DC2626" },
  errMsg: { fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" },
  metaRow: { display: "flex", gap: "16px", marginTop: "4px" },
  metaItem: { fontSize: "12px", color: "#94A3B8" },
  footer: {
    display: "flex", justifyContent: "flex-end", gap: "8px",
    padding: "14px 22px", borderTop: "1px solid #E8E8E8", flexShrink: 0,
  },
  cancelBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", color: "#5A5A5A",
    backgroundColor: "#FFFFFF", border: "1px solid #D9D9D9",
    borderRadius: "6px", padding: "8px 18px", cursor: "pointer",
  },
  saveBtn: {
    fontFamily: "'Pretendard', sans-serif", fontSize: "13px", fontWeight: "600",
    color: "#FFFFFF", backgroundColor: "#3A3A3A",
    border: "none", borderRadius: "6px", padding: "8px 20px", cursor: "pointer",
  },
  saveErrBox: {
    marginTop: "12px", padding: "12px 14px",
    backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5",
    borderRadius: "6px", color: "#DC2626",
  },
};

const d = {
  titleBox: {
    fontSize: "16px", fontWeight: "700", color: "#1E293B",
    padding: "12px 16px", backgroundColor: "#F8FAFC",
    borderRadius: "6px", marginBottom: "12px", lineHeight: "1.5",
  },
  metaRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" },
  metaChip: {
    fontSize: "12px", color: "#64748B", backgroundColor: "#F1F5F9",
    borderRadius: "4px", padding: "3px 8px",
  },
  contentBox: {
    fontSize: "14px", color: "#374151", lineHeight: "1.7",
    backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8",
    borderRadius: "6px", padding: "14px 16px", minHeight: "100px",
    whiteSpace: "pre-wrap",
  },
};
