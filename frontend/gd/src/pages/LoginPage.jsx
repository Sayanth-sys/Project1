import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem("username", username);
        if (data.access_token) {
          sessionStorage.setItem("token", data.access_token);
        }
        onLogin(username);
        navigate("/home");
      } else {
        const err = await response.json();
        setError(err.detail || "Invalid username or password");
      }
    } catch (err) {
      setError("Server not reachable. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw', 
      fontFamily: 'system-ui', 
      overflow: 'hidden' // Prevents any accidental scrollbars
    }}>
      {/* Left Side - Purple Gradient */}
      <div style={{
        flex: '1',
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center', // Centers content vertically
        padding: '40px',
        color: 'white',
        position: 'relative'
      }}>
        {/* Decorative Circle Container */}
        <div style={{
          width: 'min(300px, 40vh)', // Responsive sizing based on height
          height: 'min(300px, 40vh)',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '30px'
        }}>
          <div style={{ fontSize: 'clamp(60px, 10vh, 100px)' }}>🎤</div>
        </div>

        <div style={{ textAlign: 'center', maxWidth: '450px' }}>
          <h1 style={{ fontSize: 'clamp(24px, 4vh, 48px)', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2' }}>
            Master Your<br />Discussion Skills
          </h1>
          <p style={{ fontSize: 'clamp(14px, 2vh, 18px)', opacity: 0.9, lineHeight: '1.6' }}>
            Simulate real-world group discussions with advanced AI agents. Improve your critical thinking and articulation.
          </p>
        </div>
      </div>

      {/* Right Side - White Login Form */}
      <div style={{
        flex: '1',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Logo Section */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 4vh, 40px)' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#2563eb',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '28px'
            }}>
              💬
            </div>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#0f172a', 
              letterSpacing: '-0.5px', 
              fontFamily: "'Playfair Display', serif" 
            }}>GD Simulator</h2>
          </div>

          <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>Welcome back</h3>
          <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>Please enter your details to sign in.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Sayanth"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '14px', height: '14px' }} />
                Remember me
              </label>
              <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
                Forgot password?
              </a>
            </div>

            {error && (
              <div style={{
                padding: '10px',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
            Don't have an account?{' '}
            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signup');
              }}
              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;