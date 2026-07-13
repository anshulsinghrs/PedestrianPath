import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ onReport, onAuth, onToggleSidebar, view, onViewChange, theme, onThemeToggle, onHelp, onAdmin }) {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="nav-left">
        <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          ☰
        </button>
        <div className="brand">
          <span className="brand-icon" aria-hidden>🚶</span>
          <div className="brand-text">
            <strong>PedestrianPath — IIT KGP</strong>
            <small>Walkability, Routing &amp; Safety Platform</small>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="Primary view">
          <button
            className={`tab-btn ${view === 'routes' ? 'active' : ''}`}
            onClick={() => onViewChange('routes')}
          >
            Routes
          </button>
          <button
            className={`tab-btn ${view === 'map' ? 'active' : ''}`}
            onClick={() => onViewChange('map')}
          >
            Map
          </button>
          <button
            className={`tab-btn ${view === 'analytics' ? 'active' : ''}`}
            onClick={() => onViewChange('analytics')}
          >
            Analytics
          </button>
        </nav>
      </div>

      <div className="nav-right">
        <button
          className="icon-btn"
          onClick={onHelp}
          aria-label="Open reporting guide"
          title="Reporting guide"
        >
          ?
        </button>
        <button
          className="icon-btn"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="primary-btn" onClick={onReport}>
          + Report incident
        </button>
        {user ? (
          <div className="user-chip">
            <span>👤 {user.name}</span>
            {user.isAdmin && (
              <button className="link-btn" onClick={onAdmin} title="Admin dashboard">
                Admin
              </button>
            )}
            <button className="link-btn" onClick={logout}>Logout</button>
          </div>
        ) : (
          <button className="ghost-btn" onClick={onAuth}>Sign in</button>
        )}
      </div>
    </header>
  );
}
