import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function TopicSelectionPage({ onStartDiscussion }) {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const [timePerAgent, setTimePerAgent] = useState(40);
  const navigate = useNavigate();

  async function handleStart() {
    if (topic.trim()) {
      try {
        // Send entered topic to FastAPI backend
        const res = await fetch("http://127.0.0.1:8001/start_simulation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: topic,
            num_agents: 4,  // configurable later
            rounds: 2       // configurable later
          }),
        });

        const data = await res.json();
        console.log("✅ Simulation started:", data);

        // Pass topic and other settings to parent and move to discussion page
        onStartDiscussion({ topic, duration, timePerAgent, simulationId: data.simulation_id });
        navigate("/discussion");

      } catch (err) {
        console.error("❌ Error starting discussion:", err);
        alert("Failed to start discussion. Please check backend connection.");
      }
    } else {
      alert("Please enter a discussion topic first.");
    }
  }

  return (
    <div className="center-screen">
      <div className="box-container">
        <h2 className="page-title" style={{ marginBottom: '8px' }}>Start a New Discussion</h2>
        <div className="card">
          <label className="label" htmlFor="discussion-topic">Discussion Topic</label>
          <input
            className="input"
            id="discussion-topic"
            placeholder="Enter your discussion topic here..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />

          <div className="row gap">
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="discussion-duration">Discussion Duration</label>
              <select
                className="input"
                id="discussion-duration"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="speaking-time">Time per Agent</label>
              <select
                className="input"
                id="speaking-time"
                value={timePerAgent}
                onChange={e => setTimePerAgent(e.target.value)}
              >
                <option value={30}>30 seconds</option>
                <option value={40}>40 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
          </div>

          <button className="primary-btn" onClick={handleStart}>
            Start Discussion
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopicSelectionPage;
