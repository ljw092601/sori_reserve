# 소리 동아리방 예약 사이트 — 플랜 & 작업 목록

옛 PLAN.md(초기 개발 플랜)를 이 파일로 흡수했다 (2026-07-22).
플랜과 실제 코드가 어긋나는 부분은 코드 리뷰(아래 후속 작업 섹션) 기준으로 교정했다.
스키마 상세는 `supabase/schema.sql`이 단일 기준이므로 여기서는 요약만 유지한다.

---

# 1부. 프로젝트 플랜 (현행화)

## 개요

밴드 동아리에서 팀별로 동아리방 사용 시간이 겹치는 문제를 해결하기 위한 예약 사이트.

- 각 팀이 **원하는 날짜/시간을 직접 입력**해서 동아리방을 예약한다.
- 모든 팀의 예약 현황을 **한 화면에서 다같이 볼 수 있다** (조회는 로그인 불필요).
- 겹치는 시간대는 예약이 불가능하도록 서버(DB)에서 검증한다.

## 기술 스택

| 구분 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js (App Router, TypeScript) | 프론트+API를 한 프로젝트로 |
| DB / 백엔드 | Supabase (PostgreSQL) | 무료 플랜, 별도 서버 불필요 |
| 스타일 | Tailwind CSS | 빠른 UI 작업 |
| 배포 | Vercel | 무료, Next.js와 궁합 최고 — https://sorireserve.vercel.app (main 푸시 시 자동 배포) |

저장소 부속물: `docs/index.html`은 발표 슬라이드(GitHub Pages 배포), `slides/`는 슬라이드 원본(미블러)으로 gitignore 대상 — 앱 코드와 무관.

## 인증 — 네이버 로그인

**Auth.js(NextAuth) v5 + 네이버 OAuth** 사용. (Supabase Auth는 네이버 미지원)

- 세션은 JWT 쿠키 (DB 저장 없음). 세션 확인(`auth()`)은 서버에서만 수행.
- 예약/글 생성·취소는 로그인 필수, **조회는 누구나 가능**.
- 모든 행에 네이버 사용자 ID(`created_by`)와 표시 이름을 기록 → 소유권 검사의 기준.
- 역할: `profiles.role`이 `'exec'`이면 임원 (`src/lib/roles.ts`). 임원 승급/강등은 `/admin`에서.
- Supabase 접근은 서버 전용 service role 키만 사용, 클라이언트에 노출하지 않음.
- 네이버 개발자 센터 앱의 Client ID/Secret → `.env.local`의 `AUTH_NAVER_ID` / `AUTH_NAVER_SECRET`.
  콜백 URL: `http://localhost:3000/api/auth/callback/naver` + `https://sorireserve.vercel.app/api/auth/callback/naver`

## 데이터 모델 (요약 — 상세는 `supabase/schema.sql`)

| 테이블 | 역할 |
|--------|------|
| `boards` | 공연별 팀 모집 게시판. 임원만 생성/이름 변경/삭제. 소프트 삭제(`deleted_at`) + 24시간 내 복구, 이후 lazy purge |
| `teams` | 팀 = 팀원 모집글. `name`=곡 제목, `board_id`(null=사용금지 등 관리용 팀), `members` jsonb, `song_url`, 모집 상태(`recruiting`/`closed`) |
| `profiles` | 사용자 프로필: 닉네임 + 역할(`exec`/`member`). 로그인 시 자동 축적 |
| `comments` | 모집글 댓글 (본인만 삭제) |
| `reservations` | 예약. `category`(ensemble=합주/personal=개인연습/etc=기타), 합주만 `team_id` 필수. `series_id`는 반복 예약 잔존 컬럼 |
| `block_rules` | 정기 사용 금지 규칙 (임원 전용): "매주 X요일 HH:mm~HH:mm 예약 불가". 규칙만 저장하고 표시·검증이 참조 |

### 겹침 방지 (핵심)

- PostgreSQL **exclusion constraint**: `EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)`
  → 시간이 겹치면 DB 차원에서 INSERT 실패 (`23P01` → API가 409로 매핑). 동시 요청에도 안전.
