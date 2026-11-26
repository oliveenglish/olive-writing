-- 올리브 라이팅 (새 버전) · Supabase 표
-- Supabase > SQL Editor 에 통째로 붙여 넣고 Run 하세요.
-- 처음 설치든, 예전 버전을 쓰던 DB든 그대로 실행해도 돼요. (있는 건 건너뛰어요)
-- 단어 · 예문은 DB에 없어요. GitHub의 data 폴더 엑셀에서 읽어요.

create extension if not exists pgcrypto;

-- 반
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  teacher_id uuid not null,
  created_at timestamptz default now()
);

-- 사람 (학생 · 쌤)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','teacher')),
  name text not null,
  username text unique,
  grade text,
  nickname text,
  class_id uuid references classes(id) on delete set null,
  memo text,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);
alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists current_unit text;          -- 지금 하는 유닛 (예: B-Unit 1)
alter table profiles add column if not exists class_days int[] default '{}'; -- 수업 요일 (0 일 ~ 6 토) · 쌤이 보기용
alter table profiles add column if not exists zoom_url text;              -- 이 학생만 다른 Zoom 링크 (1:1 등 · 비우면 반 링크)

-- 반별 Zoom 링크 (화 · 목 반 / 월 · 수 반)
alter table classes add column if not exists zoom_tt text;
alter table classes add column if not exists zoom_mw text;

-- 앱 활동 체크: 단어 학습 · 문장 연습 · 수업 참석
--   w1-flash · w1-match · w1-word · w1-meaning (Set 1) / w2-… (Set 2)
--   s1-shadow · s1-chunk (Set 1) / s2-… (Set 2)
--   class1 (③ 수업) · class2 (⑥ 수업)
create table if not exists app_checks (
  student_id uuid references profiles(id) on delete cascade,
  unit_id text not null,
  key text not null,
  score int,
  total int,
  done_at timestamptz default now(),
  primary key (student_id, unit_id, key)
);

-- 인증 사진: ② 워크북 단어 학습 · ⑤ 쌤 숙제 (빨간 펜 첨삭) · ⑦ 다시 쓰기
create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  unit_id text not null,
  step int not null check (step in (2, 5, 7)),
  photo_path text not null,
  status text default 'submitted' check (status in ('submitted','returned')),
  decision text,                     -- ② · ⑦: ok · redo / ⑤: corrected
  markup_path text,                  -- ⑤ 쌤 빨간 펜
  comment text,                      -- 쌤 한마디
  seen boolean default false,
  created_at timestamptz default now(),
  returned_at timestamptz
);
create index if not exists proofs_student on proofs(student_id, unit_id, step, created_at desc);

-- ③ 영상 강의 · 숙제 안내 (유닛마다 하나 · 쌤 '영상 강의' 메뉴에서 넣어요)
create table if not exists unit_guides (
  unit_id text primary key,            -- 예: S1-Unit 11
  teacher_id uuid,
  video_url text,                      -- YouTube 일부 공개 · Vimeo 링크
  video_title text,
  video_note text,                     -- 학생에게 보일 한 줄 설명
  homework text,                       -- 학생 홈 '숙제 안내' 칸
  must_watch boolean default true,     -- 영상을 다 봐야 ④ 문장 연습이 열려요
  updated_at timestamptz default now()
);

-- 교재 폴더 (쌤 '교재 폴더' 메뉴에서 올려요 · 파일은 materials 저장소)
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  folder text not null,                -- 유닛 ID (예: S1-Unit 11) 또는 common (공통 자료)
  title text not null,                 -- 원래 파일 이름
  file_path text not null,
  size bigint,
  visible text default 'all' check (visible in ('all','teacher','some')),  -- 전체 · 쌤만 · 고른 학생
  student_ids uuid[] default '{}',
  is_new boolean default true,         -- 학생 화면 NEW 표시 (2주)
  created_at timestamptz default now()
);
create index if not exists materials_teacher on materials(teacher_id, folder, created_at desc);

-- RLS 켜기 (정책 없음 = 사이트 서버만 접근)
alter table classes enable row level security;
alter table profiles enable row level security;
alter table app_checks enable row level security;
alter table proofs enable row level security;
alter table unit_guides enable row level security;
alter table materials enable row level security;

-- 서버(관리자 키)에 표 사용 권한
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- 사진 저장소 (비공개)
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- 교재 폴더 저장소 (비공개 · 학생은 1시간짜리 링크로 열어요)
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;
