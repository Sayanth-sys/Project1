import React from "react";
import "./Navbar.css";

function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <span className="navbar-logo">GD Simulator</span>
      {user && (
        <div className="navbar-right">
          <span className="navbar-user">Welcome, {user}</span>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;