- 프론트에서도 예약 전에 겹침 여부를 미리 보여줘서 UX 보완.

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 메인: 주간 시간표 뷰. 모든 팀 예약을 색상별로 표시, 주 이동, 드래그로 시간 선택 |
| `/reserve` | 예약 생성: 카테고리 선택(합주/개인연습/기타, 합주만 팀 선택) → 날짜 + 시작/종료 시간 직접 입력 |
| `/reservations/[id]` | 예약 상세 + 취소 (예약자 본인만), `/edit` 수정 |
| `/teams` | 팀 모집 게시판: 공연(board)별 모집글 목록 + 게시판 관리(임원) |
| `/teams/new` | 모집글 쓰기 (로그인 필요) |
| `/teams/[id]` | 모집글 상세: 본문 + 댓글 + 다가오는 예약, `/edit` 수정 (로그인한 누구나) |
| `/account` | 계정 설정: 닉네임 변경 (기존 글의 표시 이름에도 반영) |
| `/admin` | 관리자(임원): 사용 금지 규칙 관리 + 부원/임원 관리 |

글 수정은 로그인한 누구나 가능, 삭제만 작성자 본인 제한. 관리용 팀(사용금지 등)의 경계 변경은 임원 전용.

## API 설계 (Next.js Route Handlers)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/reservations?from=&to=` | 기간 내 예약 목록 (로그인 불필요) |
| POST | `/api/reservations` | 예약 생성 (로그인 필요) |
| PATCH/DELETE | `/api/reservations/[id]` | 예약 수정/취소 (본인만). `DELETE ?series=true`는 반복 예약 잔존 경로 |
| GET/POST | `/api/teams` | 모집글 목록 / 쓰기 |
| PATCH/DELETE | `/api/teams/[id]` | 수정(로그인한 누구나) / 삭제(작성자 본인) — 관리용 팀 경계는 임원 전용 |
| POST | `/api/teams/[id]/comments` | 댓글 쓰기 |
| DELETE | `/api/comments/[id]` | 댓글 삭제 (본인만) |
| PATCH | `/api/profile` | 닉네임 변경 (기존 글 표시 이름 일괄 갱신) |
| * | `/api/boards`, `/api/boards/[id]` | 게시판 생성/이름 변경/삭제/복구 (임원 전용) |
| * | `/api/admin/members` | 부원 목록/임원 승급·강등 (임원 전용) |
| * | `/api/admin/block-rules`, `/[id]` | 사용 금지 규칙 CRUD (임원 전용) |
| GET/POST | `/api/auth/[...nextauth]` | Auth.js 로그인/콜백/로그아웃 |

## 예약 규칙 (코드에서 상수로 관리)

- 최소 30분, 최대 4시간 (조정 가능)
- 과거 시간 예약 불가, 예약 가능 범위: 오늘부터 2주 후까지 (조정 가능)
- 시간은 분 단위 자유 입력 (클릭 피커 + 타이핑 모두 지원)
- 사용 금지 시간대는 `block_rules`로 관리 — 조회 실패 시 예약 거부(fail-closed)

## 개발 이력 & 향후 계획

**완료**: MVP 전체(셋업/스키마/네이버 로그인/예약 CRUD/주간 시간표/Vercel 배포),
팀 모집 게시판(공연별 board + 댓글), 관리자 페이지(사용 금지 규칙 + 부원 관리), 닉네임/역할.

**구현했다가 제거**: 매주 반복 예약(repeatWeeks) — 생성 루프는 제거됐고 `series_id` 컬럼,
`DELETE ?series=true`, 상세 페이지 UI만 잔존. 재도입은 아래 "추천 추가 기능" 1번.

**남은 계획** (구체 항목은 2부 참고):
- 모바일 대응 (일간/리스트 뷰)
- 예약 규칙 강화 (팀별 주간 최대 시간 등)
- 동아리 카페 글 목록 위젯 — 비공식 엔드포인트 의존이라 리스크 큼, 자체 공지 게시판으로 대체 검토 (추천 기능 3번)
- 카카오톡/디스코드 알림, 여러 방(부스) 지원

## 로컬 개발 준비물

