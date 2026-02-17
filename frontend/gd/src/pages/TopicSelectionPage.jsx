import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function TopicDiscussion() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const username = sessionStorage.getItem("username") || "User";

  const startDiscussion = async () => {
    if (!topic.trim()) {
      alert("Enter a topic");
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

      const history = JSON.parse(
        localStorage.getItem("discussionHistory") || "[]"
      );
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
      alert("Backend not reachable");
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <div style={styles.page}>
      {/* ONLY Top Navbar - No second header */}
      

      <div style={styles.container}>
        {/* SIDEBAR */}
        <div style={styles.sidebar}>
          <button 
            style={styles.btn}
            onClick={() => navigate("/home")}
          >
            <span style={styles.btnIcon}>🏠</span>
            Home
          </button>

          <button style={styles.activeBtn}>
            <span style={styles.btnIcon}>💬</span>
            New Discussion
          </button>
        </div>

        {/* CONTENT */}
        <div style={styles.content}>
          <div style={styles.formContainer}>
            <div style={styles.header}>
              <h1 style={styles.title}>Start a New Discussion</h1>
              <p style={styles.subtitle}>Configure your group discussion session</p>
            </div>

            <div style={styles.card}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>📝</span>
                  Discussion Topic
                </label>
                <textarea
                  placeholder="Enter your discussion topic here... (e.g., Impact of AI on society)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={5}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={styles.labelIcon}>⏱️</span>
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    style={styles.select}
                  >
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={styles.labelIcon}>👥</span>
                    Participants
                  </label>
                  <div style={styles.infoBox}>
                    4 AI Agents + You
                  </div>
                </div>
              </div>

              <div style={styles.buttonGroup}>
                <button onClick={startDiscussion} style={styles.primaryBtn}>
                  <span style={styles.btnIcon}>▶️</span>
                  Start Discussion
                </button>
                <button
                  onClick={() => navigate("/home")}
                  style={styles.secondaryBtn}
                >
                  <span style={styles.btnIcon}>🏠</span>
                  Back to Home
                </button>
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
    background: "#f5f7fa",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    flexDirection: "column",
    margin: 0,
    padding: 0
  },
  navbar: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "16px 30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
  },
  navbarLeft: {
    display: "flex",
    alignItems: "center"
  },
  logoText: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#fff"
  },
  navbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px"
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,0.2)",
    padding: "8px 16px",
    borderRadius: "20px",
    color: "#fff",
    fontWeight: "600",
    fontSize: "15px"
  },
  navLogoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    background: "rgba(231, 76, 60, 0.9)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.3s ease"
  },
  container: { 
    display: "flex",
    flex: 1
  },
  sidebar: {
    width: "240px",
    background: "#fff",
    padding: "20px 15px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    borderRight: "1px solid #e0e0e0"
  },
  btn: {
    padding: "14px 18px",
    border: "none",
    background: "#f5f7fa",
    color: "#2c3e50",
    cursor: "pointer",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "500",
    textAlign: "left",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  activeBtn: {
    padding: "14px 18px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "600",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  btnIcon: {
    fontSize: "18px"
  },
  content: { 
    flex: 1, 
    padding: "40px 50px",
    overflowY: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start"
  },
  formContainer: {
    maxWidth: "700px",
    width: "100%",
    paddingTop: "20px"
  },
  header: {
    marginBottom: "30px",
    textAlign: "center"
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: "8px"
  },
  subtitle: { 
    color: "#7f8c8d", 
    fontSize: "16px",
    fontWeight: "400"
  },
  card: {
    background: "#fff",
    padding: "40px",
    borderRadius: "20px",
    boxShadow: "0 4px 30px rgba(0,0,0,0.1)",
    marginBottom: "30px"
  },
  formGroup: {
    marginBottom: "25px"
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "15px",
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: "10px"
  },
  labelIcon: {
    fontSize: "18px"
  },
  textarea: {
    width: "100%",
    padding: "16px",
    fontSize: "15px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    fontFamily: "inherit",
    resize: "vertical",
    transition: "all 0.3s ease",
    outline: "none",
    boxSizing: "border-box"
  },
  select: {
    width: "100%",
    padding: "16px",
    fontSize: "15px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    fontFamily: "inherit",
    background: "#fff",
    cursor: "pointer",
    transition: "all 0.3s ease",
    outline: "none"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px"
  },
  infoBox: {
    padding: "16px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    borderRadius: "12px",
    fontWeight: "600",
    textAlign: "center",
    fontSize: "15px"
  },
  buttonGroup: {
    display: "flex",
    gap: "15px",
    marginTop: "30px"
  },
  primaryBtn: {
    flex: 1,
    padding: "16px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  },
  secondaryBtn: {
    flex: 1,
    padding: "16px 24px",
    background: "#fff",
    color: "#667eea",
    border: "2px solid #667eea",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  }
};

export default TopicDiscussion;