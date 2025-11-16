import { User, ChevronLeft, Edit2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function InstructorProfilePage(): JSX.Element {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [coursesCount, setCoursesCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('users')
        .select('username, email, major, phone_number, "College"')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const normalized = {
          fullName: data.username,
          email: data.email,
          phone: data.phone_number ?? '',
          major: data.major ?? '',
          college: data.College ?? '',
        };
        setProfile(normalized);
        setDraft(normalized);
      }

      // Fetch courses count for instructor
      const { data: courses, error: coursesErr } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', userId);
      if (!coursesErr && Array.isArray(courses)) {
        setCoursesCount(courses.length);
      } else {
        setCoursesCount(null);
      }
    };

    fetchProfile();
  }, []);

  if (!profile) return <p>Loading...</p>;

  function startEdit() {
    setDraft(profile);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(profile);
    setEditing(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const payload: any = {
        username: draft.fullName,
        major: draft.major,
        phone_number: draft.phone,
        College: draft.college,
      };

      const { data, error } = await supabase.from('users').update(payload).eq('id', userId).select().single();
      if (!error && data) {
        const normalized = {
          fullName: data.username,
          email: data.email,
          phone: data.phone_number ?? '',
          major: data.major ?? '',
          college: data.College ?? '',
        };
        setProfile(normalized);
        setDraft(normalized);
        setEditing(false);
      } else {
        console.warn('save error', error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    // make page theme-aware so controls (back button) look correct in dark mode
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-900 p-6 text-slate-800 dark:text-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[rgba(14, 31, 31, 1)] text-slate-800 dark:text-slate-100 flex items-center justify-center"
            >
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => navigate('/instructor-dashboard')} className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100">Dashboard</button>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Instructor profile</h1>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">
              <User size={28} />
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {editing ? (
                    <input className="text-xl font-semibold text-slate-800 border-b pb-1 w-full" value={draft.fullName ?? ''} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
                  ) : (
                    <div className="text-xl font-semibold text-slate-800">{profile.fullName}</div>
                  )}
                  <div className="text-sm text-slate-500 mt-1">{profile.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <button onClick={saveEdit} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2">
                        <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="px-3 py-2 border rounded-md flex items-center gap-2"><X size={14} /> Cancel</button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="px-3 py-2 bg-white border rounded-md flex items-center gap-2"><Edit2 size={14} /> Edit profile</button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.phone}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Major</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.major ?? ''} onChange={(e) => setDraft({ ...draft, major: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.major}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">College</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.college ?? ''} onChange={(e) => setDraft({ ...draft, college: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.college}</div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-slate-500">Courses</div>
              <div className="text-lg font-semibold">{coursesCount !== null ? coursesCount : '—'}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-slate-500">Assignments</div>
              <div className="text-lg font-semibold">—</div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => navigate('/instructor-dashboard')}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
