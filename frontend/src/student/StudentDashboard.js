import React from "react";

export default function StudentDashboard({ onLogout }) {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Student Dashboard</h1>
      <p>Welcome, student!</p>
      <button onClick={onLogout} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>
        Logout
      </button>
    </div>
  );
}
