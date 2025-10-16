import React, { useState, useRef, useEffect } from "react";

const initialParticipants = [
  { name: "Agent 1", role: "Analytical Thinker", status: "waiting" },
  { name: "Agent 2", role: "Creative Strategist", status: "waiting" },
  { name: "Agent 3", role: "Pragmatic Advisor", status: "waiting" },
  { name: "Agent 4", role: "Innovation Expert", status: "waiting" }
];

function DiscussionPage({ topic = "AI Ethics and Governance" }) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [simId, setSimId] = useState(null);
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start simulation
  const startSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8001/start_simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic, num_agents: 4, rounds: 2 })
      });
      const data = await res.json();
      setSimId(data.simulation_id);
      
      // Update participants with actual personas
      if (data.agents) {
        setParticipants(prev => 
          prev.map((p, i) => ({
            ...p,
            name: data.agents[i]?.name || p.name,
            role: data.agents[i]?.persona || p.role
          }))
        );
      }
      
      console.log("✅ Simulation started:", data.simulation_id);
    } catch (err) {
      console.error("❌ Error starting simulation:", err);
      alert("Failed to start simulation");
    }
    setLoading(false);
  };

  // Fetch next round with streaming
  const fetchNextRound = async () => {
    if (!simId) return alert("Start simulation first!");
    setLoading(true);
    
    try {
      const response = await fetch(`http://127.0.0.1:8001/next_round/${simId}`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;
            
            try {
              const data = JSON.parse(jsonStr);
              console.log("📨 Received:", data);
              if (data.type === 'thinking') {
              console.log(`💭 ${data.agent} is thinking...`);
              // Show agent is thinking
              setParticipants(prev =>
                prev.map(p =>
                  p.name === data.agent
                    ? { ...p, status: 'thinking' }
                    : { ...p, status: 'waiting' }
                )
              );

              // Add thinking indicator to messages
              setMessages(prev => [...prev, {
                id: `thinking-${Date.now()}`,
                agent: data.agent,
                role: participants.find(p => p.name === data.agent)?.role || '',
                text: '',
                isThinking: true
              }]);

            } if (data.type === 'response') {
  console.log(`✅ ${data.agent} responded:`, data.text);

  // Update status to "speaking"
  setParticipants(prev =>
    prev.map(p =>
      p.name === data.agent
        ? { ...p, status: 'speaking' }
        : p
    )
  );

  // Remove thinking indicator (if any)
  setMessages(prev => {
    const filtered = prev.filter(m => !(m.agent === data.agent && m.isThinking));
    return [...filtered, {
      id: `msg-${Date.now()}`,
      agent: data.agent,
      role: participants.find(p => p.name === data.agent)?.role || '',
      text: data.text,
      isThinking: false
    }];
  });

  // 🎧 Play audio and wait for it to finish
  if (data.audio) {
    await new Promise((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audio.onended = resolve;
      audio.onerror = () => {
        console.warn("Audio play error");
        resolve();
      };
      audio.play();
    });
  }

  // After speaking ends
  setParticipants(prev =>
    prev.map(p =>
      p.name === data.agent
        ? { ...p, status: 'spoke' }
        : p
    )
  );
}

 else if (data.type === 'complete') {
              console.log(`🎉 Round ${data.round} complete`);
              setRound(data.round);
              setParticipants(prev =>
                prev.map(p => ({ ...p, status: 'waiting' }))
              );
            }

              
            } catch (e) {
              console.error("❌ Error parsing SSE data:", e, "Raw:", jsonStr);
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Error fetching next round:", err);
      alert("Failed to fetch next round. Check console for details.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f5f5f5'
    }}>
      {/* Participants Sidebar */}
      <div style={{
        width: '300px',
        background: 'white',
        borderRight: '1px solid #e0e0e0',
        overflowY: 'auto'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e0e0e0',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>
          Participants
        </div>
        {participants.map((p) => (
          <div key={p.name} style={{
            padding: '15px',
            borderBottom: '1px solid #f0f0f0',
            background: p.status === 'thinking' ? '#fff3cd' : 
                       p.status === 'spoke' ? '#d4edda' : 'white',
            transition: 'background 0.3s'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: '10px'
            }}></div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{p.name}</div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{p.role}</div>
            <div style={{ 
              fontSize: '11px', 
              color: p.status === 'thinking' ? '#856404' : 
                     p.status === 'spoke' ? '#155724' : '#999',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {p.status === 'thinking' ? '💭 Thinking...' :
               p.status === 'spoke' ? '✓ Just spoke' : 'Waiting'}
            </div>
          </div>
        ))}
      </div>

      {/* Main Discussion */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            AI Group Discussion
          </div>
          <div style={{ color: '#666', marginBottom: '15px' }}>
            Topic: {topic || "Topic not set"}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={startSimulation} 
              disabled={loading || simId !== null}
              style={{
                padding: '10px 20px',
                background: simId ? '#28a745' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: simId ? 'not-allowed' : 'pointer',
                opacity: (loading && !simId) || simId ? 0.7 : 1
              }}
            >
              {loading && !simId ? "Starting..." : simId ? "✓ Simulation Started" : "Start Simulation"}
            </button>
            <button 
              onClick={fetchNextRound} 
              disabled={!simId || loading}
              style={{
                padding: '10px 20px',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: !simId || loading ? 'not-allowed' : 'pointer',
                opacity: !simId || loading ? 0.5 : 1
              }}
            >
              {loading ? "⏳ In Progress..." : "Next Round"}
            </button>
          </div>
        </div>

        {/* Discussion Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#f9f9f9'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#999',
              marginTop: '40px',
              fontSize: '16px'
            }}>
              Start the simulation and click "Next Round" to begin the discussion
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{
                background: 'white',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.3s ease-out'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    marginRight: '10px'
                  }}></div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{msg.agent}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{msg.role}</div>
                  </div>
                </div>
                {msg.isThinking ? (
                  <div style={{
                    color: '#666',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>💭</div>
                    Thinking...
                  </div>
                ) : (
                  <div style={{ color: '#333', lineHeight: '1.6' }}>{msg.text}</div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{
          background: 'white',
          padding: '15px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          color: '#666'
        }}>
          <span>{loading ? '🔴 Processing...' : '⚪ Ready'}</span>
          <span>Round {round}</span>
          <span>{participants.length} participants</span>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default DiscussionPage;