/**
 * 인증 유틸리티 (커스텀 테이블 기반)
 * Supabase Auth 대신 SCRUMBOARD_USER / DEPARTMENT 테이블을 직접 조회합니다.
 * 세션은 localStorage로 관리합니다.
 */
import { supabase } from "../lib/supabase";

const SESSION_KEY = "scrumboard_session";

/**
 * 아이디/비밀번호로 로그인합니다.
 * SCRUMBOARD_USER 테이블에서 ID + USER_PWD 일치 여부를 확인하고,
 * DEPARTMENT 테이블에서 DEPT_NM을 조회해 세션에 저장합니다.
 *
 * @param {string} id
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: SessionUser, error?: string }>}
 */
export async function login(id, password) {
  // 1. 사용자 조회
  const { data: userRow, error } = await supabase
    .from("SCRUMBOARD_USER")
    .select("ID, NAME, DEPT_CD")
    .eq("ID", id)
    .eq("USER_PWD", password)
    .single();

  if (error || !userRow) {
    return { success: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  // 2. 부서명 조회
  let deptNm = "";
  if (userRow.DEPT_CD) {
    const { data: deptRow } = await supabase
      .from("DEPARTMENT")
      .select("DEPT_NM")
      .eq("DEPT_CD", userRow.DEPT_CD)
      .single();
    deptNm = deptRow?.DEPT_NM ?? "";
  }

  // 3. 세션 저장 (비밀번호 제외)
  const sessionUser = {
    id: userRow.ID,
    name: userRow.NAME,
    deptCd: userRow.DEPT_CD,
    deptNm,
    isLoggedIn: true,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

/**
 * localStorage에서 현재 세션 사용자를 가져옵니다.
 * @returns {SessionUser | null}
 */
export function getSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.isLoggedIn ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 로그아웃: localStorage 세션을 삭제합니다.
 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
