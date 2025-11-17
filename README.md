# final-ed-project — LMS Prototype

This repository is a learning-management-system (LMS) prototype containing a React frontend (Supabase-based auth & UI) and a Django backend (Django REST Framework) that currently talks to the same Supabase Postgres database.

The README below summarizes the current architecture, important security issues, recommended architecture choices, a prioritized roadmap to make this a production-ready LMS, and quick steps you can take immediately.

## Contents

- Executive summary
- Detailed findings (auth, data flow, security)
- Recommended architecture choices
- Prioritized action plan (immediate, short-term, mid-term)
- Minimal data model for an LMS
- Quick developer setup & environment variables
- Small, safe fixes you can apply now
- Next steps

---

## Executive summary

- Frontend: React app using Supabase client (`frontend/src/supabaseClient.js`) for authentication and direct table access. Users are created via Supabase Auth and a row is inserted into the `users` table with a `role` field.
- Backend: Django + DRF. Backend is configured to use Supabase Postgres as its `DATABASES` backend, and also uses the Python Supabase client (`backend/core/supabase_client.py`) to query/insert into the same tables.
- The system currently mixes Supabase-first and Django-first patterns. The frontend authenticates with Supabase, while the backend trusts client-supplied user IDs and uses the Supabase client without verifying tokens — this is a major security problem.
- Secrets (Django SECRET_KEY, Supabase keys, OpenRouter API key) are committed in code; DEBUG is True. These must be removed and rotated immediately.

---

## Detailed findings

1. Authentication & data flow

- Frontend signs up and signs in users using Supabase Auth and then inserts a user row into `public.users` with `role` (student/instructor).
- Backend contains Django models with `managed = False` which map to Supabase-managed tables, and also uses the Python Supabase client to read/write tables (for courses, enrollments, etc.).
- Backend endpoints accept user IDs from request body and do not verify identity using an auth token (no Authorization header verification), making them vulnerable to impersonation and privilege escalation.

2. Security problems (HIGH priority)

- Secrets in repository: Django `SECRET_KEY`, Supabase anon/service keys, OpenRouter API key. Rotate and remove immediately.
- `DEBUG = True` and `ALLOWED_HOSTS = []` — unsafe for production.
- Backend trusts client-supplied user IDs (e.g., `create_course` expects `instructor_id` in the POST body).
- No token verification on backend endpoints. CORS is present but insufficient without authentication.

3. Architectural inconsistencies

- Two access patterns to data: Django ORM (Postgres) and Supabase client calls. Pick one primary approach to avoid code drift.
- No single source of truth for auth and user identity between frontend and backend.

---

## Recommended architecture choices (pick one)

Option A — Django-first (recommended if you need complex server-side logic):

- Use Django + DRF as the single backend and implement auth via Django or DRF JWT. Frontend calls Django APIs for all actions.
- Use Supabase Postgres as the database if you want (Django connects to it), but stop using supabase-js on the frontend for write/permission-sensitive operations.

Option B — Supabase-first (recommended for fastest build):

- Use Supabase Auth, RLS policies, Supabase Storage, and supabase-js on frontend. Move server-side logic to Supabase Edge Functions or keep a very small Django service for specialized tasks (AI). Ensure RLS policies enforce role-based access.

If you keep a mixed architecture, implement strict token verification in the backend and clearly define which side owns which responsibilities.

---

## Prioritized action plan (what to do now)

Immediate (do now):

- Remove secrets from the repository and store them in environment variables. Rotate any exposed keys.
- Set `DEBUG = False` for production and configure `ALLOWED_HOSTS`.
- Add `.gitignore` (if missing) and exclude `.env*`, build artifacts, and local DB files.

High priority (this week):

- Decide on the auth source of truth (Supabase vs Django). Implement token verification accordingly.
- Require Authorization: Bearer <token> on all backend endpoints and use the verified token's user id rather than trusting the request body.
- Implement role checks on protected endpoints (e.g., only instructor can create courses).

Medium term (2–8 weeks):

- Finalize the data model (see below) and implement full API endpoints with DRF or Supabase RLS.
- Implement frontend flows for course creation, enrollment, lessons, assignments, submissions, grading, progress tracking.
- Add file storage for resources (Supabase Storage or S3 via Django storage backend).

Longer term (8–12 weeks):

- Add tests, CI, monitoring, backups, and deploy to production with secure env configuration.

---

## Minimal data model (MVP entities)

- User: id, email, username, role (student/instructor/admin), profile fields
- Course: id, course_id, name, description, instructor_id, created_at
- Module / Lesson: id, course_id, title, content, order, resources
- Enrollment: id, course_id, student_id, enrolled_at, status
- Assignment: id, course_id, title, description, due_date, max_points
- Submission: id, assignment_id, student_id, file_url, grade, feedback, submitted_at
- Progress: id, user_id, course_id, lesson_id, status/completion
- Discussion / Comment: id, course_id, user_id, content, parent_id

---

## Quick developer setup & environment variables

The project uses a backend Django app in `backend/` and a React frontend in `frontend/`.

Backend environment variables (set in your server environment or a `.env` which must NOT be committed):

- DJANGO_SECRET_KEY
- DATABASE_URL (or the individual DB variables in `core/settings.py`)
- SUPABASE_URL
- SUPABASE_KEY (service role key for server-side operations)
- OPENROUTER_API_KEY (if using the AI/chat view)

Frontend environment variables (for CRA, place in `.env.local`):

- REACT_APP_SUPABASE_URL
- REACT_APP_SUPABASE_ANON_KEY

Example (Windows PowerShell) to set env vars for development:

```powershell
$env:REACT_APP_SUPABASE_URL = "https://your-supabase-url"
$env:REACT_APP_SUPABASE_ANON_KEY = "your-anon-key"
$env:DJANGO_SECRET_KEY = "your-django-secret"
```

Make sure to rotate keys that were previously committed.

---

## Small, safe fixes you can apply now (I can implement these for you)

1. Move secrets to environment variables:

- Replace hard-coded keys in `backend/core/supabase_client.py`, `frontend/src/supabaseClient.js`, and `core/settings.py` to use `os.environ.get(...)` or `process.env.REACT_APP_...`.

2. Protect backend endpoints by verifying Supabase access tokens:

- Require `Authorization: Bearer <access_token>` and verify token on the backend. Use the verified token's user id for any user-related operations.

3. Ensure frontend only uses the anon key and never a service role key.

If you want, I will implement (1) now and then (2). Pick which to do first.

---

## Next steps & how I can help

- I can patch the repository to remove hard-coded secrets and use environment variables.
- I can update `create_course` and `join_course` views so the backend verifies the Supabase JWT and uses token user id and role checks (recommended next change).
- I can create example DRF endpoints, tests, and a small migration for the minimal LMS schema.

If you'd like, tell me which of the immediate fixes to apply first and I will make the code changes and run basic checks.

---

## Contact / notes

This README was generated from a code review of the frontend and backend files in this repository on Oct 25, 2025. It contains security-sensitive recommendations; take immediate action to rotate any keys found in the repo.

Good luck — if you want I can start implementing the safe fixes now.
