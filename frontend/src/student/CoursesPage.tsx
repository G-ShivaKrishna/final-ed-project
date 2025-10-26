import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Course = {
  id: string;
  code: string;
  title: string;
  instructor?: string;
  students?: number;
  color?: string;
};

const sampleCourses: Course[] = [
  { id: 'c3', code: 'ENG202', title: 'English Composition', instructor: 'Dr. Meera', students: 24, color: 'purple' },
  { id: 'c2', code: 'MATH101', title: 'Calculus I', instructor: 'Prof. Rao', students: 42, color: 'blue' },
  { id: 'c1', code: '4-1 FAM', title: 'Foundations of Applied Math', instructor: 'Dr. Singh', students: 30, color: 'gray' },
  { id: 'c4', code: 'CS105', title: 'Intro to Programming', instructor: 'Ms. Patel', students: 120, color: 'indigo' },
  { id: 'c5', code: 'PHY201', title: 'Physics II', instructor: 'Dr. Kumar', students: 60, color: 'green' },
];

export default function CoursesPage(): JSX.Element {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const filtered = sampleCourses.filter((c) => c.code.toLowerCase().includes(q.toLowerCase()) || c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">All courses</h1>
            <p className="text-sm text-slate-500">Browse your registered and available courses.</p>
          </div>

          <div className="w-80">
            <label className="relative block">
              <span className="sr-only">Search courses</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="placeholder:text-slate-400 block bg-white w-full border border-slate-200 rounded-md py-2 pl-10 pr-3 shadow-sm focus:outline-none focus:border-indigo-300" placeholder="Search courses or code" />
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Search size={16} /></span>
            </label>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <article key={c.id} className="bg-white rounded-xl p-5 shadow hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold ${c.color === 'purple' ? 'bg-violet-500' : c.color === 'blue' ? 'bg-blue-500' : c.color === 'gray' ? 'bg-gray-500' : c.color === 'indigo' ? 'bg-indigo-600' : 'bg-green-600'}`}>
                  {c.code.split('-')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{c.title}</h3>
                    <div className="text-xs text-slate-500">{c.code}</div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">Instructor: {c.instructor}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">{c.students} students</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/courses/${c.id}`)} className="px-3 py-1 text-sm rounded-md bg-indigo-600 text-white">Open</button>
                      <button className="px-3 py-1 text-sm rounded-md border">Details</button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
