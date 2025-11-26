import { useState, useEffect } from 'react';
import { Search, Users, Star, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // added supabase

type Course = {
  id: string;
  code: string;
  title: string;
  instructor?: string;
  students?: number;
  color?: string;
};

export default function CoursesPage(): JSX.Element {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const [sort, setSort] = useState<'popular' | 'recent' | 'alpha'>('recent');

  // real data from DB
  const [courses, setCourses] = useState<Course[]>([]);
  const [joinedCodes, setJoinedCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // get current user id
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          if (mounted) {
            setCourses([]);
            setJoinedCodes(new Set());
          }
          return;
        }

        // 1) fetch enrollments for this student (enrollments.course_id stores the course code text)
        const { data: enrollRows, error: enrollErr } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', userId);
        if (enrollErr) throw enrollErr;

        const joinedCodesArr = (enrollRows || [])
          .map((r: any) => r.course_id)
          .filter((c: string | null | undefined) => !!c) as string[];

        const joinedSet = new Set<string>(joinedCodesArr);

        if (!joinedCodesArr.length) {
          if (mounted) {
            setJoinedCodes(joinedSet);
            setCourses([]);
          }
          return;
        }

        // 2) fetch only courses whose course_id is in the student's joined course codes
        const { data: courseRows, error: courseErr } = await supabase
          .from('courses')
          .select('id, course_id, name')
          .in('course_id', joinedCodesArr)
          .order('created_at', { ascending: false });
        if (courseErr) throw courseErr;

        if (!mounted) return;

        setJoinedCodes(joinedSet);

        // map DB rows to local Course shape
        const mapped = (courseRows || []).map((r: any) => ({
          id: r.id,
          code: r.course_id ?? '',
          title: r.name ?? '',
          instructor: undefined,
          students: undefined,
          color: undefined,
        }));
        setCourses(mapped);
      } catch (err) {
        console.error('Failed to load joined courses', err);
        if (mounted) {
          setCourses([]);
          setJoinedCodes(new Set());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // filter/sort operate on courses state (instead of sampleCourses)
  const filtered = courses
    .filter((c) => c.code.toLowerCase().includes(q.toLowerCase()) || c.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'popular') return (b.students ?? 0) - (a.students ?? 0);
      if (sort === 'alpha') return a.title.localeCompare(b.title);
      // recent fallback: rely on id ordering (or change to created_at if available)
      return b.id.localeCompare(a.id);
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-pink-500 rounded-xl p-6 mb-6 text-white shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)} aria-label="Go back" className="w-10 h-10 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/30">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => navigate('/student-dashboard')} aria-label="Dashboard" className="px-3 py-2 rounded-md bg-white/20 hover:bg-white/30 text-white text-sm">Dashboard</button>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Explore courses</h1>
                <p className="text-sm opacity-90">Find and join courses. Discover trending classes and your registered courses.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input value={q} onChange={(e) => setQ(e.target.value)} className="pl-10 pr-4 py-2 rounded-md border border-transparent bg-white/20 placeholder-white text-white focus:outline-none" placeholder="Search courses or code" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white"><Search size={16} /></span>
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md bg-white/20 text-white px-3 py-2">
                <option value="recent">Recently added</option>
                <option value="popular">Most students</option>
                <option value="alpha">A → Z</option>
              </select>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center text-sm text-slate-500">Loading courses…</div>
          ) : (
            filtered.map((c) => (
              <article key={c.id} className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-150 flex flex-col h-full">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 flex-shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-lg ${c.color === 'purple' ? 'bg-violet-500' : c.color === 'blue' ? 'bg-blue-500' : c.color === 'gray' ? 'bg-gray-500' : c.color === 'indigo' ? 'bg-indigo-600' : c.color === 'green' ? 'bg-green-600' : 'bg-rose-500'}`}>
                    <span className="tracking-wide">{c.code.replace(/\d/g, '').slice(0,4)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-800 truncate">{c.title}</h3>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {c.code} • {joinedCodes.has(c.code) ? <span className="text-indigo-600 font-medium">Joined</span> : `Instructor: ${c.instructor ?? '—'}`}
                        </div>
                      </div>
                      <div className="text-right ml-2 hidden sm:block">
                        <div className="text-sm font-semibold text-slate-800">{c.students ?? '—'}</div>
                        <div className="text-xs text-slate-400">students</div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 mt-3 overflow-hidden text-ellipsis" style={{ WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
                      A well-designed course that covers key topics and practical examples to help you master the subject.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded"> <Users size={14} /> {c.students}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded"> <Star size={12} /> Popular</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/courses/${c.id}`)} className="px-4 py-2 rounded-md bg-indigo-600 text-white">Open</button>
                    <button className="px-4 py-2 rounded-md border">Details</button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
