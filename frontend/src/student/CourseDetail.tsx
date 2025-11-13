import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
const API_BASE = (import.meta as any).env?.VITE_API_URL || window.location.origin;

// Resolve a resource link into an absolute URL safe to open in a new tab.
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

type Material = { id: string; title: string; uploadedAt: string; link?: string; description?: string; type?: string };
type Assignment = { id: string; title: string; due_date: string; status: string; points?: number; description?: string; postedAt?: string; submitted_file?: string };

const SAMPLE_COURSES: { id: string; code: string; title: string }[] = [
  { id: 'c1', code: '4-1 FAM', title: 'Foundations of Applied Math' },
  { id: 'c2', code: 'MATH101', title: 'Calculus I' },
  { id: 'c3', code: 'ENG202', title: 'English Composition' },
  { id: 'c4', code: 'CS105', title: 'Intro to Programming' },
];

const SAMPLE_SYLLABUS: Record<string, Material[]> = {
  c1: [
    { id: 's1', title: 'Course Syllabus (PDF)', uploadedAt: '2025-08-01', link: '#', type: 'pdf', description: 'Full course syllabus with grading policy and schedule.' },
    { id: 's2', title: 'Lecture 1 — Mathematical Foundations', uploadedAt: '2025-08-05', link: '#', type: 'notes', description: 'Overview of sets, relations, and functions.' },
    { id: 's6', title: 'Reading: Introduction to Applied Math', uploadedAt: '2025-08-07', link: '#', type: 'reading', description: 'Chapter 1 from the course textbook.' },
  ],
  c2: [
    { id: 's3', title: 'Syllabus & Schedule', uploadedAt: '2025-07-30', link: '#', type: 'pdf', description: 'Topics, office hours and assessment calendar.' },
    { id: 's7', title: 'Problem Set Examples', uploadedAt: '2025-08-06', link: '#', type: 'examples', description: 'Worked examples for limits and continuity.' },
  ],
  c3: [
    { id: 's4', title: 'Course Reader', uploadedAt: '2025-08-02', link: '#', type: 'reader', description: 'Collection of short readings and essays for discussion.' },
    { id: 's8', title: 'Essay Guidelines', uploadedAt: '2025-08-10', link: '#', type: 'doc', description: 'Formatting and rubric for essays.' },
  ],
  c4: [
    { id: 's5', title: 'Programming Labs', uploadedAt: '2025-08-03', link: '#', type: 'lab', description: 'Lab instructions and starter code for first assignments.' },
    { id: 's9', title: 'Setup Instructions', uploadedAt: '2025-08-04', link: '#', type: 'guide', description: 'How to set up your dev environment.' },
  ],
};

const SAMPLE_ASSIGNMENTS: Record<string, Assignment[]> = {
  c1: [
    { id: 'a1', title: 'Homework 1: Sets & Functions', due_date: '2025-09-01', status: 'submitted', points: 10, description: 'Problems 1–5 from chapter 1.', postedAt: '2025-08-25' },
    { id: 'a2', title: 'Project Proposal', due_date: '2025-09-15', status: 'missing', points: 20, description: 'One-page proposal describing your term project idea.', postedAt: '2025-08-28' },
    { id: 'a6', title: 'Quiz 1', due_date: '2025-09-05', status: 'graded', points: 5, description: 'In-class quiz covering lectures 1–3.', postedAt: '2025-09-01' },
  ],
  c2: [
    { id: 'a3', title: 'Limits Worksheet', due_date: '2025-09-05', status: 'graded', points: 15, description: 'Limit evaluation problems.', postedAt: '2025-08-29' },
    { id: 'a7', title: 'Derivative Exercises', due_date: '2025-09-12', status: 'submitted', points: 20, description: 'Problems on differentiation rules.', postedAt: '2025-09-03' },
  ],
  c3: [
    { id: 'a4', title: 'Essay Draft', due_date: '2025-09-10', status: 'submitted', points: 20, description: 'First draft of essay (1000–1200 words).', postedAt: '2025-08-31' },
    { id: 'a8', title: 'Reading Response 1', due_date: '2025-09-07', status: 'graded', points: 5, description: 'Short response to assigned reading.', postedAt: '2025-09-02' },
  ],
  c4: [
    { id: 'a5', title: 'Lab 1: Hello World', due_date: '2025-09-03', status: 'submitted', points: 5, description: 'Basic programming exercises.', postedAt: '2025-08-30' },
  ],
};

