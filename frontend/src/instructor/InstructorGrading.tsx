import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

/**
 * InstructorGrading
 * - select a course and assignment
 * - list submissions for that assignment (with student info)
 * - grade a submission (grade + optional feedback) via backend POST /users/courses/submissions/grade/
 *
 * Usage: add a route like /instructor/grading -> <InstructorGrading />
 */

type Course = { id: string; name?: string; course_id?: string };
type Assignment = { id: string; title?: string; due_date?: string };
type Submission = { id: string; assignment_id: string; student_id: string; file_url?: string; status?: string; student?: { id?: string; username?: string; email?: string }; grade?: number | null; feedback?: string | null; submitted_at?: string };

export default function InstructorGrading(): JSX.Element {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeVal, setGradeVal] = useState<string>('');
  const [feedbackVal, setFeedbackVal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    (async () => {
      // load instructor's courses
      try {
        const { data: s } = await supabase.auth.getSession();
        const instructorId = s?.session?.user?.id;
        if (!instructorId) return;
        const { data: rows } = await supabase.from('courses').select('id, name, course_id').eq('instructor_id', instructorId).order('created_at', { ascending: false });
        setCourses(rows || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCourse) { setAssignments([]); setSelectedAssignment(null); return; }
    (async () => {
      // fetch assignments for this course (instructor view)
      try {
        const { data: s } = await supabase.auth.getSession();
        const instructorId = s?.session?.user?.id;
        if (!instructorId) return;
        const res = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(selectedCourse))}&user_id=${encodeURIComponent(String(instructorId))}`);
        const json = await res.json().catch(() => []);
        if (res.ok) setAssignments(Array.isArray(json) ? json.map((a: any) => ({ id: a.id, title: a.title, due_date: a.due_date })) : []);
        else setAssignments([]);
      } catch (e) {
        console.error(e);
        setAssignments([]);
      }
    })();
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedAssignment) { setSubmissions([]); return; }
    (async () => {
      setLoading(true);
      try {
        // load submissions for assignment, include student info
        const { data: subs, error } = await supabase
          .from('submissions')
          .select('id, assignment_id, student_id, file_url, status, grade, feedback, submitted_at, student:users(id, username, email)')
          .eq('assignment_id', selectedAssignment)
          .order('submitted_at', { ascending: false });
        if (error) throw error;
        setSubmissions((subs || []).map((s: any) => ({
          id: s.id,
          assignment_id: s.assignment_id,
          student_id: s.student_id,
          file_url: s.file_url,
          status: s.status,
          grade: s.grade,
          feedback: s.feedback,
          student: s.student ?? null,
          submitted_at: s.submitted_at,
        })));
      } catch (e: any) {
        console.error(e);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAssignment]);

  async function submitGrade(submissionId: string) {
    setError(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const graderId = s?.session?.user?.id;
      if (!graderId) throw new Error('Not authenticated');
      const payload = {
        grader_id: graderId,
        submission_id: submissionId,
        grade: Number(gradeVal),
        feedback: feedbackVal || null,
      };
      const res = await fetch(`${API_BASE}/users/courses/submissions/grade/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed to grade: ${res.status}`);
      // update local submission row
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? { ...s, grade: Number(gradeVal), feedback: feedbackVal, status: 'graded' } : s)));
      setGradingId(null);
      setGradeVal('');
      setFeedbackVal('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Grading</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Back</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={selectedCourse ?? ''} onChange={(e) => setSelectedCourse(e.target.value || null)} className="border px-2 py-2 rounded">
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.course_id}</option>)}
          </select>

          <select value={selectedAssignment ?? ''} onChange={(e) => setSelectedAssignment(e.target.value || null)} className="border px-2 py-2 rounded">
            <option value="">Select assignment</option>
            {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>

          <div className="text-sm text-slate-500 flex items-center">
            {loading ? 'Loading submissions…' : `${submissions.length} submission(s)`}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="space-y-3">
        {submissions.map((s) => (
          <div key={s.id} className="bg-white p-3 rounded shadow flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.student?.username ?? s.student?.email ?? s.student_id}</div>
                  <div className="text-xs text-slate-500">Submitted: {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</div>
                </div>
                <div className="text-sm text-slate-600">
                  {s.grade != null ? <div>Grade: <strong>{s.grade}</strong></div> : <div className="text-xs text-slate-500">Not graded</div>}
                </div>
              </div>

              <div className="mt-2 text-sm">
                {s.file_url ? <a href={s.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download submission</a> : <span className="text-slate-500">No file</span>}
              </div>

              {s.feedback && <div className="mt-2 text-xs text-slate-700">Prev feedback: {s.feedback}</div>}
            </div>

            <div className="w-56">
              {gradingId === s.id ? (
                <div className="space-y-2">
                  <input value={gradeVal} onChange={(e) => setGradeVal(e.target.value)} placeholder="Numeric grade" className="w-full border px-2 py-1 rounded" />
                  <textarea value={feedbackVal} onChange={(e) => setFeedbackVal(e.target.value)} placeholder="Feedback (optional)" className="w-full border px-2 py-1 rounded h-20" />
                  <div className="flex gap-2">
                    <button onClick={() => submitGrade(s.id)} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
                    <button onClick={() => { setGradingId(null); setGradeVal(''); setFeedbackVal(''); }} className="px-3 py-1 border rounded">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-slate-500">{s.status}</div>
                  <button onClick={() => { setGradingId(s.id); setGradeVal(s.grade != null ? String(s.grade) : ''); setFeedbackVal(s.feedback ?? ''); }} className="px-3 py-1 bg-green-600 text-white rounded">Grade</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {submissions.length === 0 && <div className="mt-6 text-sm text-slate-500">No submissions found for the selected assignment.</div>}
    </div>
  );
}
