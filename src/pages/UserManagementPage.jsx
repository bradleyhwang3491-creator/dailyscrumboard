import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useLanguage } from "../context/LanguageContext";

/** 사용자 정보 관리 페이지 */
function UserManagementPage() {
  const { t } = useLanguage();
  const isMobile = useBreakpoint(768);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 조회 조건
  const [searchDept, setSearchDept] = useState("");
  const [searchName, setSearchName] = useState("");

  // 등록 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ deptCd: "", id: "", name: "", password: "" });
  const [formErrors, setFormErrors] = useState({});
  const [idStatus, setIdStatus] = useState(null); // null | "available" | "taken"
  const [idChecking, setIdChecking] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  // 수정 모달
  const [editTarget, setEditTarget] = useState(null); // 수정 대상 user 객체
  const [editForm, setEditForm] = useState({ name: "", password: "" });
  const [editErrors, setEditErrors] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, []);

  /** DEPARTMENT 테이블 전체 조회 */
  async function fetchDepartments() {
    const { data } = await supabase
      .from("DEPARTMENT")
      .select("DEPT_CD, DEPT_NM")
      .order("DEPT_NM");
    if (data) setDepartments(data);
  }

  /** SCRUMBOARD_USER 조회 (조건 필터 포함) */
  async function fetchUsers(deptCd = "", name = "") {
    setLoading(true);
    let query = supabase
      .from("SCRUMBOARD_USER")
      .select("ID, NAME, DEPT_CD")
      .order("NAME");
    if (deptCd) query = query.eq("DEPT_CD", deptCd);
    if (name.trim()) query = query.ilike("NAME", `%${name.trim()}%`);
    const { data } = await query;
    if (data) setUsers(data);
    setLoading(false);
  }

  /** 부서코드 → 부서명 변환 */
  function getDeptNm(deptCd) {
    return departments.find((d) => d.DEPT_CD === deptCd)?.DEPT_NM ?? deptCd;
  }

  /** 조회 버튼 */
  function handleSearch() {
    fetchUsers(searchDept, searchName);
  }

  /** 아이디 중복 확인 */
  async function handleCheckId() {
    if (!form.id.trim()) {
      setFormErrors((prev) => ({ ...prev, id: t("userMgmt.registerModal.required") }));
      return;
    }
    setIdChecking(true);
    const { data } = await supabase
      .from("SCRUMBOARD_USER")
      .select("ID")
      .eq("ID", form.id.trim())
      .single();
    setIdChecking(false);
    if (data) {
      setIdStatus("taken");
    } else {
      setIdStatus("available");
    }
    setFormErrors((prev) => ({ ...prev, id: undefined }));
  }

  /** 등록 폼 유효성 검사 */
  function validateForm() {
    const errors = {};
    if (!form.deptCd) errors.deptCd = t("userMgmt.registerModal.required");
    if (!form.id.trim()) errors.id = t("userMgmt.registerModal.required");
    else if (idStatus !== "available") errors.id = t("userMgmt.registerModal.required");
    if (!form.name.trim()) errors.name = t("userMgmt.registerModal.required");
    if (!form.password.trim()) errors.password = t("userMgmt.registerModal.required");
    return errors;
  }

  /** 사용자 등록 */
  async function handleRegister() {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setRegisterLoading(true);
    const { error } = await supabase.from("SCRUMBOARD_USER").insert({
      ID: form.id.trim(),
      NAME: form.name.trim(),
      DEPT_CD: form.deptCd,
      USER_PWD: form.password,
    });
    setRegisterLoading(false);
    if (error) {
      setFormErrors({ submit: t("userMgmt.registerModal.errRegister") + error.message });
      return;
    }
    closeModal();
    fetchUsers(searchDept, searchName);
  }

  /** 등록 모달 닫기 및 초기화 */
  function closeModal() {
    setIsModalOpen(false);
    setForm({ deptCd: "", id: "", name: "", password: "" });
    setFormErrors({});
    setIdStatus(null);
  }

  /** 수정 모달 열기 */
  function openEditModal(user) {
    setEditTarget(user);
    setEditForm({ name: user.NAME, password: "" });
    setEditErrors({});
  }

  /** 수정 모달 닫기 */
  function closeEditModal() {
    setEditTarget(null);
    setEditForm({ name: "", password: "" });
    setEditErrors({});
  }

  /** 사용자 수정 */
  async function handleUpdate() {
    const errors = {};
    if (!editForm.name.trim()) errors.name = t("userMgmt.registerModal.required");
    if (!editForm.password.trim()) errors.password = t("userMgmt.registerModal.required");
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditLoading(true);
    const { error } = await supabase
      .from("SCRUMBOARD_USER")
      .update({ NAME: editForm.name.trim(), USER_PWD: editForm.password })
      .eq("ID", editTarget.ID);
    setEditLoading(false);
    if (error) {
      setEditErrors({ submit: t("userMgmt.editModal.errEdit") + error.message });
      return;
    }
    closeEditModal();
    fetchUsers(searchDept, searchName);
  }

  return (
    <div style={s.wrap}>
      {/* 타이틀 + 등록 버튼 */}
      <div style={s.topBar}>
        <h2 style={s.pageTitle}>{t("userMgmt.title")}</h2>
        <button style={s.registerBtn} onClick={() => setIsModalOpen(true)}>
          {t("userMgmt.addBtn")}
        </button>
      </div>

      {/* 조회 조건 */}
      <div style={{ ...s.searchBar, ...(isMobile ? s.searchBarMobile : {}) }}>
        <div style={isMobile ? s.searchFieldMobile : s.searchField}>
          <label style={s.label}>{t("userMgmt.deptLabel")}</label>
          <select
            style={isMobile ? s.selectFull : s.select}
            value={searchDept}
            onChange={(e) => setSearchDept(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {departments.map((d) => (
              <option key={d.DEPT_CD} value={d.DEPT_CD}>{d.DEPT_NM}</option>
            ))}
          </select>
        </div>
        <div style={isMobile ? s.searchFieldMobile : s.searchField}>
          <label style={s.label}>{t("userMgmt.nameLabel")}</label>
          <input
            style={isMobile ? s.inputFull : s.input}
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t("userMgmt.namePlaceholder")}
          />
        </div>
        <button style={isMobile ? s.searchBtnFull : s.searchBtn} onClick={handleSearch}>{t("userMgmt.searchBtn")}</button>
      </div>

      {/* 데이터 테이블 */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t("userMgmt.table.dept")}</th>
              <th style={s.th}>{t("userMgmt.table.name")}</th>
              <th style={s.th}>{t("userMgmt.table.id")}</th>
              <th style={{ ...s.th, width: "80px", textAlign: "center" }}>{t("userMgmt.table.manage")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={s.emptyCell}>{t("userMgmt.table.loading")}</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} style={s.emptyCell}>{t("userMgmt.table.noData")}</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.ID} style={s.tr}>
                  <td style={s.td}>{getDeptNm(u.DEPT_CD)}</td>
                  <td style={s.td}>{u.NAME}</td>
                  <td style={s.td}>{u.ID}</td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <button style={s.editBtn} onClick={() => openEditModal(u)}>{t("userMgmt.editBtn")}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {isModalOpen && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{t("userMgmt.registerModal.title")}</span>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>

            <div style={s.modalBody}>
              {/* 부서 */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.registerModal.dept")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <select
                    style={{ ...s.select, width: "100%" }}
                    value={form.deptCd}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, deptCd: e.target.value }));
                      setFormErrors((p) => ({ ...p, deptCd: undefined }));
                    }}
                  >
                    <option value="">{t("userMgmt.registerModal.deptSelect")}</option>
                    {departments.map((d) => (
                      <option key={d.DEPT_CD} value={d.DEPT_CD}>{d.DEPT_NM}</option>
                    ))}
                  </select>
                  {formErrors.deptCd && <p style={s.fieldErr}>{formErrors.deptCd}</p>}
                </div>
              </div>

              {/* 아이디 + 중복확인 */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.registerModal.id")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <div style={s.idRow}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      type="text"
                      value={form.id}
                      placeholder={t("userMgmt.registerModal.idInput")}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, id: e.target.value }));
                        setIdStatus(null);
                        setFormErrors((p) => ({ ...p, id: undefined }));
                      }}
                    />
                    <button
                      style={s.checkBtn}
                      onClick={handleCheckId}
                      disabled={idChecking}
                    >
                      {idChecking ? t("userMgmt.registerModal.checking") : t("userMgmt.registerModal.checkDuplicate")}
                    </button>
                  </div>
                  {idStatus === "available" && (
                    <p style={s.idAvailable}>{t("userMgmt.registerModal.idAvailable")}</p>
                  )}
                  {idStatus === "taken" && (
                    <p style={s.idTaken}>{t("userMgmt.registerModal.idTaken")}</p>
                  )}
                  {formErrors.id && <p style={s.fieldErr}>{formErrors.id}</p>}
                </div>
              </div>

              {/* 이름 */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.registerModal.name")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box" }}
                    type="text"
                    value={form.name}
                    placeholder={t("userMgmt.registerModal.name")}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, name: e.target.value }));
                      setFormErrors((p) => ({ ...p, name: undefined }));
                    }}
                  />
                  {formErrors.name && <p style={s.fieldErr}>{formErrors.name}</p>}
                </div>
              </div>

              {/* 비밀번호 */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.registerModal.pw")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box" }}
                    type="password"
                    value={form.password}
                    placeholder={t("userMgmt.registerModal.pw")}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, password: e.target.value }));
                      setFormErrors((p) => ({ ...p, password: undefined }));
                    }}
                  />
                  {formErrors.password && <p style={s.fieldErr}>{formErrors.password}</p>}
                </div>
              </div>

              {formErrors.submit && <p style={s.fieldErr}>{formErrors.submit}</p>}
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={closeModal}>{t("common.close")}</button>
              <button
                style={s.submitBtn}
                onClick={handleRegister}
                disabled={registerLoading}
              >
                {registerLoading ? t("common.registering") : t("common.register")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 수정 모달 */}
      {editTarget && (
        <div style={s.overlay} onClick={closeEditModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{t("userMgmt.editModal.title")}</span>
              <button style={s.closeBtn} onClick={closeEditModal}>✕</button>
            </div>

            <div style={s.modalBody}>
              {/* 부서 (읽기 전용) */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.table.dept")}</label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box", backgroundColor: "#F5F5F5", color: "#888" }}
                    type="text"
                    value={getDeptNm(editTarget.DEPT_CD)}
                    readOnly
                  />
                </div>
              </div>

              {/* 아이디 (읽기 전용) */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.table.id")}</label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box", backgroundColor: "#F5F5F5", color: "#888" }}
                    type="text"
                    value={editTarget.ID}
                    readOnly
                  />
                </div>
              </div>

              {/* 이름 (수정 가능) */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.editModal.name")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box" }}
                    type="text"
                    value={editForm.name}
                    placeholder={t("userMgmt.editModal.name")}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, name: e.target.value }));
                      setEditErrors((p) => ({ ...p, name: undefined }));
                    }}
                  />
                  {editErrors.name && <p style={s.fieldErr}>{editErrors.name}</p>}
                </div>
              </div>

              {/* 비밀번호 (수정 가능) */}
              <div style={s.formRow}>
                <label style={s.formLabel}>{t("userMgmt.editModal.pw")} <span style={s.required}>*</span></label>
                <div style={s.formControl}>
                  <input
                    style={{ ...s.input, width: "100%", boxSizing: "border-box" }}
                    type="password"
                    value={editForm.password}
                    placeholder={t("userMgmt.editModal.pw")}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, password: e.target.value }));
                      setEditErrors((p) => ({ ...p, password: undefined }));
                    }}
                  />
                  {editErrors.password && <p style={s.fieldErr}>{editErrors.password}</p>}
                </div>
              </div>

              {editErrors.submit && <p style={s.fieldErr}>{editErrors.submit}</p>}
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={closeEditModal}>{t("common.close")}</button>
              <button style={s.submitBtn} onClick={handleUpdate} disabled={editLoading}>
                {editLoading ? t("userMgmt.editModal.saving") : t("userMgmt.editModal.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { fontFamily: "'Pretendard', sans-serif" },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  pageTitle: {
    fontSize: "17px",
    fontWeight: "600",
    color: "#2F2F2F",
    margin: 0,
  },
  registerBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    color: "#FFFFFF",
    backgroundColor: "#3A3A3A",
    border: "none",
    borderRadius: "5px",
    padding: "8px 16px",
    cursor: "pointer",
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E8E8",
    borderRadius: "8px",
    padding: "16px 20px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  searchBarMobile: { flexDirection: "column", alignItems: "stretch", gap: "8px", padding: "14px 16px" },
  searchField: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  searchFieldMobile: { display: "flex", flexDirection: "column", gap: "4px" },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#5A5A5A",
    whiteSpace: "nowrap",
  },
  select: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "7px 10px",
    outline: "none",
    minWidth: "140px",
    cursor: "pointer",
  },
  selectFull: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "8px 10px",
    outline: "none",
    width: "100%",
    cursor: "pointer",
  },
  input: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "7px 10px",
    outline: "none",
  },
  inputFull: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#2F2F2F",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "8px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  searchBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    color: "#FFFFFF",
    backgroundColor: "#3A3A3A",
    border: "none",
    borderRadius: "5px",
    padding: "7px 20px",
    cursor: "pointer",
  },
  searchBtnFull: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    color: "#FFFFFF",
    backgroundColor: "#3A3A3A",
    border: "none",
    borderRadius: "5px",
    padding: "9px 20px",
    cursor: "pointer",
    width: "100%",
  },
  tableWrap: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E8E8",
    borderRadius: "8px",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "600",
    color: "#5A5A5A",
    backgroundColor: "#F9F9F9",
    borderBottom: "1px solid #E8E8E8",
    padding: "12px 16px",
    textAlign: "left",
  },
  tr: { borderBottom: "1px solid #F0F0F0" },
  td: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "14px",
    color: "#2F2F2F",
    padding: "12px 16px",
  },
  editBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "12px",
    fontWeight: "500",
    color: "#3A3A3A",
    backgroundColor: "#FFFFFF",
    border: "1px solid #D9D9D9",
    borderRadius: "4px",
    padding: "4px 12px",
    cursor: "pointer",
  },
  emptyCell: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "14px",
    color: "#AAAAAA",
    padding: "40px",
    textAlign: "center",
  },
  // 모달
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    width: "460px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px 16px",
    borderBottom: "1px solid #E8E8E8",
  },
  modalTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#2F2F2F",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "16px",
    color: "#AAAAAA",
    cursor: "pointer",
    padding: "2px 6px",
  },
  modalBody: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  formRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  formLabel: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#5A5A5A",
    whiteSpace: "nowrap",
    paddingTop: "8px",
    width: "64px",
    flexShrink: 0,
  },
  formControl: {
    flex: 1,
  },
  idRow: {
    display: "flex",
    gap: "8px",
  },
  checkBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "12px",
    fontWeight: "500",
    color: "#3A3A3A",
    backgroundColor: "#FFFFFF",
    border: "1px solid #3A3A3A",
    borderRadius: "5px",
    padding: "7px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  idAvailable: {
    fontSize: "12px",
    color: "#2A8A2A",
    margin: "4px 0 0",
  },
  idTaken: {
    fontSize: "12px",
    color: "#D14343",
    margin: "4px 0 0",
  },
  fieldErr: {
    fontSize: "12px",
    color: "#D14343",
    margin: "4px 0 0",
  },
  required: {
    color: "#D14343",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "16px 24px 20px",
    borderTop: "1px solid #E8E8E8",
  },
  cancelBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "400",
    color: "#5A5A5A",
    backgroundColor: "#FFFFFF",
    border: "1px solid #D9D9D9",
    borderRadius: "5px",
    padding: "8px 20px",
    cursor: "pointer",
  },
  submitBtn: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    color: "#FFFFFF",
    backgroundColor: "#3A3A3A",
    border: "none",
    borderRadius: "5px",
    padding: "8px 20px",
    cursor: "pointer",
  },
};

export default UserManagementPage;
