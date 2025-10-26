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

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('*, course:courses(*)')
      .order('due_date', { ascending: true });

    if (assignments) {
      const grouped = groupByDate(assignments as AssignmentWithCourse[]);
      setGroupedAssignments(grouped);
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

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      purple: 'border-purple-600',
      green: 'border-green-600',
      blue: 'border-blue-600',
      gray: 'border-gray-400',
    };
    return colorMap[color] || 'border-blue-600';
  };

  return (
    <div className="flex-1 bg-white">
      <div className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-3xl font-light">Dashboard</h1>
        <button className="p-2 hover:bg-gray-100 rounded">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="px-8 py-6">
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

        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Saturday, 27 September</h2>
          <div className="flex items-center gap-4 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4" />
              <button className="p-2 hover:bg-gray-100 rounded">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>

            <div className="border-l-4 border-gray-400 border-t border-r border-b px-4 py-2 bg-gray-100 min-w-[200px]">
              <div className="text-gray-700 text-sm font-medium text-center">4-1 FAM</div>
            </div>

            <div className="flex-1">
              <div className="text-sm text-gray-600">4-1 FAM ASSIGNMENT</div>
              <div className="text-blue-600 font-medium">JOURNAL ENTRIES</div>
            </div>

            <div className="flex items-center gap-4">
              <span className="px-3 py-1 border border-red-500 text-red-500 rounded-full text-sm">
                Missing
              </span>
              <div className="text-right">
                <div className="text-lg font-medium">5 <span className="text-sm text-gray-600">PTS</span></div>
                <div className="text-xs text-gray-600">DUE: 11:29</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
