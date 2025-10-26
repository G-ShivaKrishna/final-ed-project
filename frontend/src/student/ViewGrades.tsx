import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sampleGrades = [
  { id: 1, course: 'MATH101', assignment: 'Homework 3', grade: 18, outOf: 20, feedback: 'Good work' },
  { id: 2, course: 'ENG202', assignment: 'Essay Draft', grade: 16, outOf: 20, feedback: 'Needs more structure' },
  { id: 3, course: '4-1 FAM', assignment: 'Journal Entries', grade: 0, outOf: 5, feedback: 'Missing' },
];

export default function ViewGrades(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold mb-4">Grades</h1>
          <p className="text-sm text-slate-500 mb-6">Your recent grades and feedback.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-slate-500">
                  <th className="p-3">Course</th>
                  <th className="p-3">Assignment</th>
                  <th className="p-3">Grade</th>
                  <th className="p-3">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {sampleGrades.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="p-3 text-sm font-medium text-slate-700">{g.course}</td>
                    <td className="p-3 text-sm text-slate-600">{g.assignment}</td>
                    <td className="p-3 text-sm text-slate-700">{g.grade} / {g.outOf}</td>
                    <td className="p-3 text-sm text-slate-600">{g.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