export default function CourseDetail(): JSX.Element {
  const params = useParams();
  const idParam = (params as any).id ?? (params as any).courseId ?? (params as any).course_db_id ?? null;
  const navigate = useNavigate();
  const course = SAMPLE_COURSES.find((c) => c.id === idParam) ?? { id: idParam ?? 'unknown', code: idParam ?? '', title: 'Course' };
  const [tab, setTab] = React.useState<'syllabus' | 'assignments'>('syllabus');

  // UI state: prefer backend data but fall back to SAMPLE fixtures
  const [syllabusState, setSyllabusState] = React.useState<Material[]>(SAMPLE_SYLLABUS[idParam as string] ?? []);
  const [assignmentsState, setAssignmentsState] = React.useState<Assignment[]>(SAMPLE_ASSIGNMENTS[idParam as string] ?? []);
  const [loading, setLoading] = React.useState<boolean>(!!idParam);
  const [error, setError] = React.useState<string | null>(null);

  // file upload refs/state for submitting assignments (PDF only)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingUploadFor, setPendingUploadFor] = React.useState<string | number | null>(null);
  const [uploadCourseId, setUploadCourseId] = React.useState<string | number | null>(idParam);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  // helper: try getPublicUrl then fall back to a signed URL for private buckets
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

  // helper: upload file to 'submissions' bucket and return a usable URL (public or signed)
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

  React.useEffect(() => {
    let mounted = true;
    async function fetchCourseData() {
      if (!idParam) return;
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

        // resources
        try {
          const rres = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(String(idParam))}&user_id=${encodeURIComponent(String(userId ?? ''))}`);
          const rjson = await rres.json().catch(() => []);
          if (rres.ok && mounted) setSyllabusState(Array.isArray(rjson) ? rjson : (rjson?.data ?? []));
        } catch (_e) {
          // keep sample on error
        }

        // assignments
        try {
          const ares = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(idParam))}&user_id=${encodeURIComponent(String(userId ?? ''))}`);
          const ajson = await ares.json().catch(() => []);
          if (ares.ok && mounted) {
            const normalized = (Array.isArray(ajson) ? ajson : (ajson?.data ?? [])).map((a: any) => {
              // ensure due_date is ISO for consistent display
              if (a.due_date) {
                try { a.due_date = new Date(a.due_date).toISOString(); } catch (_) {}
              }
              if (a.course && !a.course.code) a.course.code = a.course.course_id || a.course.courseId || a.course.code;
              return a;
            });
            if (normalized.length) setAssignmentsState(normalized);
          }
        } catch (_e) {
          // keep sample on error
        }
      } catch (err: any) {
        if (mounted) setError('Failed to load course data');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchCourseData();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  function markAsSubmitted(id: string | number, filename?: string) {
    setAssignmentsState((prev) => prev.map((m) => (m.id === id ? { ...m, status: m.status === 'graded' ? m.status : 'submitted', submitted_file: filename ?? m.submitted_file } : m)));
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
        const courseDbId = uploadCourseId ?? idParam;

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
            <div className="text-sm text-slate-500">{course.code}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 border-b pb-3 mb-4">
            <button onClick={() => setTab('syllabus')} className={`px-3 py-2 rounded-md ${tab === 'syllabus' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Syllabus</button>
            <button onClick={() => setTab('assignments')} className={`px-3 py-2 rounded-md ${tab === 'assignments' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Assignments</button>
          </div>

          {tab === 'syllabus' ? (
            <div>
              {loading ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : !syllabusState || syllabusState.length === 0 ? (
                <div className="text-sm text-slate-500">No syllabus materials posted yet.</div>
              ) : (
                <ul className="space-y-3">
                  {syllabusState.map((m) => (
                    <li key={m.id} className="p-3 border rounded flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{m.title}</div>
                          {m.type && <span className="text-xs text-slate-500 px-2 py-1 rounded bg-slate-100">{m.type}</span>}
                        </div>
                        {m.description && (
                          <div className="text-sm text-slate-600 mt-1">
                            {(() => {
                              // use robust extractor which also checks for "Attachment:" and resource fields
                              const url = extractUrlFromTextOrResource(m.description, m);
                              if (url) {
                                // show the descriptive text before the URL if present
                                const before = String(m.description ?? '').split(url)[0];
                                return (
                                  <>
                                    {before && <span>{before}</span>}
                                    <div>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }}
                                        className="text-indigo-600 underline"
                                      >
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
                        // prefer explicit fields, then content text; robustly extract a real URL
                        const href = extractUrlFromTextOrResource(m.link ?? m.video_url ?? null, m) ?? extractUrlFromTextOrResource(m.description, m);
                        if (!href) {
                          return <span className="text-indigo-600 cursor-default">View</span>;
                        }
                        return (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.open(href, '_blank', 'noopener'); }}
                            className="text-indigo-600 underline"
                            aria-label={`Open ${m.title ?? 'resource'}`}
                          >
                            View
                          </button>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div>
              {loading ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : assignmentsState.length === 0 ? (
                <div className="text-sm text-slate-500">No assignments posted yet.</div>
              ) : (
                <ul className="space-y-3">
                  {assignmentsState.map((a) => (
                    <li key={a.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{a.title}</div>
                          {a.description && (
                            <div className="text-sm text-slate-600 mt-1">
                              {(() => {
                                const url = extractUrlFromTextOrResource(a.description, a);
                                if (url) {
                                  const before = String(a.description ?? '').split(url)[0];
                                  return (
                                    <>
                                      {before && <span>{before}</span>}
                                      <div>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }} className="text-indigo-600 underline">
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
                          {/* if backend returned submission object with file_url, render download link */}
                          {a.submission?.file_url && (
                            <div className="text-xs text-slate-600 mt-1"><a href={a.submission.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download your submission</a></div>
                          )}
                          <div className="text-xs text-slate-500 mt-2">Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No due date'}</div>
                          {a.postedAt && <div className="text-xs text-slate-400">Posted {a.postedAt}</div>}
                        </div>
                        <div className="text-xs text-slate-500">{a.points ?? '-'} pts</div>
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
                            <button onClick={() => {
                              setUploadError(null);
                              setPendingUploadFor(a.id);
                              setTimeout(() => fileInputRef.current?.click(), 50);
                            }} className="text-xs px-2 py-1 border rounded bg-indigo-600 text-white">Submit</button>
                          )
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {uploadError && (
          <div className="fixed top-6 right-6 z-50 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded flex items-center gap-3">
            <div className="text-sm">{uploadError}</div>
            <button onClick={() => setUploadError(null)} className="text-sm text-red-600 underline">Dismiss</button>
          </div>
        )}

        {/* hidden file input for assignment submission (PDF only) - always present */}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
