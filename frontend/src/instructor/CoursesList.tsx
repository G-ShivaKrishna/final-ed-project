import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';

export default function CoursesList(): JSX.Element {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('You must be logged in.');
          setLoading(false);
          return;
        }

        const instructorId = session.user.id;

        const response = await fetch(
          `http://localhost:8000/users/instructor-courses/?instructor_id=${instructorId}`
        );

        const data = await response.json();

        if (response.ok) {
          setCourses(data);
        } else {
          setError(data.error || data.message || 'Failed to fetch courses.');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Network error while fetching courses.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  if (loading) return <p>Loading courses...</p>;
  if (error) return <p>{error}</p>;
  if (courses.length === 0) return <p>No courses created yet.</p>;

  return (
    <div>
      <h2>My Courses</h2>
      <ul>
        {courses.map((course) => (
          <li key={course.course_id}>
            {course.name} — ID: {course.course_id}
          </li>
        ))}
      </ul>
    </div>
  );
}
