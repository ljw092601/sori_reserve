-- 소리 동아리방 예약 DB 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행하세요.

-- 시간 범위 겹침 방지(exclusion constraint)에 필요한 확장
create extension if not exists btree_gist;

-- 공연별 팀 모집 게시판 — 생성/이름 변경/삭제는 임원만 (API에서 검증)
create table boards (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,   -- 공연 이름 (예: 2026 가을 정기공연)
  created_by      text,            -- 만든 임원 네이버 ID
  created_by_name text,            -- 표시용 이름
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz      -- 삭제 대기 시각 — 24시간 안에는 되돌리기 가능,
                                   -- 지나면 /teams 방문 시점에 영구 삭제된다 (lazy purge)
);

-- 팀 = 팀원 모집글. name에는 곡 제목을 저장한다 (시간표/예약 드롭다운에 그대로 표시).
create table teams (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid references boards (id) on delete cascade,
                  -- 소속 게시판 (null = 사용금지 등 관리용 팀)
                  -- 게시판 영구 삭제 시 모집글·댓글·예약도 함께 삭제된다
  name            text not null,   -- 곡 제목 (같은 곡으로 여러 모집글 가능)
  color           text not null default '#6366f1',
  status          text not null default 'recruiting'
                    check (status in ('recruiting', 'closed')), -- 모집중/모집완료
  members         jsonb not null default '[]',
                  -- 팀원 목록: [{"session": "드럼", "name": "홍길동"}, ...]
                  -- name이 빈 문자열이면 그 세션은 모집중
  content         text,            -- 모집 글 본문
  song_url        text,            -- 곡 링크 (유튜브 등, 선택)
  created_by      text,            -- 작성자 네이버 ID (null = 관리자가 등록한 팀)
  created_by_name text,            -- 표시용 작성자 이름
  created_at      timestamptz not null default now()
);

create index teams_board_id_idx on teams (board_id);

-- 사용자 프로필 (닉네임·역할) — 닉네임이 없으면 네이버 이름을 그대로 표시
create table profiles (
  id         text primary key,     -- 네이버 사용자 고유 ID
  nickname   text not null,
  role       text check (role in ('exec', 'member')),
                                   -- 'exec'=임원, 그 외(null 포함)=부원 (src/lib/roles.ts)
                                   -- 임원 승급/강등은 /admin 부원 관리에서
  updated_at timestamptz not null default now()
);

-- 모집글 댓글
create table comments (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams (id) on delete cascade,
  content         text not null,
  created_by      text not null,   -- 작성자 네이버 ID (본인만 삭제 가능)
  created_by_name text not null,
  created_at      timestamptz not null default now()
);

create index comments_team_id_idx on comments (team_id);

create table reservations (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid references teams (id) on delete cascade,
                  -- 합주 예약만 팀을 가진다 (개인연습/기타는 null)
  category        text not null default 'ensemble'
                    check (category in ('ensemble', 'personal', 'etc')),
                  -- 예약 목적: ensemble=합주, personal=개인연습, etc=기타
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  title           text,          -- 기타(etc) 예약의 제목 — 합주는 팀명, 개인연습은 예약자 이름을 제목으로 쓴다
  note            text,
  series_id       uuid,          -- 매주 반복 예약 묶음 ID (단건 예약은 null)
  created_by      text not null, -- 네이버 사용자 고유 ID (예약자 본인만 취소 가능)
  created_by_name text not null, -- 표시용 예약자 이름
  created_at      timestamptz not null default now(),

  constraint valid_range check (starts_at < ends_at),

  -- 합주 예약은 반드시 팀이 있어야 한다
  constraint ensemble_needs_team
    check (category <> 'ensemble' or team_id is not null),

  -- 어떤 두 예약도 시간이 겹칠 수 없음. 동시 요청이 와도 DB가 하나만 통과시킨다.
  constraint no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  )
);

create index reservations_starts_at_idx on reservations (starts_at);

-- 정기 사용 금지 규칙 (임원 전용) — "매주 X요일 HH:mm~HH:mm은 예약 불가"
-- 예약 행을 미리 만들어두는 방식이 아니라 규칙만 저장하고,
-- 시간표 표시와 예약 API 검증이 이 테이블을 참조한다. 규칙을 고치면 즉시 전체 반영.
create table block_rules (
  id              uuid primary key default gen_random_uuid(),
  day_of_week     int not null check (day_of_week between 0 and 6),
                  -- KST 기준 요일 (0=일 ~ 6=토)
  start_min       int not null check (start_min between 0 and 1439),
  end_min         int not null check (end_min between 1 and 1440),
                  -- KST 자정부터의 분 (예: 18:00 = 1080)
  note            text,
  created_by      text not null,
  created_by_name text not null,
  created_at      timestamptz not null default now(),

  constraint block_rule_valid_range check (start_min < end_min)
);

-- RLS 활성화 (deny-all) — 정책을 만들지 않으므로 anon/authenticated 키로는 접근 불가.
-- 앱은 서버 전용 service role 키만 쓰고 service role은 RLS를 우회하므로 동작에 영향 없음.
-- anon 키 + Data API가 기본 활성인 Supabase에서 키 유출 시 노출을 막는 안전장치.
alter table boards enable row level security;
alter table teams enable row level security;
alter table profiles enable row level security;
alter table comments enable row level security;
alter table reservations enable row level security;
alter table block_rules enable row level security;

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

