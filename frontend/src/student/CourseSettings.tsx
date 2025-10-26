import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CourseSettings(): JSX.Element {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showScores, setShowScores] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold mb-4">Course settings</h1>
          <p className="text-sm text-slate-500 mb-6">Manage course preferences for notifications and grading visibility.</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">Notifications</div>
                <div className="text-sm text-slate-500">Receive course updates and announcements</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
                <span className="slider" />
              </label>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">Include scores in emails</div>
                <div className="text-sm text-slate-500">Show scores when notifying about grades</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={showScores} onChange={(e) => setShowScores(e.target.checked)} />
                <span className="slider" />
              </label>
            </div>

            <div className="pt-4">
              <button className="px-4 py-2 bg-indigo-600 text-white rounded">Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