- Node.js 20+
- Supabase 계정 (무료) — 프로젝트 URL과 service role 키를 `.env.local`에 저장
- 네이버 개발자 센터 앱 (네이버 로그인) — Client ID/Secret을 `.env.local`에 저장
- `npx auth secret`으로 `AUTH_SECRET` 생성
- `.env.local`은 git에 커밋하지 않음 (`.env.local.example` 참고)

---

# 2부. 코드 리뷰 후속 작업 목록

2026-07-14 전체 코드 리뷰(API 라우트 / 페이지·컴포넌트 / 데이터 계층 3방향) 결과 정리.
다음 세션에서 이어서 작업할 수 있도록 남은 수정사항과 추천 기능을 우선순위별로 기록한다.
행 번호는 리뷰 시점 기준이므로 코드가 바뀌면 어긋날 수 있음.
(2026-07-22 확인: 리뷰 이후 코드 변경은 발표 슬라이드 배포뿐이라 아래 미완 항목은 전부 여전히 유효.)

## 완료된 항목 (2026-07-14)

- [x] **[심각] 팀 모집글 PATCH 소유권/경계 검사 부재** — 커밋 3869cb5.
      관리용 팀(board_id null 또는 "사용금지" 이름)과 이름의 사용금지 경계 변경은
      임원 전용으로 제한 (PATCH/DELETE/POST). 협업 수정 UX는 유지.
- [x] **[심각] schema.sql에 profiles.role 컬럼 누락** — 커밋 3869cb5.
      컬럼 + check 제약 + 마이그레이션 주석 추가. 운영 DB는 이미 수동 반영돼 있어 실행할 것 없음.
- [x] 문서 정리(일부): PLAN.md의 낡은 서술(반복 예약 구현됨, 관리자 페이지 후순위 등)을
      현행화해서 이 파일 1부로 흡수, PLAN.md 삭제 (2026-07-22).
- [x] **RLS 활성화** — 운영 DB에는 이미 적용돼 있던 것으로 확인 (2026-07-22:
      6개 테이블 전부 rowsecurity=true, 정책 0개 = deny-all). schema.sql에만 누락돼 있어
      본 스키마 + 마이그레이션 주석으로 동기화 완료.

## 중요 (다음 작업 우선순위)

- [ ] **500 응답의 DB 에러 원문 노출 제거** — 대부분의 API 라우트
      `{ error: error.message }`가 Postgres 원문(테이블·컬럼·제약명)을 그대로 반환.
      비로그인 공개 엔드포인트 `GET /api/reservations`도 `?from=아무거나`로 노출됨.
      → `console.error`로 서버에만 남기고 일반 메시지를 반환하는 공용 헬퍼로 통일.
      대상: `api/reservations/route.ts:43,236`, `api/reservations/[id]/route.ts:230,307`,
      `api/teams/route.ts`, `api/teams/[id]/route.ts`, `api/teams/[id]/comments/route.ts`,
      `api/comments/[id]/route.ts`, `api/profile/route.ts`, `api/admin/members/route.ts`, `api/boards/route.ts` 등.
      함께: `GET /api/reservations`의 `from`/`to` 무검증 — 잘못된 값은 500이 아니라 400 반환.

- [ ] **클라이언트 폼 13곳 fetch에 try/catch 없음** — 네트워크 오류 시 unhandled rejection +
      `setSubmitting(false)` 미도달로 제출 버튼이 새로고침 전까지 영구 비활성.
      → `try { ... } catch { setError("네트워크 오류...") } finally { setSubmitting(false) }` 일괄 적용.
      대상: `reserve/reserve-form.tsx`, `reservations/[id]/edit/edit-form.tsx`, `reservations/[id]/cancel-form.tsx`,
      `teams/new/team-form.tsx`, `teams/[id]/edit/edit-form.tsx`, `teams/[id]/comment-form.tsx`,
      `teams/[id]/delete-form.tsx`, `teams/[id]/comment-delete-button.tsx`, `teams/board-manager.tsx`(4곳),
      `admin/block-form.tsx`, `admin/block-rules-section.tsx`(2곳), `admin/members-section.tsx`, `account/account-form.tsx`.

