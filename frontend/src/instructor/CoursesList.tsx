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
  const [reqLoading, setReqLoading] = useState(false);
  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const instructorId = sessionData?.session?.user?.id;
        if (!instructorId) {
          if (mounted) setCourses([]);
          return;
        }

        const { data, error } = await supabase
          .from('courses')
          .select('id, name, course_id, created_at')
          .eq('instructor_id', instructorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (mounted) setCourses((data as any[]) || []);
      } catch (err: any) {
        if (mounted) setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCourses();
    return () => { mounted = false; };
  }, []);

  async function openCourseModal(course: Course) {
    setSelectedCourse(course);
    setRequests(null);
    setReqLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/users/courses/requests/?course_db_id=${encodeURIComponent(course.id)}&instructor_id=${encodeURIComponent(instructorId)}`);
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body?.error || `Failed to load requests: ${res.status}`);
      setRequests(body || []);
    } catch (err: any) {
      setRequests([]);
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
        <h3 className="text-lg font-medium text-slate-800">My courses</h3>
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
                <button onClick={() => openCourseModal(c)} className="text-sm text-indigo-600 hover:underline">Open</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedCourse(null); setRequests(null); }} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Course: {selectedCourse.name}</h3>
              <button onClick={() => { setSelectedCourse(null); setRequests(null); }} className="text-sm text-slate-500">Close</button>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Pending join requests</h4>
              {reqLoading && <div className="text-sm text-slate-500">Loading...</div>}
              {!reqLoading && (!requests || requests.length === 0) && <div className="text-sm text-slate-500">No pending requests.</div>}
              {!reqLoading && requests && requests.length > 0 && (
                <ul className="space-y-3">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between border rounded p-3">
                      <div>
                        <div className="text-sm font-medium">{r.student?.username || r.student_id}</div>
                        <div className="text-xs text-slate-500">{r.student?.email ?? ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => respondToRequest(r.id, 'accept')} className="px-3 py-1 bg-green-600 text-white rounded-md text-sm">Accept</button>
                        <button onClick={() => respondToRequest(r.id, 'reject')} className="px-3 py-1 bg-gray-200 text-slate-700 rounded-md text-sm">Reject</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
