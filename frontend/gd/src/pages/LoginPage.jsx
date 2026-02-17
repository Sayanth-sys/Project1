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
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
      {/* Left Side - Purple Gradient */}
      <div style={{
        flex: '0 0 50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative Circle */}
        <div style={{
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          <div style={{ fontSize: '120px' }}>🎤</div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginTop: '450px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.2' }}>
            Master Your<br />Discussion Skills
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, maxWidth: '450px', lineHeight: '1.6' }}>
            Simulate real-world group discussions with advanced AI agents. Improve your critical thinking and articulation.
          </p>
        </div>
      </div>

      {/* Right Side - White Login Form */}
      <div style={{
        flex: '0 0 50%',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px'
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#667eea',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '32px'
            }}>
              💬
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>GD Simulator</h2>
          </div>

          <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Welcome back</h3>
          <p style={{ color: '#6b7280', marginBottom: '32px' }}>Please enter your details to sign in.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
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
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
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
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                Remember me
              </label>
              <a href="#" style={{ fontSize: '14px', color: '#667eea', textDecoration: 'none', fontWeight: '600' }}>
                Forgot password?
              </a>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#9ca3af' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#5568d3')}
              onMouseLeave={(e) => !loading && (e.target.style.background = '#667eea')}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#6b7280' }}>
            Don't have an account?{' '}
            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signup');
              }}
              style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}
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