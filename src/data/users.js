/**
 * Mock 사용자 데이터
 * 추후 실제 API 연동 시 이 파일 대신 auth.js의 login() 함수 내부만 교체하면 됩니다.
 *
 * @type {Array<{id: string, password: string, teamName: string, name: string}>}
 */
export const users = [
  {
    id: "hong01",
    password: "1234",
    teamName: "플랫폼팀",
    name: "홍길동",
  },
  {
    id: "kim02",
    password: "1111",
    teamName: "개발1팀",
    name: "김민수",
  },
  {
    id: "lee03",
    password: "2222",
    teamName: "기획팀",
    name: "이지은",
  },
];
