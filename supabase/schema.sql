-- 올리브 라이팅 · Supabase 테이블
-- Supabase > SQL Editor 에 통째로 붙여 넣고 Run 하세요. (처음 한 번)
-- 모든 읽기/쓰기는 사이트 서버(서비스 키)를 통해서만 합니다.
-- 그래서 RLS는 켜 두고 정책은 만들지 않습니다 = 브라우저에서 직접 접근 불가.

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
  nickname text,                           -- 별명 (학생 화면 위에 보여요)
  class_id uuid references classes(id) on delete set null,
  start_unit text,
  memo text,
  ai_autosend boolean default false,      -- 쌤 설정: AI 첨삭을 쌤 확인 없이 바로 보내기
  class_days int[] default '{2,5}',        -- 수업 요일 두 개 (0 일 ~ 6 토) · 기본 화 · 금
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

-- 문항 DB (엑셀 업로드로 채움)
create table if not exists units (
  id text primary key,                     -- 예: 기초①
  stage text not null,                     -- 예: 기초 과정
  ord int not null,                        -- 전체 순서
  title text not null,
  scope text,
  pass_score int default 6,
  status text default 'published' check (status in ('published','draft'))
);

create table if not exists unit_cards (
  unit_id text references units(id) on delete cascade,
  ord int not null,
  title text not null,
  body text not null,
  audio_url text,                          -- 쌤 음성 파일 (없으면 AI 음성)
  check_q text,                            -- 확인 한 문제
  check_a text,
  check_choices text,
  primary key (unit_id, ord)
);
alter table unit_cards add column if not exists audio_url text;
alter table unit_cards add column if not exists check_q text;
alter table unit_cards add column if not exists check_a text;
alter table unit_cards add column if not exists check_choices text;

create table if not exists words (
  unit_id text references units(id) on delete cascade,
  ord int default 0,                       -- 단어 순서
  grp text,
  word text not null,
  pos text,                                -- 품사 (n. v. adj. …)
  meaning text,
  colloc text,                             -- 콜로케이션 · 덩어리
  example text,                            -- 예문 (눌러서 듣기)
  example_ko text,                         -- 예문 뜻
  primary key (unit_id, word)
);
alter table words add column if not exists ord int default 0;
alter table words add column if not exists pos text;
alter table words add column if not exists example text;
alter table words add column if not exists example_ko text;
alter table words add column if not exists colloc text;   -- 콜로케이션 · 덩어리 (my family)

create table if not exists items (
  id text primary key,                     -- 유닛|활동|번호
  unit_id text references units(id) on delete cascade,
  activity text not null,                  -- arrange · find · ko2en · answer · test
  activity_label text,
  no int not null,
  prompt text not null,
  answer text,
  alt_answers text,
  error_code text,
  grading text,                            -- 자동 · 자동 (이유는 쌤 확인) · 쌤 첨삭
  purpose text default '연습',             -- 연습 · 복습 · 점검
  choices text,                            -- 고르기 보기 (a / an / the)
  picture text                             -- 그림 (이모지 또는 이미지 주소)
);
-- 이미 만든 DB라면: 보기 · 그림 칸 추가
alter table items add column if not exists choices text;
alter table items add column if not exists picture text;
alter table items add column if not exists memo text;  -- 쌤 참고 (볼 코드 · 예시 답)

create table if not exists error_codes (
  code text primary key,
  first_unit text,
  name text not null,                      -- 쌤 · 학부모가 보는 쉬운 이름
  bubble text,                             -- 올리 말풍선
  why text                                 -- 왜 틀렸는지 한 줄 (첨삭 화면)
);
alter table error_codes add column if not exists why text;

create table if not exists stage_topics (
  stage text not null,
  no int not null,
  format text,
  topic text not null,
  link text,
  primary key (stage, no)
);

-- 학습 기록
create table if not exists attempts (
  id bigint generated always as identity primary key,
  student_id uuid references profiles(id) on delete cascade,
  item_id text,
  unit_id text,
  activity text,
  context text not null,                   -- unit · test · review · weekly · final · task
  response text,
  correct boolean,                         -- 쌤 첨삭 문항은 null
  error_code text,
  reason text,
  created_at timestamptz default now()
);
create index if not exists attempts_student_time on attempts(student_id, created_at desc);

