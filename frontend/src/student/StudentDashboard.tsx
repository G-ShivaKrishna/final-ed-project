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
  course?: {
    id: string | number;
    code?: string;
    color?: string;
  };
  submitted_file?: string;
};

type GroupedAssignment = {
  date: string;
  assignments: AssignmentWithCourse[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StudentDashboard({ onLogout }: { onLogout: () => void }) {
  // Profile and counts will come from backend
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState<number | null>(null);

  // assignments grouped by date (populated from backend)
  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignment[]>([]);

  useEffect(() => {
    let channel: any | null = null;
    fetchAssignments();
    fetchProfileSummary();

    try {
      channel = (window as any).supabaseClient?.channel
        ? (window as any).supabaseClient
            .channel('public:assignments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
              fetchAssignments();
              fetchProfileSummary();
            })
            .subscribe()
        : null;
    } catch (err) {
      // ignore realtime subscription errors
    }

    return () => {
      if (channel && (window as any).supabaseClient) {
        (window as any).supabaseClient.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfileSummary = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

      // profile
      const profileRes = await fetch(`${API_BASE}/users/user-profile/?user_id=${encodeURIComponent(userId)}`);
      if (profileRes.ok) {
        const json = await profileRes.json();
        const data = json.data || json;
        if (data) {
          setProfileName(data.username || data.full_name || null);
          setProfileEmail(data.email || null);
        }
      }

      // summary
      const dashRes = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setEnrolledCount(json.enrolled_courses ?? null);
        setAssignmentsDueCount(json.assignments_due ?? null);
      }
    } catch (err) {
      console.error('fetchProfileSummary error', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        console.error('dashboard API error', res.status);
        return;
      }

      const json = await res.json();
      const assignments = json.assignments || [];
      if (assignments) {
        // convert assignments to our local type and group by date
        const grouped = assignments.reduce((acc: Record<string, AssignmentWithCourse[]>, a: any) => {
          const date = new Date(a.due_date);
          const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          acc[dateStr] = acc[dateStr] || [];
          acc[dateStr].push(a as AssignmentWithCourse);
          return acc;
        }, {});
  const groupedArr = Object.entries(grouped).map(([date, assignments]) => ({ date, assignments })) as GroupedAssignment[];
  setGroupedAssignments(groupedArr);
      }
    } catch (err) {
      console.error('fetchAssignments error', err);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'graded':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'missing':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const navigate = useNavigate();

  // File upload refs / state for submitting assignments (PDF-only)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadFor, setPendingUploadFor] = useState<string | number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Menu state & refs for the header options menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleRefresh = () => {
    // In a real app this would re-fetch data; here we just close the menu.
    console.log('Refresh requested');
    setMenuOpen(false);
  };

  const handleExportCSV = () => {
    // Flatten assignments into CSV rows
    const rows: string[] = [];
    rows.push(['id', 'title', 'due_date', 'status', 'completed_items', 'points', 'course_id', 'course_code'].join(','));
    groupedAssignments.forEach((group) => {
      group.assignments.forEach((a) => {
        rows.push([
          `${a.id}`,
          `"${(a.title ?? '').replace(/"/g, '""')}"`,
          a.due_date,
          a.status,
          `${a.completed_items ?? 0}`,
          `${a.points ?? ''}`,
          `${a.course?.id ?? ''}`,
          `${a.course?.code ?? ''}`,
        ].join(','));
      });
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assignments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  // Join course modal state
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const joinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (joinModalOpen) {
      // give the modal a tick to render, then focus
      setTimeout(() => joinInputRef.current?.focus(), 50);
      setJoinStatus(null);
      setJoinCode('');
    }
  }, [joinModalOpen]);

  // Joined courses (fetched from enrollments -> courses)
  const [joinedCourses, setJoinedCourses] = useState<{ id: string | number; code?: string; color?: string }[]>([]);
  // per-course modal + details for students
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | number | null>(null);
  const [activeCourseName, setActiveCourseName] = useState<string | null>(null);
  const [courseResources, setCourseResources] = useState<any[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<any[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);

  async function fetchEnrolledCourses() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      // enrollments.course_id references courses.course_id (text); select related course row
      const resp = await supabase
        .from('enrollments')
        .select('course: courses(id, course_id, name, color)')
        .eq('student_id', userId)
        .order('joined_at', { ascending: false })
        .execute ? await (supabase as any).from('enrollments').select('course: courses(id, course_id, name, color)').eq('student_id', userId).order('joined_at', { ascending: false }) : await supabase.from('enrollments').select('course: courses(id, course_id, name, color)').eq('student_id', userId).order('joined_at', { ascending: false });

      // normalize depending on client shape
      const rows: any[] = (resp?.data || resp) as any[];
      const courses = (rows || []).map((r) => r.course).filter(Boolean);
      setJoinedCourses(courses.slice(0, 6)); // keep a reasonable number
    } catch (err) {
      console.error('fetchEnrolledCourses error', err);
    }
  }

  // load course details (resources + assignments) for a joined course (student view)
  async function loadCourseDetails(course: { id: string | number; code?: string; name?: string }) {
    setCourseLoading(true);
    setCourseResources([]);
    setCourseAssignments([]);
    setActiveCourseId(course.id);
    setActiveCourseName(course.name ?? course.code ?? '');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

      // fetch resources
      try {
        const rres = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(String(course.id))}&user_id=${encodeURIComponent(String(userId))}`);
        const rjson = await rres.json().catch(() => []);
        if (rres.ok) setCourseResources(rjson || []);
        else setCourseResources([]);
      } catch (e) {
        setCourseResources([]);
      }

      // fetch assignments for this course (student view)
      try {
        const ares = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(course.id))}&user_id=${encodeURIComponent(String(userId))}`);
        const ajson = await ares.json().catch(() => []);
        if (ares.ok) setCourseAssignments(ajson || []);
        else setCourseAssignments([]);
      } catch (e) {
        setCourseAssignments([]);
      }
      setCourseModalOpen(true);
    } catch (err) {
      console.error('loadCourseDetails error', err);
    } finally {
      setCourseLoading(false);
    }
  }

  // fetch enrolled courses on mount
  useEffect(() => {
    fetchEnrolledCourses();
    // optionally re-fetch when assignments or profile summary changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recentPosts = useMemo(() => (
    groupedAssignments
      .flatMap((g) => g.assignments.map((a) => ({ ...a, groupDate: g.date })))
      .sort((x, y) => new Date(y.due_date).getTime() - new Date(x.due_date).getTime())
      .slice(0, 3)
  ), [groupedAssignments]);

  const next7Days = Array.from({ length: 7 }).map((_, i) => {
     const d = new Date();
     d.setDate(d.getDate() + i);
     return d;
   });

   const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const assignmentsByDate = useMemo(() => {
     const map = new Map<string, AssignmentWithCourse[]>();
     groupedAssignments.forEach((g) => {
       g.assignments.forEach((a) => {
         const key = dateKey(new Date(a.due_date));
         const arr = map.get(key) ?? [];
         arr.push(a);
         map.set(key, arr);
       });
     });
     return map;
   }, [groupedAssignments]);

  function dayStatusFor(date: Date) {
     const key = dateKey(date);
     const list = assignmentsByDate.get(key) ?? [];
     if (list.length === 0) return { label: 'No due', color: 'bg-gray-100 text-gray-600' };
     if (list.some((a) => a.status === 'missing')) return { label: 'Due', color: 'bg-red-50 text-red-700' };
     if (list.some((a) => a.status === 'submitted')) return { label: 'Submitted', color: 'bg-blue-50 text-blue-700' };
     if (list.every((a) => a.status === 'graded')) return { label: 'Graded', color: 'bg-green-50 text-green-700' };
     return { label: 'Due', color: 'bg-yellow-50 text-yellow-700' };
   }

   const QuickActionButtons = () => (
     <>
       <button onClick={() => navigate('/grades')} className="text-left px-3 py-2 border rounded-md">View grades</button>
       <button onClick={() => setAssignmentsOpen(true)} className="text-left px-3 py-2 border rounded-md">Assignments</button>
       <button onClick={() => navigate('/inbox')} className="text-left px-3 py-2 border rounded-md">Inbox</button>
     </>
   );

  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [assignmentsState, setAssignmentsState] = useState<AssignmentWithCourse[]>(() => groupedAssignments.flatMap((g) => g.assignments));

  // keep assignmentsState in sync if groupedAssignments ever changes
  useEffect(() => {
    setAssignmentsState(groupedAssignments.flatMap((g) => g.assignments));
  }, [groupedAssignments]);

  // mark assignment submitted (optionally attach filename)
  function markAsSubmitted(id: string | number, filename?: string) {
    setAssignmentsState((prev) => prev.map((m) => (m.id === id ? { ...m, status: m.status === 'graded' ? m.status : 'submitted', submitted_file: filename ?? m.submitted_file } : m)));
  }

  function handleInitiateUpload(id: string | number) {
    setUploadError(null);
    setPendingUploadFor(id);
    // open file picker
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  // handle file change: upload/submit assignment to backend (student)
  async function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    const id = pendingUploadFor;
    // clear the input so same-file re-uploads are possible later
    e.currentTarget.value = '';
    if (!file || id == null) {
      setPendingUploadFor(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setUploadError('Please upload a PDF file.');
      setPendingUploadFor(null);
      return;
    }

    // try to submit to backend
    setUploading(true);
    setUploadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id;
      if (!studentId) throw new Error('Not authenticated');
      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

      // NOTE: we don't handle file storage here. send a placeholder file_url = filename.
      const body = {
        student_id: studentId,
        assignment_id: id,
        file_url: file.name,
      };
      const res = await fetch(`${API_BASE}/users/courses/assignments/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // fallback to local marking but show error
        setUploadError(j?.error || `Submit failed: ${res.status}`);
        // still mark locally so UI reflects the attempt
        markAsSubmitted(id, file.name);
      } else {
        // success: update UI and refresh course assignments
        markAsSubmitted(id, file.name);
        // reload course details so students see updated submission state
        if (activeCourseId) {
          await loadCourseDetails({ id: activeCourseId, name: activeCourseName ?? undefined });
        } else {
          await fetchEnrolledCourses();
        }
      }
    } catch (err: any) {
      setUploadError(err?.message || String(err));
      // still mark locally
      markAsSubmitted(id, file.name);
    } finally {
      setUploading(false);
      setPendingUploadFor(null);
    }
  }

  // inside join modal handler, replace the simulated flow with real POST
  async function submitJoinRequest(code: string) {
    setJoinLoading(true);
    setJoinStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const studentId = sessionData?.session?.user?.id;
      if (!studentId) throw new Error('Not authenticated');

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/users/courses/join-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          course_code: code,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Map known backend errors to friendly messages
        const errCode = (body && (body.error || '')).toString();
        let friendly = body?.error || body?.details || `Request failed: ${res.status}`;
        if (errCode.includes('course_not_found')) friendly = 'Course not found. Please check the code.';
        if (errCode.includes('already_enrolled')) friendly = 'You are already enrolled in this course.';
        if (errCode.includes('request_already_pending')) friendly = 'You already have a pending request for this course.';
        setJoinStatus(`error: ${friendly}`);
      } else {
        // success - server created a join request
        setJoinStatus('pending');
      }
    } catch (err: any) {
      setJoinStatus(`error: ${err.message || String(err)}`);
    } finally {
      setJoinLoading(false);
    }
  }

  return (
  <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-50 p-6 pointer-events-auto">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-semibold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back, {profileName ?? 'Student'}</p>
          </div>
          <div className="flex items-center gap-3 relative">
            <button onClick={onLogout} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition">Logout</button>

            <button onClick={() => setMenuOpen((v) => !v)} className="h-10 w-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md" aria-haspopup="menu" aria-expanded={menuOpen}>
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
                <button onClick={handleRefresh} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Refresh</button>
                <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Export CSV</button>
                <button onClick={() => { navigate('/grades'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">View grades</button>
                <button onClick={() => { navigate('/inbox'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Inbox</button>
              </div>
            )}
          </div>
        </header>

        {uploadError && (
          <div className="fixed top-6 right-6 z-50 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded flex items-center gap-3">
            <div className="text-sm">{uploadError}</div>
            <button onClick={() => setUploadError(null)} className="text-sm text-red-600 underline">Dismiss</button>
          </div>
        )}

        {/* Recent posts: latest assignment posts */}
          <div className="mb-6">
          <h3 className="text-sm text-slate-600 font-medium mb-3">Recent posts</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            {recentPosts.map((p) => (
              <div key={p.id} className="bg-white rounded-lg p-3 shadow-sm flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{p.course?.code} • {formatDate(p.due_date)}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${statusColor(p.status)}`}>{p.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main column */}
          <main className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-slate-700">Upcoming due dates</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar size={16} />
                <span>Sorted by due date</span>
              </div>
            </div>

            <div className="space-y-6">
              {groupedAssignments.map((group) => (
                <section key={group.date} className="bg-white rounded-xl shadow-sm p-5">
                  <h3 className="text-sm text-slate-500 font-medium mb-4">{group.date}</h3>

                  <div className="space-y-3">
                    {group.assignments.map((a) => {
                      return (
                        <article key={a.id} className="flex items-center gap-4 p-4 rounded-lg border border-transparent hover:border-slate-200 transition bg-gradient-to-b from-white to-white/95">
                          <div className={`w-2 h-12 rounded-l-md ${a.course?.color === 'purple' ? 'bg-violet-500' : a.course?.color === 'blue' ? 'bg-blue-500' : a.course?.color === 'gray' ? 'bg-gray-400' : 'bg-slate-400'}`} />

                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                                <div className="text-xs text-slate-500 mt-1">{a.course?.code} • {formatDate(a.due_date)}</div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className={`px-3 py-1 text-xs rounded-full border ${statusColor(a.status)}`}>{a.status}</div>
                                <div className="text-xs text-slate-400">{a.points} pts</div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{new Date(a.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {a.completed_items ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-400" />}
                                <span>{a.completed_items ?? 0} completed</span>
                              </div>
                              <button className="ml-auto text-sm text-blue-600 hover:underline flex items-center gap-1">
                                Details <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </main>

          {/* Right column */}
          <aside className="space-y-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-full flex items-center justify-center text-white">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{profileName ?? 'Student'}</div>
                  <div className="text-xs text-slate-500">{profileEmail ?? ''}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => navigate('/profile')} className="px-3 py-1 text-sm rounded-md bg-white border">View profile</button>
                <button onClick={() => navigate('/profile')} className="px-3 py-1 text-sm rounded-md bg-indigo-600 text-white">Edit profile</button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Courses</div>
                  <div className="text-lg font-semibold text-slate-800">{typeof enrolledCount === 'number' ? enrolledCount : '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Assignments due</div>
                  <div className="text-lg font-semibold text-slate-800">{typeof assignmentsDueCount === 'number' ? assignmentsDueCount : '—'}</div>
                </div>
              </div>
            </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Quick actions</h4>
              <div className="flex flex-col gap-2">
          <button onClick={() => setJoinModalOpen(true)} className="text-left px-3 py-2 bg-indigo-600 text-white rounded-md">Join course</button>
                  <QuickActionButtons />
              </div>
            </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-700">Joined courses</h4>
                  <button onClick={() => navigate('/courses')} className="text-xs text-indigo-600 hover:underline">View all</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {joinedCourses.length ? (
                    joinedCourses.map((c) => (
                      <button key={c.id} onClick={() => loadCourseDetails({ id: c.id, code: c.code, name: (c as any).name })} className={`px-3 py-1 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 ${c.color === 'purple' ? 'bg-violet-100 text-violet-700' : c.color === 'blue' ? 'bg-blue-100 text-blue-700' : c.color === 'gray' ? 'bg-gray-100 text-gray-700' : 'bg-slate-100 text-slate-700'}`}>
                        {c.code}
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No joined courses</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Calendar</h4>
                <div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs">
                  {next7Days.map((d) => {
                    const st = dayStatusFor(d);
                    return (
                      <div key={d.toISOString()} className="p-2 rounded-md">
                        <div className="text-[10px] text-slate-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                        <div className="text-sm font-semibold text-slate-800">{d.getDate()}</div>
                        <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] ${st.color}`}>{st.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            <div className="hidden lg:block">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h5 className="text-sm font-medium text-slate-700">Help & resources</h5>
                <p className="text-xs text-slate-500 mt-2">Visit our docs or contact support if you need help.</p>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-8">
          <ChatBox />
        </div>
        {/* Assignments Modal (quick-view) */}
        {assignmentsOpen && (
          (() => {
            const flat = groupedAssignments.flatMap((g) => g.assignments).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
            return (
              <div className="fixed inset-0 z-60 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setAssignmentsOpen(false)} />
                <div className="relative bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 z-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">All assignments</h3>
                    <button onClick={() => setAssignmentsOpen(false)} className="text-sm text-slate-500">Close</button>
                  </div>

                  <div className="max-h-[60vh] overflow-auto space-y-3">
                      {flat.length === 0 ? (
                        <div className="text-sm text-slate-500">No assignments found.</div>
                      ) : (
                        (() => {
                          // pending first (not graded), then graded at bottom — each section newest -> oldest
                          const pending = assignmentsState.filter((x) => x.status !== 'graded').sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
                          const completed = assignmentsState.filter((x) => x.status === 'graded').sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
                          const ordered = [...pending, ...completed];
                          return ordered.map((a) => (
                            <div key={a.id} className="p-3 border rounded">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-sm font-medium">{a.title}</div>
                                  <div className="text-xs text-slate-500">{a.course?.code} • {formatDate(a.due_date)}</div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                  <div className="text-xs text-slate-500">{a.points ?? '-'} pts</div>
                                  <div className={`mt-1 inline-block px-2 py-1 text-xs rounded-full ${statusColor(a.status)}`}>{a.status}</div>
                                  <div className="flex items-center gap-2">
                                    {a.status === 'graded' ? (
                                      <span className="text-xs px-2 py-1 border rounded text-slate-500">Graded</span>
                                    ) : a.status === 'submitted' ? (
                                      <span className="text-xs px-2 py-1 border rounded text-slate-700">Submitted</span>
                                    ) : (
                                      (uploading && pendingUploadFor === a.id) ? (
                                        <button className="text-xs px-2 py-1 border rounded bg-indigo-400 text-white opacity-80" disabled>Uploading...</button>
                                      ) : (
                                        <button onClick={() => handleInitiateUpload(a.id)} className="text-xs px-2 py-1 border rounded bg-indigo-600 text-white">Submit</button>
                                      )
                                    )}
                                    <button onClick={() => navigate(`/courses/${a.course?.id}`)} className="text-xs px-2 py-1 border rounded text-indigo-600">Go to course</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ));
                        })()
                      )}
                  </div>
                </div>
              </div>
            );
          })()
        )}
        {/* Join Course Modal */}
        {joinModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setJoinModalOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-50">
              {!joinStatus ? (
                <form onSubmit={(e) => { e.preventDefault(); submitJoinRequest(joinCode); }}>
                   <h3 className="text-lg font-semibold text-slate-800 mb-2">Join course</h3>
                   <p className="text-sm text-slate-500 mb-4">Enter the course code provided by your instructor.</p>
                   <input ref={joinInputRef} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter code" className="w-full border rounded px-3 py-2 mb-4" />
                   <div className="flex items-center justify-end gap-2">
                     <button type="button" onClick={() => setJoinModalOpen(false)} className="px-3 py-2 rounded-md border">Cancel</button>
-                    <button type="submit" disabled={!joinCode.trim()} className="px-3 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60">Request join</button>
+                    <button type="submit" disabled={!joinCode.trim() || joinLoading} className="px-3 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60">
+                      {joinLoading ? 'Sending…' : 'Request join'}
+                    </button>
                   </div>
                 </form>
               ) : (
                 <div>
                   <h3 className="text-lg font-semibold text-slate-800 mb-2">Request sent</h3>
-                  <p className="text-sm text-slate-500 mb-4">{joinStatus === 'pending' ? 'Waiting for instructor approval.' : joinStatus}</p>
+                  <p className="text-sm text-slate-500 mb-4">
+                    {joinStatus === 'pending' ? 'Waiting for instructor approval.' : joinStatus}
+                  </p>
                   <div className="flex justify-end">
                     <button onClick={() => setJoinModalOpen(false)} className="px-3 py-2 rounded-md bg-indigo-600 text-white">Close</button>
                   </div>
                 </div>
               )}
             </div>
           </div>
         )}
         {/* Course Details Modal (student view) */}
         {courseModalOpen && (
           <div className="fixed inset-0 z-60 flex items-center justify-center">
             <div className="absolute inset-0 bg-black/40" onClick={() => setCourseModalOpen(false)} />
             <div className="relative bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 z-50">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold">{activeCourseName ?? 'Course'}</h3>
                 <div>
                  <button onClick={() => setCourseModalOpen(false)} className="px-3 py-1 text-sm rounded-md border">Close</button>
                </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Resources</h4>
                  {courseLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : courseResources.length === 0 ? (
                    <div className="text-sm text-slate-500">No resources</div>
                  ) : (
                    <ul className="space-y-2">
                      {courseResources.map((r: any) => (
                        <li key={r.id} className="p-3 border rounded">
                          <div className="text-sm font-semibold">{r.title || (r.type === 'video' ? 'Video' : 'Syllabus')}</div>
                          {r.type === 'video' ? (
                            <a href={r.video_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">{r.video_url}</a>
                          ) : (
                            <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{r.content}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Assignments</h4>
                  {courseLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : courseAssignments.length === 0 ? (
                    <div className="text-sm text-slate-500">No assignments</div>
                  ) : (
                    <ul className="space-y-2">
                      {courseAssignments.map((a: any) => (
                        <li key={a.id} className="p-3 border rounded flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{a.title}</div>
                            <div className="text-xs text-slate-500">{a.due_date ? new Date(a.due_date).toLocaleString() : 'No due date'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.status === 'submitted' ? (
                              <span className="text-sm text-slate-600">Submitted</span>
                            ) : (
                              <button onClick={() => handleInitiateUpload(a.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Submit</button>
                            )}
                            <button onClick={() => navigate(`/courses/${a.course_db_id ?? a.course?.id ?? ''}`)} className="px-3 py-1 border rounded text-sm">Go</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* hidden file input for assignment submission (PDF only) */}
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
