import React, { useState, useEffect } from "react";

const initialParticipants = [
  { name: "Agent 1", role: "Analytical Thinker", next: true, messages: [] },
  { name: "Agent 2", role: "Creative Strategist", next: false, messages: [] },
  { name: "Agent 3", role: "Pragmatic Advisor", next: false, messages: [] },
  { name: "Agent 4", role: "Innovation Expert", next: false, messages: [] }
];

function DiscussionPage({ topic }) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [simId, setSimId] = useState(null);
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(false);

  // Start simulation
  const startSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/start_simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic })
      });
      const data = await res.json();
      setSimId(data.simulation_id);
      alert(`Simulation started! ID: ${data.simulation_id}`);
    } catch (err) {
      console.error("Error starting simulation:", err);
      alert("Failed to start simulation");
    }
    setLoading(false);
  };

  // Fetch next round
  const fetchNextRound = async () => {
    if (!simId) return alert("Start simulation first!");
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/next_round/${simId}`, { method: "POST" });
      const data = await res.json();

      setRound(data.round);

      setParticipants((prev) =>
        prev.map((p) => {
          const resp = data.responses.find((r) => r.agent === p.name);
          return resp
            ? { ...p, messages: [...p.messages, resp.text], next: true }
            : { ...p, next: false };
        })
      );
    } catch (err) {
      console.error("Error fetching next round:", err);
      alert("Failed to fetch next round");
    }
    setLoading(false);
  };

  return (
    <div className="discussion-container">
      {/* Participants Sidebar */}
      <div className="participants-sidebar">
        <div className="sidebar-header">Participants</div>
        {participants.map((p) => (
          <div key={p.name} className={`participant ${p.next ? "active" : ""}`}>
            <div className="avatar"></div>
            <div>
              <div className="participant-name">{p.name}</div>
              <div className="participant-role">{p.role}</div>
              <div className="participant-status">{p.next ? "Next to speak" : "Waiting"}</div>
              <div className="participant-messages">
                {p.messages.map((msg, i) => (
                  <div key={i} className="msg-content">{msg}</div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Discussion */}
      <div className="main-discussion">
        <div className="discussion-header">
          <div className="discussion-title">AI Group Discussion</div>
          <div className="discussion-topic">Topic: {topic || "Topic not set"}</div>
          <button className="start-btn" onClick={startSimulation} disabled={loading || simId !== null}>
            {loading && !simId ? "Starting..." : simId ? "Simulation Started" : "Start Simulation"}
          </button>
          <button className="next-round-btn" onClick={fetchNextRound} disabled={!simId || loading}>
            {loading ? "Fetching..." : "Next Round"}
          </button>
        </div>
        <div className="discussion-footer">
          <span>Live Discussion</span>
          <span>Round {round}</span>
          <span>{participants.length} participants</span>
        </div>
      </div>
    </div>
  );
}

export default DiscussionPage;
