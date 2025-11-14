import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, MoreVertical, User, Calendar, Clock, CheckCircle, XCircle, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatBox from './ChatBot';
import { supabase } from '../lib/supabase';
import CourseModal from '../components/CourseModal';
import { fetchCourseResources, fetchCourseAssignments } from '../lib/api';

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
  const [courseLoading, setCourseLoading] = useState(false);

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

  // popup state for in-page messages (replaces alert)
  const [popup, setPopup] = useState<{ open: boolean; title?: string; message: string; kind?: 'error'|'info'|'success' }>(
    { open: false, message: '', kind: 'info' }
  );
  // auto-dismiss timer ref
  const popupTimerRef = useRef<number | null>(null);

  function showPopup(message: string, kind: 'error'|'info'|'success' = 'info', title?: string, timeoutMs = 5000) {
    // clear previous timer
    if (popupTimerRef.current) { window.clearTimeout(popupTimerRef.current); popupTimerRef.current = null; }
    setPopup({ open: true, title, message, kind });
    if (timeoutMs > 0) {
      popupTimerRef.current = window.setTimeout(() => {
        setPopup((p) => ({ ...p, open: false }));
        popupTimerRef.current = null;
      }, timeoutMs);
    }
  }

  function hidePopup() {
    if (popupTimerRef.current) { window.clearTimeout(popupTimerRef.current); popupTimerRef.current = null; }
    setPopup((p) => ({ ...p, open: false }));
  }

  // reusable join request used by both panel and modal
  async function submitJoinRequest(code: string) {
    if (!code || !code.trim()) {
      showPopup('Enter a course code', 'error', 'Validation');
      return;
    }
    setJoinLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id;
      if (!studentId) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/users/courses/join-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, course_code: code.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed: ${res.status}`);
      setJoinModalOpen(false);
      setJoinCode('');
      await fetchEnrolledCourses();
      showPopup('Join request sent — the instructor will review it.', 'success', 'Request Sent');
    } catch (err: any) {
      showPopup(String(err?.message || err), 'error', 'Request failed');
    } finally {
      setJoinLoading(false);
    }
  }

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
          // Redirect instructors to their dashboard to avoid showing instructor details
          const sessionRole = sessionData?.session?.user?.user_metadata?.role;
          const apiRole = data.role ?? (data.is_instructor ? 'instructor' : undefined);
          const role = (apiRole || sessionRole || '').toString().toLowerCase();
          if (role.includes('instructor')) {
            navigate('/instructor/dashboard');
            return; // stop loading student-specific data
          }

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
        // attach stable local date key for grouping in local timezone
        try {
          const d = copy.due_date ? new Date(copy.due_date) : new Date();
          const yy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          (copy as any).local_date = `${yy}-${mm}-${dd}`;
        } catch (_) { (copy as any).local_date = null; }
        return copy;
      });
      console.debug('student dashboard: normalized assignments', assignments.map(a => ({ id: a.id, due_date: a.due_date, local_date: (a as any).local_date })));

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
    setCourseModalOpen(true); // Ensure modal is open before loading details
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

  // helper: try getPublicUrl then fall back to signed URL for private buckets
  async function getPublicUrlOrSigned(bucket: string, path: string) {
    try {
      const pubRes = await supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = (pubRes as any)?.data?.publicUrl || (pubRes as any)?.publicURL || (pubRes as any)?.public_url || '';
      if (publicUrl) return publicUrl;
      const { data: signedData, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!signedErr && signedData?.signedURL) return signedData.signedURL;
    } catch (e) {
      console.warn('getPublicUrlOrSigned failed', e);
    }
    return '';
  }

  // upload submission to storage and call backend submit endpoint
  async function uploadSubmissionFile(file: File, courseId: string | number, assignmentId: string | number, studentId: string) {
    if (!file) return '';
    try {
      const safe = file.name.replace(/\s+/g, '_');
      const path = `${courseId}/${assignmentId}/${studentId}_${Date.now()}_${safe}`;
      const { data, error } = await supabase.storage.from('submissions').upload(path, file, { upsert: true });
      if (error) throw error;
      const publicUrl = await getPublicUrlOrSigned('submissions', path);
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

  // theme state: persisted to localStorage and applied globally
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') ? 'dark' : 'light');

  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme(t: 'light' | 'dark') {
    try {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
        injectDarkStyles();
      } else {
        document.documentElement.classList.remove('dark');
        removeDarkStyles();
      }
      localStorage.setItem('theme', t);
      setTheme(t);
    } catch (e) {
      // ignore in SSR/test
    }
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  function injectDarkStyles() {
    if (document.getElementById('dark-theme-overrides')) return;
    // Use html.dark for scoping (document.documentElement gets .dark)
    // Add conservative, specific overrides for common Tailwind utilities used in the app.
    const css = `
      html.dark { color-scheme: dark; }
      html.dark body, html.dark .min-h-screen { background-color: #071025 !important; color: #e6eef8 !important; }

      /* Cards / surfaces */
      html.dark .bg-white { background-color: #0f1724 !important; color: #e6eef8 !important; }
      html.dark .bg-gray-50 { background-color: #071025 !important; }
      html.dark .bg-gray-100 { background-color: #0b1320 !important; }
      html.dark .bg-gray-200 { background-color: #0f1a2a !important; }

      /* Text tokens */
      html.dark .text-slate-500, html.dark .text-slate-400 { color: #97a9c2 !important; }
      html.dark .text-slate-600, html.dark .text-slate-700 { color: #c3d3ea !important; }
      html.dark .text-slate-800, html.dark .text-slate-900 { color: #e6eef8 !important; }

      /* Borders & dividers */
      html.dark .border { border-color: rgba(255,255,255,0.06) !important; }
      html.dark .divide-y > :not([hidden]) ~ :not([hidden]) { border-color: rgba(255,255,255,0.04) !important; }

      /* Shadows: keep subtle shadows for depth */
      html.dark .shadow, html.dark .shadow-sm, html.dark .shadow-md, html.dark .shadow-lg { box-shadow: 0 6px 18px rgba(2,6,23,0.6) !important; }

      /* Buttons / primary colors */
      html.dark .bg-indigo-600 { background-color: #4f46e5 !important; }
      html.dark .text-indigo-600 { color: #93c5fd !important; }
      html.dark .bg-red-600 { background-color: #ef4444 !important; }
      html.dark .bg-green-600 { background-color: #16a34a !important; }

      /* Small utility colors used in status dots / badges */
      html.dark .bg-green-50 { background-color: #052e1f !important; color: #86efac !important; }
      html.dark .bg-blue-50 { background-color: #071633 !important; color: #93c5fd !important; }

      /* Links and interactive elements */
      html.dark a { color: #7dd3fc !important; text-decoration: underline; }
      html.dark button, html.dark input, html.dark select, html.dark textarea { color: #e6eef8 !important; }

      /* Inputs / textareas */
      html.dark input, html.dark textarea { background-color: #0b1422 !important; border-color: rgba(255,255,255,0.06) !important; color: #e6eef8 !important; }
      html.dark input::placeholder, html.dark textarea::placeholder { color: #7f97b0 !important; }

      /* Background gradients */
      html.dark .bg-gradient-to-b { background-image: linear-gradient(180deg,#071025,#071025) !important; }

      /* Toggle / Switch adjustments */
      html.dark .inline-flex.items-center.w-14.h-8 { background-color: #374151 !important; } /* fallback if used directly */

      /* Keep any remaining overrides conservative */
      html.dark .opacity-60 { opacity: 0.85 !important; }
    `;
    const s = document.createElement('style');
    s.id = 'dark-theme-overrides';
    s.innerHTML = css;
    document.head.appendChild(s);
  }

  function removeDarkStyles() {
    const el = document.getElementById('dark-theme-overrides');
    if (el) el.remove();
  }

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
  // Use local YYYY-MM-DD key (local timezone) to avoid UTC date shifts
  const dateKey = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  const assignmentsByDate = useMemo(() => {
    const m = new Map<string, AssignmentWithCourse[]>();
    groupedFlat.forEach(a => {
      try {
        const k = (a as any).local_date ?? dateKey(new Date(a.due_date));
        const arr = m.get(k) ?? [];
        arr.push(a);
        m.set(k, arr);
      } catch {}
    });
    return m;
  }, [groupedFlat]);

  const QuickActionButtons = () => (
    <div className="flex flex-col gap-2">
      <button onClick={() => navigate('/grades')} className="text-left px-3 py-2 border rounded-md">View grades</button>
      <button onClick={() => navigate('/inbox')} className="text-left px-3 py-2 border rounded-md">Inbox</button>
    </div>
  );

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome, {profileName ?? 'Student'}</p>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Sun ↔ Moon toggle (single animated switch) */}
            <button
              onClick={toggleTheme}
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Toggle theme"
              className={`relative inline-flex items-center w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className="sr-only">Toggle theme</span>
              {/* Sun icon (light) */}
              <span className={`absolute left-2 top-1 transform transition-all duration-300 ${theme === 'dark' ? 'opacity-0 -translate-x-1 scale-90' : 'opacity-100 translate-x-0 scale-100'}`}>
                <Sun size={14} className="text-yellow-400" />
              </span>
              {/* Moon icon (dark) */}
              <span className={`absolute right-2 top-1 transform transition-all duration-300 ${theme === 'dark' ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-1 scale-90'}`}>
                <Moon size={14} className="text-white" />
              </span>
              {/* Knob */}
              <span className={`relative z-10 block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6 rotate-6' : 'translate-x-0 rotate-0'}`} />
            </button>

            <button onLogout={onLogout} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
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

        {/* Join Course panel (visible, below header) */}
        <div className="mb-6 max-w-3xl">
          <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-medium">Join Course</h3>
              <p className="text-sm text-slate-500">Enter a course code to request joining.</p>
              <div className="mt-2 flex gap-2">
                <input
                  ref={joinInputRef}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Course code"
                  className="flex-1 px-3 py-2 border rounded"
                />
                <button
                  onClick={() => submitJoinRequest(joinCode)}
                  disabled={joinLoading}
                  className={`px-3 py-2 rounded ${joinLoading ? 'bg-indigo-300 text-white' : 'bg-indigo-600 text-white'}`}
                >
                  {joinLoading ? 'Requesting…' : 'Join'}
                </button>
              </div>
            </div>
            <div className="border-l pl-4 hidden sm:block">
              <button onClick={() => navigate('/courses')} className="text-left px-3 py-2 border rounded-md">View all courses</button>
            </div>
          </div>
        </div>

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
                        <div className="text-xs text-slate-500">{p.course?.name ?? p.course?.code} • {formatDate(p.due_date)}</div>
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
                            <div className="text-xs text-slate-500">{a.course?.name ?? a.course?.code} • {formatDate(a.due_date)}</div>
                            {/* show attachment link if present in description or submission */}
                            {a.submission?.file_url && <div className="text-xs mt-1"><a href={a.submission.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download submission</a></div>}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs border ${statusColor(a.status)}`}>{a.status}</div>
                            <div className="text-xs text-slate-400">
                              {a.submission?.grade !== undefined && a.submission?.grade !== null
                                ? `${a.submission.grade} / ${a.points ?? 10} pts`
                                : `${a.points ?? 10} pts`}
                            </div>
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
                  {/* View profile button */}
                  <div className="mt-2">
                    <button
                      onClick={() => navigate('/profile')}
                      className="text-sm px-3 py-1 border rounded text-indigo-600 hover:bg-indigo-50"
                    >
                      View profile
                    </button>
                  </div>
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
                            <div className="flex gap-1">{statuses.slice(0,3).map((s, i) => <span key={s + '-' + i} className={`w-2 h-2 rounded-full ${statusToColor(s)}`} />)}</div>
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

        {/* Course modal (student view) - extracted to components/CourseModal */}
        <CourseModal
          open={courseModalOpen}
          onClose={() => { setCourseModalOpen(false); setActiveCourseId(null); }}
          joinedCourses={joinedCourses}
          onOpenCourse={async (c) => {
            // ensure modal opens and load data via existing helper
            setCourseModalOpen(true);
            await loadCourseDetails(c);
          }}
          activeCourseId={activeCourseId}
          activeCourseName={activeCourseName}
          courseResources={courseResources}
          courseAssignments={courseAssignments}
          onBackToList={() => { setActiveCourseId(null); setActiveCourseName(null); setCourseAssignments([]); setCourseResources([]); }}
          onJoin={() => setJoinModalOpen(true)}
          onInitiateUpload={(id) => handleInitiateUpload(id, activeCourseId ?? undefined)}
          uploading={uploading}
        />

        {/* Join modal (uses shared submitJoinRequest) */}
        {joinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setJoinModalOpen(false)} />
            <div className="relative bg-white rounded-lg p-6 z-50 w-full max-w-md">
              <h3 className="text-lg mb-2">Join a course</h3>
              <input ref={joinInputRef} value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Enter course code" className="w-full border px-2 py-1 rounded mb-3" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setJoinModalOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={() => submitJoinRequest(joinCode)} className="px-3 py-1 bg-indigo-600 text-white rounded">{joinLoading ? 'Joining...' : 'Request'}</button>
              </div>
            </div>
          </div>
        )}

        {/* In-page Popup (replaces alert) */}
        {popup.open && (
          <div className="fixed inset-0 flex items-end justify-center pointer-events-none z-50">
            <div className="mb-6 w-full max-w-md pointer-events-auto">
              <div className={`mx-4 rounded-lg shadow-lg overflow-hidden border ${popup.kind === 'error' ? 'border-red-200' : popup.kind === 'success' ? 'border-green-200' : 'border-slate-200'}`}>
                <div className={`p-4 ${popup.kind === 'error' ? 'bg-red-50' : popup.kind === 'success' ? 'bg-green-50' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      {popup.title && <div className="font-semibold text-sm mb-1">{popup.title}</div>}
                      <div className="text-sm text-slate-800">{popup.message}</div>
                    </div>
                    <div>
                      <button onClick={hidePopup} className="text-xs text-slate-500 hover:underline">Dismiss</button>
                    </div>
                  </div>
                </div>
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