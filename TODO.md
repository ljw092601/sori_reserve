# 코드 리뷰 후속 작업 목록

2026-07-14 전체 코드 리뷰(API 라우트 / 페이지·컴포넌트 / 데이터 계층 3방향) 결과 정리.
다음 세션에서 이어서 작업할 수 있도록 남은 수정사항과 추천 기능을 우선순위별로 기록한다.
행 번호는 리뷰 시점 기준이므로 코드가 바뀌면 어긋날 수 있음.

## 완료된 항목 (2026-07-14)

- [x] **[심각] 팀 모집글 PATCH 소유권/경계 검사 부재** — 커밋 3869cb5.
      관리용 팀(board_id null 또는 "사용금지" 이름)과 이름의 사용금지 경계 변경은
      임원 전용으로 제한 (PATCH/DELETE/POST). 협업 수정 UX는 유지.
- [x] **[심각] schema.sql에 profiles.role 컬럼 누락** — 커밋 3869cb5.
      컬럼 + check 제약 + 마이그레이션 주석 추가. 운영 DB는 이미 수동 반영돼 있어 실행할 것 없음.

## 중요 (다음 작업 우선순위)

- [ ] **RLS 활성화 (6줄)** — `supabase/schema.sql`
      코드는 service key만 쓰지만 Supabase의 anon 키 + Data API가 기본 활성이라,
      RLS 없는 public 테이블은 anon 키 유출 시 전체가 읽기/쓰기로 열린다.
      정책은 만들 필요 없이 테이블당 한 줄이면 deny-all (service role은 RLS 우회하므로 코드 수정 불필요):
      `alter table boards enable row level security;` — teams, profiles, comments, reservations, block_rules 동일.
      운영 DB에도 같은 SQL 실행 필요.

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
- [ ] 문서 정리: PLAN.md §6의 `repeatWeeks` 서술은 코드에서 제거된 기능 (읽기/삭제 경로만 잔존),
      README.md는 create-next-app 기본 그대로 — 프로젝트 소개로 교체
- [ ] 정책 결정 필요: 임원이 부적절한 댓글·모집글을 삭제할 수 없음 (모더레이션 권한 공백)
- [ ] (선택) `isAdminBlockTeam`이 zero-width 문자(U+200B 등)를 제거하지 못함 — 권한 경계는 일관되어
      실해는 없고 시각적 사칭 정도 → 필요 시 `[\s​-‍﻿]+`로 확장
- [ ] (선택) 운영 DB 1회 감사: 경계가 열려 있던 기간에 부원 소유로 만들어진 "사용금지" 팀이 있는지
      확인 (DELETE 경계 추가로 위험은 이미 차단됨) — db-inspector 에이전트 활용

## 추천 추가 기능 (기존 기반 재활용 순)

1. **매주 반복 예약 재도입** — `reservations.series_id` 컬럼, `DELETE ?series=true`, 상세 페이지 UI가
   이미 남아 있어 POST에 생성 루프만 복원하면 됨 (PLAN에는 구현된 것으로 적혀 있으나 실제로는 제거됨)
2. **예약 폼에서 해당 날짜의 기존 예약 미리보기** — 지금은 겹치면 409로만 통보.
   `GET /api/reservations?from&to`가 이미 있으니 날짜 선택 시 그 날 예약 표시
3. **자체 공지 게시판** — PLAN의 "네이버 카페 위젯"은 비공식 엔드포인트 의존이라 유지보수 리스크 큼.
   boards의 소프트 삭제(deleted_at + lazy purge + 복구 API) 패턴을 복제한 `notices` 테이블 권장
4. **팀별 주간 최대 시간 규칙** (PLAN Phase 2) — 로그인 시 profiles 자동 축적으로 사용자 축은 이미 존재
5. **주간 그리드 "오늘로" 버튼** — 몇 주 이동 후 돌아올 방법이 반복 클릭뿐 (작지만 체감 큰 개선).
   함께: 예약 성공 후 `/?d=예약날짜`로 이동 (지금은 항상 이번 주로 가서 다음 주 예약이 안 보임)
6. **여러 방(부스) 지원** (PLAN Phase 3) — 현재 `no_overlap` exclusion constraint는 방 1개 전제의 전역 제약.
   `room_id` 컬럼 추가 + `exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&)`로 교체
7. **카카오톡/디스코드 알림** (PLAN Phase 3) — 예약 생성/취소 시 웹훅 호출이면 충분한 구조

## 리뷰에서 확인된 강점 (건드리지 말 것)

- 이중 예약 방지: `tstzrange` exclusion constraint + `23P01 → 409` 매핑 — DB 차원에서 원자적
- KST 처리: `lib/dates.ts` 고정 +09:00 오프셋 헬퍼, `findRuleConflict`의 자정 넘김/다일 분할 —
  UTC 서버(Vercel)에서 타임존 버그 없음이 확인됨
- 서버/클라이언트 경계: service key는 서버 파일만, `created_by`는 항상 세션에서만 (mass assignment 없음)
- dev 로그인 백도어 3중 차단 (프로바이더 등록 dev 한정 / authorize 재확인 / 페이지 notFound)
- block_rules 조회 실패 시 예약 거부하는 fail-closed 처리
