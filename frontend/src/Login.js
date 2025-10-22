import React, { useState, useEffect } from "react";
import supabase from "./supabaseClient";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [forgot, setForgot] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
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
    <div className={`login-container ${fadeIn ? "fade-in" : ""}`}>
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
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary-bg);
          padding: 1rem;
          opacity: 0;
        }
        .fade-in { animation: fadeIn 0.8s forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
        .login-card {
          max-width: 400px;
          width: 100%;
          background-color: var(--card-bg);
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
          text-align: center;
          transition: var(--transition);
        }
        .login-title { font-size: 2rem; font-weight: 700; color: var(--text-light); margin-bottom: 2rem; }
        .login-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.95rem;
          outline: none;
          background-color: var(--input-bg);
          color: var(--text-light);
          transition: var(--transition);
        }
        .form-input:focus { border-color: var(--accent); box-shadow: 0 0 8px rgba(37,99,235,0.5); transform: scale(1.02); }
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
        }
        .submit-button:hover { background-color: var(--accent-hover); transform: translateY(-2px); }
        .toggle-button {
          margin-top: 0.5rem;
          padding: 0.5rem;
          border: none;
          border-radius: 8px;
          background-color: var(--border-color);
          color: var(--text-light);
          cursor: pointer;
          font-size: 0.875rem;
          transition: var(--transition);
        }
        .toggle-button:hover { background-color: #374151; transform: translateY(-1px); }
        .message { margin-top: 1rem; font-weight: bold; opacity: 0; animation: fadeMessage 0.5s forwards; }
        .message.error { color: var(--error); }
        .message.success { color: var(--success); }
        @keyframes fadeMessage { to { opacity: 1; } }
        .navigation-link { margin-top: 1rem; font-size: 0.9rem; }
        .link { color: var(--accent); text-decoration: None; font-weight: 500; }
        .link:hover { color: var(--accent-hover); }
      `}</style>

      <div className="login-card">
        <h2 className="login-title">Log In</h2>

        {!forgot ? (
          <form className="login-form" onSubmit={handleLogin}>
            <input className="form-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username or Email" />
            <input className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" />
            <button type="submit" className="submit-button">Log In</button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handlePasswordReset}>
            <input className="form-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Email" />
            <button type="submit" className="submit-button">Send Password Reset Email</button>
          </form>
        )}

        <button className="toggle-button" onClick={() => setForgot(!forgot)}>
          {forgot ? "Back to Login" : "Forgot password?"}
        </button>

        {error && <div className="message error">{error}</div>}
        {message && <div className="message success">{message}</div>}

        <div className="navigation-link" style={{ color: 'white' }}>
  Don't have an account? <Link to="/signup" className="link">Sign Up</Link>
</div>

      </div>
    </div>
  );
}
