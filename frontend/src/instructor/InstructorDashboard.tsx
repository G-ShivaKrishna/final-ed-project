import React, { useState } from 'react';
import Profile from './Profile';
import CreateCourseForm from './CreateCourseForm';
import CoursesList from './CoursesList';

export default function InstructorDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '220px', background: '#1e293b', color: '#fff', padding: '20px' }}>
        <h2>Instructor</h2>
        <button style={buttonStyle} onClick={() => setActiveTab('profile')}>Profile</button>
        <button style={buttonStyle} onClick={() => setActiveTab('create')}>Create Course</button>
        <button style={buttonStyle} onClick={() => setActiveTab('courses')}>My Courses</button>
      </div>

      <div style={{ flex: 1, padding: '20px', position: 'relative' }}>
        <button
          onClick={onLogout}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>

        <div style={{ marginTop: '60px' }}>
          {activeTab === 'profile' && <Profile />}
          {activeTab === 'create' && <CreateCourseForm />}
          {activeTab === 'courses' && <CoursesList />}
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px',
  marginBottom: '10px',
  background: '#2563eb',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  cursor: 'pointer',
};
