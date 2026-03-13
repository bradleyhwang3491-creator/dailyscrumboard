import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginForm from "../components/LoginForm";

/**
 * LoginPage
 * /login 경로에 해당하는 페이지입니다.
 * 로그인 성공 시 AuthContext의 user 상태를 즉시 갱신하고 /main으로 이동합니다.
 */
function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  function handleLoginSuccess(sessionUser) {
    setUser(sessionUser);
    navigate("/main", { replace: true });
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    boxShadow: "0 2px 16px rgba(0, 0, 0, 0.08)",
    padding: "44px 40px 40px",
  },
};

export default LoginPage;
