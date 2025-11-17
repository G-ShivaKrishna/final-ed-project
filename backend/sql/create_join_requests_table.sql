-- Enable pgcrypto for gen_random_uuid() if not already enabled
create extension if not exists pgcrypto;

-- Create join_requests table
create table if not exists public.join_requests (
  id uuid not null default gen_random_uuid(),
  course_db_id uuid not null references public.courses(id) on delete cascade,
  course_code text not null,                 -- human-facing generated code (courses.course_id)
  student_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',    -- pending / accepted / rejected
  created_at timestamp without time zone not null default now(),
  constraint join_requests_pkey primary key (id),
  constraint join_requests_status_check check (status in ('pending','accepted','rejected'))
);

-- Indexes for efficient lookups
create index if not exists join_requests_course_db_id_idx on public.join_requests(course_db_id);
create index if not exists join_requests_student_id_idx on public.join_requests(student_id);
create index if not exists join_requests_status_idx on public.join_requests(status);

-- Optional: prevent more than one pending request per student per course
create unique index if not exists join_requests_unique_pending on public.join_requests(course_db_id, student_id)
  where status = 'pending';
