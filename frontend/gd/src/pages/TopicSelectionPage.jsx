import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function TopicDiscussion() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const username = sessionStorage.getItem("username") || "User";

  const startDiscussion = async () => {
    if (!topic.trim()) {
      alert("Please enter a topic to begin.");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8001/start_simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          num_agents: 4,
          rounds: 2,
          human_participant: true,
        }),
      });

      const data = await res.json();
      const now = new Date();
      const record = {
        id: data.simulation_id || Date.now(),
        topic,
        duration,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        timestamp: now.toISOString(),
      };

      const history = JSON.parse(localStorage.getItem("discussionHistory") || "[]");
      history.unshift(record);
      localStorage.setItem("discussionHistory", JSON.stringify(history));

      navigate("/discussion", {
        state: {
          topic: topic,
          simulationId: data.simulation_id,
          duration,
        },
      });

    } catch (err) {
      console.error("❌ Error:", err);
      alert("The discussion server is not reachable. Please try again later.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* SIDEBAR - Matching the Home Layout */}
        <div style={styles.sidebar}>
          

          <button 
            style={styles.btn}
            onClick={() => navigate("/home")}
          >
            <span style={styles.btnIcon}>🏠</span>
            Dashboard
          </button>

          <button style={styles.activeBtn}>
            <span style={styles.btnIcon}>➕</span>
            New Session
          </button>
          
          <div style={styles.sidebarDivider} />
 
        </div>

        {/* CONTENT */}
        <div style={styles.contentWrapper}>
          <div style={styles.content}>
            <div style={styles.formContainer}>
              <header style={styles.header}>
                <h1 style={styles.title}>New Discussion</h1>
                <p style={styles.subtitle}>Set the stage for your AI-powered conversation</p>
              </header>

              <div style={styles.card}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={styles.labelIcon}>📝</span>
                    What do you want to talk about?
                  </label>
                  <textarea
                    placeholder="Describe your topic in detail... (e.g. The ethics of space exploration or future of remote work)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={4}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      <span style={styles.labelIcon}>⏱️</span>
                      Session Duration
                    </label>
                    <div style={styles.selectWrapper}>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        style={styles.select}
                      >
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={20}>20 minutes</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      <span style={styles.labelIcon}>👥</span>
                      Group Setup
                    </label>
                    <div style={styles.infoBox}>
                      <span style={styles.blueDot}></span>
                      4 AI Agents + You
                    </div>
                  </div>
                </div>

                <div style={styles.buttonGroup}>
                  <button onClick={startDiscussion} style={styles.primaryBtn}>
                    Launch Session
                  </button>
                  <button
                    onClick={() => navigate("/home")}
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div style={styles.tipBox}>
                <span style={{fontSize: '20px'}}>💡</span>
                <p style={styles.tipText}>
                  <strong>Pro Tip:</strong> Be specific! Instead of "Science," try "The impact of quantum computing on modern cybersecurity."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { 
    minHeight: "100vh", 
    background: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
    color: "#1e293b",
  },
  container: { 
    display: "flex",
    minHeight: "100vh",
  },
  sidebar: {
    width: "280px",
    background: "#ffffff",
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #e2e8f0",
    position: "fixed",
    height: "100vh",
  },
  sidebarBrand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "40px",
    paddingLeft: "10px",
  },
  brandIcon: {
    background: "#2563eb",
    color: "#fff",
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  brandName: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  sidebarLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    margin: "24px 0 8px 12px",
    letterSpacing: "0.05em",
  },
  sidebarDivider: {
    height: "1px",
    background: "#f1f5f9",
    margin: "20px 0",
  },
  btn: {
    padding: "12px 16px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "500",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "0.2s",
  },
  activeBtn: {
    padding: "12px 16px",
    border: "none",
    background: "#eff6ff",
    color: "#2563eb",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  contentWrapper: {
    flex: 1,
    marginLeft: "280px",
  },
  content: { 
    padding: "60px 20px",
    display: "flex",
    justifyContent: "center",
  },
  formContainer: {
    maxWidth: "640px",
    width: "100%",
  },
  header: {
    marginBottom: "32px",
    textAlign: "left"
  },
  title: {
    fontSize: "30px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "8px",
    letterSpacing: "-0.02em"
  },
  subtitle: { 
    color: "#64748b", 
    fontSize: "16px",
  },
  card: {
    background: "#fff",
    padding: "40px",
    borderRadius: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
  },
  formGroup: {
    marginBottom: "24px"
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#334155",
    marginBottom: "12px"
  },
  textarea: {
    width: "100%",
    padding: "16px",
    fontSize: "15px",
    lineHeight: "1.5",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    fontFamily: "inherit",
    resize: "none",
    transition: "border-color 0.2s",
    outline: "none",
    boxSizing: "border-box",
    background: "#f8fafc"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginTop: "10px"
  },
  select: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "15px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    fontFamily: "inherit",
    background: "#f8fafc",
    cursor: "pointer",
    outline: "none",
    appearance: "none"
  },
  infoBox: {
    padding: "14px 16px",
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: "12px",
    fontWeight: "600",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #e2e8f0"
  },
  blueDot: {
    width: "8px",
    height: "8px",
    background: "#2563eb",
    borderRadius: "50%"
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "32px"
  },
  primaryBtn: {
    padding: "16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
    transition: "background 0.2s"
  },
  secondaryBtn: {
    padding: "14px",
    background: "transparent",
    color: "#64748b",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
  },
  tipBox: {
    marginTop: "32px",
    padding: "20px",
    background: "#fffbeb",
    border: "1px solid #fef3c7",
    borderRadius: "16px",
    display: "flex",
    gap: "16px",
    alignItems: "flex-start"
  },
  tipText: {
    margin: 0,
    fontSize: "14px",
    color: "#92400e",
    lineHeight: "1.5"
  }
};

export default TopicDiscussion;