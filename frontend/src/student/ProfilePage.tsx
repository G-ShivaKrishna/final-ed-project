import { useNavigate } from 'react-router-dom';
import { User, ChevronLeft, Edit2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function ProfilePage(): JSX.Element {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const { data, error } = await supabase
        .from('users')
        .select('username, email, role, major, phone_number, "College"')
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
  try {
    // 1️⃣ Check if Django server is up
    const djangoCheck = await fetch("http://127.0.0.1:8000/users/health/", { method: "GET" });
    if (!djangoCheck.ok) {
      alert("Server is offline. Please try again later.");
      return;
    }

    // 2️⃣ Proceed only if Django is up
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const payload: any = {
      username: draft.fullName,
      major: draft.major,
      phone_number: draft.phone,
      College: draft.college,
    };

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
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
      setEditing(false);
    } else {
      alert("Failed to update profile. Try again later.");
    }
  } catch (err) {
    alert("Django server is offline or unreachable.");
  }
}

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-md bg-indigo-750 flex items-center justify-center">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-2xl font-semibold text-slate-800">Profile</h1>
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
                      <button onClick={saveEdit} className="px-3 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2"><Save size={14} /> Save</button>
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

                {/* Year removed from profile */}

                <div>
                  <div className="text-xs text-slate-500">College</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.college ?? ''} onChange={(e) => setDraft({ ...draft, college: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.college}</div>
                  )}
                </div>
              </div>
              {/* Bio removed from profile per change request */}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-slate-500">Enrolled courses</div>
              <div className="text-lg font-semibold">3</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-slate-500">Assignments due</div>
              <div className="text-lg font-semibold">4</div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={() => navigate('/student-dashboard')} className="px-4 py-2 rounded-md bg-indigo-600 text-white">Back to dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}
