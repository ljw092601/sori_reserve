# 소리 동아리방 예약 사이트 — 개발 플랜

## 1. 개요

밴드 동아리에서 팀별로 동아리방 사용 시간이 겹치는 문제를 해결하기 위한 예약 사이트.

- 각 팀이 **원하는 날짜/시간을 직접 입력**해서 동아리방을 예약한다.
- 모든 팀의 예약 현황을 **한 화면에서 다같이 볼 수 있다**.
- 겹치는 시간대는 예약이 불가능하도록 서버에서 검증한다.

## 2. 기술 스택

| 구분 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js (App Router, TypeScript) | 프론트+API를 한 프로젝트로 |
| DB / 백엔드 | Supabase (PostgreSQL) | 무료 플랜, 별도 서버 불필요 |
| 스타일 | Tailwind CSS | 빠른 UI 작업 |
| 배포 | Vercel | 무료, Next.js와 궁합 최고 |

## 3. 인증 방식 — 네이버 로그인

**Auth.js(NextAuth) v5 + 네이버 OAuth 프로바이더** 사용. (Supabase Auth는 네이버를 지원하지 않아 Auth.js 채택)

1. 헤더의 "네이버 로그인" 버튼으로 로그인 (세션은 JWT 쿠키, DB 저장 없음)
2. 예약 생성/취소는 로그인 필수, **조회는 누구나 가능** (공유 목적이므로)
3. 예약에 네이버 사용자 ID(`created_by`)와 이름을 기록 → **본인이 만든 예약만 취소 가능**
4. 예약 시 팀은 드롭다운으로 선택 (팀 소속 관리는 하지 않음 — 필요해지면 Phase 2)

