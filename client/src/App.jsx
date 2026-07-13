import { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import MapView from './components/MapView.jsx';
import RoutePlanner from './components/RoutePlanner.jsx';
import ModulePicker from './components/ModulePicker.jsx';
import Module1Form from './components/Module1Form.jsx';
import Module2Form from './components/Module2Form.jsx';
import Module3Form from './components/Module3Form.jsx';
import AuthModal from './components/AuthModal.jsx';
import IncidentDetail from './components/IncidentDetail.jsx';
import AnalyticsDashboard from './components/AnalyticsDashboard.jsx';
import PilotGate from './components/PilotGate.jsx';
import BackendStatusBanner from './components/BackendStatusBanner.jsx';
import HelpGuide from './components/HelpGuide.jsx';
import WelcomeModal, { hasSeenWelcome } from './components/WelcomeModal.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import VerifyEmailPage from './components/VerifyEmailPage.jsx';
import { useIncidents } from './context/IncidentContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { fetchDeploymentConfig } from './services/api.js';
import { fetchLocationContext } from './services/locationContext.js';
import { cityConfig } from './config/city.js';

export default function App() {
  const [pendingModule, setPendingModule] = useState(null); // chosen via picker
  const [showPicker, setShowPicker] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedLocation, setPickedLocation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('map');
  const [theme, setTheme] = useState(
    () => localStorage.getItem('alertcycle-theme') || 'light'
  );
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  // ?verify=TOKEN in the URL triggers the email-verification landing
  // page, which short-circuits the rest of the app until handled.
  const [verifyToken, setVerifyToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('verify');
  });
  const { selectedIncident, setSelectedIncident } = useIncidents();
  const { user } = useAuth();

  // Server is authoritative on the Module 3 flag. The client config is
  // a build-time hint; the server check overrides it.
  const [module3Enabled, setModule3Enabled] = useState(cityConfig.module3Enabled);
  useEffect(() => {
    fetchDeploymentConfig()
      .then((c) => setModule3Enabled(!!c.module3Enabled))
      .catch(() => {
        /* keep build-time hint */
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('alertcycle-theme', theme);
  }, [theme]);

  const startReporting = () => {
    setView('map');
    setShowPicker(true);
  };

  const handleModulePick = (mod) => {
    setPendingModule(mod);
    setShowPicker(false);
    setPickingLocation(true);
    setSidebarOpen(false);
  };

  const handleMapPick = (latlng) => {
    setPickedLocation(latlng);
    setPickingLocation(false);
    // Fire-and-forget auto-detection of weather + road type. Updates
    // the picked location once the values are back so the module
    // forms can drop them straight into the payload.
    fetchLocationContext({ lat: latlng.lat, lng: latlng.lng })
      .then((ctx) => {
        if (ctx && (ctx.weather || ctx.roadType)) {
          setPickedLocation((cur) =>
            cur ? { ...cur, autoContext: ctx } : cur
          );
        }
      })
      .catch(() => {
        /* never block submission on auto-detect failure */
      });
  };

  const closeReport = () => {
    setPickedLocation(null);
    setPendingModule(null);
  };

  if (verifyToken) {
    return (
      <div className="app" data-theme={theme}>
        <VerifyEmailPage
          token={verifyToken}
          onContinue={() => {
            // Strip ?verify=... so a refresh doesn't re-trigger the page.
            const url = new URL(window.location.href);
            url.searchParams.delete('verify');
            window.history.replaceState({}, '', url.pathname + url.search);
            setVerifyToken(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme}>
      <BackendStatusBanner />
      <PilotGate />
      <Navbar
        onReport={startReporting}
        onAuth={() => setShowAuth(true)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        view={view}
        onViewChange={setView}
        theme={theme}
        onThemeToggle={() =>
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
        }
        onHelp={() => setShowHelp(true)}
        onAdmin={() => setShowAdmin(true)}
      />

      <div className={`main ${sidebarOpen && view === 'map' ? 'sidebar-open' : ''}`}>
        {sidebarOpen && view === 'map' && (
          <>
            <div
              className="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </>
        )}

        <div className="map-container">
          {view === 'analytics' ? (
            <AnalyticsDashboard module3Enabled={module3Enabled} />
          ) : (
            <>
              {pickingLocation && (
                <div className="picking-banner">
                  📍 Click on or near a road to mark the incident location
                  <button
                    onClick={() => {
                      setPickingLocation(false);
                      setPendingModule(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <MapView
                pickingLocation={pickingLocation}
                onMapPick={handleMapPick}
              />
              {view === 'routes' && <RoutePlanner />}
              {view === 'map' && !pickingLocation && !pendingModule && (
                <button
                  type="button"
                  className="report-fab"
                  onClick={startReporting}
                  aria-label="Report an incident"
                >
                  <span className="report-fab-plus" aria-hidden>+</span>
                  <span className="report-fab-label">Report</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showPicker && (
        <ModulePicker
          onPick={handleModulePick}
          onClose={() => setShowPicker(false)}
          module3Enabled={module3Enabled}
        />
      )}

      {pickedLocation && pendingModule === 'accident_conflict' && (
        <Module1Form location={pickedLocation} onClose={closeReport} />
      )}
      {pickedLocation && pendingModule === 'hazard_infrastructure' && (
        <Module2Form location={pickedLocation} onClose={closeReport} />
      )}
      {pickedLocation && pendingModule === 'personal_safety' && (
        <Module3Form location={pickedLocation} onClose={closeReport} />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {showWelcome && (
        <WelcomeModal
          onClose={() => setShowWelcome(false)}
          onStartTour={() => {
            setShowWelcome(false);
            setShowTour(true);
          }}
        />
      )}
      {showTour && <OnboardingTour onClose={() => setShowTour(false)} />}
      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}

      {selectedIncident && (
        <IncidentDetail
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {showAdmin && user?.isAdmin && (
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
