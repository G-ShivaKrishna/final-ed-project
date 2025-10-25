import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "./supabaseClient";
import "./Login.css";

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
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const redirectDelay = 4000; // ms

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

    // In some Supabase projects the `signUp` call does not return `data.user`
    // immediately (email confirmation flow). Guard against accessing
    // `data.user.id` when it's undefined. Only insert into `users` table if
    // the auth user id is available now; otherwise skip DB insert and rely on
    // server-side / post-confirmation logic to create the row.
    const userId = data?.user?.id;

    if (userId) {
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
    } else {
      // Not fatal: log for debugging and continue to show the user the next step.
      // The user will still receive a verification email and can log in after
      // verifying. Creating the `users` row can be handled later if desired.
      // eslint-disable-next-line no-console
      console.warn("signUp returned no user id (email confirmation may be required) — skipping DB insert for now.");
    }

    // Show a confirmation message and redirect the user to the login page
    // so they can sign in after verifying their email.
    setMessage(
      "Signup successful! Please check your email and click the verification link before logging in. Redirecting to login..."
    );

    // schedule redirect but keep a ref so the user can cancel it by clicking
    // the button (or if the component unmounts we clear it)
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      navigate("/login");
    }, redirectDelay);
  };

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`auth-wrapper ${fadeIn ? "fade-in" : ""} ${fadeOut ? "fade-out" : ""}`}>

      <div className="auth-card">
        <h2 className="auth-title">Create an account</h2>

        {error && <p className="auth-message error">{error}</p>}
        {message && (
          <>
            <p className="auth-message success">{message}</p>
            <div className="auth-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                  }
                  navigate("/login");
                }}
              >
                Go to login now
              </button>
            </div>
          </>
        )}

        <form onSubmit={handleSignup} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} className="auth-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} className="auth-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} className="auth-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPass">Confirm Password</label>
            <input id="confirmPass" type="password" name="confirmPass" placeholder="Confirm Password" value={form.confirmPass} onChange={handleChange} className="auth-input" required />
          </div>

          <div className="radio-group" role="radiogroup" aria-label="Select role">
            <label className="radio-label" htmlFor="role-student">
              <input id="role-student" type="radio" name="role" value="student" checked={form.role === "student"} onChange={handleChange} required /> Student
            </label>

            <label className="radio-label" htmlFor="role-instructor">
              <input id="role-instructor" type="radio" name="role" value="instructor" checked={form.role === "instructor"} onChange={handleChange} /> Instructor
            </label>
          </div>

          <button type="submit" className="btn btn-primary">Create account</button>
        </form>
      </div>
    </div>
  );
}
