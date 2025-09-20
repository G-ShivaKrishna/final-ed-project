import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabaseClient";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPass: "",
    role: "student",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    setFadeIn(true);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setFadeOut(false);

    if (!form.username || !form.email || !form.password || !form.confirmPass) {
      setError("All fields are required.");
      return;
    }

    if (form.password !== form.confirmPass) {
      setError("Passwords do not match.");
      return;
    }

    // Signup in Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin + "/login", // optional redirect after verification
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    const userId = data.user.id;

    // Insert extra fields into public.users
    const { error: dbError } = await supabase.from("users").insert([
      {
        id: userId,
        email: form.email,
        username: form.username,
        role: form.role,
      },
    ]);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Show success message instead of navigating
    setMessage(
      "Signup successful! Please check your email and click the verification link before logging in."
    );
  };

  return (
    <div className={`signup-container ${fadeIn ? "fade-in" : ""} ${fadeOut ? "fade-out" : ""}`}>
      <style jsx>{`
        :root {
          --primary-bg: linear-gradient(135deg, #0f172a, #1e293b);
          --card-bg: #1e293b;
          --text-light: #f8fafc;
          --text-muted: #94a3b8;
          --input-bg: #0f172a;
          --border-color: #475569;
          --accent: #2563eb;
          --accent-hover: #1d4ed8;
          --error: #f87171;
          --success: #34d399;
          --transition: all 0.3s ease-in-out;
        }

        .signup-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary-bg);
          padding: 1rem;
          opacity: 0;
        }

        .fade-in { animation: fadeIn 0.8s forwards; }
        .fade-out { opacity: 0; transition: opacity 0.5s ease-in-out; }

        @keyframes fadeIn { to { opacity: 1; } }

        .signup-card {
          max-width: 400px;
          width: 100%;
          background-color: var(--card-bg);
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
          text-align: center;
          transition: var(--transition);
        }

        .signup-title { font-size: 2rem; font-weight: 700; color: var(--text-light); margin-bottom: 2rem; }
        .signup-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; }

        .form-group label {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-light);
          display: block;
          margin-bottom: 0.3rem;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          background-color: var(--input-bg);
          color: var(--text-light);
          transition: var(--transition);
        }

        .form-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 8px rgba(37,99,235,0.5);
          transform: scale(1.02);
        }

        .radio-group { display: flex; gap: 1.5rem; margin-top: 0.5rem; }
        .radio-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--text-light); cursor: pointer; }

        .message { font-size: 0.875rem; text-align: center; font-weight: 500; margin-top: 0.5rem; opacity: 0; animation: fadeMessage 0.5s forwards; }
        .message.error { color: var(--error); }
        .message.success { color: var(--success); }
        @keyframes fadeMessage { to { opacity: 1; } }

        .submit-button {
          padding: 0.85rem;
          border: none;
          border-radius: 8px;
          background-color: var(--accent);
          color: var(--text-light);
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          margin-top: 1rem;
        }
        .submit-button:hover { background-color: var(--accent-hover); transform: translateY(-2px); }
      `}</style>

      <div className="signup-card">
        <h2 className="signup-title">Sign Up</h2>

        {error && <p className="message error">{error}</p>}
        {message && <p className="message success">{message}</p>}

        <form onSubmit={handleSignup} className="signup-form" noValidate>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPass">Confirm Password</label>
            <input id="confirmPass" type="password" name="confirmPass" placeholder="Confirm Password" value={form.confirmPass} onChange={handleChange} className="form-input" required />
          </div>

          <div className="radio-group" role="radiogroup" aria-label="Select role">
            <label className="radio-label" htmlFor="role-student">
              <input id="role-student" type="radio" name="role" value="student" checked={form.role === "student"} onChange={handleChange} required /> Student
            </label>

            <label className="radio-label" htmlFor="role-instructor">
              <input id="role-instructor" type="radio" name="role" value="instructor" checked={form.role === "instructor"} onChange={handleChange} /> Instructor
            </label>
          </div>

          <button type="submit" className="submit-button">Sign Up</button>
        </form>
      </div>
    </div>
  );
}
