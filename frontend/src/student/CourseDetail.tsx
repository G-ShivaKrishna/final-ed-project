import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

type Material = { id: string; title: string; uploadedAt: string; link?: string; description?: string; type?: string };
type Assignment = { id: string; title: string; due_date: string; status: string; points?: number; description?: string; postedAt?: string };

const SAMPLE_COURSES: { id: string; code: string; title: string }[] = [
  { id: 'c1', code: '4-1 FAM', title: 'Foundations of Applied Math' },
  { id: 'c2', code: 'MATH101', title: 'Calculus I' },
  { id: 'c3', code: 'ENG202', title: 'English Composition' },
  { id: 'c4', code: 'CS105', title: 'Intro to Programming' },
];

const SAMPLE_SYLLABUS: Record<string, Material[]> = {
  c1: [
    { id: 's1', title: 'Course Syllabus (PDF)', uploadedAt: '2025-08-01', link: '#', type: 'pdf', description: 'Full course syllabus with grading policy and schedule.' },
    { id: 's2', title: 'Lecture 1 — Mathematical Foundations', uploadedAt: '2025-08-05', link: '#', type: 'notes', description: 'Overview of sets, relations, and functions.' },
    { id: 's6', title: 'Reading: Introduction to Applied Math', uploadedAt: '2025-08-07', link: '#', type: 'reading', description: 'Chapter 1 from the course textbook.' },
  ],
  c2: [
    { id: 's3', title: 'Syllabus & Schedule', uploadedAt: '2025-07-30', link: '#', type: 'pdf', description: 'Topics, office hours and assessment calendar.' },
    { id: 's7', title: 'Problem Set Examples', uploadedAt: '2025-08-06', link: '#', type: 'examples', description: 'Worked examples for limits and continuity.' },
  ],
  c3: [
    { id: 's4', title: 'Course Reader', uploadedAt: '2025-08-02', link: '#', type: 'reader', description: 'Collection of short readings and essays for discussion.' },
    { id: 's8', title: 'Essay Guidelines', uploadedAt: '2025-08-10', link: '#', type: 'doc', description: 'Formatting and rubric for essays.' },
  ],
  c4: [
    { id: 's5', title: 'Programming Labs', uploadedAt: '2025-08-03', link: '#', type: 'lab', description: 'Lab instructions and starter code for first assignments.' },
    { id: 's9', title: 'Setup Instructions', uploadedAt: '2025-08-04', link: '#', type: 'guide', description: 'How to set up your dev environment.' },
  ],
};

const SAMPLE_ASSIGNMENTS: Record<string, Assignment[]> = {
  c1: [
    { id: 'a1', title: 'Homework 1: Sets & Functions', due_date: '2025-09-01', status: 'submitted', points: 10, description: 'Problems 1–5 from chapter 1.', postedAt: '2025-08-25' },
    { id: 'a2', title: 'Project Proposal', due_date: '2025-09-15', status: 'missing', points: 20, description: 'One-page proposal describing your term project idea.', postedAt: '2025-08-28' },
    { id: 'a6', title: 'Quiz 1', due_date: '2025-09-05', status: 'graded', points: 5, description: 'In-class quiz covering lectures 1–3.', postedAt: '2025-09-01' },
  ],
  c2: [
    { id: 'a3', title: 'Limits Worksheet', due_date: '2025-09-05', status: 'graded', points: 15, description: 'Limit evaluation problems.', postedAt: '2025-08-29' },
    { id: 'a7', title: 'Derivative Exercises', due_date: '2025-09-12', status: 'submitted', points: 20, description: 'Problems on differentiation rules.', postedAt: '2025-09-03' },
  ],
  c3: [
    { id: 'a4', title: 'Essay Draft', due_date: '2025-09-10', status: 'submitted', points: 20, description: 'First draft of essay (1000–1200 words).', postedAt: '2025-08-31' },
    { id: 'a8', title: 'Reading Response 1', due_date: '2025-09-07', status: 'graded', points: 5, description: 'Short response to assigned reading.', postedAt: '2025-09-02' },
  ],
  c4: [
    { id: 'a5', title: 'Lab 1: Hello World', due_date: '2025-09-03', status: 'submitted', points: 5, description: 'Basic programming exercises.', postedAt: '2025-08-30' },
  ],
};

export default function CourseDetail(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = SAMPLE_COURSES.find((c) => c.id === id) ?? { id: id ?? 'unknown', code: id ?? '', title: 'Course' };
  const [tab, setTab] = React.useState<'syllabus' | 'assignments'>('syllabus');

  const syllabus = SAMPLE_SYLLABUS[id as string] ?? [];
  const assignments = SAMPLE_ASSIGNMENTS[id as string] ?? [];

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-md bg-white shadow flex items-center justify-center"> <ChevronLeft size={18} /></button>
          <div>
            <h1 className="text-2xl font-semibold">{course.title}</h1>
            <div className="text-sm text-slate-500">{course.code}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 border-b pb-3 mb-4">
            <button onClick={() => setTab('syllabus')} className={`px-3 py-2 rounded-md ${tab === 'syllabus' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Syllabus</button>
            <button onClick={() => setTab('assignments')} className={`px-3 py-2 rounded-md ${tab === 'assignments' ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>Assignments</button>
          </div>

          {tab === 'syllabus' ? (
            <div>
              {syllabus.length === 0 ? (
                <div className="text-sm text-slate-500">No syllabus materials posted yet.</div>
              ) : (
                <ul className="space-y-3">
                  {syllabus.map((m) => (
                    <li key={m.id} className="p-3 border rounded flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{m.title}</div>
                          {m.type && <span className="text-xs text-slate-500 px-2 py-1 rounded bg-slate-100">{m.type}</span>}
                        </div>
                        {m.description && <div className="text-sm text-slate-600 mt-1">{m.description}</div>}
                        <div className="text-xs text-slate-500 mt-2">Uploaded {m.uploadedAt}</div>
                      </div>
                      <a href={m.link} className="text-indigo-600">View</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div>
              {assignments.length === 0 ? (
                <div className="text-sm text-slate-500">No assignments posted yet.</div>
              ) : (
                <ul className="space-y-3">
                  {assignments.map((a) => (
                    <li key={a.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{a.title}</div>
                          {a.description && <div className="text-sm text-slate-600 mt-1">{a.description}</div>}
                          <div className="text-xs text-slate-500 mt-2">Due {new Date(a.due_date).toLocaleDateString()}</div>
                          {a.postedAt && <div className="text-xs text-slate-400">Posted {a.postedAt}</div>}
                        </div>
                        <div className="text-xs text-slate-500">{a.points ?? '-'} pts</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">Status: {a.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
