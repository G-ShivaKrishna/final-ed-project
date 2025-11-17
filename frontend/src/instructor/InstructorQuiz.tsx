import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

type Question = {
  text: string;
  options: string[];
  correctIndex: number;
};

export default function InstructorQuiz(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const preCourse = params.get('course_db_id') ?? (location.state as any)?.course_db_id ?? '';

  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState<string>(preCourse || '');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;
        const res: any = await supabase
          .from('courses')
          .select('id, name, course_id')
          .eq('instructor_id', userId)
          .order('created_at', { ascending: false });
        if (!res.error && Array.isArray(res.data)) setCourses(res.data);
      } catch (e) { /* ignore */ }
    }
    loadCourses();
  }, []);

  useEffect(() => { if (preCourse) setCourseId(preCourse); }, [preCourse]);

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }
  function addQuestion() {
    if (questions.length >= 10) return;
    setQuestions(p => [...p, { text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  }
  function removeQuestion(i: number) { setQuestions(p => p.filter((_, idx) => idx !== i)); }

  async function submitQuiz() {
    setError(null);
    setMsg(null);
    if (!courseId) { setError('Select a course'); return; }
    if (!title.trim()) { setError('Enter a title'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setError(`Question ${i + 1} text required`); return; }
      if (q.options.some(o => !o.trim())) { setError(`All options for Q${i + 1} must be filled`); return; }
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;
      const payload = { course_db_id: courseId, title: title.trim(), questions, created_by: userId };
      const res: any = await supabase.from('quizzes').insert([payload]).select().single();
      if (res.error) throw res.error;
      setMsg('Quiz created');
      setTitle('');
      setQuestions([{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
      // optionally navigate back to course
      // navigate(`/instructor-dashboard?view=courses&course_db_id=${encodeURIComponent(courseId)}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Create Quiz (up to 10 questions)</h2>
      {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-2 text-sm text-green-600">{msg}</div>}

      <div className="mb-3">
        <label className="block text-xs text-slate-600">Course</label>
        <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full border px-2 py-1 rounded">
          <option value="">Select course…</option>
          {courses.map(c => <option key={c.id} value={String(c.id)}>{c.name} ({c.course_id ?? '—'})</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-xs text-slate-600">Quiz title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border px-2 py-1 rounded" />
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div
            key={qi}
            className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 pl-5"
          >
            {/* left indigo accent */}
            <span className="absolute left-0 top-0 h-full w-1.5 bg-indigo-600 rounded-l-lg" aria-hidden />

            <div className="flex items-start justify-between">
              <div className="w-full">
                {/* indigo badge for question number */}
                <div className="mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    Question {qi + 1}
                  </span>
                </div>

                <input
                  value={q.text}
                  onChange={e => updateQuestion(qi, { text: e.target.value })}
                  className="w-full border px-2 py-1 rounded mt-1"
                  placeholder="Enter question text"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                  {q.options.map((opt, oi) => {
                    const selected = q.correctIndex === oi;
                    return (
                      <div key={oi} className="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                        <input
                          className="w-full border px-2 py-1 rounded"
                          value={opt}
                          onChange={e => {
                            const newOpts = [...q.options];
                            newOpts[oi] = e.target.value;
                            updateQuestion(qi, { options: newOpts });
                          }}
                          placeholder={`Option ${oi + 1}`}
                        />
                        <label className={`text-xs ml-2 ${selected ? 'text-indigo-600 font-medium' : ''}`}>
                          <input
                            type="radio"
                            className="mr-1 align-middle"
                            checked={selected}
                            onChange={() => updateQuestion(qi, { correctIndex: oi })}
                          />
                          correct
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ml-3">
                <button
                  type="button"
                  onClick={() => removeQuestion(qi)}
                  disabled={questions.length === 1}
                  className="px-2 py-1 text-sm border rounded text-red-600 hover:bg-red-50 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={addQuestion} disabled={questions.length >= 10} className="px-3 py-1 bg-indigo-600  rounded hover:bg-indigo-750  transition">Add question</button>
        <button type="button" onClick={submitQuiz} disabled={saving} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">{saving ? 'Saving…' : 'Create quiz'}</button>
        <button type="button" onClick={() => navigate(-1)} className="px-3 py-1 border rounded hover:shadow-sm transition">Back</button>
      </div>
    </div>
  );
}