- [ ] **길이 제한 없는 텍스트 필드 3종** — 수 MB도 저장 가능 (다른 필드는 전부 제한 있음)
      - 예약 메모 `note`: `api/reservations/route.ts:215`, `api/reservations/[id]/route.ts:210` → 200자 제안
      - 모집글 본문 `content`: `api/teams/route.ts:144`, `api/teams/[id]/route.ts:118` → 2000자 제안
      - 금지 규칙 메모 `note`: `api/admin/block-rules/route.ts:94`, `[id]/route.ts:64` → 200자 제안
        (이 값은 예약 거부 에러 메시지에 삽입되므로 우선)
      서버 검증 + 폼 maxLength를 constants로 공유.

- [ ] **`/?d=2026-02-30` 같은 잘못된 날짜로 홈 500** — `src/app/page.tsx:48-49`
      정규식만 통과하면 `mondayOf` 내부 `toISOString()`이 RangeError (try 블록 바깥).
      → `Date.parse` 실패 시 오늘로 폴백. 함께 루트 `error.tsx`(한국어) + `loading.tsx`(스켈레톤) 추가 —
      현재 둘 다 없어서 렌더 예외는 영어 기본 에러 화면, 내비게이션은 멈춘 것처럼 보임.

## 사소 (여유 될 때)

- [ ] PATCH 예약 수정이 시간 문자열을 정규화 없이 저장 (POST는 `toISOString()` 후 저장 — 불일치)
      — `api/reservations/[id]/route.ts:208-209`
- [ ] 닉네임 변경 시 3테이블(`reservations`/`teams`/`comments`) 일괄 갱신의 `.error` 미확인 —
      부분 실패해도 200 반환 — `api/profile/route.ts:53-66`
- [ ] 누락 인덱스 3종 (schema.sql + 운영 DB):
      `reservations(series_id) where series_id is not null`, 3테이블 `(created_by)`, `boards(deleted_at)`
- [ ] `src/lib/supabase.ts`에 `import "server-only"` 추가 (1줄) — 클라이언트 import를 빌드 에러로 강제.
      `roles.ts`, `profile.ts`, `boards.ts`도 동일 검토
- [ ] 상세 페이지들이 DB 장애까지 404 처리 — `.single()`의 error 코드(PGRST116/22P02)를 구분하지 않고
      `notFound()` — `reservations/[id]/page.tsx`, `edit/page.tsx`, `teams/[id]/page.tsx`, `edit/page.tsx`
- [ ] 성능:
      - `/teams` 페이지 5회 순차 DB 왕복 → `isExecutive` + `purgeExpiredBoards`는 `Promise.all` — `teams/page.tsx:37-81`
      - `/admin` 3중 클라이언트 페칭 → 서버에서 `Promise.all`로 조회해 초기값 prop
      - 예약 수정 폼만 클라이언트 팀 페칭 (생성 폼은 서버 페칭으로 개선됨 — 같은 패턴 적용,
        로딩 중 "선택할 수 있는 팀이 없어요" 오표시도 해결됨) — `reservations/[id]/edit/edit-form.tsx:34,46-62`
      - `reservations/[id]/page.tsx`: `auth()`와 예약 조회 병렬화, `teams/[id]/page.tsx`: comments/upcoming 병렬화
- [ ] 중복 코드 정리:
      - 예약 생성/수정 폼 ~230줄 중복 (이미 갈라지기 시작) → 공용 `ReservationFields` + mode prop
      - 임원 검사 헬퍼 3벌 (`boards/[id]/route.ts:requireExecutive`, `admin/block-rules/[id]/route.ts:denyUnlessExecutive`, 인라인) → lib로 통일
      - `fmtTime` 3중 정의 (`week-grid.tsx`, `reserve-form.tsx`, `edit-form.tsx`) — `lib/block-rules.ts`의 `minToHHMM`과 동일 → `lib/dates.ts`로
      - 로그인 유도 카드 5개 페이지 반복 → 공용 컴포넌트
- [ ] 접근성:
      - TeamPicker 키보드 조작 불가 (마우스 전용) → ArrowUp/Down/Enter/Escape + combobox ARIA — `components/team-picker.tsx:37-95`
      - StatusRadio 포커스 표시 없음 (`sr-only` input + label에 focus 스타일 부재) — `teams/form-fields.tsx:33-40`
