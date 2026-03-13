/**
 * useBreakpoint 훅
 * window 너비가 지정한 maxWidth 이하일 때 true를 반환합니다.
 * resize 이벤트를 구독해 실시간으로 업데이트됩니다.
 *
 * @param {number} maxWidth - 모바일 기준 너비 (기본값: 768)
 * @returns {boolean} isMobile
 */
import { useState, useEffect } from "react";

export function useBreakpoint(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth <= maxWidth
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [maxWidth]);

  return isMobile;
}
