import React, { useState } from 'react';
import supabase from '../supabaseClient';

export default function CreateCourseForm(): JSX.Element {
  const [courseName, setCourseName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState('');
  // NEW: store generated code + copy status
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>('');

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
        // backend returns full course row; prefer course_id / code from response
        const code = data.course_id || data.code || courseId || '';
        setCreatedCode(code || null);
        setCourseName('');
        setCourseId('');
        setCopyStatus('');
      } else {
        setMessage(data.error || data.message || 'Error creating course.');
        setCreatedCode(null);
        setCopyStatus('');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setMessage('Network error: could not create course.');
      setCreatedCode(null);
      setCopyStatus('');
    }
  };

  // NEW: copy helper
  const handleCopyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopyStatus('Code copied to clipboard.');
    } catch {
      setCopyStatus('Unable to copy. Please copy manually.');
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

      {/* NEW: show generated code + copy button */}
      {createdCode && (
        <div style={{ marginTop: '0.75rem' }}>
          <p>
            Course code:&nbsp;
            <strong>{createdCode}</strong>
          </p>
          <button type="button" onClick={handleCopyCode}>
            Copy code
          </button>
          {copyStatus && <p style={{ fontSize: '0.85rem' }}>{copyStatus}</p>}
        </div>
      )}
    </div>
  );
}
