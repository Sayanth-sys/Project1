import React from "react";

function Navbar({ user }) {
  // No navigation tabs, just a header on top after login
  return (
    <nav className="navbar">
      <span className="navbar-logo">GD Simulator</span>
      {user && <span className="navbar-user">Welcome, {user}</span>}
    </nav>
  );
}
export default Navbar;
