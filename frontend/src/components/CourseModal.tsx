import React from 'react';
const API_BASE = (import.meta as any).env?.VITE_API_URL || window.location.origin;
function resolveHref(raw?: string | null) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return window.location.protocol + s;
  if (s.startsWith('/')) return window.location.origin + s;
  return `${API_BASE.replace(/\/$/, '')}/${s.replace(/^\//, '')}`;
}

// robust extractor used by the modal (same logic as CourseDetail)
function extractUrlFromTextOrResource(rawText?: string | null, resource?: any): string | null {
  const t = String(rawText ?? '').trim();
  const m = t.match(/https?:\/\/[^\s'"]+/i);
  if (m) return resolveHref(m[0]);
  const attach = t.match(/attachment[:\s-]*([^\s'"]+)/i);
  if (attach && attach[1]) return resolveHref(attach[1]);
  if (resource && typeof resource === 'object') {
    const candidates = ['file_url', 'url', 'link', 'video_url', 'content', 'path', 'storage_path'];
    for (const k of candidates) {
      const v = resource[k];
      if (!v) continue;
      if (k === 'content') {
        const cm = String(v).match(/https?:\/\/[^\s'"]+/i);
        if (cm) return resolveHref(cm[0]);
      } else {
        const s = String(v).trim();
        if (s && s !== '#' && s !== '') return resolveHref(s);
      }
    }
  }
  return null;
}
 
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
                <ul className="space-y-2">{courseResources.map((r:any) => {
                  // robustly extract url from content / video_url / link / known fields
                  const href = extractUrlFromTextOrResource(r.content ?? null, r) ?? extractUrlFromTextOrResource(r.video_url ?? null, r) ?? extractUrlFromTextOrResource(r.link ?? null, r);
                  return (
                    <li key={r.id} className="p-3 border rounded flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-slate-500">{r.type}{r.video_url ? ` • ${r.video_url}` : ''}</div>
                      </div>
                      {href ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); window.open(href, '_blank', 'noopener'); }}
                          className="text-indigo-600 underline"
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-indigo-600">Open</span>
                      )}
                    </li>
                  );
                })}</ul>}
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
