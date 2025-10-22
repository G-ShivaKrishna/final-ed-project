import React, { useState, useEffect } from "react";
import supabase from "../supabaseClient"; // adjust path if needed
import ChatBox from "./ChatBot"; // both files are in the same folder


export default function StudentDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [userProfile, setUserProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) console.error("Error fetching profile:", profileError);
      else setUserProfile(profileData);

      // Fetch enrolled courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", userId);

      if (coursesError) console.error("Error fetching courses:", coursesError);
      else setCourses(coursesData);

      // Fetch progress data
      const { data: progressData, error: progressError } = await supabase
        .from("progress")
        .select("*")
        .eq("user_id", userId);

      if (progressError) console.error("Error fetching progress:", progressError);
      else setProgress(progressData);
    };

    fetchData();
  }, []);

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>{userProfile?.username || "Student"}</h2>
        <nav style={styles.nav}>
          {["profile", "courses", "progress"].map((tab) => (
            <button
              key={tab}
              style={{
                ...styles.navItem,
                backgroundColor: activeTab === tab ? "#2563eb" : "transparent",
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <button onClick={onLogout} style={styles.logoutBtn}>
          Logout
        </button>

        <div style={{ marginTop: "60px" }}>
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div style={styles.card}>
              <h1 style={styles.cardTitle}>Profile</h1>
              {userProfile ? (
                <div style={styles.profileInfo}>
                  <p><strong>Username:</strong> {userProfile.username}</p>
                  <p><strong>Email:</strong> {userProfile.email}</p>
                  <p><strong>Joined:</strong> {new Date(userProfile.created_at).toLocaleDateString()}</p>
                </div>
              ) : (
                <p>Loading profile...</p>
              )}
            </div>
          )}

          {/* Courses Tab */}
          {activeTab === "courses" && (
            <div style={styles.card}>
              <h1 style={styles.cardTitle}>My Courses</h1>
              {courses.length > 0 ? (
                <ul style={styles.list}>
                  {courses.map((course) => (
                    <li key={course.id}>{course.name}</li>
                  ))}
                </ul>
              ) : (
                <p>No courses found.</p>
              )}
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === "progress" && (
            <div style={styles.card}>
              <h1 style={styles.cardTitle}>Progress</h1>
              {progress.length > 0 ? (
                <ul style={styles.list}>
                  {progress.map((item) => (
                    <li key={item.id}>
                      {item.course_name} - {item.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No progress data found.</p>
              )}
            </div>
          )}
        </div>
  <button onClick={onLogout} style={styles.logoutBtn}>
    Logout
  </button>

  <div style={{ marginTop: "60px" }}>
    {/* Profile, Courses, Progress Tabs */}
    {activeTab === "profile" && (
      <div style={styles.card}>
        <h1 style={styles.cardTitle}>Profile</h1>
        {userProfile ? (
          <div style={styles.profileInfo}>
            <p><strong>Username:</strong> {userProfile.username}</p>
            <p><strong>Email:</strong> {userProfile.email}</p>
            <p><strong>Joined:</strong> {new Date(userProfile.created_at).toLocaleDateString()}</p>
          </div>
        ) : (
          <p>Loading profile...</p>
        )}
      </div>
    )}

    {activeTab === "courses" && (
      <div style={styles.card}>
        <h1 style={styles.cardTitle}>My Courses</h1>
        {courses.length > 0 ? (
          <ul style={styles.list}>
            {courses.map((course) => (
              <li key={course.id}>{course.name}</li>
            ))}
          </ul>
        ) : (
          <p>No courses found.</p>
        )}
      </div>
    )}

    {activeTab === "progress" && (
      <div style={styles.card}>
        <h1 style={styles.cardTitle}>Progress</h1>
        {progress.length > 0 ? (
          <ul style={styles.list}>
            {progress.map((item) => (
              <li key={item.id}>
                {item.course_name} - {item.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No progress data found.</p>
        )}
      </div>
    )}
  </div>

  {/* ChatBox Component */}
  <ChatBox />
</main>

    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #0f172a, #1e293b)",
    color: "#f8fafc",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: "220px",
    backgroundColor: "#1e293b",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  navItem: {
    padding: "12px",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "6px",
    color: "#f8fafc",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.2s",
  },
  main: {
    flex: 1,
    padding: "20px",
    position: "relative",
  },
  logoutBtn: {
    position: "absolute",
    top: "20px",
    right: "20px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 0 10px rgba(0,0,0,0.4)",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "22px",
    marginBottom: "10px",
  },
  profileInfo: {
    lineHeight: "1.6",
    color: "#f8fafc",
  },
  list: {
    paddingLeft: "20px",
    lineHeight: "1.6",
  },
};
