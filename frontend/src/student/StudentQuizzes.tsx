import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * StudentQuizzes
 * - visit /student/quizzes?course_db_id=... (or route without course_db_id) to list quizzes
 * - "Take quiz" opens an in-page modal. Student answers, submits, sees score and submission stored server-side.
 *
 * Note: Add a Router entry to render this component at /student/quizzes.
 */

type QuizSummary = { id: string; title: string; questions?: any[]; created_at?: string; course_db_id?: string };
type QuizDetail = { id: string; title: string; questions: { text: string; options: string[]; correctIndex?: number }[]; course_db_id?: string };

export default function StudentQuizzes(): JSX.Element {
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
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = courseId ? `?course_db_id=${encodeURIComponent(courseId)}` : '';
        const res = await fetch(`${API_BASE}/users/courses/quizzes/${q}`);
        if (!res.ok) throw new Error(`Failed to load quizzes: ${res.status}`);
        const json = await res.json();
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
      setShowModal(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
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
    // compute score locally (backend also stores what we send)
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
        setError(`Server returned error: ${j?.error || res.status}`);
      } else {
        // optionally refresh list or close modal
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Quizzes{courseId ? ` — course ${courseId}` : ''}</h2>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded text-sm">Back</button>
        </div>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Loading quizzes…</div>
      ) : quizzes.length === 0 ? (
        <div className="text-sm text-slate-500">No quizzes available.</div>
      ) : (
        <ul className="space-y-3">
          {quizzes.map((q) => (
            <li key={q.id} className="border rounded-lg p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <div>
                <div className="text-sm font-medium">{q.title}</div>
                <div className="text-xs text-slate-500">{Array.isArray(q.questions) ? `${q.questions.length} question${q.questions.length > 1 ? 's' : ''}` : '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openQuiz(q.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition">Take quiz</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal / inline runner */}
      {showModal && selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowModal(false); setSelectedQuiz(null); setScore(null); setError(null); }} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl p-6 z-50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedQuiz.title}</h3>
              <button onClick={() => { setShowModal(false); setSelectedQuiz(null); setScore(null); setError(null); }} className="px-2 py-1 border rounded">Close</button>
            </div>

            <div className="space-y-4">
              {selectedQuiz.questions.map((q, qi) => (
                <div key={qi} className="border rounded p-3">
                  <div className="font-medium mb-2">{qi + 1}. {q.text}</div>
                  <div className="space-y-2">
                    {q.options.map((opt: string, oi: number) => (
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
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowModal(false); setSelectedQuiz(null); setScore(null); setError(null); }} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={submitAttempt} disabled={submitting} className="px-3 py-1 bg-indigo-600 text-white rounded">{submitting ? 'Submitting…' : 'Submit quiz'}</button>
            </div>
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
