import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import TopicSelectionPage from "./pages/TopicSelectionPage";
import DiscussionPage from "./pages/DiscussionPage";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [discussionParams, setDiscussionParams] = useState(null);

  // Check if user is already logged in (persist login)
  useEffect(() => {
    const savedUser = sessionStorage.getItem("username");
    const savedToken = sessionStorage.getItem("token");
    if (savedUser && savedToken) {
      setUser(savedUser);
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("token");
    setUser(null);
    setDiscussionParams(null);
  };

  return (
    <Router>
      <div className="app-bg">
        {/* Show Navbar only after login */}
        {user && <Navbar user={user} onLogout={handleLogout} />}

        <div className="main-content">
          <Routes>
            {/* DEFAULT ROUTE - Redirect to login or topic selection */}
            <Route
              path="/"
              element={
                user ? <Navigate to="/topic-selection" replace /> : <Navigate to="/login" replace />
              }
            />

            {/* LOGIN */}
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/topic-selection" replace />
                ) : (
                  <LoginPage onLogin={setUser} />
                )
              }
            />

            {/* SIGNUP */}
            <Route
              path="/signup"
              element={
                user ? (
                  <Navigate to="/topic-selection" replace />
                ) : (
                  <SignupPage />
                )
              }
            />

            {/* TOPIC SELECTION (Protected) */}
            <Route
              path="/topic-selection"
              element={
                user ? (
                  <TopicSelectionPage onStartDiscussion={setDiscussionParams} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* DISCUSSION (Protected) */}
            <Route
              path="/discussion"
              element={
                user && discussionParams ? (
                  <DiscussionPage topic={discussionParams.topic} />
                ) : (
                  <Navigate to="/topic-selection" replace />
                )
              }
            />

            {/* 404 - Catch all undefined routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;