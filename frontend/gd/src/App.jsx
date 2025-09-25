// App.jsx
// Single-file React app you can paste into src/App.jsx in a Vite + React project
// It contains Login, Topics selection, and Simulator pages (4 AI agents + user)
// The app expects a backend at /api for login, topics and simulator control, but also
// has a local `mock` mode when backend is not available. Change MOCK_BACKEND=false
// to use a real backend.

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
} from 'react-router-dom';
import './index.css';

const MOCK_BACKEND = true; // set to false when you wire a real backend

/* ------------------------- tiny API layer ------------------------- */
async function apiLogin({ username, password }) {
  if (MOCK_BACKEND) {
    if (!username) throw new Error('Username required');
    // return fake token
    return { token: 'mock-token-' + username, user: { name: username } };
  }
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGetTopics(token) {
  if (MOCK_BACKEND) {
    return [
      { id: 't1', title: 'Climate Change' },
      { id: 't2', title: 'AI Regulations' },
      { id: 't3', title: 'Space Exploration' },
    ];
  }
  const res = await fetch('/api/topics', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiStartSimulator(token, topicId) {
  if (MOCK_BACKEND) {
    return { sessionId: 'mock-session-' + Date.now() };
  }
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ topicId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiSendMessage(token, sessionId, message) {
  if (MOCK_BACKEND) {
    // simple echo + random agent reply simulation handled in frontend
    return { ok: true };
  }
  const res = await fetch(`/api/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ------------------------- Auth utilities ------------------------- */
function saveToken(token) {
  localStorage.setItem('authToken', token);
}
function loadToken() {
  return localStorage.getItem('authToken');
}
function clearToken() {
  localStorage.removeItem('authToken');
}

/* ------------------------- Pages & components ------------------------- */
function PrivateRoute({ children }) {
  const token = loadToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await apiLogin({ username, password });
      saveToken(token);
      navigate('/topics');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page center">
      <div className="card">
        <h2>Login</h2>
        <form onSubmit={submit} className="form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
      </div>
    </div>
  );
}

function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const t = await apiGetTopics(loadToken());
        if (mounted) setTopics(t);
      } catch (err) {
        setError(err.message || 'Failed to load topics');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, []);

  async function start(topicId) {
    try {
      const res = await apiStartSimulator(loadToken(), topicId);
      navigate(`/simulator/${res.sessionId}?topic=${topicId}`);
    } catch (err) {
      setError(err.message || 'Could not start simulator');
    }
  }

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h2>Choose a topic</h2>
        <div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main>
        {loading && <div>Loading topics...</div>}
        {error && <div className="error">{error}</div>}
        <div className="topics-grid">
          {topics.map((t) => (
            <div key={t.id} className="topic-card">
              <h3>{t.title}</h3>
              <button onClick={() => start(t.id)}>Start Discussion</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function SimulatorPage({ sessionId, topicId }) {
  const [messages, setMessages] = useState([]); // {sender,type,text}
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const agents = ['Agent A', 'Agent B', 'Agent C', 'Agent D'];
  const agentIndexRef = useRef(0);
  const simulateRef = useRef(null);

  useEffect(() => {
    // when page loads, inject a system message
    setMessages((m) => [...m, { sender: 'system', text: `Discussion started on topic ${topicId}` }]);
    return () => stopSimulation();
  }, [topicId]);

  function appendMessage(sender, text) {
    setMessages((m) => [...m, { sender, text }]);
  }

  async function sendUserMessage() {
    if (!input.trim()) return;
    const text = input.trim();
    appendMessage('You', text);
    setInput('');
    await apiSendMessage(loadToken(), sessionId, text);
    // in mock mode, starting AI replies handled by interval
  }

  function startSimulation() {
    if (running) return;
    setRunning(true);
    simulateRef.current = setInterval(() => {
      // each tick, one agent replies
      const idx = agentIndexRef.current % agents.length;
      const agent = agents[idx];
      const reply = mockAgentReply(agent, messages);
      appendMessage(agent, reply);
      agentIndexRef.current += 1;
    }, 2500);
  }

  function stopSimulation() {
    setRunning(false);
    if (simulateRef.current) {
      clearInterval(simulateRef.current);
      simulateRef.current = null;
    }
  }

  function mockAgentReply(agent, _messages) {
    // Very simple dumb reply generator. Replace with backend-driven replies.
    const phrases = [
      'I partly agree with that.',
      'That is an interesting point.',
      'Can you expand on that?',
      'I have a counterexample.',
      'From my perspective, we should consider...',
    ];
    return `${phrases[Math.floor(Math.random() * phrases.length)]} (${agent})`;
  }

  return (
    <div className="page simulator">
      <header className="topbar">
        <h2>Simulator — Topic: {topicId}</h2>
        <div>
          {!running ? (
            <button onClick={startSimulation}>Start</button>
          ) : (
            <button onClick={stopSimulation}>Pause</button>
          )}
        </div>
      </header>
      <main className="sim-main">
        <aside className="agents">
          <h3>Participants</h3>
          <ul>
            <li className="participant user">You</li>
            {agents.map((a) => (
              <li key={a} className="participant">{a}</li>
            ))}
          </ul>
        </aside>
        <section className="chat">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.sender === 'You' ? 'from-you' : ''}`}>
                <div className="sender">{m.sender}</div>
                <div className="text">{m.text}</div>
              </div>
            ))}
          </div>
          <div className="composer">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendUserMessage()} placeholder="Type your message" />
            <button onClick={sendUserMessage}>Send</button>
          </div>
        </section>
      </main>
    </div>
  );
}

