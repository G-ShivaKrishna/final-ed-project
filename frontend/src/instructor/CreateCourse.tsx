import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function CreateCourse() {
  const [formData, setFormData] = useState({
    name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const navigate = useNavigate();

  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setCourseCode(null);
    setCopyStatus('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const instructorId = sessionData?.session?.user?.id;
      if (!instructorId) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/users/courses/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructor_id: instructorId,
          name: formData.name,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (body && (body.error || body.details || JSON.stringify(body))) || `Request failed with status ${res.status}`;
        console.error('CreateCourse API error:', msg, body);
        throw new Error(msg);
      }

      const returned = body || {};
      const finalCourseId = returned.course_id || returned.courseId || returned.code || null;

      setSuccess(true);
      setCourseCode(finalCourseId);
      setFormData({ name: '' });
    } catch (err) {
      console.error('CreateCourse failed', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!courseCode) return;
    try {
      await navigator.clipboard.writeText(courseCode);
      setCopyStatus('Code copied to clipboard.');
      navigate('/instructor-dashboard');
    } catch {
      setCopyStatus('Unable to copy. Please copy manually.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/instructor-dashboard')} className="px-3 py-1 border rounded-md">Dashboard</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Create new course</h2>

        {success && courseCode && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-green-700 font-medium">Course created successfully!</div>
            <div className="text-sm text-green-600 mt-1">
              Course code: <span className="font-mono font-bold">{courseCode}</span>
            </div>
            <p className="text-sm text-green-600 mt-1">Share this code with your students to let them join the course.</p>
            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Copy code & go to dashboard
            </button>
            {copyStatus && (
              <div className="mt-1 text-xs text-green-700">
                {copyStatus}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Course name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g. Introduction to Computer Science"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create course'}
          </button>
        </form>
      </div>
    </div>
  );
}
