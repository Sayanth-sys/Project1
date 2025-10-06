import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import TopicSelectionPage from "./pages/TopicSelectionPage";
import DiscussionPage from "./pages/DiscussionPage";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [discussionParams, setDiscussionParams] = useState(null);

  return (
    <Router>
      <div className="app-bg">
        {/* Show Navbar only after login */}
        {user && <Navbar user={user} />}
        <div className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                user
                  ? <Navigate to="/topic-selection" />
                  : <LoginPage onLogin={setUser} />
              }
            />
            <Route
              path="/topic-selection"
              element={
                user
                  ? <TopicSelectionPage onStartDiscussion={setDiscussionParams} />
                  : <Navigate to="/" />
              }
            />
            <Route
              path="/discussion"
              element={
                discussionParams
                  ? <DiscussionPage topic={discussionParams.topic} />
                  : <Navigate to="/topic-selection" />
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
export default App;
