import React from 'react';
import AssignmentList from './AssignmentList';

export default function CourseModal({
  open,
  onClose,
  joinedCourses,
  onOpenCourse,
  activeCourseId,
  activeCourseName,
  courseResources,
  courseAssignments,
  onBackToList,
  onJoin,
  onInitiateUpload,
  uploading,
}: {
  open: boolean;
  onClose: () => void;
  joinedCourses: { id: string | number; code?: string; name?: string }[];
  onOpenCourse: (c: { id: string | number; code?: string; name?: string }) => void;
  activeCourseId: string | number | null;
  activeCourseName: string | null;
  courseResources: any[];
  courseAssignments: any[];
  onBackToList: () => void;
  onJoin: () => void;
  onInitiateUpload: (id: string | number, courseId?: string | number) => void;
  uploading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg w-full max-w-3xl p-6 z-50 overflow-auto max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{activeCourseId ? (activeCourseName ?? 'Course') : 'My courses'}</h3>
            {!activeCourseId && <div className="text-sm text-slate-500">Courses you have joined</div>}
          </div>
          <div className="flex items-center gap-2">
            {activeCourseId ? (
              <button onClick={onBackToList} className="px-3 py-1 border rounded">Back to courses</button>
            ) : (
              <button onClick={onJoin} className="px-3 py-1 bg-indigo-600 text-white rounded">Join course</button>
            )}
            <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
          </div>
        </div>

        {!activeCourseId ? (
          <div className="flex flex-col gap-4">
            {joinedCourses.length === 0 ? (
              <div className="text-sm text-slate-500">You haven't joined any courses yet. Use "Join course" to request access.</div>
            ) : (
              <ul className="flex flex-col gap-4">
                {joinedCourses.map((c) => (
                  <li key={String(c.id)} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border rounded p-4 bg-white shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-lg">{c.name ?? c.code}</div>
                      <div className="text-xs text-slate-500 mt-1">{c.code}</div>
                    </div>
                    <div className="flex flex-col gap-2 mt-3 sm:mt-0 sm:flex-row">
                      <button onClick={() => onOpenCourse(c)} className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold">Open</button>
                      <button onClick={() => navigator.clipboard?.writeText(String(c.code))} className="px-4 py-2 border rounded text-sm">Copy code</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm mb-2">Resources</h4>
              {courseResources.length === 0 ? <div className="text-sm text-slate-500">No resources</div> :
                <ul className="space-y-2">{courseResources.map((r:any) => (
                  <li key={r.id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-slate-500">{r.type}{r.video_url ? ` • ${r.video_url}` : ''}</div>
                    </div>
                    <a href={r.content?.match?.(/https?:\/\/\S+/)?.[0] ?? r.video_url ?? '#'} target="_blank" rel="noreferrer" className="text-indigo-600">Download</a>
                  </li>
                ))}</ul>}
            </div>

            <div>
              <h4 className="text-sm mb-2">Assignments</h4>
              {courseAssignments.length === 0 ? <div className="text-sm text-slate-500">No assignments</div> :
                <AssignmentList assignments={courseAssignments} onInitiateUpload={(id)=>onInitiateUpload(id)} uploading={uploading} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
