import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

// URL helpers (retain)
function resolveHref(raw?: string | null) : string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return window.location.protocol + s;
  if (s.startsWith('/')) return window.location.origin + s;
  return `${API_BASE.replace(/\/$/, '')}/${s.replace(/^\//, '')}`;
}

// Better extractor: checks content for explicit URLs, "Attachment:" patterns,
// and common fields that may contain storage URLs. Returns a usable absolute href or null.
function extractUrlFromTextOrResource(rawText?: string | null, resource?: any): string | null {
  const t = String(rawText ?? '').trim();
  // 1) explicit http(s) URL inside text
  const m = t.match(/https?:\/\/[^\s'"]+/i);
  if (m) return resolveHref(m[0]);

  // 2) common "Attachment:" or "Attachment - " pattern followed by a URL
  const attach = t.match(/attachment[:\s-]*([^\s'"]+)/i);
  if (attach && attach[1]) {
    return resolveHref(attach[1]);
  }

  // 3) if resource object provided, try a few known fields
  if (resource && typeof resource === 'object') {
    const candidates = ['file_url', 'url', 'link', 'video_url', 'content', 'path', 'storage_path'];
    for (const k of candidates) {
      const v = resource[k];
      if (v) {
        // if content field contains an embedded URL, reuse that extraction
        if (k === 'content') {
          const cm = String(v).match(/https?:\/\/[^\s'"]+/i);
          if (cm) return resolveHref(cm[0]);
        } else {
          // accept raw URL or relative path
          const s = String(v).trim();
          if (s) {
            // ignore placeholder '#'
            if (s === '#' || s === '') continue;
            return resolveHref(s);
          }
        }
      }
    }
  }

  // 4) nothing found
  return null;
}

type Material = { id: string; title: string; uploadedAt?: string; link?: string; description?: string; type?: string; created_at?: string };
type Assignment = { id: string; title: string; due_date: string; status: string; points?: number; description?: string; submitted_file?: string; submission?: any };
type Quiz = { id: string; title: string; questions?: any[] };

export default function CourseDetail(): JSX.Element {
  const params = useParams();
  const idParam = (params as any).id ?? (params as any).courseId ?? (params as any).course_db_id ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const navCourse = (location.state as any)?.course ?? null;

  // Normalize incoming course
  function prettifyId(raw?: string | null) {
    if (!raw) return 'Course';
    try {
      let s = String(raw);
      s = decodeURIComponent(s);
      s = s.replace(/[_\-+]+/g, ' ').replace(/\s+/g, ' ').trim();
      s = s.split(' ').map((w) => w ? (w[0].toUpperCase() + w.slice(1)) : '').join(' ');
      return s || 'Course';
    } catch {
      return String(raw);
    }
  }
  function normalizeCourseObject(obj: any, fallbackId?: string | null) {
    if (!obj || typeof obj !== 'object') return { id: fallbackId ?? String(fallbackId ?? ''), code: '', title: prettifyId(fallbackId) };
    const title = obj.title || obj.name || obj.course_name || obj.display_name || obj.courseTitle || obj.courseTitleString || obj.label || obj.full_name;
    const code = obj.code || obj.course_code || obj.courseId || obj.course_id || obj.courseIdString || '';
    // ensure correct precedence when mixing || and ??
    const id = obj.id || obj.course_id || obj.courseId || (fallbackId ?? '');
    return { id: String(id), code: String(code || ''), title: String(title || code || prettifyId(fallbackId)) };
  }

  const initialCourse = normalizeCourseObject(navCourse, idParam);
  const [course, setCourse] = React.useState(initialCourse);

  // tabs: syllabus, assignments, quizzes
  const [tab, setTab] = React.useState<'syllabus' | 'assignments' | 'quizzes'>('syllabus');

  // dynamic state (no static SAMPLE data)
  const [syllabusState, setSyllabusState] = React.useState<Material[]>([]);
  const [assignmentsState, setAssignmentsState] = React.useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // quiz interaction state
  const [activeQuiz, setActiveQuiz] = React.useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = React.useState<number[]>([]);
  const [quizSubmitting, setQuizSubmitting] = React.useState(false);
  const [quizScore, setQuizScore] = React.useState<number | null>(null);
  const [quizError, setQuizError] = React.useState<string | null>(null);

  // submission upload
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingUploadFor, setPendingUploadFor] = React.useState<string | number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Fetch course meta once
  React.useEffect(() => {
    if (!idParam) return;
    (async () => {
      try {
        const urls = [
          `${API_BASE}/users/courses/detail/?course_db_id=${encodeURIComponent(String(idParam))}`,
          `${API_BASE}/users/courses/?course_db_id=${encodeURIComponent(String(idParam))}`,
        ];
        for (const u of urls) {
          try {
            const r = await fetch(u);
            if (!r.ok) continue;
            const j = await r.json().catch(()=>null);
            if (!j) continue;
            const candidate = j.course ?? j.data?.course ?? j.data ?? j;
            if (candidate && typeof candidate === 'object') {
              setCourse(normalizeCourseObject(candidate, idParam));
              break;
            }
          } catch {}
        }
      } catch {}
    })();
  }, [idParam]);

  // Fetch data per-tab
  React.useEffect(() => {
    if (!idParam) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? '';
        setStudentId(userId || null);

        if (tab === 'syllabus') {
          const res = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(String(idParam))}&user_id=${encodeURIComponent(userId)}`);
          const json = await res.json().catch(()=>[]);
          if (!cancelled) setSyllabusState(res.ok && Array.isArray(json) ? json : []);
        } else if (tab === 'assignments') {
          const res = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(idParam))}&user_id=${encodeURIComponent(userId)}`);
          const json = await res.json().catch(()=>[]);
          if (res.ok && Array.isArray(json)) {
            const normalized = json.map(a => {
              if (a.due_date) { try { a.due_date = new Date(a.due_date).toISOString(); } catch {} }
              return a;
            });
            if (!cancelled) setAssignmentsState(normalized);
          } else if (!cancelled) setAssignmentsState([]);
        } else if (tab === 'quizzes') {
          const res = await fetch(`${API_BASE}/users/courses/quizzes/?course_db_id=${encodeURIComponent(String(idParam))}${studentId ? `&student_id=${encodeURIComponent(studentId)}` : ''}`);
          const json = await res.json().catch(()=>[]);
          if (res.ok) {
            const list = Array.isArray(json) ? json : (json.quizzes ?? []);
            const normalized = list.map((q: any) => {
              let questions = q.questions;
              if (!Array.isArray(questions) && typeof questions === 'string') {
                try {
                  const parsed = JSON.parse(questions);
                  if (Array.isArray(parsed)) questions = parsed;
                  else questions = [];
                } catch { questions = []; }
              }
              if (!Array.isArray(questions)) questions = [];
             const total = Array.isArray(questions) ? questions.length : 0;
              return { ...q, questions, total_points: total };
            });
            setQuizzes(normalized);
          } else if (!cancelled) setQuizzes([]);
        }
      } catch (e:any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idParam, tab, studentId]);

  // Quiz handlers
  async function openQuiz(quizId: string) {
    setQuizError(null);
    setQuizScore(null);
    setActiveQuiz(null);
    setQuizAnswers([]);
    try {
     const res = await fetch(`${API_BASE}/users/courses/quizzes/${encodeURIComponent(quizId)}/?${studentId ? `student_id=${encodeURIComponent(studentId)}` : ''}`);
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.error || `Failed to load quiz`);
      const q = j.quiz ?? j;
      let questions = q.questions;
      if (!Array.isArray(questions) && typeof questions === 'string') {
        try {
          const parsed = JSON.parse(questions);
          if (Array.isArray(parsed)) questions = parsed; else questions = [];
        } catch { questions = []; }
      }
      if (!Array.isArray(questions)) questions = [];
      // prevent opening if already submitted: show summary only
      if (q.has_submitted) {
        setActiveQuiz({ id: q.id, title: q.title, questions: [], });
        setQuizScore(q.student_submission?.score ?? null);
        return;
      }
      setActiveQuiz({ id: q.id, title: q.title, questions });
      setQuizAnswers(Array(questions.length).fill(-1));
    } catch (e:any) {
      setQuizError(e?.message || 'Quiz load failed');
    }
  }

  function pickQuizAnswer(idx: number, opt: number) {
    setQuizAnswers(prev => {
      const copy = [...prev];
      copy[idx] = opt;
      return copy;
    });
  }

  async function submitQuizAttempt() {
    if (!activeQuiz) return;
    if (quizScore !== null) return;
    setQuizSubmitting(true);
    setQuizError(null);
    try {
      let correct = 0;
      for (let i = 0; i < activeQuiz.questions!.length; i++) {
        const q = activeQuiz.questions![i];
        const ans = quizAnswers[i];
        if (ans >= 0 && q.correctIndex !== undefined && ans === q.correctIndex) correct++;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id;
      const payload = { quiz_id: activeQuiz.id, student_id: studentId, answers: quizAnswers, score: correct };
      const res = await fetch(`${API_BASE}/users/courses/quizzes/submit/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await res.json().catch(()=>{});
      if (!res.ok) {
        setQuizError(j?.error || `Submit failed: ${res.status}`);
      } else {
        setQuizzes(prev =>
          prev.map(q => q.id === activeQuiz.id
            ? { ...q, has_submitted: true, student_submission: { score: correct } }
            : q
          )
        );
        // CLOSE quiz view and return to list
        setActiveQuiz(null);
        setQuizAnswers([]);
        setQuizScore(null);
      }
    } catch (e:any) {
      setQuizError(e?.message || 'Submit failed');
    } finally {
      setQuizSubmitting(false);
    }
  }

  function closeActiveQuiz() {
    setActiveQuiz(null);
    setQuizAnswers([]);
    setQuizScore(null);
    setQuizError(null);
  }

  // Upload helpers
  async function getPublicUrlOrSigned(bucket: string, path: string) {
    try {
      const pubRes = await supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = (pubRes as any)?.data?.publicUrl || (pubRes as any)?.publicURL || (pubRes as any)?.public_url || '';
      if (publicUrl) return publicUrl;

      // fall back to signed URL (valid for 1 hour)
      const { data: signedData, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!signedErr && signedData?.signedURL) return signedData.signedURL;
    } catch (e) {
      console.warn('getPublicUrlOrSigned failed', e);
    }
    return '';
  }
  async function uploadSubmissionFile(file: File, courseId: string | number, assignmentId: string | number, studentId: string) {
    if (!file) return '';
    try {
      const path = `${courseId}/${assignmentId}/${studentId}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage.from('submissions').upload(path, file, { upsert: true });
      if (error) throw error;
      const publicUrl = await getPublicUrlOrSigned('submissions', path);
      return publicUrl;
    } catch (err) {
      console.warn('uploadSubmissionFile failed', err);
      return '';
    }
  }
  function markAsSubmitted(id: string | number, filename?: string) {
    setAssignmentsState(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'graded' ? a.status : 'submitted', submitted_file: filename ?? a.submitted_file } : a));
  }
  function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    const idFor = pendingUploadFor;
    e.currentTarget.value = '';
    if (!file || idFor == null) {
      setPendingUploadFor(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setUploadError('Please upload a PDF file.');
      setPendingUploadFor(null);
      return;
    }

    // upload to storage then POST to backend submit endpoint with public URL
    (async () => {
      setUploading(true);
      setUploadError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const studentId = sessionData?.session?.user?.id;
        if (!studentId) throw new Error('Not authenticated');
        const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
        const courseDbId = idParam; // removed uploadCourseId

        const publicUrl = await uploadSubmissionFile(file, courseDbId ?? 'public', idFor, studentId);
        if (!publicUrl) throw new Error('Upload failed');

        const body = { student_id: studentId, assignment_id: idFor, file_url: publicUrl };
        const res = await fetch(`${API_BASE}/users/courses/assignments/submit/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(j?.error || `Submit failed: ${res.status}`);
          markAsSubmitted(idFor, file.name);
        } else {
          // successful submit: mark locally and refresh assignments from backend
          markAsSubmitted(idFor, file.name);
          // refresh course assignments from backend to pull saved submission record
          if (idParam) {
            // re-run fetchCourseData
            try {
              const { data: sessionData2 } = await supabase.auth.getSession();
              const userId = sessionData2?.session?.user?.id;
              const ares = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(idParam))}&user_id=${encodeURIComponent(String(userId ?? ''))}`);
              const ajson = await ares.json().catch(() => []);
              if (ares.ok) {
                const normalized = (Array.isArray(ajson) ? ajson : (ajson?.data ?? [])).map((a: any) => {
                  if (a.due_date) { try { a.due_date = new Date(a.due_date).toISOString(); } catch (_) {} }
                  return a;
                });
                if (normalized.length) setAssignmentsState(normalized);
              }
            } catch (_e) { /* ignore */ }
          }
        }
      } catch (err: any) {
        setUploadError(err?.message || String(err));
        markAsSubmitted(idFor, file.name);
      } finally {
        setUploading(false);
        setPendingUploadFor(null);
      }
    })();
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-md bg-white shadow flex items-center justify-center"> <ChevronLeft size={18} /></button>
          <div>
            <h1 className="text-2xl font-semibold">{course.title}</h1>
            {/* show code when it is meaningful and distinct from the title */}
            <div className="text-sm text-slate-500">
              {(course.code && course.code.trim() && course.code !== course.title) ? course.code : ''}
            </div>
          </div>
          {/* header actions (no join button) */}
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 border-b pb-3 mb-4">
            <button onClick={() => setTab('syllabus')} className={`px-3 py-2 rounded-md ${tab === 'syllabus' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Syllabus</button>
            <button onClick={() => setTab('assignments')} className={`px-3 py-2 rounded-md ${tab === 'assignments' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Assignments</button>
            <button onClick={() => setTab('quizzes')} className={`px-3 py-2 rounded-md ${tab === 'quizzes' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Quizzes</button>
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

          {tab === 'syllabus' && (
            loading ? <div className="text-sm text-slate-500">Loading…</div> :
            syllabusState.length === 0 ? <div className="text-sm text-slate-500">No materials posted.</div> :
            <ul className="space-y-3">
              {syllabusState.map(m => (
                <li key={m.id} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{m.title}</div>
                      {m.type && <span className="text-xs text-slate-500 px-2 py-1 rounded bg-slate-100">{m.type}</span>}
                    </div>
                    {m.description && (
                      <div className="text-sm text-slate-600 mt-1">
                        {(() => {
                          const url = extractUrlFromTextOrResource(m.description, m);
                          if (url) {
                            const before = String(m.description).split(url)[0];
                            return (
                              <>
                                {before && <span>{before}</span>}
                                <div>
                                  <button type="button" onClick={() => window.open(url, '_blank','noopener')} className="text-indigo-600 underline">
                                    Download attachment
                                  </button>
                                </div>
                              </>
                            );
                          }
                          return <span>{m.description}</span>;
                        })()}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-2">Uploaded {m.uploadedAt ?? m.created_at ?? ''}</div>
                  </div>
                  {(() => {
                    const href = extractUrlFromTextOrResource(m.link ?? m.video_url ?? null, m) ?? extractUrlFromTextOrResource(m.description, m);
                    if (!href) return <span className="text-indigo-600 cursor-default">View</span>;
                    return <button type="button" onClick={() => window.open(href,'_blank','noopener')} className="text-indigo-600 underline">View</button>;
                  })()}
                </li>
              ))}
            </ul>
          )}

          {tab === 'assignments' && (
            loading ? <div className="text-sm text-slate-500">Loading…</div> :
            assignmentsState.length === 0 ? <div className="text-sm text-slate-500">No assignments posted.</div> :
            <ul className="space-y-3">
              {assignmentsState.map(a => (
                <li key={a.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      {a.description && (
                        <div className="text-sm text-slate-600 mt-1">
                          {(() => {
                            const url = extractUrlFromTextOrResource(a.description, a);
                            if (url) {
                              const before = String(a.description).split(url)[0];
                              return (
                                <>
                                  {before && <span>{before}</span>}
                                  <div>
                                    <button type="button" onClick={() => window.open(url,'_blank','noopener')} className="text-indigo-600 underline">
                                      Download attachment
                                    </button>
                                  </div>
                                </>
                              );
                            }
                            return <span>{a.description}</span>;
                          })()}
                        </div>
                      )}
                      {a.submission?.file_url && (
                        <div className="text-xs text-slate-600 mt-1">
                          <a href={a.submission.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download your submission</a>
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-2">Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No due date'}</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {a.submission?.grade !== undefined && a.submission?.grade !== null
                        ? `${a.submission.grade} / ${a.points ?? 10} pts`
                        : `${a.points ?? 10} pts`}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">Status: {a.status}{a.submitted_file ? ` — ${a.submitted_file}` : ''}</div>
                  <div className="mt-2">
                    {a.status === 'graded' ? (
                      <span className="text-xs px-2 py-1 border rounded text-slate-500">Graded</span>
                    ) : a.status === 'submitted' ? (
                      <span className="text-xs px-2 py-1 border rounded text-slate-700">Submitted</span>
                    ) : (
                      (uploading && pendingUploadFor === a.id) ? (
                        <button className="text-xs px-2 py-1 border rounded bg-indigo-400 text-white opacity-80" disabled>Uploading...</button>
                      ) : (
                        <button
                          onClick={() => {
                            setUploadError(null);
                            setPendingUploadFor(a.id);
                            setTimeout(() => fileInputRef.current?.click(), 50);
                          }}
                          className="text-xs px-2 py-1 border rounded bg-indigo-600 text-white"
                        >
                          Submit
                        </button>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'quizzes' && (
            loading ? <div className="text-sm text-slate-500">Loading…</div> :
            activeQuiz ? (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold">{activeQuiz.title}</h3>
                  <button onClick={closeActiveQuiz} className="px-2 py-1 border rounded text-sm">Close</button>
                </div>
                <div className="space-y-4 max-h-[55vh] overflow-auto">
                  {activeQuiz.questions?.map((q: any, qi: number) => (
                    <div key={qi} className="border rounded p-3">
                      <div className="font-medium mb-2">{qi + 1}. {q.text}</div>
                      <div className="space-y-2">
                        {Array.isArray(q.options) ? q.options.map((opt: string, oi: number) => (
                          <label key={oi} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`quiz-q-${qi}`}
                              checked={quizAnswers[qi] === oi}
                              onChange={() => pickQuizAnswer(qi, oi)}
                            />
                            <span>{opt}</span>
                          </label>
                        )) : <div className="text-xs text-slate-500">No options</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {quizScore !== null && (
                  <div className="mt-4 text-sm text-green-700">
                    You scored {quizScore} / {activeQuiz.questions?.length ?? 0}
                  </div>
                )}
                {quizError && <div className="mt-2 text-sm text-red-600">{quizError}</div>}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeActiveQuiz} className="px-3 py-1 border rounded">Cancel</button>
                  <button
                    onClick={submitQuizAttempt}
                    disabled={quizSubmitting}
                    className="px-3 py-1 bg-indigo-600 text-white rounded"
                  >
                    {quizSubmitting ? 'Submitting…' : 'Submit quiz'}
                  </button>
                </div>
              </div>
            ) : (
              quizzes.length === 0 ? <div className="text-sm text-slate-500">No quizzes available.</div> :
              <ul className="space-y-3">
                {quizzes.map(q => (
                  <li key={q.id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs text-slate-500">
                        {(Array.isArray(q.questions) ? `${q.questions.length}` : '0') + ' question(s)'}
                        {q.has_submitted && q.student_submission?.score != null ? (
                          <span className="ml-2 font-semibold text-green-600">
                            {q.student_submission.score} / {q.total_points ?? (Array.isArray(q.questions)? q.questions.length:0)} pts
                          </span>
                        ) : null}
                      </div>
                    </div>
                   {q.has_submitted ? (
                     <span className="px-3 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200">Completed</span>
                   ) : (
                     <button onClick={() => openQuiz(q.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Open quiz</button>
                   )}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        {uploadError && (
          <div className="fixed top-6 right-6 z-50 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded flex items-center gap-3">
            <div className="text-sm">{uploadError}</div>
            <button onClick={() => setUploadError(null)} className="text-sm text-red-600 underline">Dismiss</button>
          </div>
        )}

        {/* Hidden file input for assignment submission */}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
