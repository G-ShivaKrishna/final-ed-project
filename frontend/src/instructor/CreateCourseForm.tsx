import React, { useState } from 'react';
import supabase from '../supabaseClient';

export default function CreateCourseForm(): JSX.Element {
  const [courseName, setCourseName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage('You must be logged in to create a course.');
      return;
    }

    const instructorId = session.user.id;

    try {
      const response = await fetch('http://localhost:8000/users/create-course/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: courseName,
          course_id: courseId,
          instructor_id: instructorId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Course created successfully!');
        setCourseName('');
        setCourseId('');
      } else {
        setMessage(data.error || data.message || 'Error creating course.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setMessage('Network error: could not create course.');
    }
  };

  return (
    <div>
      <h2>Create Course</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Course Name:</label>
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Course ID:</label>
          <input
            type="text"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          />
        </div>
        <button type="submit">Create Course</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
