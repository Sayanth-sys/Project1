import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import TopicSelectionPage from "./pages/TopicSelectionPage";
import DiscussionPage from "./pages/DiscussionPage";
import FeedbackPage from "./pages/FeedbackPage";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);

  // Persist login
  useEffect(() => {
    const username = sessionStorage.getItem("username");
    const token = sessionStorage.getItem("token");
    if (username && token) {
      setUser(username);
    }
  }, []);

  // Logout → Login
  const handleLogout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  return (
    <Router>
      <div className="app-bg">
        {/* Navbar WITHOUT logout */}
        {user && <Navbar user={user} onLogout={handleLogout} />}

        <Routes>
          {/* ROOT */}
          <Route
            path="/"
            element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />}
          />

          {/* LOGIN */}
          <Route
            path="/login"
            element={user ? <Navigate to="/home" replace /> : <LoginPage onLogin={setUser} />}
          />

          {/* SIGNUP */}
          <Route
            path="/signup"
            element={user ? <Navigate to="/home" replace /> : <SignupPage />}
          />

          {/* HOME */}
          <Route
            path="/home"
            element={
              user ? <HomePage onLogout={handleLogout} /> : <Navigate to="/login" replace />
            }
          />

          {/* TOPIC SELECTION */}
          <Route
            path="/topic-selection"
            element={
              user ? <TopicSelectionPage /> : <Navigate to="/login" replace />
            }
          />

          {/* ✅ DISCUSSION PAGE (NO discussionParams CHECK) */}
          <Route
            path="/discussion"
            element={
              user ? <DiscussionPage /> : <Navigate to="/login" replace />
            }
          />

          {/* FEEDBACK PAGE */}
          <Route
            path="/feedback/:id"
            element={
              user ? <FeedbackPage /> : <Navigate to="/login" replace />
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
