import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  // keep counts numeric so UI shows 0 instead of disappearing/— when nothing found
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [pendingGradingCount, setPendingGradingCount] = useState<number>(0);

  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignment[]>([]);
  const [activeView, setActiveView] = useState('dashboard');

  // Recent courses for quick access
  const [recentCourses, setRecentCourses] = useState<Array<{ id: string | number; title?: string; created_at?: string; code?: string; color?: string }>>([]);

  const [recentOpenedCourses, setRecentOpenedCourses] = useState<Array<{ id: string | number; title?: string; code?: string }>>([]);

  // submissions / grading modal state (missing previously and caused runtime issues)
  const [currentAssignment, setCurrentAssignment] = useState<AssignmentWithCourse | null>(null);
  const [submissionsForAssignment, setSubmissionsForAssignment] = useState<any[] | null>(null);
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);

  // grading modal state
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradeValue, setGradeValue] = useState<number | ''>('');
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  // --- end new state ---

  // submitted counts per assignment used by "Ready to grade (past 7 days)"
  const [hasSubmissions, setHasSubmissions] = useState<Record<string, number>>({});

  // --- New: edit-due state & helpers ---
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithCourse | null>(null);
  const [editDueValue, setEditDueValue] = useState<string>(''); // local input value (YYYY-MM-DDTHH:mm)
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // NEW: file upload state for edit modal
  const [editFileUploading, setEditFileUploading] = useState(false);
  const [editFileUrl, setEditFileUrl] = useState<string>('');
  const [editFileError, setEditFileError] = useState<string | null>(null);

  function openEditDue(a: AssignmentWithCourse) {
    setEditingAssignment(a);
    // try to set a suitable input default (local datetime)
    try {
      const d = a.due_date ? new Date(a.due_date) : new Date();
      // input[type=datetime-local] expects "YYYY-MM-DDTHH:mm"
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      setEditDueValue(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch {
      setEditDueValue('');
    }
    // pre-fill file URL if assignment already has one
    setEditFileUrl((a as any)?.file_url ?? (a as any)?.submitted_file ?? '');
    setEditError(null);
    setEditFileError(null);
    setEditModalOpen(true);
  }

  function closeEditDue() {
    setEditModalOpen(false);
    setEditingAssignment(null);
    setEditDueValue('');
    setEditError(null);
    setEditLoading(false);
    setEditFileUploading(false);
    setEditFileUrl('');
    setEditFileError(null);
  }

  // NEW: upload helper used by instructor edit modal
  async function uploadAssignmentFile(file: File) {
    if (!file) return '';
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? 'unknown';
      const safe = file.name.replace(/\s+/g, '_');
      const assignmentId = editingAssignment?.id ?? 'unassigned';
      const path = `assignments/${assignmentId}/${userId}_${Date.now()}_${safe}`;
      const { data, error } = await supabase.storage.from('assignments').upload(path, file, { upsert: true });
      if (error) throw error;
      const pub = await supabase.storage.from('assignments').getPublicUrl(path);
      const publicUrl = (pub as any)?.data?.publicUrl || '';
      return publicUrl;
    } catch (e) {
      console.warn('uploadAssignmentFile failed', e);
      throw e;
    }
  }

  // NEW: file input handler for edit modal
  async function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditFileError(null);
    setEditFileUploading(true);
    try {
      // Basic validation: PDF only (adjust if other types allowed)
      if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        throw new Error('Please upload a PDF file.');
      }
      const url = await uploadAssignmentFile(file);
      if (!url) throw new Error('Failed to obtain public URL for uploaded file.');
      setEditFileUrl(url);
    } catch (err: any) {
      setEditFileError(err?.message || String(err));
    } finally {
      setEditFileUploading(false);
      // reset input value so re-uploading same file is possible
      if (e.target) { e.target.value = ''; }
    }
  }

  async function submitEditDue() {
    if (!editingAssignment) return;
    if (!editDueValue) { setEditError('Enter a date & time'); return; }

    // convert local input to ISO UTC string (backend expects ISO)
    let iso: string;
    try {
      iso = new Date(editDueValue).toISOString();
      if (!iso) throw new Error('Invalid date');
    } catch {
      setEditError('Invalid date/time');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
      const id = String(editingAssignment.id);
      // include file_url when present
      const payload = { due_date: iso, ...(editFileUrl ? { file_url: editFileUrl } : {}) };
      const headers = { 'Content-Type': 'application/json' };

      // Try common update endpoints in order (stop when one returns ok)
      const attempts = [
        { url: `${API_BASE}/users/courses/assignments/${id}/`, method: 'PATCH', body: payload },
        { url: `${API_BASE}/users/assignments/${id}/`, method: 'PATCH', body: payload },
        { url: `${API_BASE}/users/courses/assignments/update/`, method: 'POST', body: { assignment_id: id, ...payload } },
        { url: `${API_BASE}/users/assignments/update/`, method: 'POST', body: { assignment_id: id, ...payload } },
      ];

      let success = false;
      let lastErr: any = null;
      for (const at of attempts) {
        try {
          const res = await fetch(at.url, {
            method: at.method,
            headers,
            body: JSON.stringify(at.body),
          });
          if (res.ok) {
            success = true;
            break;
          }
          const txt = await res.text().catch(() => '');
          lastErr = `Endpoint ${at.url} failed: ${res.status} ${txt}`;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!success) {
        throw new Error(typeof lastErr === 'string' ? lastErr : (lastErr?.message || 'Update failed'));
      }

      // refresh assignments and close modal
      await fetchAssignments();
      closeEditDue();
    } catch (err: any) {
      setEditError(err?.message || String(err));
    } finally {
      setEditLoading(false);
    }
  }
  // --- end new helpers ---

  useEffect(() => {
    // when location.search contains ?view=..., reflect that in the UI
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    if (view === 'courses' || view === 'create' || view === 'dashboard') {
      // set matching view (default 'dashboard' for explicit dashboard)
      setActiveView(view === 'dashboard' ? 'dashboard' : view);
    }
    fetchAssignments();
    fetchProfileSummary();
    // Optionally, add realtime subscription logic here if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* run on mount and when location.search changes */ location.search]);

  // Avoid retrying an explicit-column query that caused a 42703 (column not found).
  // Once we detect such a schema mismatch, we switch to a safe select('*') and only log once.
  const preferSafeCourseSelectRef = useRef<boolean>(false);
  const loggedCourseSelectErrorRef = useRef<boolean>(false);

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

      // Ensure pending submissions refreshed when refreshing profile summary
      // Compute instructor-specific counts robustly using the submissions table schema you provided:
      try {
        // fetch courses (try rich select once, then fall back — existing logic using preferSafeCourseSelectRef)
        let courseRows: any[] = [];
        let hasMeta = false;
        try {
          if (!preferSafeCourseSelectRef.current) {
            // use schema that matches your DB: name and course_id (no `color` column)
            const rich: any = await supabase
              .from('courses')
              .select('id, name, created_at, course_id')
              .eq('instructor_id', userId);
            if (!rich?.error && Array.isArray(rich?.data) && rich.data.length > 0) {
              courseRows = rich.data;
              hasMeta = true;
            } else if (rich?.error) {
              // If the error indicates a missing column (42703), switch to safe select(*) for subsequent calls
              if (rich.error?.code === '42703') {
                preferSafeCourseSelectRef.current = true;
                if (!loggedCourseSelectErrorRef.current) {
                  // log once to help debugging, but avoid flooding the console
                  console.warn('explicit courses select failed (missing column); switching to select(*). Error:', rich.error);
                  loggedCourseSelectErrorRef.current = true;
                }
              } else {
                console.warn('supabase rich courses query error', rich.error);
              }
            }
          }

          if ((!Array.isArray(courseRows) || courseRows.length === 0) && preferSafeCourseSelectRef.current) {
            try {
              const safe: any = await supabase
                .from('courses')
                .select('*')
                .eq('instructor_id', userId);
              if (!safe?.error && Array.isArray(safe?.data) && safe.data.length > 0) {
                courseRows = safe.data;
                hasMeta = courseRows.some((r: any) => r.name || r.course_id || r.created_at);
              } else if (safe?.error) {
                if (!loggedCourseSelectErrorRef.current) {
                  console.warn('safe select(*) for courses returned error', safe.error);
                  loggedCourseSelectErrorRef.current = true;
                }
              }
            } catch (e) {
              if (!loggedCourseSelectErrorRef.current) {
                console.warn('safe select(*) for courses failed', e);
                loggedCourseSelectErrorRef.current = true;
              }
            }
          }

          if ((!Array.isArray(courseRows) || courseRows.length === 0)) {
            try {
              const minimal: any = await supabase
                .from('courses')
                .select('id')
                .eq('instructor_id', userId);
              if (!minimal?.error && Array.isArray(minimal?.data)) {
                courseRows = minimal.data;
              }
            } catch (e) {
              console.warn('minimal courses select failed', e);
              courseRows = [];
            }
          }
        } catch (e) {
          console.warn('unexpected error while fetching courses', e);
          courseRows = [];
        }

        setCoursesCount(Array.isArray(courseRows) ? courseRows.length : 0);

        // map DB fields into UI shape (title/code)
        if (Array.isArray(courseRows) && courseRows.length > 0) {
          const hasCreatedAt = courseRows.some((r: any) => Boolean(r.created_at));
          const mapped = [...courseRows].map((r: any) => ({
            id: r.id,
            title: r.name ?? r.title ?? undefined,
            created_at: r.created_at,
            code: r.course_id ?? r.code ?? undefined,
            color: r.color,
          }));
          if (hasCreatedAt) {
            try {
              const sorted = mapped.sort((a: any, b: any) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                return tb - ta;
              });
              setRecentCourses(sorted.slice(0, 3));
            } catch {
              setRecentCourses(mapped.slice(0, 3));
            }
          } else {
            setRecentCourses(mapped.filter((c) => c.title).slice(0, 3));
          }
        } else {
          setRecentCourses([]);
        }

        // Now compute pending grading using assignment_id (per your submissions schema).
        // Approach: fetch assignments for each course, then count submitted submissions per-assignment.
        let pending = 0;
        const courseIds = Array.isArray(courseRows) ? courseRows.map((r: any) => r.id).filter(Boolean) : [];

        // collect assignment ids for instructor courses
        const assignmentIds: string[] = [];
        for (const cid of courseIds) {
          try {
            const ares: any = await supabase
              .from('assignments')
              .select('id')
              .eq('course_db_id', cid);
            if (!ares?.error && Array.isArray(ares?.data)) {
              assignmentIds.push(...ares.data.map((a: any) => a.id).filter(Boolean));
            } else if (ares?.error) {
              console.warn(`assignments select for course ${cid} error`, ares.error);
            }
          } catch (e) {
            console.warn(`assignments select for course ${cid} failed`, e);
          }
        }

        // count submissions per-assignment (use head/count when supported)
        for (const aid of assignmentIds) {
          try {
            const sres: any = await supabase
              .from('submissions')
              .select('id', { count: 'exact', head: true })
              .eq('assignment_id', aid)
              .eq('status', 'submitted');
            const c = Number(sres?.count ?? (Array.isArray(sres?.data) ? sres.data.length : 0));
            pending += Number.isFinite(c) ? c : 0;
          } catch (e) {
            console.warn(`counting submissions for assignment ${aid} failed`, e);
          }
        }

        setPendingGradingCount(Number.isFinite(pending) ? pending : 0);
      } catch (err) {
        console.error('compute instructor counts failed', err);
      }
    } catch (err) {
      console.error('fetchProfileSummary error', err);
    }
  };

  // Build grouped assignments from instructor's courses if API returns none
  async function fetchAssignmentsFallbackFromSupabase() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      // 1) Instructor courses (map: id -> course_id for UI code)
      const cr = await supabase
        .from('courses')
        .select('id, course_id, name')
        .eq('instructor_id', userId);
      const courses = Array.isArray(cr.data) ? cr.data : [];
      const courseIds = courses.map((c: any) => c.id).filter(Boolean);
      if (courseIds.length === 0) { setGroupedAssignments([]); return; }

      const courseMap: Record<string, { id: string; code?: string; title?: string }> = {};
      for (const c of courses) {
        courseMap[String(c.id)] = { id: String(c.id), code: c.course_id, title: c.name };
      }

      // 2) Assignments under those courses
      const ar = await supabase
        .from('assignments')
        .select('id, title, due_date, points, course_db_id')
        .in('course_db_id', courseIds);
      const assigns = Array.isArray(ar.data) ? ar.data : [];

      // 3) Optional: detect pending submissions per assignment to set a useful status
      //    We'll mark as "submitted" if there are any submissions with status=submitted.
      const statusByAssignment: Record<string, string> = {};
      for (const a of assigns) {
        try {
          const c = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('assignment_id', a.id)
            .eq('status', 'submitted');
          const count = Number(c?.count ?? 0);
          if (count > 0) statusByAssignment[String(a.id)] = 'submitted';
        } catch {
          // ignore per-assignment errors
        }
      }

      // 4) Normalize and group like fetchAssignments does
      const normalized = assigns.map((a: any) => {
        let iso = '';
        try { if (a.due_date) iso = new Date(a.due_date).toISOString(); } catch {}
        const course = courseMap[String(a.course_db_id)] || undefined;
        const status = statusByAssignment[String(a.id)] || 'open';
        return {
          id: a.id,
          title: a.title,
          due_date: iso,
          status,
          points: a.points ?? undefined,
          course: course ? { id: course.id, code: course.code } : undefined,
        } as AssignmentWithCourse;
      });

      const grouped = normalized.reduce((acc: Record<string, AssignmentWithCourse[]>, a) => {
        const d = a.due_date ? new Date(a.due_date) : new Date();
        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        (acc[dateStr] ||= []).push(a);
        return acc;
      }, {});
      const groupedArr = Object.entries(grouped).map(([date, assignments]) => ({ date, assignments })) as GroupedAssignment[];
      setGroupedAssignments(groupedArr);
    } catch (e) {
      console.warn('fallback assignments load failed', e);
    }
  }

  const fetchAssignments = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/users/dashboard/?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        console.error('dashboard API error', res.status);
        // Try Supabase fallback if API fails
        await fetchAssignmentsFallbackFromSupabase();
        return;
      }

      const json = await res.json();
      const rawAssignments: AssignmentWithCourse[] = json.assignments || [];
      if (rawAssignments && rawAssignments.length > 0) {
        // normalize due_date -> ISO and ensure course.code exists
        const assignments = rawAssignments.map((a) => {
          try {
            if (a.due_date) a.due_date = new Date(a.due_date).toISOString();
          } catch (_) { /* leave as-is */ }
          if (a.course && !a.course.code) a.course.code = a.course.course_id || a.course.courseId || a.course.code;
          // attach local YYYY-MM-DD key to avoid timezone issues when grouping
          try {
            const d = a.due_date ? new Date(a.due_date) : new Date();
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            (a as any).local_date = `${yy}-${mm}-${dd}`;
          } catch (_) { (a as any).local_date = null; }
          return a;
        });

        // debug: log incoming and normalized assignments to help trace missing items
        console.debug('dashboard: raw assignments payload', rawAssignments);
        console.debug('dashboard: normalized assignments', assignments.map((x) => ({ id: x.id, due_date: x.due_date, local_date: (x as any).local_date })));

        const grouped = assignments.reduce((acc: Record<string, AssignmentWithCourse[]>, a: AssignmentWithCourse) => {
          // group by a human-friendly local date string for display
          const date = a.due_date ? new Date(a.due_date) : new Date();
          const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          acc[dateStr] = acc[dateStr] || [];
          acc[dateStr].push(a);
          return acc;
        }, {} as Record<string, AssignmentWithCourse[]>);
        const groupedArr = Object.entries(grouped).map(([date, assignments]) => ({ date, assignments })) as GroupedAssignment[];
        setGroupedAssignments(groupedArr);
      } else {
        // API returned empty, try to populate from Supabase so dashboard has content
        await fetchAssignmentsFallbackFromSupabase();
      }
    } catch (err) {
      console.error('fetchAssignments error', err);
      // Network/parse error — still try fallback once
      await fetchAssignmentsFallbackFromSupabase();
    }
  };

  // Refresh per-assignment submitted counts for assignments due within the last 7 days
  useEffect(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    // collect candidate assignment IDs
    const candidates = Array.from(
      new Set(
        groupedAssignments
          .flatMap((g) => g.assignments)
          .filter((a) => {
            if (!a?.due_date) return false;
            const due = new Date(a.due_date).getTime();
            return Number.isFinite(due) && due <= now && due >= weekAgo;
          })
          .map((a) => String(a.id))
      )
    );
    if (candidates.length === 0) {
      setHasSubmissions({});
      return;
    }
    // limit to a reasonable batch (avoid too many network calls)
    const limited = candidates.slice(0, 50);
    (async () => {
      try {
        const entries = await Promise.all(
          limited.map(async (aid) => {
            try {
              const resp: any = await supabase
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('assignment_id', aid)
                .eq('status', 'submitted');
              const count = Number(resp?.count ?? 0);
              return [aid, count] as const;
            } catch {
              return [aid, 0] as const;
            }
          })
        );
        const map: Record<string, number> = {};
        for (const [aid, count] of entries) map[aid] = count;
        setHasSubmissions(map);
      } catch {
        setHasSubmissions({});
      }
    })();
  }, [groupedAssignments]);

  // Fetch submissions for a given assignment (directly from submissions table)
  async function openSubmissionsForAssignment(a: AssignmentWithCourse) {
    setCurrentAssignment(a);
    setSubmissionsForAssignment(null);
    setSubmissionsModalOpen(true);
    try {
      // Query submissions table by assignment_id (your schema uses assignment_id)
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', String(a.id))
        .order('submitted_at', { ascending: false });
      if (error) {
        console.error('supabase submissions select error', error);
        setSubmissionsForAssignment([]);
        return;
      }
      const rows: any[] = Array.isArray(data) ? data : [];
      setSubmissionsForAssignment(rows);
      // count as opened for its course
      recordOpenedCourse(a.course);
    } catch (err: any) {
      console.error('openSubmissionsForAssignment failed', err);
      setSubmissionsForAssignment([]);
    }
  }

  function closeSubmissionsModal() {
    setSubmissionsModalOpen(false);
    setSubmissionsForAssignment(null);
    setCurrentAssignment(null);
  }

  // Grade a specific submission (open modal)
  function openGradeForSubmission(sub: any) {
    setGradingSubmission(sub);
    setGradeValue(sub.grade ?? '');
    setGradeFeedback(sub.feedback ?? '');
    setGradingError(null);
    setGradeModalOpen(true);
  }
  function closeGradeModal() {
    setGradeModalOpen(false);
    setGradingSubmission(null);
    setGradeValue('');
    setGradeFeedback('');
    setGradingError(null);
  }
  async function submitGradeForSubmission() {
    if (!gradingSubmission || (!Number.isFinite(Number(gradeValue)) && gradeValue !== '')) {
      setGradingError('Enter a numeric grade');
      return;
    }
    setGradingLoading(true);
    setGradingError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const graderId = sessionData?.session?.user?.id;
      if (!graderId) throw new Error('Not authenticated');
      const payload = {
        grader_id: graderId,
        submission_id: gradingSubmission.id,
        grade: Number(gradeValue),
        feedback: gradeFeedback || null,
      };
      const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/users/courses/submissions/grade/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed: ${res.status}`);
      // refresh submissions list for current assignment
      if (currentAssignment) await openSubmissionsForAssignment(currentAssignment);
      closeGradeModal();
    } catch (err: any) {
      setGradingError(err?.message || String(err));
    } finally {
      setGradingLoading(false);
    }
  }
  // --- end new helpers ---

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

  // Use local timezone date key (YYYY-MM-DD) to avoid UTC shifts hiding "tomorrow" due dates
  const dateKey = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  // helper: check if assignment due_date is in the past
  function isPastDue(a: AssignmentWithCourse | null | undefined) {
    try {
      if (!a || !a.due_date) return false;
      const due = new Date(a.due_date).getTime();
      if (!Number.isFinite(due)) return false;
      return due < Date.now();
    } catch {
      return false;
    }
  }

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, AssignmentWithCourse[]>();
    groupedAssignments.forEach((g) => {
      g.assignments.forEach((a) => {
        // prefer precomputed local_date (safe) then fall back to computing from due_date
        const key = (a as any).local_date ?? dateKey(new Date(a.due_date));
        const arr = map.get(key) ?? [];
        arr.push(a);
        map.set(key, arr);
      });
    });
    return map;
  }, [groupedAssignments]);

  // only include next-7 days that actually have deadlines
  const upcomingDeadlineDays = useMemo(() => {
    return next7Days.filter((d) => {
      const key = dateKey(d);
      const list = assignmentsByDate.get(key) ?? [];
      return list.length > 0;
    });
  }, [next7Days, assignmentsByDate]);

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
      <button type="button" onClick={() => { navigate('/instructor-dashboard?view=courses'); setActiveView('courses'); }} className="text-left px-3 py-2 border rounded-md">My courses</button>
      <button type="button" onClick={() => { navigate('/instructor-dashboard?view=create'); setActiveView('create'); }} className="text-left px-3 py-2 border rounded-md">Create course</button>
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

  // urgent assignments: due within next 48 hours and not graded (allow instructor to open & grade quickly)
  const urgentAssignments = useMemo(() => {
    const now = Date.now();
    const windowMs = 48 * 60 * 60 * 1000; // 48 hours
    return groupedAssignments
      .flatMap((g) => g.assignments.map((a) => ({ ...a, groupDate: g.date })))
      .filter((a) => {
        try {
          if (!a.due_date) return false;
          const due = new Date(a.due_date).getTime();
          if (!Number.isFinite(due)) return false;
          const withinWindow = due >= now && due <= now + windowMs;
          const needsAttention = a.status !== 'graded';
          return withinWindow && needsAttention;
        } catch {
          return false;
        }
      })
      .sort((x, y) => new Date(x.due_date).getTime() - new Date(y.due_date).getTime())
      .slice(0, 4);
  }, [groupedAssignments]);

  const readyToGradeAssignments = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return groupedAssignments
      .flatMap((g) => g.assignments)
      .filter((a) => {
        if (!a?.due_date || a.status === 'graded') return false;
        const due = new Date(a.due_date).getTime();
        if (!Number.isFinite(due)) return false;
        // only past-due within the last 7 days
        if (!(due <= now && due >= weekAgo)) return false;
        // must have at least one submitted submission (or status already says submitted)
        const count = hasSubmissions[String(a.id)] ?? 0;
        return count > 0 || a.status === 'submitted';
      })
      // newest past-due first
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
      .slice(0, 8);
  }, [groupedAssignments, hasSubmissions]);

  // --- new recent-opened course tracking ---
  useEffect(() => {
    try {
      const stored = localStorage.getItem('instructor-recent-opened-courses');
      if (stored) setRecentOpenedCourses(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const recordOpenedCourse = (course?: { id?: string | number; name?: string; title?: string; course_id?: string; code?: string }) => {
    if (!course?.id) return;
    const normalized = {
      id: course.id,
      title: course.name ?? course.title ?? '',
      code: course.course_id ?? course.code ?? '',
    };
    setRecentOpenedCourses((prev) => {
      const filtered = prev.filter((c) => String(c.id) !== String(normalized.id));
      const next = [normalized, ...filtered].slice(0, 4);
      try { localStorage.setItem('instructor-recent-opened-courses', JSON.stringify(next)); } catch {}
      return next;
    });
    // If title missing, fetch it (one-shot) from courses table
    if (!normalized.title) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('courses')
            .select('name, course_id')
            .eq('id', course.id)
            .single();
          if (!error && data?.name) {
            setRecentOpenedCourses((prev) => {
              const updated = prev.map((c) =>
                String(c.id) === String(course.id) ? { ...c, title: data.name, code: c.code || data.course_id } : c
              );
              try { localStorage.setItem('instructor-recent-opened-courses', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        } catch {}
      })();
    }
  };
  // --- end new tracking ---

  // Enrich already stored recentOpenedCourses that lack titles (e.g., persisted earlier only with code)
  useEffect(() => {
    const missing = recentOpenedCourses.filter((c) => !c.title);
    if (missing.length === 0) return;
    (async () => {
      for (const m of missing) {
        try {
          const { data, error } = await supabase
            .from('courses')
            .select('name, course_id')
            .eq('id', m.id)
            .single();
          if (!error && data?.name) {
            setRecentOpenedCourses((prev) => {
              const updated = prev.map((c) =>
                String(c.id) === String(m.id) ? { ...c, title: data.name, code: c.code || data.course_id } : c
              );
              try { localStorage.setItem('instructor-recent-opened-courses', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }
        } catch {}
      }
    })();
  }, [recentOpenedCourses]);

  // Navigate to a course and record it in "recently opened"
  function goToCourse(course?: { id?: string | number; name?: string; title?: string; course_id?: string; code?: string }) {
    if (!course?.id) return;
    try { recordOpenedCourse(course); } catch {}
    // Instructor management page path (adjust if your router uses a different one)
    // Preferred pattern: /instructor/courses/manage/:id
    const managePathPrimary = `/instructor/courses/manage/${course.id}`;
    // Fallback pattern if primary route not defined: /instructor/courses/${course.id}
    const fallbackPath = `/instructor/courses/${course.id}`;
    // Try primary; if navigation fails you can change to fallback.
    navigate(managePathPrimary);
  }

  // Navigate directly to an instructor submissions grading page for an assignment
  function navigateToSubmissions(a: AssignmentWithCourse) {
    if (!a) return;
    recordOpenedCourse(a.course);
    const before = location.pathname;
    const primary = `/instructor/assignments/${a.id}/submissions`;
    const altCourse = a.course?.id ? `/instructor/courses/manage/${a.course.id}` : null;
    const fallbackStudent = a.course?.id ? `/courses/${a.course.id}` : null;
    navigate(primary);
    // After a short delay, if path unchanged, fall back progressively
    setTimeout(() => {
      if (location.pathname === before) {
        if (altCourse) {
          navigate(altCourse);
        } else if (fallbackStudent) {
          navigate(fallbackStudent);
        }
      }
    }, 50);
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
                <button onClick={() => { navigate('/instructor-dashboard?view=courses'); setActiveView('courses'); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">My courses</button>
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
                <section className="bg-white rounded-xl shadow-sm p-5 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-700">Ready to grade (past 7 days)</h3>
                    <span className="text-xs text-slate-500">{readyToGradeAssignments.length} assignment{readyToGradeAssignments.length > 1 ? 's' : ''}</span>
                  </div>
                  {readyToGradeAssignments.length === 0 ? (
                    <div className="mt-4 text-sm text-slate-500">No assignments are ready to grade yet.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {readyToGradeAssignments.map((a) => (
                        <article key={`ready-${a.id}`} className="border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                            <div className="text-xs text-slate-500 mt-1">{a.course?.code ?? '—'} • due {new Date(a.due_date).toLocaleString()}</div>
                          </div>
                          <button
                            onClick={() => openSubmissionsForAssignment(a)}
                            className="text-xs px-3 py-1 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                          >
                            Open submissions
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

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
                                  {/* Show overdue marker for instructor view */}
                                  {isPastDue(a) && a.status !== 'submitted' && a.status !== 'graded' && (
                                    <div className="mt-1 text-xs text-red-600 font-medium">Deadline passed</div>
                                  )}
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

                                <button onClick={() => goToCourse(a.course)} className="ml-auto text-sm text-indigo-600 hover:underline">View submissions</button>
                                {/* Replace course-level navigation with assignment submissions navigation */}
                                <button
                                  onClick={() => navigateToSubmissions(a)}
                                  className="ml-2 text-sm text-indigo-600 underline hover:no-underline"
                                  title="Open grading view"
                                >
                                  Grade
                                </button>

                                {/* Edit due date (instructor) */}
                                <button
                                  onClick={() => openEditDue(a)}
                                  className="ml-2 text-sm px-2 py-1 border rounded text-slate-700 hover:bg-slate-50"
                                  title="Edit due date"
                                >
                                  Edit due
                                </button>
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
              <aside className="space-y-6 lg:sticky lg:top-6 min-h-0">
                {recentOpenedCourses.length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Recently opened</h4>
                    <div className="flex flex-col gap-2">
                      {recentOpenedCourses.map((course) => (
                        <button
                          key={`opened-${course.id}`}
                          onClick={() => goToCourse(course)}
                          className="w-full text-left px-3 py-2 rounded-md border border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <div className="font-semibold">
                            {course.title ? course.title : `Course ${course.id}`}
                          </div>
                          <div className="text-xs text-slate-400">{course.code}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    <button type="button" onClick={() => { navigate('/instructor-dashboard?view=create'); setActiveView('create'); }} className="text-left px-3 py-2 bg-indigo-600 text-white rounded-md">Create course</button>
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
          </>
        )}

        {/* Edit due modal */}
        {editModalOpen && editingAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeEditDue} />
            <div className="relative bg-white rounded-lg p-6 z-50 w-full max-w-md">
              <h3 className="text-lg mb-2">Edit due date</h3>
              <div className="text-sm text-slate-600 mb-3">{editingAssignment.title}</div>
              <label className="block text-xs text-slate-600 mb-2">Due date and time</label>
              <input
                type="datetime-local"
                value={editDueValue}
                onChange={(e) => setEditDueValue(e.target.value)}
                className="w-full border px-3 py-2 rounded mb-3"
              />

              {/* NEW: file upload for assignment/syllabus */}
              <label className="block text-xs text-slate-600 mb-2">Attach file (PDF)</label>
              <div className="flex items-center gap-2 mb-2">
                <input type="file" accept="application/pdf" onChange={handleEditFileChange} className="block" />
                {editFileUploading && <div className="text-xs text-slate-500">Uploading…</div>}
              </div>
              {editFileError && <div className="text-xs text-red-600 mb-2">{editFileError}</div>}
              <textarea
                readOnly
                value={editFileUrl}
                placeholder="Uploaded file URL will appear here"
                className="w-full border px-3 py-2 rounded mb-3 resize-y"
                rows={3}
              />

              {editError && <div className="text-xs text-red-600 mb-2">{editError}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={closeEditDue} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={submitEditDue} disabled={editLoading} className={`px-3 py-1 rounded ${editLoading ? 'bg-indigo-300 text-white' : 'bg-indigo-600 text-white'}`}>
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
