import { useEffect, useState } from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { supabase, Course, Assignment } from '../lib/supabase';

type AssignmentWithCourse = Assignment & {
  course?: Course;
};

type GroupedAssignment = {
  date: string;
  assignments: AssignmentWithCourse[];
};

export default function Dashboard() {
  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignment[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [assignmentsDueCount, setAssignmentsDueCount] = useState<number | null>(null);

  useEffect(() => {
    let channel: any | null = null;

    fetchAssignments();
    fetchProfileSummary();
    // subscribe to assignments changes and refresh when anything changes
    try {
      channel = supabase
        .channel('public:assignments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
          fetchAssignments();
        })
        .subscribe();
    } catch (err) {
      // ignore realtime subscription errors — we'll still fetch on mount
      // console.warn('realtime subscribe failed', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfileSummary = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

      // fetch profile
      const profileRes = await fetch(`${API_BASE}/users/user-profile/?user_id=${encodeURIComponent(userId)}`);
      if (profileRes.ok) {
        const json = await profileRes.json();
        const data = json.data || json;
        if (data) {
          setProfileName(data.username || data.full_name || null);
        }
      }

      // fetch dashboard summary (enrolled courses, assignments due)
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
    // fetch assignments relevant to the current user (student) via backend
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
        const grouped = groupByDate(assignments as AssignmentWithCourse[]);
        setGroupedAssignments(grouped);
      }
    } catch (err) {
      console.error('fetchAssignments error', err);
    }
  };

  const groupByDate = (assignments: AssignmentWithCourse[]): GroupedAssignment[] => {
    const groups: { [key: string]: AssignmentWithCourse[] } = {};

    assignments.forEach((assignment) => {
      const date = new Date(assignment.due_date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(assignment);
    });

    return Object.entries(groups).map(([date, assignments]) => ({
      date,
      assignments,
    }));
  };

  const getStatusBadge = (status: string, isLate?: boolean) => {
    if (isLate) {
      return (
        <span className="px-3 py-1 border border-red-500 text-red-500 rounded-full text-sm">
          Late
        </span>
      );
    }

    switch (status) {
      case 'graded':
        return (
          <span className="px-3 py-1 border border-gray-400 text-gray-600 rounded-full text-sm">
            Graded
          </span>
        );
      case 'submitted':
        return (
          <span className="px-3 py-1 border border-gray-400 text-gray-600 rounded-full text-sm">
            Submitted
          </span>
        );
      case 'missing':
        return (
          <span className="px-3 py-1 border border-red-500 text-red-500 rounded-full text-sm">
            Missing
          </span>
        );
      default:
        return null;
    }
  };

  const getColorClass = (color?: string) => {
    const colorMap: { [key: string]: string } = {
      purple: 'border-purple-600',
      green: 'border-green-600',
      blue: 'border-blue-600',
      gray: 'border-gray-400',
    };
    return colorMap[color || 'blue'] || 'border-blue-600';
  };

  return (
    <div className="flex-1 bg-white">
      <div className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light">Dashboard</h1>
          {profileName ? (
            <div className="text-sm text-gray-500">Welcome back, {profileName}</div>
          ) : (
            <div className="text-sm text-gray-400">Welcome back</div>
          )}
        </div>
        <button className="p-2 hover:bg-gray-100 rounded">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="px-8 py-6">
        <div className="flex gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded w-40">
            <div className="text-xs text-slate-500">Courses</div>
            <div className="text-lg font-semibold">{typeof enrolledCount === 'number' ? enrolledCount : '—'}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded w-40">
            <div className="text-xs text-slate-500">Assignments due</div>
            <div className="text-lg font-semibold">{typeof assignmentsDueCount === 'number' ? assignmentsDueCount : '—'}</div>
          </div>
        </div>
        {groupedAssignments.map((group, idx) => (
          <div key={idx} className="mb-8">
            <h2 className="text-lg font-medium mb-4">{group.date}</h2>

            {group.assignments.map((assignment) => {
              const course = assignment.course;
              if (!course) return null;

              const isLate = assignment.status === 'submitted' && assignment.due_date < new Date().toISOString();

              return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-4 py-4 border-t border-gray-200"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>

                  <div className={`border-l-4 ${getColorClass(course.color)} border-t border-r border-b px-4 py-2 bg-white min-w-[200px]`}>
                    <div className="text-blue-600 text-sm font-medium text-center">
                      {course.code}
                    </div>
                  </div>

                  <ChevronRight size={20} className="text-gray-400" />

                  <button className="text-blue-600 hover:underline flex-1 text-left">
                    Show {assignment.completed_items} completed item
                  </button>

                  <div className="flex gap-2">
                    {getStatusBadge(assignment.status, isLate)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {groupedAssignments.length === 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">No upcoming assignments</h2>
            <div className="p-6 bg-gray-50 rounded text-gray-600">You're all caught up 🎉</div>
          </div>
        )}
      </div>
    </div>
  );
}
