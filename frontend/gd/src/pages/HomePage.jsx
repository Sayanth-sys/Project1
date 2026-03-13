import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
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
      <div style={styles.container}>
        {/* SIDEBAR */}
        <div style={styles.sidebar}>

          <button style={styles.activeBtn}>
            <span style={styles.btnIcon}>🏠</span>
            Dashboard
          </button>

          <button
            style={styles.btn}
            onClick={() => navigate("/topic-selection")}
          >
            <span style={styles.btnIcon}>➕</span>
            New Session
          </button>
          
          <div style={styles.sidebarDivider} />
          
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={styles.contentWrapper}>
          <div style={styles.content}>
            <header style={styles.header}>
              <div>
                <h1 style={styles.title}>Welcome back, {username}</h1>
                <p style={styles.subtitle}>Manage your discussions and track your progress.</p>
              </div>
             
            </header>

            {/* STATS SECTION */}
            <div style={styles.statsContainer}>
              <div style={styles.statCard}>
                <div style={styles.statIconBox}>📊</div>
                <div>
                  <div style={styles.statLabel}>Total Sessions</div>
                  <div style={styles.statNumber}>{discussions.length}</div>
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={{...styles.statIconBox, background: '#ecfdf5', color: '#10b981'}}>⏱️</div>
                <div>
                  <div style={styles.statLabel}>Total Time</div>
                  <div style={styles.statNumber}>
                    {discussions.reduce((sum, d) => sum + parseInt(d.duration || 0), 0)}
                    <span style={styles.unit}> min</span>
                  </div>
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={{...styles.statIconBox, background: '#eff6ff', color: '#2563eb'}}>🎯</div>
                <div>
                  <div style={styles.statLabel}>Avg. Duration</div>
                  <div style={styles.statNumber}>
                    {discussions.length > 0 ? Math.round(discussions.reduce((sum, d) => sum + parseInt(d.duration || 0), 0) / discussions.length) : 0}
                    <span style={styles.unit}> min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LIST SECTION */}
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Recent Discussions</h2>
              {discussions.length > 0 && <span style={styles.badge}>{discussions.length} Total</span>}
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
                  <div key={d.id} style={styles.card}>
                    <div style={styles.cardTop}>
                      <span style={styles.cardCategory}>Discussion</span>
                      <span style={styles.cardDate}>{d.date}</span>
                    </div>
                    <h3 style={styles.cardTitle}>{d.topic}</h3>
                    <div style={styles.cardFooter}>
                      <div style={styles.durationTag}>
                        <span style={{marginRight: '4px'}}>🕒</span> {d.duration} mins
                      </div>
                      <button 
                        style={styles.cardActionBtn}
                        onClick={() => navigate(`/feedback/${d.id}`)}
                      >
                        Details →
                      </button>
                    </div>
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
    transition: "all 0.2s ease",
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
    marginLeft: "280px", // Offset for fixed sidebar
  },
  content: { 
    padding: "48px 64px",
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
    letterSpacing: "-0.025em",
    marginBottom: "8px",
  },
  subtitle: { 
    color: "#64748b", 
    fontSize: "16px",
  },
  createMainBtn: {
    padding: "12px 24px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "24px",
    marginBottom: "48px",
  },
  statCard: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "20px",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  statIconBox: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },
  statLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#64748b",
  },
  statNumber: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#0f172a",
  },
  unit: {
    fontSize: "14px",
    fontWeight: "400",
    color: "#94a3b8",
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
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
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
    letterSpacing: "0.05em",
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