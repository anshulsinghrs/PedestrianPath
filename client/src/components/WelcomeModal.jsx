/**
 * First-run welcome modal. Shown automatically when localStorage has
 * no record of the user dismissing or completing onboarding before.
 *
 * Three exit paths:
 *   - "Get started"  → marks seen, closes
 *   - "Take a tour"  → marks seen, closes, opens the OnboardingTour
 *   - "Don't show again" checkbox + close → same as Get started but
 *     also locks the welcome out permanently
 */
const WELCOME_KEY = 'pathguard-welcome-seen';

export function hasSeenWelcome() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(WELCOME_KEY) === '1';
}

export function markWelcomeSeen() {
  localStorage.setItem(WELCOME_KEY, '1');
}

export default function WelcomeModal({ onClose, onStartTour }) {
  const finish = () => {
    markWelcomeSeen();
    onClose();
  };
  const tour = () => {
    markWelcomeSeen();
    onStartTour();
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal modal-welcome"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="welcome-hero">
          <div className="welcome-emoji" aria-hidden>🛡️</div>
          <h2>Welcome to PathGuard</h2>
          <p className="welcome-tagline">
            Urban Mobility Safety Platform · IIT KGP
          </p>
        </div>

        <div className="welcome-body">
          <p>
            PathGuard helps identify mobility and safety risks by letting
            citizens report accidents, infrastructure hazards, and
            personal-safety concerns on an interactive city map.
          </p>
          <p>
            Your reports contribute to safer streets, better urban
            planning, and academic research on vulnerable road users.
          </p>

          <div className="welcome-pillars">
            <div className="welcome-pillar">
              <div className="welcome-pillar-emoji">🚲</div>
              <strong>Report</strong>
              <span>Accidents, hazards & safety concerns</span>
            </div>
            <div className="welcome-pillar">
              <div className="welcome-pillar-emoji">📍</div>
              <strong>Pin</strong>
              <span>Mark the exact location on the map</span>
            </div>
            <div className="welcome-pillar">
              <div className="welcome-pillar-emoji">📊</div>
              <strong>Improve</strong>
              <span>See aggregate analytics & hotspots</span>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="ghost-btn" onClick={tour}>
            Take a quick tour
          </button>
          <button className="primary-btn" onClick={finish}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
