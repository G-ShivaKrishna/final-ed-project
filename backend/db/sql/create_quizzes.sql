-- Enable pgcrypto for gen_random_uuid() if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Quizzes table: stores quiz metadata and questions JSON
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_db_id text NOT NULL,
  title text NOT NULL,
  questions jsonb NOT NULL,   -- array of { text, options: [..], correctIndex }
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL
);

-- Submissions table: stores students' answers and score
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  student_id text NOT NULL,
  answers jsonb NOT NULL,     -- array of selected option indexes or nulls
  score integer NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_quiz FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes (course_db_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz ON public.quiz_submissions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student ON public.quiz_submissions (student_id);

-- GIN indexes for JSONB queries if needed
CREATE INDEX IF NOT EXISTS gin_idx_quizzes_questions ON public.quizzes USING GIN (questions);
CREATE INDEX IF NOT EXISTS gin_idx_quiz_submissions_answers ON public.quiz_submissions USING GIN (answers);
