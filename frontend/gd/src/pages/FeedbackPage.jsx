import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

function FeedbackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [feedback, setFeedback] = useState(null);
  const [roundData, setRoundData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isNewEnd = location.state?.requiresEndDiscussion;
    const currentTopic = location.state?.topic;

    const loadData = async () => {
      setLoading(true);
      
      const feedbackStore = JSON.parse(localStorage.getItem("discussionFeedback") || "{}");

      try {
        // If coming directly from the End Discussion button, calculate feedback FIRST
        if (isNewEnd) {
          console.log("Generating fresh feedback...");
          const endRes = await fetch(`http://127.0.0.1:8001/end_discussion/${id}`, { method: "POST" });
          const endData = await endRes.json();
          if (endData && !endData.error) {
            feedbackStore[id] = { ...endData, topic: currentTopic };
            localStorage.setItem("discussionFeedback", JSON.stringify(feedbackStore));
          }
        }

        // Load the finalized data
        const res = await fetch(`http://127.0.0.1:8001/discussion/${id}/feedback`);
        const data = await res.json();

        if (data && !data.detail) {
          setRoundData(data);
          
          const localData = feedbackStore[String(id).trim()] || {};
          const dbData = data.evaluation || {};
          
          console.log("DB Payload:", dbData);
          console.log("Local Payload:", localData);
          
          const finalFeedback = {
            grammar: localData.grammar ?? dbData.grammar ?? null,
            clarity: localData.clarity ?? dbData.clarity ?? null,
            relevance: localData.relevance ?? dbData.relevance ?? null,
            politeness: localData.politeness ?? dbData.politeness ?? null,
            team_collaboration: localData.team_collaboration ?? dbData.team_collaboration ?? null,
            overall: localData.overall ?? dbData.overall ?? null,
            human_percentage: localData.human_percentage ?? dbData.human_percentage ?? null,
            human_interrupt_count: localData.human_interrupt_count ?? dbData.human_interrupt_count ?? data.discussion?.human_interrupt_count ?? null,
            strengths: (localData.strengths && localData.strengths.length > 0) ? localData.strengths : dbData.strengths || [],
            improvements: (localData.improvements && localData.improvements.length > 0) ? localData.improvements : dbData.improvements || [],
            final_feedback: localData.final_feedback ?? dbData.final_feedback ?? "",
            topic: localData.topic || data.discussion?.topic || "Discussion"
          };

          console.log("Merged Strategy Output:", finalFeedback);
          setFeedback(finalFeedback);

        } else if (feedbackStore[String(id).trim()]) {
          setFeedback(feedbackStore[String(id).trim()]);
        }
      } catch (err) {
        console.error("Could not fetch round data:", err);
        if (feedbackStore[String(id).trim()]) {
          setFeedback(feedbackStore[String(id).trim()]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, location.state]);

  // Get topic from either source
  const topic = feedback?.topic || roundData?.discussion?.topic || location.state?.topic || "Discussion";
  const hasEvaluationData = Boolean(
    feedback &&
    [
      feedback.grammar,
      feedback.clarity,
      feedback.relevance,
      feedback.politeness,
      feedback.team_collaboration,
      feedback.overall
    ].some((value) => value !== null && value !== undefined)
  );

  // Score bar component
  const ScoreBar = ({ label, score, max = 10, color = "#2563eb" }) => {
    // Safe check to prevent NaN width breaking the UI style
    const numericScore = score ?? 0;
    const pct = (numericScore / max) * 100;
    return (
      <div style={styles.scoreRow}>
        <div style={styles.scoreLabel}>{label}</div>
        <div style={styles.barContainer}>
          <div
            style={{
              ...styles.barFill,
              width: `${pct}%`,
              background: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
        <div style={styles.scoreValue}>{numericScore}/{max}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <p style={{ color: "#64748b", marginTop: 16 }}>Loading feedback...</p>
      </div>
    );
  }

  if (!feedback && !roundData) {
    return (
      <div style={styles.loadingPage}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h2 style={{ color: "#1e293b", marginBottom: 8 }}>No Feedback Available</h2>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          This discussion doesn't have feedback data yet. Complete a discussion to see results.
        </p>
        <button style={styles.backBtn} onClick={() => navigate("/home")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate("/home")}>
            ← Back
          </button>
          <div>
            <h1 style={styles.title}>Discussion Feedback</h1>
            <p style={styles.subtitle}>{topic}</p>
          </div>
        </div>

        {/* No evaluation data notice */}
        {!hasEvaluationData && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fbbf24",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            <div style={{ fontSize: "32px" }}>⚠️</div>
            <div>
              <h3 style={{ margin: "0 0 4px 0", color: "#92400e", fontSize: "16px" }}>
                No final evaluation saved for this session
              </h3>
              <p style={{ margin: 0, color: "#a16207", fontSize: "14px" }}>
                This may happen if the discussion ended before evaluation completed, or if there was a connection issue. 
                Start a new discussion to see full feedback results.
              </p>
            </div>
          </div>
        )}

        {/* Overall Score Card */}
        {feedback && hasEvaluationData && (
          <div style={styles.overallCard}>
            <div style={styles.overallScoreCircle}>
              <div style={styles.overallScoreNumber}>{feedback.overall ?? 0}</div>
              <div style={styles.overallScoreMax}>/10</div>
            </div>
            <div style={styles.overallInfo}>
              <h2 style={styles.overallTitle}>Overall Performance</h2>
              <p style={styles.overallSubtitle}>
                {(feedback.overall ?? 0) >= 8
                  ? "Excellent performance! 🌟"
                  : (feedback.overall ?? 0) >= 6
                  ? "Good job! Keep improving 👍"
                  : (feedback.overall ?? 0) >= 4
                  ? "Decent effort, room for growth 💪"
                  : "Needs significant improvement 📚"}
              </p>
            </div>
          </div>
        )}

        {/* Human Participation */}
        {feedback && feedback.human_percentage !== undefined && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🗣️ Speaking Time & Engagement</h3>
            <div style={styles.participationRow}>
              <div style={styles.participationBarBg}>
                <div
                  style={{
                    ...styles.participationBarFill,
                    width: `${Math.min(feedback.human_percentage || 0, 100)}%`,
                    background:
                      (feedback.human_percentage || 0) < 20
                        ? "#ef4444"
                        : (feedback.human_percentage || 0) > 40
                        ? "#f59e0b"
                        : "#10b981",
                  }}
                />
              </div>
              <span style={styles.participationPct}>{feedback.human_percentage || 0}%</span>
            </div>
            <p style={styles.participationNote}>
              {(feedback.human_percentage || 0) < 20
                ? "⚠️ Too low — try to contribute more actively"
                : (feedback.human_percentage || 0) > 40
                ? "⚠️ Dominating — give others more space to speak"
                : "✅ Balanced participation — well done!"}
            </p>
            
            {/* ✅ INTERRUPT ANALYSIS */}
            {feedback && feedback.human_interrupt_count !== undefined && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                  🔔 Interrupts Used: <strong>{feedback.human_interrupt_count}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                  {feedback.human_interrupt_count === 0
                    ? "No interrupts used. Consider engaging more proactively in discussions."
                    : feedback.human_interrupt_count === 1
                    ? "Good! You used one well-timed interrupt to share your perspective."
                    : feedback.human_interrupt_count <= 3
                    ? `👍 ${feedback.human_interrupt_count} interrupts used. Ensure they add value rather than disrupt flow.`
                    : `⚠️ ${feedback.human_interrupt_count} interrupts used. Try to be more strategic and concise with interrupts.`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Detailed Scores */}
        {feedback && hasEvaluationData && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📊 Detailed Scores</h3>
            <div style={styles.scoresGrid}>
              <ScoreBar label="Grammar" score={feedback.grammar} />
              <ScoreBar label="Clarity" score={feedback.clarity} />
              <ScoreBar label="Relevance" score={feedback.relevance} />
              <ScoreBar label="Politeness" score={feedback.politeness} />
              <ScoreBar label="Team Collaboration" score={feedback.team_collaboration} />
            </div>
          </div>
        )}

        {/* Strengths & Improvements */}
        {feedback && hasEvaluationData && (
          <div style={styles.twoColGrid}>
            <div style={{ ...styles.card, borderLeft: "4px solid #10b981" }}>
              <h3 style={styles.cardTitle}>💪 Strengths</h3>
              <ul style={styles.list}>
                {(feedback.strengths || []).map((s, i) => (
                  <li key={i} style={styles.listItem}>
                    <span style={styles.checkIcon}>✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ ...styles.card, borderLeft: "4px solid #f59e0b" }}>
              <h3 style={styles.cardTitle}>⚡ Areas to Improve</h3>
              <ul style={styles.list}>
                {(feedback.improvements || []).map((imp, i) => (
                  <li key={i} style={styles.listItem}>
                    <span style={styles.warnIcon}>!</span> {imp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Final Feedback */}
        {feedback && hasEvaluationData && feedback.final_feedback && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📝 Evaluator's Feedback</h3>
            <p style={styles.feedbackText}>{feedback.final_feedback}</p>
          </div>
        )}

        {/* Per-Round Scores */}
        {roundData && roundData.rounds && roundData.rounds.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📋 Per-Round Performance</h3>
            <div style={styles.roundsContainer}>
              {roundData.rounds.map((r, idx) => (
                <div key={idx} style={styles.roundCard}>
                  <div style={styles.roundHeader}>
                    <span style={styles.roundBadge}>Round {r.round_number}</span>
                  </div>
                  <p style={styles.roundText}>"{r.text}"</p>
                  <div style={styles.roundScores}>
                    {r.grammar_score !== null && (
                      <span style={styles.roundScoreTag}>
                        Grammar: {r.grammar_score}/10
                      </span>
                    )}
                    {r.clarity_score !== null && (
                      <span style={styles.roundScoreTag}>
                        Clarity: {r.clarity_score}/10
                      </span>
                    )}
                    {r.relevance_score !== null && (
                      <span style={styles.roundScoreTag}>
                        Relevance: {r.relevance_score}/10
                      </span>
                    )}
                    {r.politeness_score !== null && (
                      <span style={styles.roundScoreTag}>
                        Politeness: {r.politeness_score}/10
                      </span>
                    )}
                  </div>
                  {r.feedback && (
                    <p style={styles.roundFeedback}>{r.feedback}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
    padding: "40px 24px",
  },
  container: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    marginBottom: "32px",
  },
  backBtn: {
    padding: "10px 20px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    color: "#475569",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.025em",
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    fontSize: "15px",
    margin: "4px 0 0 0",
  },

  // Overall card
  overallCard: {
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    borderRadius: "20px",
    padding: "32px",
    display: "flex",
    alignItems: "center",
    gap: "32px",
    marginBottom: "24px",
    color: "#fff",
  },
  overallScoreCircle: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    border: "3px solid rgba(255,255,255,0.3)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  overallScoreNumber: {
    fontSize: "36px",
    fontWeight: "800",
    lineHeight: 1,
  },
  overallScoreMax: {
    fontSize: "14px",
    opacity: 0.6,
  },
  overallInfo: { flex: 1 },
  overallTitle: {
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 8px 0",
  },
  overallSubtitle: {
    fontSize: "16px",
    opacity: 0.8,
    margin: 0,
  },

  // Cards
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "28px",
    border: "1px solid #e2e8f0",
    marginBottom: "24px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#0f172a",
    margin: "0 0 20px 0",
  },

  // Participation bar
  participationRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "12px",
  },
  participationBarBg: {
    flex: 1,
    height: "20px",
    background: "#f1f5f9",
    borderRadius: "10px",
    overflow: "hidden",
  },
  participationBarFill: {
    height: "100%",
    borderRadius: "10px",
    transition: "width 0.8s ease",
  },
  participationPct: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
    minWidth: "60px",
    textAlign: "right",
  },
  participationNote: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0,
  },

  // Score bars
  scoresGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  scoreLabel: {
    width: "160px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#475569",
  },
  barContainer: {
    flex: 1,
    height: "12px",
    background: "#f1f5f9",
    borderRadius: "6px",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: "6px",
    transition: "width 0.8s ease",
  },
  scoreValue: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
    minWidth: "45px",
    textAlign: "right",
  },

  // Two column
  twoColGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginBottom: "0",
  },

  // Lists
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: "10px 0",
    fontSize: "14px",
    color: "#334155",
    lineHeight: "1.6",
    borderBottom: "1px solid #f8fafc",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  checkIcon: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: "16px",
    flexShrink: 0,
  },
  warnIcon: {
    color: "#f59e0b",
    fontWeight: "700",
    fontSize: "16px",
    background: "#fef3c7",
    borderRadius: "50%",
    width: "20px",
    height: "20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Feedback text
  feedbackText: {
    fontSize: "15px",
    lineHeight: "1.8",
    color: "#334155",
    margin: 0,
    background: "#f8fafc",
    padding: "20px",
    borderRadius: "12px",
    borderLeft: "4px solid #2563eb",
  },

  // Per-round
  roundsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  roundCard: {
    background: "#f8fafc",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e2e8f0",
  },
  roundHeader: {
    marginBottom: "12px",
  },
  roundBadge: {
    background: "#2563eb",
    color: "#fff",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  roundText: {
    fontSize: "14px",
    color: "#475569",
    fontStyle: "italic",
    margin: "0 0 12px 0",
    lineHeight: "1.6",
  },
  roundScores: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "8px",
  },
  roundScoreTag: {
    background: "#e2e8f0",
    padding: "4px 10px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#475569",
  },
  roundFeedback: {
    fontSize: "13px",
    color: "#64748b",
    margin: "8px 0 0 0",
    lineHeight: "1.6",
  },

  // Loading
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e2e8f0",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};

export default FeedbackPage;