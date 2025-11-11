import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, MoreVertical, User, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatBox from './ChatBot';
import { supabase } from '../lib/supabase';

type AssignmentWithCourse = {
  id: string | number;
  title?: string;
  due_date: string;
  status: string;
  completed_items?: number;
  points?: number;
  course?: { id?: string | number; code?: string; color?: string };
  submission?: { id?: string; file_url?: string; status?: string };
  submitted_file?: string;
};

type GroupedAssignment = { date: string; assignments: AssignmentWithCourse[] };

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StudentDashboard({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState<number | null>(null);

  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignment[]>([]);
  const [joinedCourses, setJoinedCourses] = useState<{ id: string | number; code?: string; name?: string; color?: string }[]>([]);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | number | null>(null);
  const [activeCourseName, setActiveCourseName] = useState<string | null>(null);
  const [courseResources, setCourseResources] = useState<any[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // file upload state for submissions
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadFor, setPendingUploadFor] = useState<string | number | null>(null);
  const [pendingUploadCourseId, setPendingUploadCourseId] = useState<string | number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // header menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // join modal (simplified)
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const joinInputRef = useRef<HTMLInputElement | null>(null);

  // helpers: API base
  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

  // fetch profile & summary
  async function fetchProfileSummary() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const profileRes = await fetch(`${API_BASE}/users/user-profile/?user_id=${encodeURIComponent(userId)}`);
      if (profileRes.ok) {
        const json = await profileRes.json();
        const data = json.data || json;
        if (data) {
          setProfileName(data.username || data.full_name || null);
          setProfileEmail(data.email || null);
        }
      }

      const dashRes = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setEnrolledCount(json.enrolled_courses ?? null);
        setAssignmentsDueCount(json.assignments_due ?? null);
      }
    } catch (err) {
      console.error('fetchProfileSummary error', err);
    }
  }

  // fetch assignments for dashboard
  async function fetchAssignments() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;
      setLoading(true);

      const res = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      const raw: AssignmentWithCourse[] = json.assignments || [];
      // normalize
      const assignments = raw.map((a) => {
        const copy = { ...a };
        if (copy.due_date) {
          try { copy.due_date = new Date(copy.due_date).toISOString(); } catch {}
        }
        if (copy.course && !(copy.course as any).code) (copy.course as any).code = (copy.course as any).course_id || (copy.course as any).courseId || (copy.course as any).code;
        return copy;
      });
      // group by date
      const grouped = assignments.reduce((acc: Record<string, AssignmentWithCourse[]>, a) => {
        const date = a.due_date ? new Date(a.due_date) : new Date();
        const key = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        acc[key] = acc[key] || [];
        acc[key].push(a);
        return acc;
      }, {});
      setGroupedAssignments(Object.entries(grouped).map(([date, assignments]) => ({ date, assignments })));
    } catch (err) {
      console.error('fetchAssignments error', err);
    } finally {
      setLoading(false);
    }
  }

  // fetch enrolled courses
  async function fetchEnrolledCourses() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const resp = await supabase.from('enrollments').select('course: courses(id, course_id, name), course_id').eq('student_id', userId).order('joined_at', { ascending: false });
      const error = (resp as any)?.error;
      if (error) {
        setJoinedCourses([]);
        return;
      }
      const respData = (resp as any)?.data ?? resp;
      if (!respData) { setJoinedCourses([]); return; }
      const rowsArray = Array.isArray(respData) ? respData : [];
      const nestedCourses = rowsArray.map((r: any) => r?.course).filter(Boolean);
      if (nestedCourses.length > 0) {
        setJoinedCourses(nestedCourses.map((c: any) => ({ id: c.id, code: c.course_id, name: c.name })));
        return;
      }
      const codes = Array.from(new Set(rowsArray.map((r: any) => r.course_id).filter(Boolean)));
      if (codes.length === 0) { setJoinedCourses([]); return; }
      const { data: courseRows } = await supabase.from('courses').select('id, course_id, name').in('course_id', codes);
      setJoinedCourses((courseRows || []).map((c: any) => ({ id: c.id, code: c.course_id, name: c.name })));
    } catch (err) {
      console.error('fetchEnrolledCourses error', err);
      setJoinedCourses([]);
    }
  }

  // resolve course id and load resources + assignments
  async function loadCourseDetails(course: { id: string | number; code?: string; name?: string }) {
    setCourseLoading(true);
    setCourseResources([]);
    setCourseAssignments([]);
    setActiveCourseId(course.id);
    setActiveCourseName(course.name ?? course.code ?? '');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      let courseDbId = String(course.id);
      // try by id, fallback to code
      const test = await supabase.from('courses').select('id, course_id, name').eq('id', courseDbId).single();
      if (!test?.data) {
        const byCode = await supabase.from('courses').select('id, course_id, name').eq('course_id', String(course.id)).single();
        if (byCode?.data?.id) {
          courseDbId = byCode.data.id;
          if (!course.name && byCode.data.name) setActiveCourseName(byCode.data.name);
        } else {
          throw new Error('Course not found');
        }
      } else {
        if (!course.name && test.data.name) setActiveCourseName(test.data.name);
      }

      // resources
      try {
        const rres = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(String(courseDbId))}&user_id=${encodeURIComponent(String(userId))}`);
        const rjson = await rres.json().catch(() => []);
        setCourseResources(rres.ok ? (rjson || []) : []);
      } catch { setCourseResources([]); }

      // assignments
      try {
        const ares = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(courseDbId))}&user_id=${encodeURIComponent(String(userId))}`);
        const ajson = await ares.json().catch(() => []);
        if (ares.ok) {
          const normalized = (ajson || []).map((a: any) => {
            if (a.due_date) try { a.due_date = new Date(a.due_date).toISOString(); } catch {}
            if (a.course && !a.course.code) a.course.code = a.course.course_id || a.course.courseId || a.course.code;
            return a;
          });
          setCourseAssignments(normalized);
        } else setCourseAssignments([]);
      } catch { setCourseAssignments([]); }

      setCourseModalOpen(true);
    } catch (err) {
      console.error('loadCourseDetails error', err);
      setCourseResources([]); setCourseAssignments([]);
    } finally {
      setCourseLoading(false);
    }
  }

  // upload submission to storage and call backend submit endpoint
  async function uploadSubmissionFile(file: File, courseId: string | number, assignmentId: string | number, studentId: string) {
    if (!file) return '';
    try {
      const safe = file.name.replace(/\s+/g, '_');
      const path = `${courseId}/${assignmentId}/${studentId}_${Date.now()}_${safe}`;
      const { data, error } = await supabase.storage.from('submissions').upload(path, file, { upsert: true });
      if (error) throw error;
      const urlRes = await supabase.storage.from('submissions').getPublicUrl(path);
      const publicUrl = (urlRes as any)?.data?.publicUrl || (urlRes as any)?.publicURL || '';
      return publicUrl;
    } catch (err) {
      console.warn('submission upload failed', err);
      return '';
    }
  }

  // initiate and handle file selection
  function handleInitiateUpload(id: string | number, courseId?: string | number) {
    setUploadError(null);
    setPendingUploadFor(id);
    setPendingUploadCourseId(courseId ?? null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  async function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    const assignmentId = pendingUploadFor;
    const courseId = pendingUploadCourseId ?? activeCourseId ?? 'public';
    e.currentTarget.value = '';
    if (!file || assignmentId == null) { setPendingUploadFor(null); setPendingUploadCourseId(null); return; }
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setUploadError('Please upload a PDF file.');
      setPendingUploadFor(null); setPendingUploadCourseId(null); return;
    }

    setUploading(true); setUploadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id;
      if (!studentId) throw new Error('Not authenticated');

      const publicUrl = await uploadSubmissionFile(file, courseId, assignmentId, studentId);
      if (!publicUrl) throw new Error('Failed to upload file');

      const body = { student_id: studentId, assignment_id: assignmentId, file_url: publicUrl };
      const res = await fetch(`${API_BASE}/users/courses/assignments/submit/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(j?.error || `Submit failed: ${res.status}`);
      } else {
        // optimistic local update and refresh course assignments
        setCourseAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: 'submitted', submitted_file: file.name } : a));
        await fetchAssignments();
      }
    } catch (err: any) {
      setUploadError(err?.message || String(err));
    } finally {
      setUploading(false); setPendingUploadFor(null); setPendingUploadCourseId(null);
    }
  }

  // quick UI helpers
  const statusColor = (status: string) => {
    switch (status) {
      case 'graded': return 'bg-green-50 text-green-700 border-green-200';
      case 'submitted': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'missing': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // lifecycle
  useEffect(() => {
    fetchAssignments();
    fetchProfileSummary();
    fetchEnrolledCourses();
    // menu click outside
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // calendar helpers
  const groupedFlat = useMemo(() => groupedAssignments.flatMap(g => g.assignments), [groupedAssignments]);
  const recentPosts = useMemo(() => groupedFlat.sort((a,b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()).slice(0,3), [groupedFlat]);
  const next7Days = Array.from({length:7}).map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return d; });
  const dateKey = (d: Date) => d.toISOString().slice(0,10);
  const assignmentsByDate = useMemo(() => {
    const m = new Map<string, AssignmentWithCourse[]>();
    groupedFlat.forEach(a => {
      try {
        const k = dateKey(new Date(a.due_date));
        const arr = m.get(k) ?? [];
        arr.push(a);
        m.set(k, arr);
      } catch {}
    });
    return m;
  }, [groupedFlat]);

  const QuickActionButtons = () => (
    <>
      <button onClick={() => navigate('/grades')} className="text-left px-3 py-2 border rounded-md">View grades</button>
      <button onClick={() => setCourseModalOpen(true)} className="text-left px-3 py-2 border rounded-md">Courses</button>
      <button onClick={() => navigate('/inbox')} className="text-left px-3 py-2 border rounded-md">Inbox</button>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome, {profileName ?? 'Student'}</p>
          </div>

          <div className="flex items-center gap-3 relative">
            <button onClick={onLogout} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
            <button onClick={() => setMenuOpen(v => !v)} className="h-10 w-10 bg-white rounded flex items-center justify-center"><MoreVertical size={18} /></button>
            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 mt-2 w-40 bg-white rounded shadow z-50">
                <button onClick={() => { fetchAssignments(); fetchProfileSummary(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm">Refresh</button>
                <button onClick={() => { /* export quick */ }} className="w-full text-left px-3 py-2 text-sm">Export CSV</button>
                <button onClick={() => { setJoinModalOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm">Join course</button>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <main className="lg:col-span-3 space-y-6">
            <section>
              <h3 className="text-sm text-slate-600 mb-3">Recent posts</h3>
              <div className="flex gap-3">
                {recentPosts.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded shadow flex-1">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.course?.code} • {formatDate(p.due_date)}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl">Upcoming due dates</h2>
                <div className="text-sm text-slate-500">Sorted by due date</div>
              </div>

              <div className="space-y-4">
                {groupedAssignments.map(g => (
                  <div key={g.date} className="bg-white rounded p-4 shadow">
                    <h4 className="text-sm text-slate-500 mb-3">{g.date}</h4>
                    <div className="space-y-3">
                      {g.assignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <div className="font-medium">{a.title}</div>
                            <div className="text-xs text-slate-500">{a.course?.code} • {formatDate(a.due_date)}</div>
                            {/* show attachment link if present in description or submission */}
                            {a.submission?.file_url && <div className="text-xs mt-1"><a href={a.submission.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download submission</a></div>}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs border ${statusColor(a.status)}`}>{a.status}</div>
                            <div className="text-xs text-slate-400">{a.points ?? '-'} pts</div>
                            {a.status !== 'graded' && <button onClick={() => handleInitiateUpload(a.id, a.course?.id)} className="mt-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded">Submit</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white"><User size={18} /></div>
                <div>
                  <div className="font-semibold">{profileName ?? 'Student'}</div>
                  <div className="text-xs text-slate-500">{profileEmail ?? ''}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Enrolled</div>
                  <div className="font-semibold">{enrolledCount ?? '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Due</div>
                  <div className="font-semibold">{assignmentsDueCount ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h4 className="text-sm mb-2">Quick actions</h4>
              <QuickActionButtons />
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h4 className="text-sm mb-2">Calendar</h4>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {next7Days.map(d => {
                  const key = dateKey(d);
                  const list = assignmentsByDate.get(key) ?? [];
                  const count = list.length;
                  const statuses = Array.from(new Set(list.map(x => x.status)));
                  const statusToColor = (s: string) => s === 'missing' ? 'bg-red-500' : s === 'submitted' ? 'bg-blue-500' : s === 'graded' ? 'bg-green-500' : 'bg-yellow-400';
                  return (
                    <div key={d.toISOString()} className="p-2 rounded">
                      <div className="text-[10px] text-slate-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-sm font-semibold">{d.getDate()}</div>
                      <div className="mt-1">
                        {count === 0 ? <div className="inline-block w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-600">No due</div> :
                          <div className="flex flex-col items-center">
                            <div className="flex gap-1">{statuses.slice(0,3).map(s => <span key={s} className={`w-2 h-2 rounded-full ${statusToColor(s)}`} />)}</div>
                            <div className="text-[10px] font-semibold">{count} due</div>
                          </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-8"><ChatBox /></div>

        {/* Course modal (student view) */}
        {courseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setCourseModalOpen(false)} />
            <div className="relative bg-white rounded-lg w-full max-w-3xl p-6 z-50 overflow-auto max-h-[80vh]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{activeCourseName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCourseModalOpen(false)} className="px-3 py-1 border rounded">Close</button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm mb-2">Resources</h4>
                  {courseResources.length === 0 ? <div className="text-sm text-slate-500">No resources</div> :
                    <ul className="space-y-2">{courseResources.map(r => (
                      <li key={r.id} className="p-3 border rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.title}</div>
                          <div className="text-xs text-slate-500">{r.type}{r.video_url ? ` • ${r.video_url}` : ''}</div>
                        </div>
                        <a href={r.content?.match?.(/https?:\/\/\S+/)?.[0] ?? r.video_url ?? '#'} target="_blank" rel="noreferrer" className="text-indigo-600">Download</a>
                      </li>
                    ))}</ul>}
                </div>

                <div>
                  <h4 className="text-sm mb-2">Assignments</h4>
                  {courseAssignments.length === 0 ? <div className="text-sm text-slate-500">No assignments</div> :
                    <ul className="space-y-2">{courseAssignments.map((a:any) => (
                      <li key={a.id} className="p-3 border rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{a.title}</div>
                            <div className="text-xs text-slate-500">{a.due_date ? new Date(a.due_date).toLocaleString() : 'No due date'}</div>
                            {a.description && <div className="text-xs mt-1">{String(a.description).split(/https?:\/\//)[0]}</div>}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs border ${statusColor(a.status)}`}>{a.status}</div>
                            {a.status !== 'graded' && <button onClick={() => handleInitiateUpload(a.id, activeCourseId ?? a.course?.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Submit</button>}
                          </div>
                        </div>
                      </li>
                    ))}</ul>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Join modal */}
        {joinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setJoinModalOpen(false)} />
            <div className="relative bg-white rounded-lg p-6 z-50 w-full max-w-md">
              <h3 className="text-lg mb-2">Join a course</h3>
              <input ref={joinInputRef} value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Enter course code" className="w-full border px-2 py-1 rounded mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setJoinModalOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={async () => {
                  setJoinLoading(true);
                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const studentId = sessionData?.session?.user?.id;
                    if (!studentId) throw new Error('Not authenticated');
                    const res = await fetch(`${API_BASE}/users/courses/join-request/`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ student_id: studentId, course_code: joinCode.trim() })
                    });
                    const body = await res.json().catch(()=>({}));
                    if (!res.ok) throw new Error(body?.error || `Failed: ${res.status}`);
                    setJoinModalOpen(false);
                    await fetchEnrolledCourses();
                  } catch (err: any) {
                    alert(String(err?.message || err));
                  } finally { setJoinLoading(false); }
                }} className="px-3 py-1 bg-indigo-600 text-white rounded">{joinLoading ? 'Joining...' : 'Request'}</button>
              </div>
            </div>
          </div>
        )}

        {/* hidden file input */}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

      </div>
    </div>
  );
}