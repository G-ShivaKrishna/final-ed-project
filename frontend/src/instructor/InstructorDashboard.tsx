import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, MoreVertical, User, XCircle, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ChatBox from '../student/ChatBot';
import CreateCourse from './CreateCourse';
import CoursesList from './CoursesList';

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

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InstructorDashboard({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [coursesCount, setCoursesCount] = useState<number | null>(null);
  const [pendingGradingCount, setPendingGradingCount] = useState<number | null>(null);

  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignment[]>([]);
  const [activeView, setActiveView] = useState('dashboard');

  useEffect(() => {
    fetchAssignments();
    fetchProfileSummary();
    // Optionally, add realtime subscription logic here if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfileSummary = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

      const profileRes = await fetch(`${API_BASE}/users/user-profile/?user_id=${encodeURIComponent(userId)}`);
      if (profileRes.ok) {
        const json = await profileRes.json();
        const data = json.data || json;
        if (data) {
          setProfileName(data.username || data.full_name || null);
          setProfileEmail(data.email || null);
        }
      }

      // Reuse generic dashboard for counts if no instructor-specific API exists
      const dashRes = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setCoursesCount(json.enrolled_courses ?? json.courses_taught ?? null);
        setPendingGradingCount(json.assignments_due ?? json.pending_grading ?? null);
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
      const rawAssignments: AssignmentWithCourse[] = json.assignments || [];
      if (rawAssignments) {
        // normalize due_date -> ISO and ensure course.code exists
        const assignments = rawAssignments.map((a) => {
          try {
            if (a.due_date) a.due_date = new Date(a.due_date).toISOString();
          } catch (_) { /* leave as-is */ }
          if (a.course && !a.course.code) a.course.code = a.course.course_id || a.course.courseId || a.course.code;
          return a;
        });

        const grouped = assignments.reduce((acc: Record<string, AssignmentWithCourse[]>, a: AssignmentWithCourse) => {
          const date = new Date(a.due_date);
          const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          acc[dateStr] = acc[dateStr] || [];
          acc[dateStr].push(a);
          return acc;
        }, {} as Record<string, AssignmentWithCourse[]>);
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
    fetchAssignments();
    fetchProfileSummary();
    setMenuOpen(false);
  };

  const handleExportCSV = () => {
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
    a.download = 'instructor_assignments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

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
    if (list.some((a) => a.status === 'submitted')) return { label: 'Submissions', color: 'bg-blue-50 text-blue-700' };
    if (list.every((a) => a.status === 'graded')) return { label: 'Graded', color: 'bg-green-50 text-green-700' };
    return { label: 'Due', color: 'bg-yellow-50 text-yellow-700' };
  }

  const QuickActionButtons = () => (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => { setActiveView('courses'); }} className="text-left px-3 py-2 border rounded-md">My courses</button>
      <button type="button" onClick={() => { setActiveView('create'); }} className="text-left px-3 py-2 border rounded-md">Create course</button>
      <button onClick={() => navigate('/inbox')} className="text-left px-3 py-2 border rounded-md">Inbox</button>
    </div>
  );

  const assignmentsOpen = false; // Instructor quick-view modal can be added later if needed

  // theme state & helpers (same behavior as student dashboard)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') ? 'dark' : 'light');

  useEffect(() => {
    try { applyTheme(theme); } catch {}
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
    } catch (e) {}
  }

  function toggleTheme() { applyTheme(theme === 'dark' ? 'light' : 'dark'); }

  function injectDarkStyles() {
    if (document.getElementById('dark-theme-overrides')) return;
    const css = `
      :root { color-scheme: dark; }
      body, .min-h-screen { background-color: #0b1220 !important; color: #e6eef8 !important; }
      .bg-white { background-color: #0b1220 !important; }
      .bg-gray-50 { background-color: #071025 !important; }
      .text-slate-500, .text-slate-400 { color: #94a3b8 !important; }
      .text-slate-600, .text-slate-700 { color: #cbd5e1 !important; }
      .text-slate-800, .text-slate-900 { color: #e6eef8 !important; }
      .border { border-color: rgba(255,255,255,0.06) !important; }
      .shadow, .shadow-sm, .shadow-md, .shadow-lg { box-shadow: none !important; }
      .bg-indigo-600 { background-color: #4f46e5 !important; }
      .bg-red-600 { background-color: #ef4444 !important; }
      .bg-green-50 { background-color: #052e1f !important; }
      .bg-blue-50 { background-color: #071633 !important; }
      a { color: #7dd3fc !important; }
      input, textarea { background-color: #071025 !important; color: #e6eef8 !important; border-color: rgba(255,255,255,0.06) !important; }
      .bg-gradient-to-b { background-image: linear-gradient(180deg,#071025,#071025) !important; }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-semibold text-slate-800">Instructor dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back, {profileName ?? 'Instructor'}</p>
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
              <span className={`absolute left-2 top-1 transform transition-all duration-400 ${theme === 'dark' ? 'opacity-0 -translate-x-1 scale-90' : 'opacity-100 translate-x-0 scale-100'}`}>
                <Sun size={14} className="text-yellow-400" />
              </span>
              <span className={`absolute right-2 top-1 transform transition-all duration-400 ${theme === 'dark' ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-1 scale-90'}`}>
                <Moon size={14} className="text-white" />
              </span>
              <span className={`relative z-10 block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6 rotate-6' : 'translate-x-0 rotate-0'}`} />
            </button>

            <button onClick={onLogout} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition">Logout</button>

            <button onClick={() => setMenuOpen((v) => !v)} className="h-10 w-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md" aria-haspopup="menu" aria-expanded={menuOpen}>
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
                <button onClick={handleRefresh} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Refresh</button>
                <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Export CSV</button>
                <button onClick={() => { setActiveView('courses'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">My courses</button>
                <button onClick={() => { navigate('/inbox'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Inbox</button>
              </div>
            )}
          </div>
        </header>

        {activeView === 'create' ? (
          <CreateCourse />
        ) : activeView === 'courses' ? (
          <CoursesList />
        ) : (
          <>
            {/* Recent posts: latest assignments created */}
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
                        {group.assignments.map((a) => (
                          <article key={a.id} className="flex items-center gap-4 p-4 rounded-lg border border-transparent hover:border-slate-200 transition bg-gradient-to-b from-white to-white/95">
                            <div className={`${a.course?.color === 'purple' ? 'bg-violet-500' : a.course?.color === 'blue' ? 'bg-blue-500' : a.course?.color === 'gray' ? 'bg-gray-400' : 'bg-slate-400'} w-2 h-12 rounded-l-md`} />

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
                                  <span>{a.completed_items ?? 0} items</span>
                                </div>
                                <button onClick={() => navigate(`/courses/${a.course?.id}`)} className="ml-auto text-sm text-indigo-600 hover:underline">View submissions</button>
                              </div>
                            </div>
                          </article>
                        ))}
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
                      <div className="text-sm font-semibold text-slate-800">{profileName ?? 'Instructor'}</div>
                      <div className="text-xs text-slate-500">{profileEmail ?? ''}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={() => navigate('/profile')} className="px-3 py-1 text-sm rounded-md bg-white border">View profile</button>
                    <button onClick={() => navigate('/profile')} className="px-3 py-1 text-sm rounded-md bg-indigo-600 text-white">Edit profile</button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-xs text-slate-500">Courses taught</div>
                      <div className="text-lg font-semibold text-slate-800">{typeof coursesCount === 'number' ? coursesCount : '—'}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-xs text-slate-500">Pending grading</div>
                      <div className="text-lg font-semibold text-slate-800">{typeof pendingGradingCount === 'number' ? pendingGradingCount : '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Quick actions</h4>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => setActiveView('create')} className="text-left px-3 py-2 bg-indigo-600 text-white rounded-md">Create course</button>
                    <QuickActionButtons />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Calendar</h4>
                  <div className="mt-2 grid grid-cols-7 gap-2 text-center text-xs">
                    {next7Days.map((d) => {
                      const key = dateKey(d);
                      const list = assignmentsByDate.get(key) ?? [];
                      const count = list.length;
                      const statuses = Array.from(new Set(list.map((a) => a.status)));
                      const statusToColor = (s: string) =>
                        s === 'missing' ? 'bg-red-500' :
                        s === 'submitted' ? 'bg-blue-500' :
                        s === 'graded' ? 'bg-green-500' :
                        'bg-yellow-400';
                      const aria = count === 0
                        ? `No due assignments on ${d.toLocaleDateString()}`
                        : `${count} assignment${count > 1 ? 's' : ''} on ${d.toLocaleDateString()}: ${statuses.join(', ')}`;

                      return (
                        <div key={d.toISOString()} className="p-2 rounded-md" aria-label={aria} title={aria}>
                          <div className="text-[10px] text-slate-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                          <div className="text-sm font-semibold text-slate-800">{d.getDate()}</div>

                          <div className="mt-1">
                            {count === 0 ? (
                              <div className="inline-block w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-600">No due</div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  {statuses.slice(0, 4).map((s) => (
                                    <span key={s} className={`w-2 h-2 rounded-full ${statusToColor(s)}`} />
                                  ))}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-700">{count} due</div>
                              </div>
                            )}
                          </div>
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
          </>
        )}
      </div>
    </div>
  );
}