-- [마이그레이션] 팀 게시판 기능 — teams 테이블이 이미 있다면 아래만 실행:
-- alter table teams
--   add column song text,
--   add column members text,
--   add column created_by text,
--   add column created_by_name text;

-- [마이그레이션] 팀 모집 게시판 개편 — 위까지 실행한 상태라면 아래만 실행:
-- alter table teams drop constraint teams_name_key;
-- update teams set name = coalesce(song, name);
-- alter table teams
--   add column status text not null default 'recruiting'
--     check (status in ('recruiting', 'closed')),
--   add column content text;
-- create table comments (
--   id              uuid primary key default gen_random_uuid(),
--   team_id         uuid not null references teams (id) on delete cascade,
--   content         text not null,
--   created_by      text not null,
--   created_by_name text not null,
--   created_at      timestamptz not null default now()
-- );
-- create index comments_team_id_idx on comments (team_id);
-- (song 컬럼은 배포 중 구버전 코드 호환을 위해 남겨둠 — 나중에 정리:
--  alter table teams drop column song;)

-- [마이그레이션] 팀원을 세션/이름 구조(jsonb)로 변경 — 위까지 실행했다면 아래만 실행:
-- (기존 텍스트 팀원 정보는 사라짐)
-- alter table teams drop column members;
-- alter table teams add column members jsonb not null default '[]';

-- [마이그레이션] 닉네임 기능 — 위까지 실행했다면 아래만 실행:
-- create table profiles (
--   id         text primary key,
--   nickname   text not null,
--   updated_at timestamptz not null default now()
-- );

-- [마이그레이션] 매주 반복 예약 — 위까지 실행했다면 아래만 실행:
-- alter table reservations add column series_id uuid;

-- [마이그레이션] 예약 목적 카테고리(합주/개인연습/기타) — 위까지 실행했다면 아래만 실행:
-- (기존 예약은 전부 팀이 있으므로 기본값 'ensemble'(합주)로 채워진다)
-- alter table reservations alter column team_id drop not null;
-- alter table reservations
--   add column category text not null default 'ensemble'
--     check (category in ('ensemble', 'personal', 'etc'));
-- alter table reservations
--   add constraint ensemble_needs_team
--     check (category <> 'ensemble' or team_id is not null);

-- [마이그레이션] 기타(etc) 예약 제목 — 위까지 실행했다면 아래만 실행:
-- (제목 없는 기존 기타 예약은 화면에서 예약자 이름으로 표시된다)
-- alter table reservations add column title text;

-- [마이그레이션] 임원 역할(/admin 부원 관리) — 위까지 실행했다면 아래만 실행:
-- (role이 null인 사용자는 부원으로 취급. 첫 임원은 SQL로 직접 지정:
--  update profiles set role = 'exec' where id = '<네이버 ID>';)
-- alter table profiles add column role text check (role in ('exec', 'member'));

-- [마이그레이션] 모집글 곡 링크(유튜브 등, 선택) — 위까지 실행했다면 아래만 실행:
-- alter table teams add column song_url text;

-- [마이그레이션] 정기 사용 금지 규칙 — 위까지 실행했다면 아래만 실행:
-- create table block_rules (
--   id              uuid primary key default gen_random_uuid(),
--   day_of_week     int not null check (day_of_week between 0 and 6),
--   start_min       int not null check (start_min between 0 and 1439),
--   end_min         int not null check (end_min between 1 and 1440),
--   note            text,
--   created_by      text not null,
--   created_by_name text not null,
--   created_at      timestamptz not null default now(),
--   constraint block_rule_valid_range check (start_min < end_min)
-- );

-- [마이그레이션] 공연별 팀 모집 게시판 — 위까지 실행했다면 아래만 실행:
-- (기존 모집글은 "기존 모집글" 게시판으로 옮겨진다 — 이름은 /teams 게시판 관리에서 변경 가능.
--  "사용금지" 관리용 팀은 게시판에 속하지 않는다)
-- create table boards (
--   id              uuid primary key default gen_random_uuid(),
--   name            text not null,
--   created_by      text,
--   created_by_name text,
--   created_at      timestamptz not null default now()
-- );
-- alter table teams add column board_id uuid references boards (id);
-- create index teams_board_id_idx on teams (board_id);
-- insert into boards (name) values ('기존 모집글');
-- update teams set board_id = (select id from boards where name = '기존 모집글')
--   where regexp_replace(name, '\s', '', 'g') not like '%사용금지%';

-- [마이그레이션] 게시판 삭제 유예기간(24시간 되돌리기) — 위까지 실행했다면 아래만 실행:
-- (글 있는 게시판도 삭제 가능해지고, 영구 삭제 시 글·댓글·예약이 함께 지워진다)
-- alter table boards add column deleted_at timestamptz;
-- alter table teams drop constraint teams_board_id_fkey;
-- alter table teams add constraint teams_board_id_fkey
--   foreign key (board_id) references boards (id) on delete cascade;

-- [마이그레이션] RLS 활성화 (deny-all) — 위까지 실행했다면 아래만 실행:
-- (운영 DB에는 2026-07-22 기준 이미 적용돼 있음 — 6개 테이블 rowsecurity=true, 정책 0개 확인)
-- alter table boards enable row level security;
-- alter table teams enable row level security;
-- alter table profiles enable row level security;
-- alter table comments enable row level security;
-- alter table reservations enable row level security;
-- alter table block_rules enable row level security;
