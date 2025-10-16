import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css"; // Import CSS

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Login successful:", data);

        // Save token to sessionStorage (better than localStorage for security)
        sessionStorage.setItem("username", username);
        if (data.access_token) {
          sessionStorage.setItem("token", data.access_token);
        }

        onLogin(username);
        navigate("/topic-selection");
      } else {
        const err = await response.json();
        console.log("❌ Login error:", err);
        setError(err.detail || "Invalid username or password");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Server not reachable. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-screen">
      <div className="box-container login-box">
        <h2 className="page-title">GD Simulator</h2>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="input"
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          {error && <p className="error-text">{error}</p>}
        </form>

        <p className="redirect-text">
          Don't have an account?{" "}
          <a href="/signup" onClick={(e) => {
            e.preventDefault();
            navigate("/signup");
          }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;