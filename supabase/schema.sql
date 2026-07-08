-- 소리 동아리방 예약 DB 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행하세요.

-- 시간 범위 겹침 방지(exclusion constraint)에 필요한 확장
create extension if not exists btree_gist;

create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table reservations (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  note            text,
  created_by      text not null, -- 네이버 사용자 고유 ID (예약자 본인만 취소 가능)
  created_by_name text not null, -- 표시용 예약자 이름
  created_at      timestamptz not null default now(),

  constraint valid_range check (starts_at < ends_at),

  -- 어떤 두 예약도 시간이 겹칠 수 없음. 동시 요청이 와도 DB가 하나만 통과시킨다.
  constraint no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  )
);

create index reservations_starts_at_idx on reservations (starts_at);

-- 팀 등록 예시:
-- insert into teams (name, color) values
--   ('1팀', '#ef4444'),
--   ('2팀', '#3b82f6');

-- ─────────────────────────────────────────────────────────────
-- [마이그레이션] 이전 버전(팀 비밀번호 방식) 스키마를 이미 실행했다면
-- 위 create 대신 아래만 실행:
-- alter table teams drop column password_hash;
-- alter table reservations
--   add column created_by text not null default '',
--   add column created_by_name text not null default '';
