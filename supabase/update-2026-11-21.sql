-- 올리브 라이팅 · 2026-11-21 업데이트 (이번 주 할 일 · 워크시트 사진 · PREP 빼기)
-- 이미 사이트를 쓰고 있다면: Supabase > SQL Editor 에 이 파일만 붙여 넣고 Run 하세요. (한 번만)

-- 1. 학생 수업 요일 (기본 화 · 금)
alter table profiles add column if not exists class_days int[] default '{2,5}';
update profiles set class_days = '{2,5}' where role = 'student' and class_days is null;

-- 2. 단어: 순서 · 품사 · 예문 · 예문 뜻
alter table words add column if not exists ord int default 0;
alter table words add column if not exists pos text;
alter table words add column if not exists example text;
alter table words add column if not exists example_ko text;

-- 3. 워크시트 사진: 몇 쪽인지
alter table submissions add column if not exists page text;

-- 4. 이번 주 할 일 체크
create table if not exists unit_checks (
  student_id uuid references profiles(id) on delete cascade,
  unit_id text references units(id) on delete cascade,
  task text not null,
  score int,
  total int,
  done_at timestamptz default now(),
  primary key (student_id, unit_id, task)
);
alter table unit_checks enable row level security;
grant all on unit_checks to service_role;

-- 5. PREP 유닛 지우기 (설명 카드 · 단어 · 문항 · 진도가 같이 지워져요. 학생이 푼 기록은 남아요)
delete from units where id ilike 'P-Unit%' or id ilike 'P Unit%';
