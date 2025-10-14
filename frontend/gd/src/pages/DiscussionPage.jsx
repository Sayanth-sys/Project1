import React from "react";

const participants = [
  { name: "Dr. Sarah Chen", role: "Analytical Thinker", next: true },
  { name: "Marcus Rivera", role: "Creative Strategist", next: false },
  { name: "Elena Kowalski", role: "Pragmatic Advisor", next: false },
  { name: "David Park", role: "Innovation Expert", next: false }
];

const initialMessages = [
  {
    name: "Dr. Sarah Chen",
    role: "AI Agent",
    content:
      "From an analytical perspective, this topic presents several interesting data points. Research consistently shows that systematic approaches yield better outcomes than ad-hoc methods. I'd like to examine the empirical evidence behind this discussion and consider how we can apply evidence-based frameworks to reach meaningful conclusions."
  }
];

function DiscussionPage({ topic }) {
  return (
    <div className="discussion-container">
      <div className="participants-sidebar">
        <div className="sidebar-header">Participants</div>
        {participants.map((p, i) => (
          <div key={p.name} className={`participant ${p.next ? "active" : ""}`}>
            <div className="avatar"></div>
            <div>
              <div className="participant-name">{p.name}</div>
              <div className="participant-role">{p.role}</div>
              <div className="participant-status">{p.next ? "Next to speak" : "Waiting"}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="main-discussion">
        <div className="discussion-header">
          <div className="discussion-title">AI Group Discussion</div>
          <div className="discussion-topic">Topic: {topic || "Topic not set"}</div>
          <button className="end-btn">End Discussion</button>
        </div>
        <div className="discussion-messages">
          {initialMessages.map((msg, i) => (
            <div className="single-message" key={i}>
              <div className="msg-header">
                <span className="msg-author">{msg.name}</span>
                <span className="msg-role">{msg.role}</span>
              </div>
              <div className="msg-content">{msg.content}</div>
            </div>
          ))}
        </div>
        <div className="discussion-footer">
          <span>Live Discussion</span>
          <span>Round 1</span>
          <span>5 participants</span>
        </div>
      </div>
    </div>
  );
}
export default DiscussionPage;
