import React, { useState, useEffect } from "react";
import supabase from "./supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [forgot, setForgot] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => setFadeIn(true), []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    let emailToLogin = identifier;
    let role = null;

    // If input does not contain '@', treat it as username
    if (!identifier.includes("@")) {
      const { data: user, error: findError } = await supabase
        .from("users")
        .select("email, role")
        .eq("username", identifier)
        .single();

      if (findError || !user) {
        setError("No account with that username.");
        return;
      }
      emailToLogin = user.email;
      role = user.role;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: emailToLogin,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      return;
    }

    // If role wasn't fetched via username, get it from email
    if (!role) {
      const { data: userInfo, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("email", emailToLogin)
        .single();

      if (roleError || !userInfo) {
        setError("Unable to fetch user role.");
        return;
      }
      role = userInfo.role;
    }

    setMessage("Login successful! Redirecting...");

    // Redirect based on role
    setTimeout(() => {
      if (role === "student") navigate("/student-dashboard");
      else if (role === "instructor") navigate("/instructor-dashboard");
      else navigate("/"); // fallback
    }, 800);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!identifier) {
      setError("Enter your email to reset password.");
      return;
    }

    // Check if email exists
    const { data: userExists } = await supabase
      .from("users")
      .select("email")
      .eq("email", identifier)
      .single();

    if (!userExists) {
      setError("No account found with that email.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(identifier);
    setMessage(resetError ? resetError.message : "Password reset email sent! Check your inbox.");
  };

  return (
    <div className={`auth-wrapper ${fadeIn ? "fade-in" : ""}`}>
      <div className="auth-card">
        <div className="auth-brand">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="12" fill="url(#g1)" />
            <path d="M16 30c3-4 8-6 14-6" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="auth-title">Welcome back</h2>
        </div>

        {!forgot ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label className="visually-hidden">Username or Email</label>
            <input className="auth-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username or email" />

            <div className="password-row">
              <label className="visually-hidden">Password</label>
              <input className="auth-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type={showPassword ? "text" : "password"} />
              <button type="button" aria-label="Toggle password visibility" className="eye-toggle" onClick={() => setShowPassword(s => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>

            <button type="submit" className="btn btn-primary">Sign in</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handlePasswordReset}>
            <label className="visually-hidden">Email</label>
            <input className="auth-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Email" />
            <button type="submit" className="btn btn-primary">Send password reset email</button>
          </form>
        )}

        <div className="auth-actions">
          <button className="btn btn-ghost" onClick={() => setForgot(!forgot)}>{forgot ? 'Back to login' : 'Forgot password?'}</button>
        </div>

        {error && <div className="auth-message error">{error}</div>}
        {message && <div className="auth-message success">{message}</div>}

        <div className="auth-footer">Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link></div>
      </div>
    </div>
  );

}
