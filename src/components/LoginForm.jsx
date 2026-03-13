import { useState } from "react";
import { login } from "../utils/auth";

/**
 * LoginForm 컴포넌트
 * 아이디/비밀번호 입력, 유효성 검사, SCRUMBOARD_USER 테이블 인증 처리를 담당합니다.
 *
 * @param {{ onLoginSuccess: (user: object) => void }} props
 */
function LoginForm({ onLoginSuccess }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  /** 필드 단위 유효성 검사 */
  function validate() {
    const newErrors = {};
    if (!id.trim()) newErrors.id = "아이디를 입력해주세요.";
    if (!password.trim()) newErrors.password = "비밀번호를 입력해주세요.";
    return newErrors;
  }

  /** 로그인 버튼 클릭 또는 엔터 키 제출 */
  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    const result = await login(id, password);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess(result.user);
    } else {
      setErrors({ auth: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={styles.form}>
      {/* 서비스명 */}
      <h1 style={styles.title}>SCRUM MEETING,<br />WORK TOGETHER</h1>

      {/* 아이디 입력 */}
      <div style={styles.fieldGroup}>
        <input
          type="text"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setErrors((prev) => ({ ...prev, id: undefined, auth: undefined }));
          }}
          placeholder="아이디를 입력하세요"
          autoComplete="username"
          disabled={isLoading}
          style={{
            ...styles.input,
            ...(errors.id ? styles.inputError : {}),
            ...(isLoading ? styles.inputDisabled : {}),
          }}
        />
        {errors.id && <p style={styles.fieldErrorMsg}>{errors.id}</p>}
      </div>

      {/* 비밀번호 입력 */}
      <div style={styles.fieldGroup}>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined, auth: undefined }));
          }}
          placeholder="비밀번호를 입력하세요"
          autoComplete="current-password"
          disabled={isLoading}
          style={{
            ...styles.input,
            ...(errors.password ? styles.inputError : {}),
            ...(isLoading ? styles.inputDisabled : {}),
          }}
        />
        {errors.password && <p style={styles.fieldErrorMsg}>{errors.password}</p>}
      </div>

      {/* 인증 실패 공통 오류 메시지 */}
      {errors.auth && <p style={styles.authErrorMsg}>{errors.auth}</p>}

      {/* 로그인 버튼 */}
      <button type="submit" disabled={isLoading} style={styles.button}>
        {isLoading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
  },
  title: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "22px",
    fontWeight: "700",
    color: "#2F2F2F",
    textAlign: "center",
    marginBottom: "32px",
    lineHeight: "1.5",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "12px",
  },
  input: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "15px",
    fontWeight: "400",
    color: "#2F2F2F",
    backgroundColor: "#FFFFFF",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#D9D9D9",
    borderRadius: "6px",
    padding: "12px 14px",
    outline: "none",
    transition: "border-color 0.15s",
  },
  inputError: {
    borderColor: "#D14343",
  },
  inputDisabled: {
    backgroundColor: "#F5F5F5",
    cursor: "not-allowed",
  },
  fieldErrorMsg: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#D14343",
    marginTop: "5px",
    marginBottom: "0px",
  },
  authErrorMsg: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "13px",
    color: "#D14343",
    textAlign: "center",
    margin: "4px 0 12px",
  },
  button: {
    fontFamily: "'Pretendard', sans-serif",
    fontSize: "15px",
    fontWeight: "500",
    color: "#FFFFFF",
    backgroundColor: "#3A3A3A",
    border: "none",
    borderRadius: "6px",
    padding: "13px",
    marginTop: "8px",
    cursor: "pointer",
    transition: "background-color 0.15s, opacity 0.15s",
  },
};

export default LoginForm;
