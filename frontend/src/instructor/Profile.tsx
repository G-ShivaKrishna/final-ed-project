import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function Profile(): JSX.Element {
  const [userData, setUserData] = useState<any | null>(null);

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
    <div>
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
