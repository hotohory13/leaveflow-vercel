import { useState } from 'react';

export default function AuthPage({ onLoginSuccess, addToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      addToast('Please enter both username and password', 'error');
      return;
    }

    if (!isLogin && (!firstName.trim() || !lastName.trim())) {
      addToast('Please enter both your first and last name', 'error');
      return;
    }

    if (!isLogin && password.length < 6) {
      addToast('Password must be at least 6 characters long', 'error');
      return;
    }

    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { username, password } 
      : { username, password, firstName, lastName, startDate };

    try {
      // Connect to host (assume backend runs on same host/port in production, or fallback to localhost:5000 in dev)
      const baseUrl = window.location.origin.includes('5173') 
        ? 'http://localhost:5000' 
        : window.location.origin;

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      addToast(isLogin ? 'Welcome back!' : 'Account created successfully!', 'success');
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Connection to server failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-split-info">
        <div className="auth-brand">
          <div className="brand-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>LeaveFlow</span>
          </div>
          <span className="brand-badge">Engineering Faculty Portal</span>
        </div>

        <div className="auth-info-content">
          <h1>Effortless Leave Tracking for TAs</h1>
          <p>
            An internal portal designed for Teaching Assistants and faculty members to monitor quotas, apply for leaves, and stay aligned with faculty rules.
          </p>

          <div className="policy-cards">
            <div className="policy-card">
              <div className="policy-icon green-glow">21</div>
              <div>
                <h4>Established TAs</h4>
                <p>21 days of annual leave resetting every academic year on Sept 1st.</p>
              </div>
            </div>

            <div className="policy-card">
              <div className="policy-icon blue-glow">3</div>
              <div>
                <h4>New TAs (First 6 months)</h4>
                <p>3 days of leave maximum during the initial 6-month trial window.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-info-footer">
          &copy; 2026 Faculty of Engineering. All rights reserved.
        </div>
      </div>

      <div className="auth-split-form">
        <div className="glass-card auth-card animate-slide-up">
          <div className="auth-tabs">
            <button 
              type="button" 
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setUsername(''); setPassword(''); setFirstName(''); setLastName(''); }}
            >
              Sign In
            </button>
            <button 
              type="button" 
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setUsername(''); setPassword(''); setFirstName(''); setLastName(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <h3 className="auth-form-title">
              {isLogin ? 'Welcome Back' : 'Create TA Account'}
            </h3>
            <p className="auth-form-subtitle">
              {isLogin ? 'Sign in to access your leave calendar' : 'Fill in details to compute your legal leave limits'}
            </p>

            {!isLogin && (
              <div className="name-fields-row animate-fade-in">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ahmed"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Aly"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="username">Username / Email</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. k.ahmed"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {!isLogin && (
              <>
                <div className="form-group animate-fade-in">
                  <label className="form-label" htmlFor="startDate">Employment Start Date</label>
                  <input
                    id="startDate"
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="field-hint">
                    Used to calculate the 6-month trial window (3 days limit vs 21 days limit)
                  </p>
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 50 50">
                    <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                  </svg>
                  Processing...
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Styled JSX for Auth Layout that does not fit easily in index.css */}
      <style>{`
        .auth-container {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          min-height: 100vh;
          width: 100vw;
        }

        .auth-split-info {
          background: radial-gradient(circle at 10% 20%, rgba(13, 20, 38, 0.9) 0%, rgba(4, 7, 19, 0.98) 100%);
          border-right: 1px solid var(--border-card);
          padding: 3rem 4rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .auth-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-display);
          font-size: 1.35rem;
          font-weight: 800;
          color: rgb(var(--color-primary));
        }

        .brand-badge {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-card);
          padding: 0.2rem 0.6rem;
          border-radius: 100px;
          color: var(--text-muted);
        }

        .auth-info-content {
          max-width: 520px;
          margin: auto 0;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .auth-info-content h1 {
          font-size: 2.75rem;
          line-height: 1.15;
          font-weight: 800;
          background: linear-gradient(135deg, #f8fafc 30%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .auth-info-content p {
          color: var(--text-muted);
          font-size: 1.1rem;
          line-height: 1.6;
        }

        .policy-cards {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }

        .policy-card {
          display: flex;
          gap: 1.25rem;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1.25rem;
          border-radius: var(--radius-md);
        }

        .policy-icon {
          width: 3rem;
          height: 3rem;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.25rem;
        }

        .green-glow {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(var(--color-green));
          border: 1px solid rgba(16, 185, 129, 0.25);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.1);
        }

        .blue-glow {
          background: rgba(56, 189, 248, 0.1);
          color: rgb(var(--color-primary));
          border: 1px solid rgba(56, 189, 248, 0.25);
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
        }

        .policy-card h4 {
          font-size: 0.95rem;
          margin-bottom: 0.15rem;
        }

        .policy-card p {
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .auth-info-footer {
          font-size: 0.8rem;
          color: var(--text-dim);
        }

        .auth-split-form {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          background-color: var(--bg-main);
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 2.5rem;
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid var(--border-card);
          margin-bottom: 2rem;
        }

        .auth-tab {
          background: none;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 1rem;
          padding-bottom: 0.75rem;
          cursor: pointer;
          position: relative;
          text-align: center;
          transition: color var(--transition-fast);
        }

        .auth-tab:hover {
          color: var(--text-primary);
        }

        .auth-tab.active {
          color: rgb(var(--color-primary));
        }

        .auth-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 2px;
          background-color: rgb(var(--color-primary));
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
        }

        .name-fields-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
        }

        .auth-form-title {
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
        }

        .auth-form-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 1.75rem;
        }

        .field-hint {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin-top: 0.2rem;
        }

        .w-full {
          width: 100%;
        }

        .mt-4 {
          margin-top: 1rem;
        }

        /* Spinner */
        .spinner {
          animation: rotate 2s linear infinite;
          width: 1.25rem;
          height: 1.25rem;
        }
        
        .spinner .path {
          stroke: #040815;
          stroke-linecap: round;
          animation: dash 1.5s ease-in-out infinite;
        }

        @keyframes rotate {
          100% { transform: rotate(360deg); }
        }

        @keyframes dash {
          0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
          }
          100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
          }
        }

        @media (max-width: 968px) {
          .auth-container {
            grid-template-columns: 1fr;
          }
          .auth-split-info {
            padding: 3rem 2rem;
            border-right: none;
            border-bottom: 1px solid var(--border-card);
          }
          .auth-info-content {
            margin: 3rem 0;
          }
          .auth-split-form {
            padding: 3rem 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
