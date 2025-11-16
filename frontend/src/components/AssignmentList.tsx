import React from 'react';

type Assign = {
  id: string | number;
  title?: string;
  due_date?: string;
  status?: string;
  points?: number | null;
  description?: string;
  submission?: { file_url?: string };
  submitted_file?: string;
  course?: { id?: string | number; code?: string };
};

export default function AssignmentList({
  assignments,
  onInitiateUpload,
  uploading,
}: {
  assignments: Assign[];
  onInitiateUpload: (id: string | number) => void;
  uploading?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {assignments.map((a) => (
        <li key={String(a.id)} className="p-3 border rounded">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-slate-500">{a.course?.code} • {a.due_date ? new Date(a.due_date).toLocaleString() : 'No due date'}</div>
              {a.description && <div className="text-xs mt-1">{String(a.description).split(/https?:\/\//)[0]}</div>}
              {a.submission?.file_url && <div className="text-xs mt-1"><a href={a.submission.file_url} target="_blank" rel="noreferrer" className="text-indigo-600">Download your submission</a></div>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-slate-400">{a.points ?? '-'} pts</div>
              {a.status === 'graded' ? (
                <span className="text-xs px-2 py-1 border rounded text-slate-500">Graded</span>
              ) : a.status === 'submitted' ? (
                <span className="text-xs px-2 py-1 border rounded text-slate-700">Submitted</span>
              ) : (
                <button
                  onClick={() => onInitiateUpload(a.id)}
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Submit'}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
