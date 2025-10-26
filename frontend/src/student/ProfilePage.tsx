import { useNavigate } from 'react-router-dom';
import { User, ChevronLeft, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';

export default function ProfilePage(): JSX.Element {
  const navigate = useNavigate();

  // Made-up profile details (editable locally)
  const [profile, setProfile] = useState({
    fullName: 'Akhil Kumar',
    email: 'akhil.kumar@example.com',
    phone: '+91 98765 43210',
    major: 'Computer Science',
    year: '3rd Year',
    college: 'SRU University',
    bio: 'Passionate computer science student with interests in algorithms, machine learning, and full-stack development. Contributor to several open-source projects and organizer of campus hackathons.'
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  function startEdit() {
    setDraft(profile);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(profile);
    setEditing(false);
  }

  function saveEdit() {
    setProfile(draft);
    setEditing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
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
                    <input className="text-xl font-semibold text-slate-800 border-b pb-1 w-full" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
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
                    <input className="w-full border rounded px-2 py-1" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.phone}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Major</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.major}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Year</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.year}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">College</div>
                  {editing ? (
                    <input className="w-full border rounded px-2 py-1" value={draft.college} onChange={(e) => setDraft({ ...draft, college: e.target.value })} />
                  ) : (
                    <div className="text-sm text-slate-700">{profile.college}</div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-slate-500">Bio</div>
                {editing ? (
                  <textarea className="w-full border rounded px-2 py-2 mt-1" rows={4} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
                ) : (
                  <p className="text-sm text-slate-600 mt-1">{profile.bio}</p>
                )}
              </div>
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
