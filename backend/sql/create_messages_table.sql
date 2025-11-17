-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Messages table for instructor <-> student chat and optional course-threaded messages
create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  sender_id uuid null references public.users(id) on delete set null,
  recipient_id uuid null references public.users(id) on delete set null,
  course_id uuid null references public.courses(id) on delete cascade, -- optional: message tied to a course
  thread_id uuid null,             -- optional: group messages into threads/rooms
  subject text null,
  body text not null,
  read boolean not null default false, -- whether recipient has read it
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null,
  is_deleted boolean not null default false, -- soft-delete flag if desired
  constraint messages_pkey primary key (id)
);

-- Indexes for common lookups
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_recipient_idx on public.messages(recipient_id);
create index if not exists messages_course_idx on public.messages(course_id);
create index if not exists messages_thread_idx on public.messages(thread_id);
create index if not exists messages_created_at_idx on public.messages(created_at);

-- Optional: partial index for unread messages (fast unread counts)
create index if not exists messages_unread_idx on public.messages(recipient_id, created_at) where read = false;

-- Optional: simple full-text search index on subject+body (adjust language as needed)
-- create index if not exists messages_fts_idx on public.messages using gin (to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,'')));

-- Optional: RLS policy examples (adapt to your RLS setup; uncomment & adjust if using RLS)
-- enable row level security
-- alter table public.messages enable row level security;
-- allow senders to insert their own messages
-- create policy "messages_insert_own" on public.messages for insert using (auth.uid() is not null) with check (sender_id = auth.uid());
-- allow sender/recipient to select their messages
-- create policy "messages_select_owner" on public.messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
-- allow sender/recipient to update read/is_deleted (or other columns) only for their rows
-- create policy "messages_update_owner" on public.messages for update using (sender_id = auth.uid() or recipient_id = auth.uid()) with check (recipient_id = auth.uid() or sender_id = auth.uid());

-- Notes:
-- - If you prefer enrollments.course_id (text) mapping, you can also add course_code text instead of course_id UUID.
-- - After running this SQL in Supabase, refresh the API/schema cache so PostgREST recognizes the new table.
