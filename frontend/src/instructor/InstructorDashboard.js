import React, { useState } from "react";
import Profile from "./Profile";
import CreateCourseForm from "./CreateCourseForm";
import CoursesList from "./CoursesList";

export default function InstructorDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("profile"); // default to profile

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div style={{ width: "220px", background: "#1e293b", color: "#fff", padding: "20px" }}>
        <h2>Instructor</h2>
        <button style={buttonStyle} onClick={() => setActiveTab("profile")}>Profile</button>
        <button style={buttonStyle} onClick={() => setActiveTab("create")}>Create Course</button>
        <button style={buttonStyle} onClick={() => setActiveTab("courses")}>My Courses</button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "20px", position: "relative" }}>
        {/* Logout Button */}
        <button
          onClick={onLogout}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            padding: "10px 15px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>

        {/* Tab Content */}
        <div style={{ marginTop: "60px" }}>
          {activeTab === "profile" && <Profile />}
          {activeTab === "create" && <CreateCourseForm />}
          {activeTab === "courses" && <CoursesList />}
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  display: "block",
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  background: "#2563eb",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  cursor: "pointer",
};
