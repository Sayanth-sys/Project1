import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username.trim());
      navigate("/topic-selection");
    }
  }

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
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button className="primary-btn" type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
export default LoginPage;
