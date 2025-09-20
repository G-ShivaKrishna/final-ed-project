import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import StudentDashboard from './student/StudentDashboard';
import InstructorDashboard from './instructor/InstructorDashboard';
import { useState, useEffect } from 'react';
import supabase from './supabaseClient';

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const navigate = useNavigate(); // Add navigate

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        supabase.from('users').select('role').eq('id', session.user.id).single().then(({ data }) => {
          setRole(data?.role ?? null);
        });
      } else {
        setRole(null);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    navigate('/login', { replace: true }); // Navigate to login after logout
  };

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

      {/* Dashboards with logout */}
      <Route path="/student-dashboard" element={<StudentDashboard onLogout={handleLogout} />} />
      <Route path="/instructor-dashboard" element={<InstructorDashboard onLogout={handleLogout} />} />
    </Routes>
  );
}

export default AppWrapper;
