import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute 컴포넌트
 * Supabase 세션 로딩이 끝난 뒤 인증 여부를 확인합니다.
 * - 로딩 중: 빈 화면 유지 (화면 깜빡임 방지)
 * - 미인증: /login으로 리다이렉트
 * - 인증됨: children 렌더링
 *
 * @param {{ children: React.ReactNode }} props
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // 초기 세션 확인이 끝나기 전에는 아무것도 렌더링하지 않음
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
