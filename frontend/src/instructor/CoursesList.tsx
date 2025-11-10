import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Course = {
  id: string;
  name: string;
  course_id?: string;
  created_at?: string;
};

type JoinRequest = {
  id: string;
  student_id: string;
  status: string;
  created_at?: string;
  student?: { username?: string; email?: string };
};

export default function CoursesList(): JSX.Element {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [students, setStudents] = useState<{ id: string; username?: string; email?: string; joined_at?: string }[] | null>(null);
  const [instructorEmail, setInstructorEmail] = useState<string | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
  const navigate = useNavigate();

  // move fetchCourses out so we can re-use it after delete
  async function fetchCourses() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) {
        setCourses([]);
        return;
      }

      const { data, error } = await supabase
        .from('courses')
        .select('id, name, course_id, created_at')
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses((data as any[]) || []);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    fetchCourses();
    return () => { mounted = false; };
  }, []);

  // delete course (instructor)
  async function deleteCourse(course: Course) {
    const ok = window.confirm(`Delete course "${course.name}" (code ${course.course_id})? This cannot be undone.`);
    if (!ok) return;
    try {
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/users/courses/delete/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_db_id: course.id, instructor_id: instructorId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Delete failed: ${res.status}`);

      // remove from local list and close management view if open
      setCourses((prev) => (prev || []).filter((c) => c.id !== course.id));
      if (selectedCourse && selectedCourse.id === course.id) {
        setSelectedCourse(null);
        setRequests(null);
        setStudents(null);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  async function openCourseModal(course: Course) {
    setSelectedCourse(course);
    setRequests(null);
    setStudents(null);
    setReqLoading(true);
    setError(null);
    try {
      // get session + instructor email
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      const instructorMail = sessionData?.session?.user?.email ?? null;
      setInstructorEmail(instructorMail);
      if (!instructorId) throw new Error('Not authenticated');

      // fetch pending requests
      const res = await fetch(`${API_BASE}/users/courses/requests/?course_db_id=${encodeURIComponent(course.id)}&instructor_id=${encodeURIComponent(instructorId)}`);
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body?.error || `Failed to load requests: ${res.status}`);
      setRequests(body || []);

      // fetch enrolled students
      try {
        const sres = await fetch(`${API_BASE}/users/courses/students/?course_db_id=${encodeURIComponent(course.id)}&instructor_id=${encodeURIComponent(instructorId)}`);
        const sbody = await sres.json().catch(() => []);
        if (sres.ok) {
          // Normalize rows: backend returns { id, student_id, joined_at, student: { id, username, email } }
          const normalized = (sbody || []).map((r: any) => ({
            id: r.id ?? r.student_id ?? (r.student && r.student.id),
            email: r.student?.email ?? r.email ?? null,
            username: r.student?.username ?? r.username ?? null,
            joined_at: r.joined_at ?? r.created_at ?? null,
          }));
          setStudents(normalized);
        } else {
          setStudents([]);
        }
      } catch (_err) {
        setStudents([]);
      }
    } catch (err: any) {
      setRequests([]);
      setStudents([]);
      setError(err?.message || String(err));
    } finally {
      setReqLoading(false);
    }
  }

  async function respondToRequest(requestId: string, action: 'accept' | 'reject') {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/users/courses/requests/respond/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action, instructor_id: instructorId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed to ${action}`);
      // refresh list
      if (selectedCourse) await openCourseModal(selectedCourse);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  if (loading) return <div className="bg-white rounded-xl p-6 shadow-sm text-center">Loading courses...</div>;
  if (error) return <div className="bg-red-50 rounded-xl p-4 text-red-700">{error}</div>;
  if (!courses || courses.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800 mb-2">My courses</h3>
        <div className="text-sm text-slate-500">You haven't created any courses yet.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded-md">Back</button>
          <button onClick={() => navigate('/instructor')} className="px-3 py-1 border rounded-md">Dashboard</button>
          <h3 className="text-lg font-medium text-slate-800 ml-3">My courses</h3>
        </div>
        <button onClick={() => navigate('/instructor/create')} className="text-sm px-3 py-1 bg-indigo-600 text-white rounded-md">New course</button>
      </div>

      <ul className="space-y-3">
        {courses.map((c) => (
          <li key={c.id} className="border rounded-lg p-3 flex items-center justify-between hover:shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-800">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1">Code: <span className="font-mono">{c.course_id ?? '—'}</span></div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => openCourseModal(c)} className="text-sm text-indigo-600 hover:underline">Open</button>
                  <button onClick={() => deleteCourse(c)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selectedCourse && (
        // Full-page course management view
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-800">Manage course: {selectedCourse.name}</h2>
                <div className="text-sm text-slate-500 mt-1">Course code: <span className="font-mono">{selectedCourse.course_id}</span></div>
                <div className="text-xs text-slate-500 mt-1">Instructor: {instructorEmail ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded-md">Back</button>
                <button onClick={() => navigate('/instructor')} className="px-3 py-2 border rounded-md">Dashboard</button>
                <button onClick={() => { setSelectedCourse(null); setRequests(null); setStudents(null); }} className="px-3 py-2 border rounded-md">Close</button>
                <button onClick={() => { /* optional: navigate to full course editor route later */ }} className="px-3 py-2 bg-indigo-600 text-white rounded-md">Open editor</button>
                <button onClick={() => deleteCourse(selectedCourse)} className="px-3 py-2 bg-red-600 text-white rounded-md">Delete course</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: enrolled students */}
              <div className="lg:col-span-2 bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium mb-3">Enrolled students</h4>
                {reqLoading && !students && <div className="text-sm text-slate-500">Loading students...</div>}
                {!reqLoading && (!students || students.length === 0) && <div className="text-sm text-slate-500">No students enrolled yet.</div>}
                {!reqLoading && students && students.length > 0 && (
                  <ul className="space-y-2">
                    {students.map((s) => (
                      <li key={s.id} className="flex items-center justify-between border rounded p-3">
                        <div>
                          <div className="text-sm font-medium">{s.email ?? s.username ?? s.id}</div>
                          <div className="text-xs text-slate-500">{s.username ? `(${s.username})` : ''}</div>
                        </div>
                        <div className="text-xs text-slate-400">{s.joined_at ? new Date(s.joined_at).toLocaleDateString() : ''}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Right: pending requests and quick actions */}
              <aside className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-medium mb-3">Pending join requests</h4>
                {reqLoading && <div className="text-sm text-slate-500">Loading...</div>}
                {!reqLoading && (!requests || requests.length === 0) && <div className="text-sm text-slate-500">No pending requests.</div>}
                {!reqLoading && requests && requests.length > 0 && (
                  <ul className="space-y-3">
                    {requests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between border rounded p-3">
                        <div>
                          <div className="text-sm font-medium">{r.student?.email ?? r.student?.username ?? r.student_id}</div>
                          <div className="text-xs text-slate-500">{r.student?.username ? `(${r.student.username})` : ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => respondToRequest(r.id, 'accept')} className="px-3 py-1 bg-green-600 text-white rounded-md text-sm">Accept</button>
                          <button onClick={() => respondToRequest(r.id, 'reject')} className="px-3 py-1 bg-gray-200 text-slate-700 rounded-md text-sm">Reject</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6">
                  <h5 className="text-sm font-medium mb-2">Quick actions</h5>
                  <div className="flex flex-col gap-2">
                    <button className="px-3 py-2 bg-indigo-600 text-white rounded-md">Download roster</button>
                    <button className="px-3 py-2 border rounded-md" onClick={() => { /* placeholder for settings */ }}>Course settings</button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
