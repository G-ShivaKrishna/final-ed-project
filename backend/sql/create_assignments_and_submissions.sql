-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Assignments table
create table if not exists public.assignments (
  id uuid not null default gen_random_uuid(),
  course_db_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text null,
  due_date timestamp with time zone null,
  points integer null,
  created_at timestamp with time zone not null default now(),
  created_by uuid null references public.users(id) on delete set null,
  constraint assignments_pkey primary key (id)
);

create index if not exists assignments_course_idx on public.assignments(course_db_id);
create index if not exists assignments_due_idx on public.assignments(due_date);

-- Submissions table
create table if not exists public.submissions (
  id uuid not null default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  submitted_at timestamp with time zone not null default now(),
  file_url text null,
  text_submission text null,
  status text not null default 'submitted', -- submitted | graded | resubmitted
  grade numeric null,
  feedback text null,
  grader_id uuid null references public.users(id) on delete set null,
  graded_at timestamp with time zone null,
  constraint submissions_pkey primary key (id)
);

create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists submissions_student_idx on public.submissions(student_id);

-- Course resources (syllabus entries + videos)
create table if not exists public.course_resources (
  id uuid not null default gen_random_uuid(),
  course_db_id uuid not null references public.courses(id) on delete cascade,
  type text not null check (type in ('syllabus','video')),
  title text null,
  content text null,    -- syllabus text or notes
  video_url text null,  -- YouTube link when type='video'
  created_at timestamp with time zone not null default now(),
  created_by uuid null references public.users(id) on delete set null,
  constraint course_resources_pkey primary key (id)
);

create index if not exists course_resources_course_idx on public.course_resources(course_db_id);

-- Optional: RLS policy templates (uncomment & adapt to your RLS)
-- alter table public.assignments enable row level security;
-- create policy "assignments_insert_instructor" on public.assignments for insert using (auth.uid() is not null) with check (created_by = auth.uid());
-- create policy "assignments_select" on public.assignments for select using (true);
-- alter table public.submissions enable row level security;
-- create policy "submissions_insert_student" on public.submissions for insert using (auth.uid() is not null) with check (student_id = auth.uid());
-- create policy "submissions_select_owner" on public.submissions for select using (student_id = auth.uid() or exists (select 1 from courses where id = (select course_db_id from assignments where id = assignment_id) and instructor_id = auth.uid()));
-- alter table public.course_resources enable row level security;
-- create policy "resources_manage" on public.course_resources for insert, update, delete using (true) with check (created_by = auth.uid());
-- create policy "resources_select" on public.course_resources for select using (true);

-- Notes:
-- After running this SQL, refresh PostgREST / Supabase schema cache. The backend views below expect these tables.