create table if not exists unit_progress (
  student_id uuid references profiles(id) on delete cascade,
  unit_id text references units(id) on delete cascade,
  step int default 0,
  test_score int,
  test_tries int default 0,
  fails_in_row int default 0,
  passed boolean default false,
  skipped boolean default false,
  updated_at timestamptz default now(),
  primary key (student_id, unit_id)
);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  student_id uuid references profiles(id) on delete cascade,
  error_code text not null,
  due_date date not null,
  done boolean default false,
  created_at timestamptz default now()
);

-- 글쓰기 제출 · 첨삭
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  kind text not null,                      -- unit_answer · weekly · final · task
  ref text,                                -- 유닛 id · 단계 · 과제 id
  title text,
  text_content text,
  photo_path text,
  status text default 'submitted' check (status in ('submitted','returned')),
  ai_draft jsonb,
  corrected_text text,
  markup_path text,
  teacher_comment text,
  error_codes text[],
  rubric jsonb,
  decision text,                           -- final: pass · redo
  seen boolean default false,
  created_at timestamptz default now(),
  returned_at timestamptz,
  parent_id uuid references submissions(id) on delete set null,  -- 고쳐 쓰기: 원래 제출
  rewrite_wanted boolean default false,    -- 쌤이 고쳐 쓰기를 요청했나
  rewrite_done boolean default false       -- 학생이 고쳐 쓴 글을 냈나
);
alter table submissions add column if not exists parent_id uuid references submissions(id) on delete set null;
alter table submissions add column if not exists rewrite_wanted boolean default false;
alter table submissions add column if not exists rewrite_done boolean default false;
alter table submissions add column if not exists page text;  -- 워크시트 쪽: p12 · p67 · p8 · p9 · p10

-- 이번 주 할 일 체크 (앱 활동 · 수업 칸)
create table if not exists unit_checks (
  student_id uuid references profiles(id) on delete cascade,
  unit_id text references units(id) on delete cascade,
  task text not null,                      -- vocab · warmup · practice · class1 · class2
  score int,
  total int,
  done_at timestamptz default now(),
  primary key (student_id, unit_id, task)
);

-- 주간 점검
create table if not exists weekly_runs (
  student_id uuid references profiles(id) on delete cascade,
  week_start date not null,
  available_from date not null,
  status text default 'pending' check (status in ('pending','done','skipped')),
  unit_ids text[],
  item_ids text[],
  score int,
  total int,
  primary key (student_id, week_start)
);

-- 최종 점검 (단계 끝)
create table if not exists final_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  stage text not null,
  part1_score int,
  part1_total int,
  submission_id uuid references submissions(id) on delete set null,
  status text default 'submitted' check (status in ('part1','submitted','passed','redo')),
  created_at timestamptz default now()
);

-- 추가 과제
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid,
  title text not null,
  mode text not null,                      -- units · weakness · writing
  unit_ids text[],
  count int default 10,
  writing_prompt text,
  message text,
  due_date date,
  created_at timestamptz default now()
);
create table if not exists task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  item_ids text[],
  status text default 'assigned' check (status in ('assigned','done')),
  score int,
  completed_at timestamptz,
  primary key (task_id, student_id)
);

-- 학부모 리포트
create table if not exists reports (
  student_id uuid references profiles(id) on delete cascade,
  month text not null,                     -- 2026-11
  comment text,
  token text unique default encode(gen_random_bytes(12), 'hex'),
  sent_at timestamptz,
  primary key (student_id, month)
);

-- RLS 켜기 (정책 없음 = 서버만 접근)
do $$ declare t text; begin
  foreach t in array array['classes','profiles','units','unit_cards','words','items','error_codes','stage_topics',
    'attempts','unit_progress','reviews','submissions','weekly_runs','final_checks','tasks','task_assignees','reports','unit_checks']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists class_days int[] default '{2,5}';

-- 서버(관리자 키)에 표 사용 권한 주기
-- (2026년부터 새 Supabase 프로젝트는 이걸 직접 써 줘야 해요. 브라우저용 키에는 주지 않아요.)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- 사진 저장소 (비공개)
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false)
on conflict (id) do nothing;
