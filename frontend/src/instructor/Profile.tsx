import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function Profile(): JSX.Element {
  const [userData, setUserData] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Select extra fields: major, phone_number and the case-sensitive "College"
        const { data, error } = await supabase
          .from('users')
          .select('username, email, role, major, phone_number, "College"')
          .eq('id', session.user.id)
          .single();

        if (!error) setUserData(data);
      }
    };

    fetchUser();
  }, []);

  if (!userData) return <p>Loading...</p>;

  return (
    // theme-aware wrapper so header buttons render correctly in dark mode
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-900 p-6 text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/instructor-dashboard')} className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">Dashboard</button>
      </div>
      <h2>Profile</h2>
      <p><strong>Username:</strong> {userData.username}</p>
      <p><strong>Email:</strong> {userData.email}</p>
      <p><strong>Role:</strong> {userData.role}</p>
      <p><strong>Major:</strong> {userData.major ?? '-'}</p>
      <p><strong>College:</strong> {userData.College ?? '-'}</p>
      <p><strong>Phone number:</strong> {userData.phone_number ?? '-'}</p>
    </div>
  );
}