준비물: [네이버 개발자 센터](https://developers.naver.com)에서 애플리케이션 등록
- 사용 API: 네이버 로그인 (권한: 이름/닉네임)
- 콜백 URL: `http://localhost:3000/api/auth/callback/naver` + `https://sorireserve.vercel.app/api/auth/callback/naver`
- 발급받은 Client ID/Secret을 `.env.local`의 `AUTH_NAVER_ID` / `AUTH_NAVER_SECRET`에 저장

팀 등록/삭제는 관리자(운영진)가 Supabase 대시보드에서 처리.

## 4. 데이터 모델

### teams (팀 = 팀원 모집글)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| name | text | **곡 제목** (시간표/예약 드롭다운에 그대로 표시, 중복 허용) |
| color | text | 캘린더 표시 색상 (팔레트에서 자동 배정) |
| status | text | `recruiting`(모집중) / `closed`(모집완료) |
| members | jsonb | 팀원 목록 `[{session, name}]` — name이 비면 그 세션은 모집중 |
| content | text (nullable) | 모집 글 본문 |
| created_by | text (nullable) | 작성자 네이버 ID (null = 운영진 등록) |
| created_by_name | text (nullable) | 표시용 작성자 이름 |
| created_at | timestamptz | |

### comments (모집글 댓글)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| team_id | uuid (FK → teams, cascade) | |
| content | text | 댓글 내용 |
| created_by | text | 작성자 네이버 ID (본인만 삭제 가능) |
| created_by_name | text | 표시용 작성자 이름 |
| created_at | timestamptz | |

팀 모집 게시판(`/teams`)에 곡 제목으로 모집글을 올리면 예약 페이지 드롭다운에 바로 나타난다. 댓글로 지원을 받고, 모집이 끝나면 상태를 '모집완료'로 바꾼다. 글 수정은 로그인한 누구나 가능, 삭제만 작성자 본인 제한 (삭제 시 그 팀의 예약·댓글도 함께 삭제 — FK cascade).

### reservations (예약)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| team_id | uuid (FK → teams) | |
| starts_at | timestamptz | 시작 시각 |
| ends_at | timestamptz | 종료 시각 |
| note | text (nullable) | 메모 (예: 정기합주, 공연연습) |
| created_by | text | 네이버 사용자 고유 ID (예약자) |
| created_by_name | text | 표시용 예약자 이름 |
| created_at | timestamptz | |

### 겹침 방지 (핵심)
- PostgreSQL **exclusion constraint** 사용:
  `EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)`
  → 어떤 예약도 시간이 겹치면 DB 차원에서 INSERT 실패. 동시 요청에도 안전.
- 프론트에서도 예약 전에 겹침 여부를 미리 보여줘서 UX 보완.

## 5. 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 메인: 주간 시간표 뷰. 모든 팀 예약을 색상별로 표시. 주 이동(이전/다음) |
| `/reserve` | 예약 생성: 네이버 로그인 → 팀 검색·선택(모집완료 팀만) → 날짜 + 시작/종료 시간 직접 입력 → 확인 |
| `/reservations/[id]` | 예약 상세 + 취소 (예약자 본인만), `/reservations/[id]/edit` 수정 |
| `/teams` | 팀 모집 게시판: 모집글 목록 (곡/상태/팀원/댓글 수) |
| `/teams/new` | 모집글 쓰기 (네이버 로그인 필요) |
| `/teams/[id]` | 모집글 상세: 본문 + 댓글 + 다가오는 예약, `/teams/[id]/edit` 수정 (로그인 필요) |
| `/account` | 계정 설정: 닉네임 변경 (예약·모집글·댓글 표시 이름에 반영) |
| `/admin` | (후순위) 예약/팀 강제 삭제 |

메인 화면의 시간표는 세로축 = 시간(예: 09:00~24:00), 가로축 = 요일 형태의 주간 그리드로, 각 예약 블록에 팀명이 팀 색상으로 표시된다. 모바일에서는 일간 뷰 또는 리스트 뷰로 전환.

## 6. API 설계 (Next.js Route Handlers)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/reservations?from=&to=` | 기간 내 예약 목록 (로그인 불필요) |
| POST | `/api/reservations` | 예약 생성 (로그인 필요 / teamId, startsAt, endsAt, note?, repeatWeeks?) — repeatWeeks(2~15)로 매주 반복 생성 |
| PATCH/DELETE | `/api/reservations/[id]` | 예약 수정/취소 (예약자 본인만), DELETE ?series=true로 반복 전체 취소 |
| GET | `/api/teams` | 모집글(팀) 목록 |
| POST | `/api/teams` | 모집글 쓰기 (로그인 필요 / name=곡 제목, status?, members?: {session,name}[], content?) |
| PATCH | `/api/teams/[id]` | 모집글 수정 (로그인한 누구나 / name, status, members?, content?) |
| DELETE | `/api/teams/[id]` | 모집글 삭제 (작성자 본인만) |
| POST | `/api/teams/[id]/comments` | 댓글 쓰기 (로그인 필요) |
| DELETE | `/api/comments/[id]` | 댓글 삭제 (작성자 본인만) |
| PATCH | `/api/profile` | 닉네임 변경 (기존 글의 표시 이름도 일괄 갱신) |
| GET/POST | `/api/auth/[...nextauth]` | Auth.js 로그인/콜백/로그아웃 처리 |

- 세션 확인(`auth()`)은 서버에서만 수행.
- Supabase 접근은 서버 전용 키(service role) 사용, 클라이언트에 직접 노출하지 않음 → RLS 설정 부담 없이 단순하게 시작.

## 7. 예약 규칙 (초기값, 코드에서 상수로 관리)

- 최소 30분, 최대 4시간 (조정 가능)
- 과거 시간 예약 불가
- 예약 가능 범위: 오늘부터 2주 후까지 (조정 가능)
- 시간은 분 단위 자유 입력 (클릭 피커 + 타이핑 모두 지원)

## 8. 개발 단계

### Phase 1 — MVP (여기까지가 목표)
1. Next.js + Tailwind 프로젝트 셋업 ✅
2. Supabase 프로젝트 생성, teams / reservations 테이블 + 겹침 방지 제약 ✅
3. 네이버 로그인 (Auth.js) ✅
4. API: 예약 조회/생성/삭제 + 세션 검증 ✅
5. 예약 생성 폼 (날짜/시간 직접 입력, 겹침 시 에러 표시) ✅
6. 메인 주간 시간표 뷰 (팀별 색상, 주 이동, 드래그로 시간 선택) ✅
7. Vercel 배포 ✅ — https://sorireserve.vercel.app (GitHub main 푸시 시 자동 배포)

### Phase 2 — 개선
- **팀 모집 게시판** ✅ — 곡 제목으로 모집글을 올리고(모집중/모집완료) 댓글로 팀원을 모으면, 예약 페이지에서 바로 선택 가능
- 모바일 대응 (일간/리스트 뷰)
- 관리자 페이지 (예약/팀 강제 삭제)
- 예약 규칙 강화 (팀별 주간 최대 시간 등)
- **동아리 카페 글 목록 위젯**: 네이버 카페 최신 글(공지)을 메인 화면에 표시
  - 카페가 공개인 경우: 서버에서 카페 글 목록 JSON을 가져와 10분 캐싱 후 표시 (비공식 엔드포인트라 구조 변경 시 유지보수 필요)
  - 카페가 회원 전용인 경우: 크롤링 대신 사이트 자체 공지 게시판으로 대체 검토

### Phase 3 — 나중에 고려
- ~~정기 예약 (매주 반복)~~ ✅ Phase 2에서 구현 — 예약 시 반복 주 수(2~15) 선택, series_id로 묶어 전체 취소 지원. 사용 금지 시간은 전용 팀을 만들어 반복 예약으로 처리
- 카카오톡/디스코드 알림
- 여러 방(부스) 지원

## 9. 로컬 개발 준비물

- Node.js 20+
- Supabase 계정 (무료) — 프로젝트 URL과 service role 키를 `.env.local`에 저장
- 네이버 개발자 센터 앱 (네이버 로그인) — Client ID/Secret을 `.env.local`에 저장
- `npx auth secret`으로 `AUTH_SECRET` 생성
- `.env.local`은 git에 커밋하지 않음 (`.env.local.example` 참고)
