import { useState, useRef, useEffect } from 'react';
import { ChevronRight, MoreVertical, User, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatBox from './ChatBot';

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
  // Hardcoded user (no backend)
  const hardcodedEmail = '2203A51311@sru.edu.in';
  const hardcodedName = 'Akhil Kumar';

  // Hardcoded assignments grouped by date
  const [groupedAssignments] = useState<GroupedAssignment[]>([
    {
      date: 'Today',
      assignments: [
        {
          id: 1,
          title: 'Journal Entries',
          due_date: '2025-10-27T11:29:00Z',
          status: 'missing',
          completed_items: 0,
          points: 5,
          course: { id: 'c1', code: '4-1 FAM', color: 'gray' },
        },
        {
          id: 2,
          title: 'Homework 3',
          due_date: '2025-10-27T15:00:00Z',
          status: 'submitted',
          completed_items: 3,
          points: 10,
          course: { id: 'c2', code: 'MATH101', color: 'blue' },
        },
      ],
    },
    {
      date: 'Wed, Oct 29',
      assignments: [
        {
          id: 3,
          title: 'Essay Draft',
          due_date: '2025-10-29T09:00:00Z',
          status: 'graded',
          completed_items: 5,
          points: 20,
          course: { id: 'c3', code: 'ENG202', color: 'purple' },
        },
      ],
    },
  ]);

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
  const joinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (joinModalOpen) {
      // give the modal a tick to render, then focus
      setTimeout(() => joinInputRef.current?.focus(), 50);
      setJoinStatus(null);
      setJoinCode('');
    }
  }, [joinModalOpen]);

  // Derived data: joined courses and recent posts
  // Build map of course -> latest assignment date, then pick 3 most recent courses
  const courseMap = new Map<string | number, { course: { id: string | number; code?: string; color?: string }; latest: number }>();
  groupedAssignments.forEach((g) => {
    g.assignments.forEach((a) => {
      if (a.course?.id != null) {
        const id = a.course.id;
        const ts = new Date(a.due_date).getTime();
        const prev = courseMap.get(id);
        if (!prev || ts > prev.latest) {
          courseMap.set(id, { course: a.course as any, latest: ts });
        }
      }
    });
  });
  const joinedCourses = Array.from(courseMap.values())
    .sort((a, b) => b.latest - a.latest)
    .map((x) => x.course)
    .slice(0, 3);

  const recentPosts = groupedAssignments
    .flatMap((g) => g.assignments.map((a) => ({ ...a, groupDate: g.date })))
    .sort((x, y) => new Date(y.due_date).getTime() - new Date(x.due_date).getTime())
    .slice(0, 3);

  // Mini 7-day calendar with status per day based on assignments
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

  const assignmentsByDate = new Map<string, AssignmentWithCourse[]>();
  groupedAssignments.forEach((g) => {
    g.assignments.forEach((a) => {
      const key = dateKey(new Date(a.due_date));
      const arr = assignmentsByDate.get(key) ?? [];
      arr.push(a);
      assignmentsByDate.set(key, arr);
    });
  });

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
      <button onClick={() => navigate('/course-settings')} className="text-left px-3 py-2 border rounded-md">Course settings</button>
    </>
  );

  return (
  <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-50 p-6 pointer-events-auto">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back, {hardcodedName}</p>
          </div>

          <div className="flex items-center gap-3 relative">
            <button onClick={onLogout} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition">
              Logout
            </button>

            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md" aria-haspopup="menu" aria-expanded={menuOpen}>
                <MoreVertical size={20} />
              </button>

              {menuOpen && (
                <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
                  <button onClick={handleRefresh} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Refresh</button>
                  <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Export CSV</button>
                  <button onClick={() => { navigate('/grades'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">View grades</button>
                  <button onClick={() => { navigate('/course-settings'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Course settings</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Recent posts: latest assignment posts */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-600 font-medium mb-3">Recent posts</h3>
          <div className="flex flex-col sm:flex-row gap-3">
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
                  <div className="text-sm font-semibold text-slate-800">{hardcodedName}</div>
                  <div className="text-xs text-slate-500">{hardcodedEmail}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Courses</div>
                  <div className="text-lg font-semibold text-slate-800">3</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-slate-500">Assignments due</div>
                  <div className="text-lg font-semibold text-slate-800">4</div>
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
                <h4 className="text-sm font-medium text-slate-700 mb-3">Joined courses</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {joinedCourses.length ? (
                    joinedCourses.map((c) => (
                      <span key={c.id} className={`px-3 py-1 rounded-full text-sm ${c.color === 'purple' ? 'bg-violet-100 text-violet-700' : c.color === 'blue' ? 'bg-blue-100 text-blue-700' : c.color === 'gray' ? 'bg-gray-100 text-gray-700' : 'bg-slate-100 text-slate-700'}`}>
                        {c.code}
                      </span>
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
        {/* Join Course Modal */}
        {joinModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setJoinModalOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-50">
              {!joinStatus ? (
                <form onSubmit={(e) => { e.preventDefault(); setJoinStatus('the instructor will accept the joining'); }}>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Join course</h3>
                  <p className="text-sm text-slate-500 mb-4">Enter the course code provided by your instructor.</p>
                  <input ref={joinInputRef} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter code" className="w-full border rounded px-3 py-2 mb-4" />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setJoinModalOpen(false)} className="px-3 py-2 rounded-md border">Cancel</button>
                    <button type="submit" disabled={!joinCode.trim()} className="px-3 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60">Request join</button>
                  </div>
                </form>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Request sent</h3>
                  <p className="text-sm text-slate-500 mb-4">the instructor will accept the joining</p>
                  <div className="flex justify-end">
                    <button onClick={() => setJoinModalOpen(false)} className="px-3 py-2 rounded-md bg-indigo-600 text-white">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
