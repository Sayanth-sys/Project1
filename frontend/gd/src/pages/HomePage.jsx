import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const handleLogout = () => {
    onLogout();
    navigate("/login", { replace: true });
  };

  return (
    <div style={styles.page}>
      {/* ONLY Top Navbar - No second header */}
      

      <div style={styles.container}>
        {/* SIDEBAR */}
        <div style={styles.sidebar}>
          <button style={styles.activeBtn}>
            <span style={styles.btnIcon}>🏠</span>
            Home
          </button>

          <button
            style={styles.btn}
            onClick={() => navigate("/topic-selection")}
          >
            <span style={styles.btnIcon}>💬</span>
            New Discussion
          </button>
        </div>

        {/* CONTENT */}
        <div style={styles.content}>
          <div style={styles.header}>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>Track your discussion activities</p>
          </div>

          <div style={styles.statsContainer}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{discussions.length}</div>
              <div style={styles.statLabel}>Total Discussions</div>
            </div>
            <div style={{...styles.statCard, ...styles.statCard2}}>
              <div style={styles.statNumber}>
                {discussions.reduce((sum, d) => sum + parseInt(d.duration || 0), 0)}
              </div>
              <div style={styles.statLabel}>Total Minutes</div>
            </div>
            <div style={{...styles.statCard, ...styles.statCard3}}>
              <div style={styles.statNumber}>
                {discussions.length > 0 ? Math.round(discussions.reduce((sum, d) => sum + parseInt(d.duration || 0), 0) / discussions.length) : 0}
              </div>
              <div style={styles.statLabel}>Avg Duration</div>
            </div>
          </div>

          <h2 style={styles.sectionTitle}>Recent Discussions</h2>

          {discussions.length === 0 ? (
            <div style={styles.emptyCard}>
              <div style={styles.emptyIcon}>💭</div>
              <h3 style={styles.emptyTitle}>No discussions yet</h3>
              <p style={styles.emptyText}>Start your first group discussion to see it here!</p>
              <button 
                style={styles.emptyBtn}
                onClick={() => navigate("/topic-selection")}
              >
                Start Discussion
              </button>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {discussions.map((d) => (
                <div key={d.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div style={styles.cardIcon}>📋</div>
                  </div>
                  <h3 style={styles.cardTitle}>{d.topic}</h3>
                  <div style={styles.cardMeta}>
                    <div style={styles.metaItem}>
                      <span style={styles.metaIcon}>📅</span>
                      <span>{d.date}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <span style={styles.metaIcon}>🕐</span>
                      <span>{d.time}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <span style={styles.metaIcon}>⏱️</span>
                      <span>{d.duration} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    overflowY: "auto"
  },
  header: {
    marginBottom: "30px"
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
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
    marginBottom: "40px"
  },
  statCard: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "25px",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    color: "#fff"
  },
  statCard2: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
  },
  statCard3: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
  },
  statNumber: {
    fontSize: "36px",
    fontWeight: "700",
    marginBottom: "8px"
  },
  statLabel: {
    fontSize: "14px",
    opacity: "0.9",
    fontWeight: "500"
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: "20px"
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "20px"
  },
  card: {
    background: "#fff",
    padding: "24px",
    borderRadius: "16px",
    boxShadow: "0 2px 15px rgba(0,0,0,0.08)",
    transition: "all 0.3s ease",
    cursor: "pointer",
    border: "2px solid transparent"
  },
  cardHeader: {
    marginBottom: "15px"
  },
  cardIcon: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px"
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: "15px",
    lineHeight: "1.4",
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  },
  cardMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#7f8c8d"
  },
  metaIcon: {
    fontSize: "16px"
  },
  emptyCard: {
    background: "#fff",
    padding: "60px 40px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 2px 15px rgba(0,0,0,0.08)"
  },
  emptyIcon: {
    fontSize: "64px",
    marginBottom: "20px",
    opacity: "0.5"
  },
  emptyTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: "10px"
  },
  emptyText: {
    color: "#7f8c8d",
    fontSize: "16px",
    marginBottom: "25px"
  },
  emptyBtn: {
    padding: "14px 32px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
    transition: "all 0.3s ease"
  }
};

export default HomePage;