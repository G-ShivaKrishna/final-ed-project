import { useState } from 'react';
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

          <div className="flex items-center gap-3">
            <button onClick={onLogout} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition">
              Logout
            </button>
            <button className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md">
              <MoreVertical size={20} />
            </button>
          </div>
        </header>

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
                  <button className="text-left px-3 py-2 bg-indigo-600 text-white rounded-md">Create submission</button>
                  <QuickActionButtons />
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
      </div>
    </div>
  );
}
