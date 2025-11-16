import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SubmissionList from '../components/SubmissionList';
import { fetchCourseSubmissions } from '../lib/api';

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
  const location = useLocation();
  const urlNavigate = useNavigate();

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [students, setStudents] = useState<{ id: string; username?: string; email?: string; joined_at?: string }[] | null>(null);
  const [instructorEmail, setInstructorEmail] = useState<string | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [resources, setResources] = useState<any[] | null>(null);
  const [addAssignOpen, setAddAssignOpen] = useState(false);
  const [addResOpen, setAddResOpen] = useState(false);
  // assignment edit state
  const [editAssignOpen, setEditAssignOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [editAssignForm, setEditAssignForm] = useState({ title: '', description: '', due_date: '', points: '' });
  const [assignForm, setAssignForm] = useState({ title: '', description: '', due_date: '', points: '' });
  const [resForm, setResForm] = useState({ type: 'syllabus' as 'syllabus' | 'video', title: '', content: '', video_url: '' });
  // resource edit state
  const [editResOpen, setEditResOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<any | null>(null);
  const [editResForm, setEditResForm] = useState({ title: '', content: '', video_url: '', type: 'syllabus' as 'syllabus' | 'video' });

  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
  const navigate = useNavigate();

  // file upload state & refs for assignment/resource attachments
  const [assignFile, setAssignFile] = useState<File | null>(null);
  const [resFile, setResFile] = useState<File | null>(null);
  const assignFileRef = useRef<HTMLInputElement | null>(null);
  const resFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // grading state
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradeValue, setGradeValue] = useState<number | ''>('');
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // in-page confirmation modal state (replaces window.confirm)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmMessage, setConfirmMessage] = useState<string>('');
  // store the async callback to run when confirmed
  const confirmCallbackRef = useRef<(() => Promise<void>) | null>(null);

  function openConfirm(title: string, message: string, cb: () => Promise<void>) {
    confirmCallbackRef.current = cb;
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmOpen(true);
  }
  async function runConfirm() {
    setConfirmOpen(false);
    const cb = confirmCallbackRef.current;
    confirmCallbackRef.current = null;
    if (cb) await cb();
  }
  function cancelConfirm() {
    setConfirmOpen(false);
    confirmCallbackRef.current = null;
  }

  // helper: try getPublicUrl then fall back to signed URL for private buckets (assignments bucket)
  async function getPublicUrlOrSigned(bucket: string, path: string) {
    try {
      const pubRes = await supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = (pubRes as any)?.data?.publicUrl || (pubRes as any)?.publicURL || (pubRes as any)?.public_url || '';
      if (publicUrl) return publicUrl;
      const { data: signedData, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!signedErr && signedData?.signedURL) return signedData.signedURL;
    } catch (e) {
      console.warn('getPublicUrlOrSigned failed', e);
    }
    return '';
  }

  // helper: upload a file to Supabase storage 'assignments' bucket and return a usable URL (public or signed)
  async function uploadAssignmentFile(file: File, courseId: string) {
    if (!file) return '';
    try {
      const path = `${courseId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage.from('assignments').upload(path, file, { upsert: true });
      if (error) throw error;
      const publicUrl = await getPublicUrlOrSigned('assignments', path);
      return publicUrl;
    } catch (err) {
      console.warn('file upload failed', err);
      return '';
    }
  }

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
    fetchCourses();
    // no teardown needed here
  }, []);

  // delete course (instructor) — HTTP-only (backend handles verification & deletion)
  function deleteCourse(course: Course) {
    // show in-page confirmation and run the async delete on confirm
    openConfirm(
      `Delete course "${course.name}"?`,
      `This will permanently delete the course (code ${course.course_id}). This cannot be undone.`,
      async () => {
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
    );
  }

  async function openCourseModal(course: Course) {
    setSelectedCourse(course);
    setRequests(null);
    setStudents(null);
    setAssignments(null);
    setResources(null);
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

      // fetch assignments for this course (instructor view)
      try {
        const ares = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(course.id)}&user_id=${encodeURIComponent(instructorId)}`);
        const ajson = await ares.json().catch(() => []);
        if (ares.ok) {
          // normalize incoming assignment rows: ensure due_date is ISO and course.code exists
          // keep normalized assignments in a local var so we can attach submissions below
          const normalizedAssignments = (ajson || []).map((a: any) => {
            if (a.course && !a.course.code) a.course.code = a.course.course_id || a.course.courseId || a.course.code;
            if (a.due_date) {
              try {
                a.due_date = new Date(a.due_date).toISOString();
              } catch (_) { /* leave as-is */ }
            }
            return a;
          });
          // set state from the normalized local copy
          setAssignments(normalizedAssignments);
        } else setAssignments([]);
      } catch {
        setAssignments([]);
      }

      // fetch course resources (syllabus/videos)
      try {
        const rres = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(course.id)}&user_id=${encodeURIComponent(instructorId)}`);
        const rjson = await rres.json().catch(() => []);
        if (rres.ok) setResources(rjson || []);
        else setResources([]);
      } catch {
        setResources([]);
      }
      // new: fetch all submissions for this course (instructor view)
      try {
        const subs = await fetchCourseSubmissions(course.id, instructorId);
        // subs expected to be array of submissions with student info and assignment reference
        // attach submissions to the previously-normalized assignments (use the local normalized array if available)
        if (Array.isArray(subs) && subs.length > 0) {
          const map = new Map<string, any[]>();
          subs.forEach((s: any) => {
            const aid = String(s.assignment_id);
            if (!map.has(aid)) map.set(aid, []);
            map.get(aid).push(s);
          });
          // read current assignments from state (fallback to []) then attach submissions
          setAssignments((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            return base.map((a: any) => ({ ...a, submissions: map.get(String(a.id)) || [] }));
          });
        }
      } catch (_e) {
        // ignore
      }
    } catch (err: any) {
      setRequests([]);
      setStudents([]);
      setError(err?.message || String(err));
    } finally {
      setReqLoading(false);
    }
  }

  async function createAssignment() {
    if (!selectedCourse) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      // optionally upload an attached file and append its public URL into the description
      let description = assignForm.description ?? '';
      if (assignFile) {
        setUploadingFile(true);
        const pub = await uploadAssignmentFile(assignFile, selectedCourse.id);
        setUploadingFile(false);
        if (pub) description = `${description}\n\nAttachment: ${pub}`;
      }

      // convert datetime-local (local) -> ISO before sending
      const dueIso = assignForm.due_date ? new Date(assignForm.due_date).toISOString() : null;
      const payload = {
        instructor_id: instructorId,
        course_db_id: selectedCourse.id,
        title: assignForm.title,
        description: description,
        due_date: dueIso,
        points: assignForm.points ? Number(assignForm.points) : null,
      };
      const res = await fetch(`${API_BASE}/users/courses/assignments/create/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed: ${res.status}`);
      // refresh assignments
      await openCourseModal(selectedCourse);
      setAddAssignOpen(false);
      setAssignForm({ title: '', description: '', due_date: '', points: '' });
      setAssignFile(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  // open edit modal and prefill form
  function openEditAssignment(a: any) {
    setEditingAssignment(a);
    setEditAssignForm({
      title: a.title ?? '',
      description: a.description ?? '',
      // convert ISO -> datetime-local format if possible
      due_date: a.due_date ? (() => {
        try {
          const dt = new Date(a.due_date);
          const iso = dt.toISOString();
          // return YYYY-MM-DDTHH:MM for datetime-local
          return iso.slice(0, 16);
        } catch { return ''; }
      })() : '',
      points: a.points ? String(a.points) : '',
    });
    setEditAssignOpen(true);
  }

  // update assignment via API
  async function updateAssignment() {
    if (!selectedCourse || !editingAssignment) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      // NEW: optionally upload attached file and append its public URL into the description
      let description = editAssignForm.description ?? '';
      if (assignFile) {
        setUploadingFile(true);
        const pub = await uploadAssignmentFile(assignFile, selectedCourse.id);
        setUploadingFile(false);
        if (pub) description = `${description}\n\nAttachment: ${pub}`;
        // clear assignFile after using it
        setAssignFile(null);
      }

      const payload: any = {
        instructor_id: instructorId,
        assignment_id: editingAssignment.id,
        title: editAssignForm.title,
        description: description,
        points: editAssignForm.points ? Number(editAssignForm.points) : null,
      };
      if (editAssignForm.due_date) {
        // datetime-local -> ISO
        try { payload.due_date = new Date(editAssignForm.due_date).toISOString(); } catch { payload.due_date = null; }
      } else {
        payload.due_date = null;
      }

      const res = await fetch(`${API_BASE}/users/courses/assignments/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Update failed: ${res.status}`);

      // refresh modal data and close editor
      if (selectedCourse) await openCourseModal(selectedCourse);
      setEditAssignOpen(false);
      setEditingAssignment(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  // delete assignment via API — HTTP-only (backend handles validation)
  function deleteAssignment(a: any) {
    if (!selectedCourse || !a) return;
    openConfirm(
      `Delete assignment "${a.title}"?`,
      'This action cannot be undone.',
      async () => {
        try {
          setError(null);
          const { data: sessionData } = await supabase.auth.getSession();
          const instructorId = sessionData?.session?.user?.id;
          if (!instructorId) throw new Error('Not authenticated');

          const res = await fetch(`${API_BASE}/users/courses/assignments/delete/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignment_id: a.id, instructor_id: instructorId }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.error || `Delete failed: ${res.status}`);

          // refresh assignments list
          await openCourseModal(selectedCourse);
        } catch (err: any) {
          setError(err?.message || String(err));
        }
      }
    );
  }

  async function addResource() {
    if (!selectedCourse) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');
      // optionally upload a file for syllabus and append link into content
      let content = resForm.content ?? '';
      if (resFile && resForm.type === 'syllabus') {
        setUploadingFile(true);
        const pub = await uploadAssignmentFile(resFile, selectedCourse.id);
        setUploadingFile(false);
        if (pub) content = `${content}\n\nAttachment: ${pub}`;
      }

      const payload = {
        instructor_id: instructorId,
        course_db_id: selectedCourse.id,
        type: resForm.type,
        title: resForm.title,
        content: content,
        video_url: resForm.video_url,
      };
      const res = await fetch(`${API_BASE}/users/courses/resources/add/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed: ${res.status}`);
      // refresh resources
      await openCourseModal(selectedCourse);
      setAddResOpen(false);
      setResForm({ type: 'syllabus', title: '', content: '', video_url: '' });
      setResFile(null);
    } catch (err: any) {
      setError(err?.message || String(err));
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

  // update resource (edit modal)
  async function updateResource() {
    if (!editingResource) return;
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');
      const payload: any = {
        instructor_id: instructorId,
        resource_id: editingResource.id,
        title: editResForm.title,
        type: editResForm.type,
      };

      // NEW: if editing syllabus and a file was attached, upload and append into content
      if (editResForm.type === 'syllabus') {
        let content = editResForm.content ?? '';
        if (resFile) {
          setUploadingFile(true);
          const pub = await uploadAssignmentFile(resFile, selectedCourse?.id ?? '');
          setUploadingFile(false);
          if (pub) content = `${content}\n\nAttachment: ${pub}`;
          setResFile(null);
        }
        payload.content = content;
      } else {
        payload.video_url = editResForm.video_url;
      }

      const res = await fetch(`${API_BASE}/users/courses/resources/update/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Update failed: ${res.status}`);
      // refresh modal data
      if (selectedCourse) await openCourseModal(selectedCourse);
      setEditResOpen(false);
      setEditingResource(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  useEffect(() => {
    // If the URL (or navigation state) requests opening a specific course, auto-open it.
    // Allows InstructorDashboard to navigate to ?view=courses&course_db_id=... and have the course modal open.
    async function maybeOpenCourseFromUrl() {
      try {
        const params = new URLSearchParams(location.search);
        const courseIdFromQuery = params.get('course_db_id');
        const courseIdFromState = (location.state as any)?.open_course_id ?? (location.state as any)?.course?.id;
        const courseId = courseIdFromQuery ?? (courseIdFromState ? String(courseIdFromState) : null);
        if (!courseId) return;
        // wait until courses are loaded (fetchCourses runs on mount) — if courses not loaded yet, keep waiting until they are
        if (courses === null) return;
        // find a matching course if present
        const found = (courses || []).find((c) => String(c.id) === String(courseId));
        if (found) {
          // open using the real course object
          await openCourseModal(found);
        } else {
          // construct a minimal course object (openCourseModal only needs id and will fetch details)
          await openCourseModal({ id: courseId, name: `Course ${courseId}`, course_id: undefined } as Course);
        }
      } catch (e) {
        // ignore errors — auto-open should be best-effort
      }
    }
    maybeOpenCourseFromUrl();
    // run when the location or courses list changes
  }, [location.search, location.state, courses, /* openCourseModal defined inline so no eslint deps */]);

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
    // make the list container theme-aware: white in light, slate-800 in dark, and inherit text
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
          >
            Back
          </button>
          <button
            onClick={() => navigate('/instructor-dashboard?view=dashboard')}
            className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
          >
            Dashboard
          </button>
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 ml-3">My courses</h3>
        </div>
        <button onClick={() => navigate('/instructor/create')} className="text-sm px-3 py-1 bg-indigo-600 text-white rounded-md">New course</button>
      </div>

      <ul className="space-y-3">
        {courses.map((c) => (
          <li key={c.id} className="border rounded-lg p-3 flex items-center justify-between hover:shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Code: <span className="font-mono">{c.course_id ?? '—'}</span></div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  {/* open in-place (fetch data) AND update URL so navigation works */}
                  <button
                    onClick={async () => {
                      // open the in-page course view (loads assignments, students, etc.)
                      await openCourseModal(c);
                      // update URL so users can share / use back/forward
                      // use view=courses (plural) so InstructorDashboard's view parsing picks this up
                      // this navigation is a user action that should create a history entry (push),
                      // so we keep the default (no replace).
                      urlNavigate(`/instructor-dashboard?view=courses&course_db_id=${encodeURIComponent(c.id)}`, {
                        state: { course: c },
                      });
                    }}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Open
                  </button>
                  <button onClick={() => deleteCourse(c)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selectedCourse && (
        // Full-page course management view (lower z so modals can appear above)
        <div className="fixed inset-0 z-40 bg-slate-50 dark:bg-[#071025] overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-800">Manage course: {selectedCourse.name}</h2>
                <div className="text-sm text-slate-500 mt-1">Course code: <span className="font-mono">{selectedCourse.course_id}</span></div>
                <div className="text-xs text-slate-500 mt-1">Instructor: {instructorEmail ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">Back</button>
                <button onClick={() => navigate('/instructor-dashboard?view=dashboard')} className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">Dashboard</button>
                <button onClick={() => { setSelectedCourse(null); setRequests(null); setStudents(null); }} className="px-3 py-2 border rounded-md">Close</button>
                <button onClick={() => { /* optional: navigate to full course editor route later */ }} className="px-3 py-2 bg-indigo-600 text-white rounded-md">Open editor</button>
                <button onClick={() => deleteCourse(selectedCourse)} className="px-3 py-2 bg-red-600 text-white rounded-md">Delete course</button>
                {/* new quick-create buttons */}
                <button onClick={() => setAddAssignOpen(true)} className="px-3 py-2 bg-green-600 text-white rounded-md">Add assignment</button>
                <button onClick={() => { setResForm({ type: 'syllabus', title: '', content: '', video_url: '' }); setAddResOpen(true); }} className="px-3 py-2 bg-orange-600 text-white rounded-md">Add syllabus</button>
                {/* 'Add resource' removed to avoid duplication with syllabus/video flow */}
              </div>
            </div>

            {/* Assignments list */}
            <div className="mb-4 bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Assignments</h4>
                <div className="text-xs text-slate-500">{assignments ? `${assignments.length} total` : '—'}</div>
              </div>
              {assignments && assignments.length > 0 ? (
                <ul className="space-y-2">
                  {assignments.map((a: any) => (
                    <li key={a.id} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{a.title}</div>
                          <div className="text-xs text-slate-500">{a.due_date ? new Date(a.due_date).toLocaleString() : 'No due date'}</div>
                          {a.description && (() => {
                            const m = String(a.description).match(/https?:\/\/\S+/);
                            return m ? <div className="text-xs mt-1"><a href={m[0]} target="_blank" rel="noreferrer" className="text-indigo-600">Download attachment</a></div> : null;
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-slate-400 mr-2">{a.points ? `${a.points} pts` : ''}</div>
                          <button onClick={() => openEditAssignment(a)} className="text-sm px-2 py-1 border rounded-md bg-white text-indigo-600">Edit</button>
                          <button onClick={() => deleteAssignment(a)} className="text-sm px-2 py-1 border rounded-md bg-white text-red-600">Delete</button>
                        </div>
                      </div>
                      {/* render submissions for this assignment (if any) */}
                      <div className="mt-3">
                        <h5 className="text-xs text-slate-500 mb-2">Submissions</h5>
                        {Array.isArray(a.submissions) && a.submissions.length > 0 ? (
                          <ul className="space-y-2">
                            {a.submissions.map((s: any) => (
                              <li key={s.id} className="flex items-center justify-between border rounded p-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <div>
                                  <div className="text-sm font-medium dark:text-slate-100">{s.student?.email ?? s.student_id}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{s.assignment_title ?? ''} • {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ''}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {s.file_url ? <a href={s.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm">Download PDF</a> : <span className="text-xs text-slate-500">No file</span>}
                                  <div className="text-xs text-slate-400 dark:text-slate-400">{s.status ?? ''}</div>
                                  <button onClick={() => openGradeModal(s)} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm">Grade</button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-500">No submissions yet.</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">No assignments yet.</div>
              )}
            </div>

            {/* Resources list */}
            <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Resources (syllabus & videos)</h4>
                <div className="text-xs text-slate-500">{resources ? `${resources.length} total` : '—'}</div>
              </div>
              {resources && resources.length > 0 ? (
                <ul className="space-y-2">
                  {resources.map((r: any) => (
                    <li key={r.id} className="border rounded p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{r.title || (r.type === 'video' ? 'Video' : 'Syllabus')}</div>
                        <div className="text-xs text-slate-500">{r.type}{r.video_url ? ` • ${r.video_url}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
                        <button onClick={() => {
                          setEditingResource(r);
                          setEditResForm({ title: r.title ?? '', content: r.content ?? '', video_url: r.video_url ?? '', type: r.type ?? 'syllabus' });
                          setEditResOpen(true);
                        }} className="text-sm px-3 py-1 border rounded-md">Edit</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">No resources yet.</div>
              )}
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
              <aside className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
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

      {/* Add Assignment Modal */}
      {addAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setAddAssignOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Add assignment</h3>
            <div className="space-y-2">
              <input value={assignForm.title} onChange={(e) => setAssignForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" className="w-full border px-2 py-1 rounded" />
              {/* datetime-local shows a calendar/time picker in supported browsers */}
              <input
                type="datetime-local"
                value={assignForm.due_date}
                onChange={(e) => setAssignForm((s) => ({ ...s, due_date: e.target.value }))}
                className="w-full border px-2 py-1 rounded"
                aria-label="Due date and time"
              />
              <input value={assignForm.points} onChange={(e) => setAssignForm((s) => ({ ...s, points: e.target.value }))} placeholder="Points" className="w-full border px-2 py-1 rounded" />
              <textarea value={assignForm.description} onChange={(e) => setAssignForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description" className="w-full border px-2 py-2 rounded h-24" />
              <div>
                <input ref={assignFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setAssignFile(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => assignFileRef.current?.click()} className="px-3 py-1 border rounded text-sm">{assignFile ? assignFile.name : 'Attach document (PDF/DOC)'}</button>
                {uploadingFile && <span className="text-xs text-slate-500 ml-2">Uploading…</span>}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAddAssignOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={createAssignment} className="px-3 py-1 bg-indigo-600 text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editAssignOpen && editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setEditAssignOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Edit assignment</h3>
            <div className="space-y-2">
              <input value={editAssignForm.title} onChange={(e) => setEditAssignForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" className="w-full border px-2 py-1 rounded" />
              <input
                type="datetime-local"
                value={editAssignForm.due_date}
                onChange={(e) => setEditAssignForm((s) => ({ ...s, due_date: e.target.value }))}
                className="w-full border px-2 py-1 rounded"
                aria-label="Due date and time"
              />
              <input value={editAssignForm.points} onChange={(e) => setEditAssignForm((s) => ({ ...s, points: e.target.value }))} placeholder="Points" className="w-full border px-2 py-1 rounded" />
              <textarea value={editAssignForm.description} onChange={(e) => setEditAssignForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description" className="w-full border px-2 py-2 rounded h-24" />

              {/* NEW: add file upload control to Edit Assignment modal */}
              <div>
                <input ref={assignFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setAssignFile(e.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => assignFileRef.current?.click()} className="px-3 py-1 border rounded text-sm">
                  {assignFile ? assignFile.name : 'Attach document (PDF/DOC)'}
                </button>
                {uploadingFile && <span className="text-xs text-slate-500 ml-2">Uploading…</span>}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditAssignOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={updateAssignment} className="px-3 py-1 bg-indigo-600 text-white rounded">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {addResOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setAddResOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Add resource</h3>
            <div className="space-y-2">
              <select value={resForm.type} onChange={(e) => setResForm((s) => ({ ...s, type: e.target.value as any }))} className="w-full border px-2 py-1 rounded">
                <option value="syllabus">Syllabus / Notes</option>
                <option value="video">YouTube video</option>
              </select>
              <input value={resForm.title} onChange={(e) => setResForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" className="w-full border px-2 py-1 rounded" />
              {resForm.type === 'syllabus' ? (
                <textarea value={resForm.content} onChange={(e) => setResForm((s) => ({ ...s, content: e.target.value }))} placeholder="Syllabus text" className="w-full border px-2 py-2 rounded h-28" />
              ) : (
                <input value={resForm.video_url} onChange={(e) => setResForm((s) => ({ ...s, video_url: e.target.value }))} placeholder="YouTube URL" className="w-full border px-2 py-1 rounded" />
              )}
              {resForm.type === 'syllabus' && (
                <div>
                  <input ref={resFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setResFile(e.target.files?.[0] ?? null)} />
                  <button type="button" onClick={() => resFileRef.current?.click()} className="px-3 py-1 border rounded text-sm">{resFile ? resFile.name : 'Attach syllabus document'}</button>
                  {uploadingFile && <span className="text-xs text-slate-500 ml-2">Uploading…</span>}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAddResOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={addResource} className="px-3 py-1 bg-indigo-600 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Resource Modal */}
      {editResOpen && editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={() => setEditResOpen(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Edit resource</h3>
            <div className="space-y-2">
              <select value={editResForm.type} onChange={(e) => setEditResForm((s) => ({ ...s, type: e.target.value as any }))} className="w-full border px-2 py-1 rounded">
                <option value="syllabus">Syllabus / Notes</option>
                <option value="video">YouTube video</option>
              </select>
              <input value={editResForm.title} onChange={(e) => setEditResForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" className="w-full border px-2 py-1 rounded" />
              {editResForm.type === 'syllabus' ? (
                <>
                  <textarea value={editResForm.content} onChange={(e) => setEditResForm((s) => ({ ...s, content: e.target.value }))} placeholder="Syllabus text" className="w-full border px-2 py-2 rounded h-28" />
                  {/* NEW: file upload for editing syllabus */}
                  <div>
                    <input ref={resFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setResFile(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => resFileRef.current?.click()} className="px-3 py-1 border rounded text-sm">
                      {resFile ? resFile.name : 'Attach syllabus document'}
                    </button>
                    {uploadingFile && <span className="text-xs text-slate-500 ml-2">Uploading…</span>}
                  </div>
                </>
              ) : (
                <input value={editResForm.video_url} onChange={(e) => setEditResForm((s) => ({ ...s, video_url: e.target.value }))} placeholder="YouTube URL" className="w-full border px-2 py-1 rounded" />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditResOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={async () => {
                // submit update
                try {
                  setError(null);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const instructorId = sessionData?.session?.user?.id;
                  if (!instructorId) throw new Error('Not authenticated');
                  const payload: any = {
                    instructor_id: instructorId,
                    resource_id: editingResource.id,
                    title: editResForm.title,
                    type: editResForm.type,
                  };
                  if (editResForm.type === 'syllabus') payload.content = editResForm.content;
                  else payload.video_url = editResForm.video_url;
                  const res = await fetch(`${API_BASE}/users/courses/resources/update/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(body?.error || `Update failed: ${res.status}`);
                  // refresh modal data
                  if (selectedCourse) await openCourseModal(selectedCourse);
                  setEditResOpen(false);
                  setEditingResource(null);
                } catch (err: any) {
                  setError(err?.message || String(err));
                }
              }} className="px-3 py-1 bg-indigo-600 text-white rounded">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Grade submission modal */}
      {gradeModalOpen && gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={closeGradeModal} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Grade submission</h3>
            <div className="space-y-3">
              <div className="text-sm"><strong>Student:</strong> {gradingSubmission.student?.email ?? gradingSubmission.student_id}</div>
              <div className="text-sm"><strong>Assignment:</strong> {gradingSubmission.assignment_title ?? ''}</div>
              <div>
                <label className="block text-xs text-slate-500">Grade</label>
                <input type="number" value={gradeValue as any} onChange={(e) => setGradeValue(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border px-2 py-1 rounded" />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Feedback (optional)</label>
                <textarea value={gradeFeedback} onChange={(e) => setGradeFeedback(e.target.value)} className="w-full border px-2 py-1 rounded h-24"></textarea>
              </div>
              {gradingError && <div className="text-sm text-red-600">{gradingError}</div>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeGradeModal} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={submitGrade} disabled={gradingLoading} className="px-3 py-1 bg-indigo-600 text-white rounded">{gradingLoading ? 'Saving…' : 'Save grade'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-40" onClick={cancelConfirm} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-none w-full max-w-md p-6 z-50 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">{confirmTitle}</h3>
            <div className="text-sm text-slate-600 mb-4">{confirmMessage}</div>
            <div className="flex justify-end gap-2">
              <button onClick={cancelConfirm} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={() => runConfirm()} className="px-3 py-1 bg-red-600 text-white rounded">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
