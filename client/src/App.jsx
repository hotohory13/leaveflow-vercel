import { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on startup
  useEffect(() => {
    const storedUser = localStorage.getItem('leaveflow_user');
    const storedToken = localStorage.getItem('leaveflow_token');

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        
        // Optionally verify token status on mount
        verifySession(storedToken);
      } catch (err) {
        console.error('Session restore failed', err);
        handleLogout();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifySession = async (sessionToken) => {
    const baseUrl = window.location.origin.includes('5173') 
      ? 'http://localhost:5000' 
      : window.location.origin;

    try {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) {
        // Token expired or invalid
        handleLogout();
        addToast('Session expired. Please log in again.', 'warning');
      }
    } catch (err) {
      console.warn('Backend server offline, staying in local session', err);
    } finally {
      setLoading(false);
    }
  };

  // Toast notifier function
  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto delete after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleLoginSuccess = (userData, sessionToken) => {
    setUser(userData);
    setToken(sessionToken);
    localStorage.setItem('leaveflow_user', JSON.stringify(userData));
    localStorage.setItem('leaveflow_token', sessionToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('leaveflow_user');
    localStorage.removeItem('leaveflow_token');
    addToast('Logged out successfully', 'success');
  };

  if (loading) {
    return (
      <div className="app-loader">
        <svg className="spinner" viewBox="0 0 50 50" width="40" height="40">
          <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" stroke="rgb(var(--color-primary))"></circle>
        </svg>
        <span>Loading LeaveFlow...</span>
        <style>{`
          .app-loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 1rem;
            color: var(--text-muted);
            font-family: var(--font-display);
            font-weight: 500;
          }
          .spinner {
            animation: rotate 2s linear infinite;
          }
          .spinner .path {
            stroke-linecap: round;
            animation: dash 1.5s ease-in-out infinite;
          }
          @keyframes rotate {
            100% { transform: rotate(360deg); }
          }
          @keyframes dash {
            0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
            50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
            100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {token ? (
        <Dashboard 
          user={user} 
          token={token} 
          onLogout={handleLogout} 
          addToast={addToast} 
        />
      ) : (
        <AuthPage 
          onLoginSuccess={handleLoginSuccess} 
          addToast={addToast} 
        />
      )}

      {/* Custom Toast Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' && (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
