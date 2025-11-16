import React from 'react';

export default function SubmissionList({ submissions }: { submissions: any[] }) {
  if (!submissions || submissions.length === 0) return <div className="text-sm text-slate-500">No submissions yet.</div>;
  return (
    <ul className="space-y-2">
      {submissions.map((s) => (
        <li key={s.id} className="border rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{s.student?.email ?? s.student_id}</div>
            <div className="text-xs text-slate-500 mt-1">{s.assignment_title ?? ''}</div>
          </div>
          <div className="flex items-center gap-3">
            {s.file_url ? <a href={s.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm">Download PDF</a> : <span className="text-xs text-slate-500">No file</span>}
            <div className="text-xs text-slate-400">{s.status}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
