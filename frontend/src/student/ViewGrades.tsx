import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ViewGrades(): JSX.Element {
  const navigate = useNavigate();
  const [grades, setGrades] = useState<
    { id: string; course: string; assignment: string; grade: number | null; outOf: number | null; feedback?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadGrades() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          if (mounted) {
            setGrades([]);
            setLoading(false);
          }
          return;
        }

        // 1) fetch submissions for the student
        const { data: subs, error: subsErr } = await supabase
          .from('submissions')
          .select('id, assignment_id, grade, feedback, submitted_at, status')
          .eq('student_id', userId)
          .order('submitted_at', { ascending: false });
        if (subsErr) throw subsErr;
        const submissions = Array.isArray(subs) ? subs : [];

        // 2) fetch assignments referenced by those submissions
        const assignmentIds = Array.from(new Set(submissions.map((s: any) => s.assignment_id).filter(Boolean)));
        let assignments: any[] = [];
        if (assignmentIds.length) {
          const { data: arows, error: aErr } = await supabase
            .from('assignments')
            .select('id, title, points, course_db_id')
            .in('id', assignmentIds);
          if (aErr) throw aErr;
          assignments = Array.isArray(arows) ? arows : [];
        }

        // 3) fetch courses referenced by assignments
        const courseIds = Array.from(new Set(assignments.map((a) => a.course_db_id).filter(Boolean)));
        let courses: any[] = [];
        if (courseIds.length) {
          const { data: crows, error: cErr } = await supabase
            .from('courses')
            .select('id, course_id, name')
            .in('id', courseIds);
          if (cErr) throw cErr;
          courses = Array.isArray(crows) ? crows : [];
        }

        // build maps for quick lookup
        const assignMap = new Map(assignments.map((a: any) => [String(a.id), a]));
        const courseMap = new Map(courses.map((c: any) => [String(c.id), c]));

        // compose grade rows
        const rows = submissions.map((s: any) => {
          const a = assignMap.get(String(s.assignment_id)) || {};
          const course = courseMap.get(String(a.course_db_id)) || {};
          return {
            id: String(s.id),
            // prefer human-friendly course name; fall back to course_id code
            course: course.name || course.course_id || '—',
            assignment: a.title || '—',
            // keep raw grade/outOf so UI can format consistently
            grade: s.grade ?? null,
            outOf: a.points ?? null,
            feedback: s.feedback ?? '',
          };
        });

        if (mounted) {
          setGrades(rows);
        }
      } catch (err: any) {
        console.error('Failed loading grades', err);
        if (mounted) setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadGrades();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold mb-4">Grades</h1>
          <p className="text-sm text-slate-500 mb-6">Your recent grades and feedback.</p>

          {loading ? (
            <div className="text-sm text-slate-500">Loading grades…</div>
          ) : error ? (
            <div className="text-sm text-red-600">Error loading grades: {error}</div>
          ) : grades.length === 0 ? (
            <div className="text-sm text-slate-500">No grades available yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sm text-slate-500">
                    <th className="p-3">Course</th>
                    <th className="p-3">Assignment</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id} className="border-t">
                      <td className="p-3 text-sm font-medium text-slate-700">{g.course}</td>
                      <td className="p-3 text-sm text-slate-600">{g.assignment}</td>
                      <td className="p-3 text-sm text-slate-700">
                        {g.grade !== null
                          ? `${g.grade} / 10` // show marks out of 10 as requested
                          : 'Yet to grade'}
                      </td>
                      <td className="p-3 text-sm text-slate-600">{g.feedback || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
