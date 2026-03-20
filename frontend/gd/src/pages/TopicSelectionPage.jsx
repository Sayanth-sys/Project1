import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import homeIcon from "../images/home-button.png";
import logoutIcon from "../images/power.png";
import addIcon from "../images/add.png";
import groupIcon from "../images/group.png";
import clockIcon from "../images/clock.png";

function TopicDiscussion({ onLogout }) {
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
          agents: data.agents || [],
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
        .topic-page-title {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
          letter-spacing: -1px;
          text-align: center;
        }
        .topic-card {
          background: #ffffff;
          padding: 48px;
          border-radius: 24px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(37, 99, 235, 0.05);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .topic-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 6px;
          background: linear-gradient(90deg, #2563eb, #8b5cf6);
        }
        .topic-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 25px 50px -12px rgba(37, 99, 235, 0.15), 0 0 0 1px rgba(37, 99, 235, 0.1);
        }
        .topic-textarea:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1) !important;
          background: #ffffff !important;
        }
        .topic-primary-btn {
          padding: 14px 40px;
          background: transparent;
          color: #2563eb;
          border: 2px solid #2563eb;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: none;
          transition: all 0.3s ease;
        }
        .topic-primary-btn:hover {
          background: #2563eb;
          color: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 15px 25px rgba(37, 99, 235, 0.15);
        }
      `}</style>
      <div style={styles.container}>

        {/* UPDATED SIDEBAR - Matches HomePage Layout */}
        <div style={styles.sidebar}>
          {/* Top Section: Navigation */}
          <div style={styles.sidebarTop}>
            <div style={styles.sidebarBrand}>
              <div style={styles.brandIcon}>GD</div>
              <span style={styles.brandName}>SIMULATOR</span>
            </div>

            <p style={styles.sidebarLabel}>Main Menu</p>

            <button
              style={styles.btn}
              onClick={() => navigate("/home")}
            >
              <img src={homeIcon} alt="Home" style={styles.btnIcon} />
              Home
            </button>

            <button style={styles.activeBtn}>
              <img src={addIcon} alt="New Session" style={styles.btnIcon} />
              New Session
            </button>
          </div>

          {/* Bottom Section: Logout */}
          <div style={styles.sidebarBottom}>
            <div style={styles.sidebarDivider} />
            <button
              style={styles.logoutBtnSidebar}
              onClick={() => {
                onLogout();
                navigate("/login");
              }}
            >
              <img src={logoutIcon} alt="Logout" style={styles.btnIcon} />
              Logout
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={styles.contentWrapper}>
          <div style={styles.content}>
            <div style={styles.formContainer}>
              <header style={{ ...styles.header, textAlign: 'center' }}>
                <h1 className="topic-page-title">New Discussion</h1>
              </header>

              <div className="topic-card">
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={styles.labelIcon}></span>
                    What do you want to talk about?
                  </label>
                  <textarea
                    className="topic-textarea"
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
                      <img src={clockIcon} alt="Session Duration" style={{ width: "18px", height: "18px", objectFit: "contain" }} />
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
                      <img src={groupIcon} alt="Group Setup" style={{ width: "18px", height: "18px", objectFit: "contain" }} />
                      Group Setup
                    </label>
                    <div style={styles.infoBox}>
                      <span style={styles.blueDot}></span>
                      4 AI Agents + You
                    </div>
                  </div>
                </div>

                <div style={styles.buttonGroup}>
                  <button onClick={startDiscussion} className="topic-primary-btn">
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
    justifyContent: "space-between", // Key: Keeps navigation top and logout bottom
    borderRight: "1px solid #e2e8f0",
    position: "fixed",
    height: "100vh",
    boxSizing: "border-box",
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
    fontFamily: "'Playfair Display', serif",
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
    width: "100%",
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
    width: "100%",
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
    cursor: "pointer",
  },
  logoutBtnSidebar: {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "all 0.2s ease",
  },
  btnIcon: {
    width: "20px",
    height: "20px",
    objectFit: "contain",
  },
  contentWrapper: {
    flex: 1,
    marginLeft: "280px",
  },
  content: {
    minHeight: "100vh",
    padding: "8px 20px 40px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
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
  }
};

export default TopicDiscussion;