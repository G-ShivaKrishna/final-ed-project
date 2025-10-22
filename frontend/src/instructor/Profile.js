// src/instructor/Profile.js
import { useState, useEffect } from "react";
import supabase from "../supabaseClient";

export default function Profile() {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data, error } = await supabase
          .from("users")
          .select("username, email, role")
          .eq("id", session.user.id)
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
    </div>
  );
}
