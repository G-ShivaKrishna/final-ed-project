import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import StudentDashboard from './student/StudentDashboard';
import InstructorDashboard from './instructor/InstructorDashboard';
import ViewGrades from './student/ViewGrades';
import CourseSettings from './student/CourseSettings';
import CoursesPage from './student/CoursesPage';
import supabase from './supabaseClient';
import { UserProvider } from './lib/UserContext';

function AppWrapper(): JSX.Element {
  return (
    <Router>
      <UserProvider>
        <App />
      </UserProvider>
    </Router>
  );
}

function App(): JSX.Element {
  const [session, setSession] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data?.session ?? null;
      setSession(currentSession);

      if (currentSession) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();
        setRole(userData?.role ?? null);
      }
    };

    fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session) {
        supabase.from('users').select('role').eq('id', session.user.id).single().then(({ data }: any) => {
          setRole(data?.role ?? null);
        });
      } else {
        setRole(null);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleLogout = async (navigate: any) => {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    navigate('/login', { replace: true });
  };

  return <RoutesWrapper session={session} role={role} onLogout={handleLogout} />;
}

function RoutesWrapper({ session, role, onLogout }: { session: any; role: string | null; onLogout: (nav: any) => void; }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={
          session ? (
            role === 'student' ? (
              <Navigate to="/student-dashboard" replace />
            ) : role === 'instructor' ? (
              <Navigate to="/instructor-dashboard" replace />
            ) : null
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/signup" element={!session ? <Signup /> : <Navigate to="/" replace />} />

      {/* Dashboards */}
      <Route path="/student-dashboard" element={<StudentDashboard onLogout={() => onLogout(navigate)} />} />
      <Route path="/instructor-dashboard" element={<InstructorDashboard onLogout={() => onLogout(navigate)} />} />
      <Route path="/grades" element={<ViewGrades />} />
  <Route path="/courses" element={<CoursesPage />} />
      <Route path="/course-settings" element={<CourseSettings />} />
    </Routes>
  );
}

export default AppWrapper;