function SimulatorRouteWrapper() {
  // read sessionId from url
  const params = new URLSearchParams(window.location.search);
  const topic = params.get('topic') || 'unknown';
  const { pathname } = window.location;
  const sessionId = pathname.split('/').pop();
  return <SimulatorPage sessionId={sessionId} topicId={topic} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/topics" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/topics" element={<PrivateRoute><TopicsPage /></PrivateRoute>} />
        <Route path="/simulator/:sessionId" element={<PrivateRoute><SimulatorRouteWrapper /></PrivateRoute>} />
        <Route path="*" element={<div style={{padding:20}}>404 — <Link to="/topics">Go home</Link></div>} />
      </Routes>
    </Router>
  );
}

export default App;

/* ------------------------- basic styles (paste into src/index.css) ------------------------- */

/*
:root{
  --bg:#0f1724; --card:#111827; --muted:#9ca3af; --accent:#60a5fa;
}
body{font-family:Inter,Segoe UI,Arial;background:var(--bg);color:#e6eef8;margin:0}
.page{padding:20px}
.center{display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#0b1220;padding:20px;border-radius:8px;min-width:320px;box-shadow:0 6px 18px rgba(0,0,0,0.6)}
.form label{display:block;margin-bottom:10px}
.form input{width:100%;padding:8px;margin-top:6px;border-radius:6px;border:none;background:#0a1320;color:#fff}
.form button{padding:10px 14px;border-radius:8px;border:none;margin-top:8px;cursor:pointer}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.topics-grid{display:flex;gap:12px;flex-wrap:wrap}
.topic-card{background:#071226;padding:16px;border-radius:8px;min-width:180px}
.error{color:#ff8a8a;margin-top:6px}
.sim-main{display:flex;gap:12px}
.agents{width:180px;background:#071226;padding:12px;border-radius:8px}
.participant{padding:8px;border-radius:6px;margin-bottom:8px;background:#0b1420}
.participant.user{font-weight:700}
.chat{flex:1;display:flex;flex-direction:column}
.messages{background:#06121a;padding:12px;border-radius:8px;flex:1;overflow:auto}
.message{margin-bottom:10px}
.message .sender{font-size:12px;color:var(--muted)}
.message .text{background:#0b1420;padding:8px;border-radius:8px;margin-top:6px}
.composer{display:flex;gap:8px;margin-top:8px}
.composer input{flex:1;padding:8px;border-radius:6px;border:none;background:#071226;color:#fff}
*/

/* ------------------------- mount ------------------------- */
const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

// End of file
