/**
 * AuthContext
 * localStorage 기반 세션을 전역 상태로 관리합니다.
 * setUser를 외부에 노출해 로그인 성공 시 즉시 상태를 갱신할 수 있습니다.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { getSessionUser } from "../utils/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 초기 localStorage 확인 전까지 로딩 상태 유지 (화면 깜빡임 방지)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 기존 세션 확인
    setUser(getSessionUser());
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/** AuthContext를 소비하는 커스텀 훅 */
export function useAuth() {
  return useContext(AuthContext);
}
