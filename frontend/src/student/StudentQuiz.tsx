import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * StudentQuiz
 * - visit /student/quizzes?course_db_id=... to list quizzes for a course
 * - click "Take quiz" to open a quiz, answer questions, submit, and see score
 */

type QuizSummary = { id: string; title: string; questions?: any[]; created_at?: string };
type QuizDetail = { id: string; title: string; questions: { text: string; options: string[]; correctIndex?: number }[] };

export default function StudentQuiz(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const courseDbIdParam = params.get('course_db_id');

  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

  const [courseId] = useState<string | null>(courseDbIdParam);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = courseId ? `?course_db_id=${encodeURIComponent(courseId)}` : '';
        const res = await fetch(`${API_BASE}/users/courses/quizzes/${q}`);
        if (!res.ok) throw new Error(`Failed to load quizzes: ${res.status}`);
        const json = await res.json();
        // backend returns { quizzes: [...] } per earlier view
        const list = json.quizzes ?? json?.quizzes ?? json;
        setQuizzes(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setError(e?.message || String(e));
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  async function openQuiz(id: string) {
    setError(null);
    setSelectedQuiz(null);
    setAnswers([]);
    setScore(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/courses/quizzes/${encodeURIComponent(id)}/`);
      if (!res.ok) throw new Error(`Failed to load quiz: ${res.status}`);
      const json = await res.json();
      const q: QuizDetail = json.quiz || json;
      setSelectedQuiz(q);
      setAnswers(Array(q.questions?.length ?? 0).fill(-1));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function pickAnswer(qIdx: number, optIdx: number) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[qIdx] = optIdx;
      return copy;
    });
  }

  async function submitAttempt() {
    if (!selectedQuiz) return;
    // compute score (server also should validate)
    let correct = 0;
    for (let i = 0; i < selectedQuiz.questions.length; i++) {
      const q = selectedQuiz.questions[i];
      const choice = answers[i];
      if (choice >= 0 && q.correctIndex !== undefined && choice === q.correctIndex) correct++;
    }
    const obtained = correct;
    setScore(obtained);

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id ?? null;
      const payload = {
        quiz_id: selectedQuiz.id,
        student_id: studentId,
        answers,
        score: obtained,
      };
      const res = await fetch(`${API_BASE}/users/courses/quizzes/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // still show score locally but surface error
        setError(`Saved locally but server returned error: ${j?.error || res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-4 bg-white rounded shadow-sm">Loading…</div>;

  if (selectedQuiz) {
    return (
      <div className="p-4 bg-white rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-2">{selectedQuiz.title}</h2>
        <div className="space-y-4">
          {selectedQuiz.questions.map((q, qi) => (
            <div key={qi} className="border rounded p-3">
              <div className="font-medium mb-2">{qi + 1}. {q.text}</div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`q-${qi}`} checked={answers[qi] === oi} onChange={() => pickAnswer(qi, oi)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {score !== null && <div className="mt-4 text-sm text-green-700">You scored {score} / {selectedQuiz.questions.length}</div>}
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

        <div className="mt-4 flex gap-2">
          <button onClick={submitAttempt} disabled={submitting} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
          <button onClick={() => { setSelectedQuiz(null); setScore(null); setError(null); }} className="px-3 py-1 border rounded hover:shadow-sm transition">Back to list</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Available quizzes{courseId ? ` for course ${courseId}` : ''}</h2>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="text-sm text-slate-500">No quizzes available.</div>
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q) => (
            <li key={q.id} className="border rounded p-3 flex items-center justify-between hover:bg-slate-50 transition">
              <div>
                <div className="font-medium">{q.title}</div>
                <div className="text-xs text-slate-500">Questions: {Array.isArray(q.questions) ? q.questions.length : (q.questions ? q.questions.length : '—')}</div>
              </div>
              <div>
                <button onClick={() => openQuiz(q.id)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">Take quiz</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded hover:shadow-sm transition">Back</button>
      </div>
    </div>
  );
}
