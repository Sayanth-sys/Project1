import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import homeIcon from "../images/home-button.png";
import logoutIcon from "../images/power.png";
import addIcon from "../images/add.png";
import counterIcon from "../images/counter.png";
import clockIcon from "../images/clock.png";

function HomePage({ onLogout }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("User");
  const [discussions, setDiscussions] = useState([]);

  useEffect(() => {
    const name = sessionStorage.getItem("username");
    if (!name) {
      navigate("/login");
      return;
    }
    setUsername(name);

    const history = JSON.parse(localStorage.getItem("discussionHistory") || "[]");
    setDiscussions(history);
  }, [navigate]);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
        .discussion-card {
          background: #ffffff;
          padding: 40px 24px;
          border-radius: 16px;
          border: 2px solid #2563eb;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: #000000;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .discussion-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -15px rgba(37, 99, 235, 0.15);
        }
        .discussion-card .card-icon {
          width: 64px;
          height: 64px;
          background: rgba(37, 99, 235, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: #2563eb;
        }
        .discussion-card .card-topic {
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #000000;
        }
        .discussion-card .card-desc {
          font-size: 15px;
          color: #1e293b;
          margin-bottom: 32px;
          line-height: 1.6;
          padding: 0 10px;
        }
        .discussion-card .card-btn {
          padding: 12px 32px;
          border-radius: 50px;
          border: 2px solid #2563eb;
          background: transparent;
          color: #2563eb;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .discussion-card .card-btn:hover {
          background: #2563eb;
          color: #ffffff;
        }
        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 54px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
          letter-spacing: -1px;
          text-align: center;
        }
        .username-highlight {
          background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .section-title-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }
        .section-title {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .section-title-decorator {
          width: 8px;
          height: 32px;
          background: linear-gradient(to bottom, #2563eb, #8b5cf6);
          border-radius: 8px;
        }
      `}</style>
      <div style={styles.container}>

        {/* UPDATED SIDEBAR */}
        <div style={styles.sidebar}>
          {/* Top Section: Navigation */}
          <div style={styles.sidebarTop}>
            <div style={styles.sidebarBrand}>
              <div style={styles.brandIcon}>GD</div>
              <span style={styles.brandName}>SIMULATOR</span>
            </div>

            <p style={styles.sidebarLabel}>Main Menu</p>

            <button style={styles.activeBtn} onClick={() => navigate("/home")}>
              <img src={homeIcon} alt="Home" style={styles.btnIcon} />
              Home
            </button>

            <button
              style={styles.btn}
              onClick={() => navigate("/topic-selection")}
            >
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

        {/* MAIN CONTENT AREA */}
        <div style={styles.contentWrapper}>
          <div style={styles.content}>
            <header style={{ ...styles.header, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <h1 className="page-title">Welcome <span className="username-highlight"> {username}</span></h1>
              </div>
            </header>

            {/* LIST SECTION */}
            <div className="section-title-wrapper">
              <h2 className="section-title">Recent Discussions</h2>
            </div>

            {discussions.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIcon}>☁️</div>
                <h3 style={styles.emptyTitle}>No activity yet</h3>
                <p style={styles.emptyText}>Start a discussion session to begin tracking your history.</p>
                <button
                  style={styles.primaryBtn}
                  onClick={() => navigate("/topic-selection")}
                >
                  Start First Session
                </button>
              </div>
            ) : (
              <div style={styles.cardsGrid}>
                {discussions.map((d) => (
                  <div key={d.id} className="discussion-card">
                    <div className="card-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div className="card-topic">{d.topic}</div>
                    <div className="card-desc">
                      Session Date: {d.date}<br />
                      Duration: {d.duration} minutes<br />
                      Status: Completed
                    </div>
                    <button
                      className="card-btn"
                      onClick={() => navigate(`/feedback/${d.id}`)}
                    >
                      VIEW DETAILS
                    </button>
                  </div>
                ))}
              </div>
            )}
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
    justifyContent: "space-between", // Pushes top and bottom apart
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
    transition: "all 0.2s ease",
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
    padding: "8px 64px 48px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "40px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "16px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
  },
  badge: {
    background: "#e2e8f0",
    color: "#475569",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "24px",
  },
  card: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "20px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  cardCategory: {
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#2563eb",
  },
  cardDate: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1e293b",
    lineHeight: "1.4",
    marginBottom: "24px",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "16px",
    borderTop: "1px solid #f1f5f9",
  },
  durationTag: {
    fontSize: "13px",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
  },
  cardActionBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  emptyCard: {
    background: "#fff",
    padding: "80px 40px",
    borderRadius: "24px",
    textAlign: "center",
    border: "2px dashed #e2e8f0",
  },
  emptyIcon: {
    fontSize: "50px",
    marginBottom: "16px",
    opacity: "0.5",
  },
  emptyTitle: {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "8px",
  },
  emptyText: {
    color: "#64748b",
    marginBottom: "24px",
  },
  primaryBtn: {
    padding: "12px 32px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  }
};

export default HomePage;