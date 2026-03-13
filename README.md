# Daily Scrum Board (데일리 스크럼보드)

스크럼 미팅 업무 관리 시스템 — React + Vite + Supabase 기반의 칸반 보드 애플리케이션입니다.

## 주요 기능

- **로그인 / 로그아웃** — Supabase 커스텀 테이블 기반 인증
- **데일리 스크럼보드** — 칸반 보드 형태의 업무 현황판
  - 카드 드래그 & 드롭으로 상태 변경 (Supabase 실시간 반영)
  - 업무 상세 팝업 (등록 / 수정 / 삭제)
  - 이슈 해결 기능 (`ISSUE_COMPLETE_YN` 업데이트)
  - 텍스트 복사 버튼 (메모장 붙여넣기 가능한 형식)
- **AI Weekly Report** — Google Gemini API 활용
  - 조회 조건(기간 / 업무구분 / 등록자)으로 데이터 필터링
  - 일반 리포트 + 보고서 형식 리포트 동시 생성 (탭 UI)
  - Gemini 모델 자동 폴백 체인

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 18, React Router v6, Vite 5 |
| Backend | Supabase (PostgreSQL) |
| AI | Google Gemini API (gemini-2.5-flash) |
| 폰트 | Pretendard (CDN) |

---

## 로컬 실행 방법

### 1. 저장소 클론

```bash
git clone https://github.com/bradleyhwang3491-creator/dailyscrumboard.git
cd dailyscrumboard
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 실제 값을 입력합니다.

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채워넣으세요:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 빌드 방법

```bash
npm run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다.

로컬에서 빌드 결과 미리보기:

```bash
npm run preview
```

---

## Vercel 배포 방법

### 사전 준비

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 로그인
2. **New Project** → 이 저장소 선택 → Import

### Vercel 프로젝트 설정

| 항목 | 값 |
|------|-----|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### Vercel 환경변수 등록

**Settings → Environment Variables** 에서 아래 3개를 모두 등록하세요:

| 변수명 | 값 출처 |
|--------|---------|
| `VITE_SUPABASE_URL` | Supabase 대시보드 > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 대시보드 > Settings > API > anon public |
| `VITE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |

> ⚠️ **중요**: `VITE_` 접두사가 반드시 있어야 Vite 빌드 시 클라이언트에서 접근 가능합니다.

### 배포 후 확인 포인트

- [ ] 배포 URL로 접속 시 로그인 화면이 표시되는가
- [ ] `/login` URL 직접 접속 시 404가 아닌 로그인 화면이 표시되는가
- [ ] `/main` URL 직접 접속 시 로그인 화면으로 리다이렉트 되는가
- [ ] 로그인 후 칸반 보드가 정상 로드되는가 (Supabase 연결 확인)
- [ ] AI Weekly Report 탭에서 리포트 생성이 되는가 (Gemini API 연결 확인)
- [ ] 브라우저 새로고침 시 화면이 유지되는가

---

## Supabase 테이블 구조

### SCRUMBOARD_USER (사용자 테이블)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | TEXT | 사용자 ID (PK) |
| USER_PWD | TEXT | 비밀번호 |
| NAME | TEXT | 이름 |
| DEPT_CD | TEXT | 부서 코드 |

### DEPARTMENT (부서 테이블)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| DEPT_CD | TEXT | 부서 코드 (PK) |
| DEPT_NM | TEXT | 부서명 |

### TASK_BOARD (업무 보드 테이블)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| BOARD_ID | TEXT | 업무 ID (PK) |
| STATUS | TEXT | 상태 (TODO / IN_PROGRESS / DONE 등) |
| TITLE | TEXT | 제목 |
| CONTENT | TEXT | 작업 내용 |
| ISSUE | TEXT | 이슈 사항 |
| ISSUE_COMPLETE_YN | TEXT | 이슈 해결 여부 (Y/N) |
| TASK_TYPE1_CD | TEXT | 업무 구분 코드 |
| REG_USER_ID | TEXT | 등록자 ID |
| REG_DT | TIMESTAMP | 등록일시 |

---

## 보안 주의사항

- `.env` 파일은 절대 GitHub에 올리지 마세요 (`.gitignore`에 포함됨)
- API 키가 노출된 경우 즉시 재발급하세요
  - Supabase: 대시보드 > Settings > API > Rotate
  - Gemini: [Google AI Studio](https://aistudio.google.com/apikey) > Delete & Create new

## 라이선스

MIT
