import { useState } from "react";
import { login } from "../utils/auth";
import { useLanguage } from "../context/LanguageContext";

function LoginForm({ onLoginSuccess }) {
  const { t } = useLanguage();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  function validate() {
    const newErrors = {};
    if (!id.trim())       newErrors.id       = t("login.idRequired");
    if (!password.trim()) newErrors.password = t("login.pwRequired");
    return newErrors;
  }

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
      <h1 style={styles.title}>{t("login.title").replace(",", ",\n")}</h1>

      <div style={styles.fieldGroup}>
        <input
          type="text"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setErrors((prev) => ({ ...prev, id: undefined, auth: undefined }));
          }}
          placeholder={t("login.idPlaceholder")}
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

      <div style={styles.fieldGroup}>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined, auth: undefined }));
          }}
          placeholder={t("login.pwPlaceholder")}
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

      {errors.auth && <p style={styles.authErrorMsg}>{errors.auth}</p>}

      <button type="submit" disabled={isLoading} style={styles.button}>
        {isLoading ? t("login.loading") : t("login.button")}
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
    whiteSpace: "pre-line",
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
  inputError:    { borderColor: "#D14343" },
  inputDisabled: { backgroundColor: "#F5F5F5", cursor: "not-allowed" },
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
