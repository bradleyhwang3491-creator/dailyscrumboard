import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * App 컴포넌트
 * AuthProvider로 전체 앱을 감싸 Supabase 세션을 전역 상태로 공유합니다.
 *
 * - /           → /login으로 리다이렉트
 * - /login      → 로그인 화면
 * - /main       → 메인 화면 (로그인 필요)
 */
function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 루트 접근 시 로그인 화면으로 이동 */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 로그인 화면 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 메인 화면 (인증 필요) */}
          <Route
            path="/main"
            element={
              <ProtectedRoute>
                <MainPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