- [ ] `MembersInput`의 `key={i}` — 중간 행 삭제 시 세션 select UI 어긋남 → 고유 id key 또는 custom 파생 — `teams/form-fields.tsx:140-141`
- [ ] `GET /api/reservations`가 비로그인 응답에 네이버 고유 ID(`created_by`) 노출 → `mine: boolean` 플래그로 대체
- [ ] 마지막 임원 강등 방지가 원자적이지 않음 (count와 update가 별개 쿼리) → 단일 쿼리/RPC — `api/admin/members/route.ts:137-158`
- [ ] 댓글 삭제만 `alert()` 사용 → 인라인 에러로 통일 — `teams/[id]/comment-delete-button.tsx:26`
- [ ] 문서 정리(남은 것): README.md가 create-next-app 기본 그대로 — 프로젝트 소개로 교체
- [ ] 정책 결정 필요: 임원이 부적절한 댓글·모집글을 삭제할 수 없음 (모더레이션 권한 공백)
- [ ] (선택) `isAdminBlockTeam`이 zero-width 문자(U+200B 등)를 제거하지 못함 — 권한 경계는 일관되어
      실해는 없고 시각적 사칭 정도 → 필요 시 `[\s​-‍﻿]+`로 확장
- [ ] (선택) 운영 DB 1회 감사: 경계가 열려 있던 기간에 부원 소유로 만들어진 "사용금지" 팀이 있는지
      확인 (DELETE 경계 추가로 위험은 이미 차단됨) — db-inspector 에이전트 활용

## 추천 추가 기능 (기존 기반 재활용 순)

1. **매주 반복 예약 재도입** — `reservations.series_id` 컬럼, `DELETE ?series=true`, 상세 페이지 UI가
   이미 남아 있어 POST에 생성 루프만 복원하면 됨 (한때 구현됐다가 제거된 기능 — 1부 개발 이력 참고)
2. **예약 폼에서 해당 날짜의 기존 예약 미리보기** — 지금은 겹치면 409로만 통보.
   `GET /api/reservations?from&to`가 이미 있으니 날짜 선택 시 그 날 예약 표시
3. **자체 공지 게시판** — 1부 "남은 계획"의 네이버 카페 위젯은 비공식 엔드포인트 의존이라 유지보수 리스크 큼.
   boards의 소프트 삭제(deleted_at + lazy purge + 복구 API) 패턴을 복제한 `notices` 테이블 권장
4. **팀별 주간 최대 시간 규칙** (1부 남은 계획) — 로그인 시 profiles 자동 축적으로 사용자 축은 이미 존재
5. **주간 그리드 "오늘로" 버튼** — 몇 주 이동 후 돌아올 방법이 반복 클릭뿐 (작지만 체감 큰 개선).
   함께: 예약 성공 후 `/?d=예약날짜`로 이동 (지금은 항상 이번 주로 가서 다음 주 예약이 안 보임)
6. **여러 방(부스) 지원** (1부 남은 계획) — 현재 `no_overlap` exclusion constraint는 방 1개 전제의 전역 제약.
   `room_id` 컬럼 추가 + `exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&)`로 교체
7. **카카오톡/디스코드 알림** (1부 남은 계획) — 예약 생성/취소 시 웹훅 호출이면 충분한 구조

## 리뷰에서 확인된 강점 (건드리지 말 것)

- 이중 예약 방지: `tstzrange` exclusion constraint + `23P01 → 409` 매핑 — DB 차원에서 원자적
- KST 처리: `lib/dates.ts` 고정 +09:00 오프셋 헬퍼, `findRuleConflict`의 자정 넘김/다일 분할 —
  UTC 서버(Vercel)에서 타임존 버그 없음이 확인됨
- 서버/클라이언트 경계: service key는 서버 파일만, `created_by`는 항상 세션에서만 (mass assignment 없음)
- dev 로그인 백도어 3중 차단 (프로바이더 등록 dev 한정 / authorize 재확인 / 페이지 notFound)
- block_rules 조회 실패 시 예약 거부하는 fail-closed 처리
