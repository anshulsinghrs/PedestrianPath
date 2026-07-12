import { useState } from 'react';
import LocationField from './LocationField.jsx';
import { useRoutes, PROFILE_COLORS } from '../context/RouteContext.jsx';

/**
 * RoutePlanner — the intelligent pedestrian route planner panel.
 *
 * Users pick a start + destination, optionally tune priority sliders
 * (safer / greener / more accessible / faster …), and get several ranked
 * routes back: Fastest, Shortest, Safest, Most Comfortable, an AI
 * Recommended overall-optimum, and — when priorities are set — a bespoke
 * Custom route. Each card surfaces distance, walking time and the four
 * 0–100 scores. Selecting a card highlights that route on the map.
 */

const SLIDERS = [
  ['safety', 'Prefer safer streets'],
  ['greenery', 'Prefer greener routes'],
  ['sidewalks', 'Prefer good sidewalks'],
  ['comfort', 'Prefer comfortable / calmer'],
  ['accessibility', 'Prefer step-free / accessible'],
  ['speed', 'Prefer faster'],
];

function ScorePill({ label, value, color }) {
  return (
    <div className="rp-score-pill" title={`${label}: ${value}/100`}>
      <span className="rp-score-label">{label}</span>
      <span className="rp-score-track">
        <span
          className="rp-score-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </span>
      <span className="rp-score-value">{Math.round(value)}</span>
    </div>
  );
}

function RouteCard({ route, active, isRecommended, onSelect }) {
  const color = PROFILE_COLORS[route.profile] || '#64748b';
  const mins = route.walkingTimeMinutes;
  const dist =
    route.distanceMeters >= 1000
      ? `${(route.distanceMeters / 1000).toFixed(2)} km`
      : `${route.distanceMeters} m`;
  return (
    <button
      type="button"
      className={`rp-card ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(route.profile)}
      style={{ '--route-color': color }}
    >
      <div className="rp-card-head">
        <span className="rp-card-swatch" style={{ background: color }} />
        <strong className="rp-card-title">{route.label}</strong>
        {isRecommended && <span className="rp-card-badge">★ AI pick</span>}
      </div>
      <div className="rp-card-meta">
        <span>🕒 {mins} min</span>
        <span>📏 {dist}</span>
        {route.stepSegments > 0 && <span>🪜 {route.stepSegments} steps</span>}
        {route.sameAs && <span className="rp-card-same">= {route.sameAs}</span>}
      </div>
      <div className="rp-card-scores">
        <ScorePill label="Walk" value={route.walkabilityScore} color="#16a34a" />
        <ScorePill label="Safe" value={route.safetyScore} color="#2563eb" />
        <ScorePill label="Comfort" value={route.comfortScore} color="#7c3aed" />
        <ScorePill label="Access" value={route.accessibilityScore} color="#d97706" />
      </div>
    </button>
  );
}

export default function RoutePlanner() {
  const {
    origin,
    setOrigin,
    destination,
    setDestination,
    priorities,
    setPriorities,
    routes,
    recommended,
    activeProfile,
    setActiveProfile,
    meta,
    planning,
    error,
    plan,
    clearRoutes,
    showWalkabilityHeatmap,
    setShowWalkabilityHeatmap,
  } = useRoutes();

  const [showAdvanced, setShowAdvanced] = useState(false);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const setSlider = (key, value) =>
    setPriorities((p) => ({ ...p, [key]: value }));
  const toggle = (key) => setPriorities((p) => ({ ...p, [key]: !p[key] }));

  return (
    <aside className="route-planner" aria-label="Pedestrian route planner">
      <div className="rp-header">
        <h2>🚶 Plan a walk</h2>
        <p>Not just the shortest — the best route by walkability, safety, comfort and access.</p>
      </div>

      <div className="rp-inputs">
        <LocationField
          label="Start"
          placeholder="Search start, or use 📍"
          value={origin}
          onChange={setOrigin}
          allowMyLocation
        />
        <button type="button" className="rp-swap" onClick={swap} title="Swap start and destination">
          ⇅
        </button>
        <LocationField
          label="Destination"
          placeholder="Search destination"
          value={destination}
          onChange={setDestination}
        />
      </div>

      <button
        type="button"
        className="rp-advanced-toggle"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? '▾' : '▸'} Customise priorities
      </button>

      {showAdvanced && (
        <div className="rp-advanced">
          {SLIDERS.map(([key, labelText]) => (
            <label key={key} className="rp-slider">
              <span className="rp-slider-label">{labelText}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={priorities[key]}
                onChange={(e) => setSlider(key, parseFloat(e.target.value))}
              />
            </label>
          ))}
          <div className="rp-toggles">
            <label className="rp-toggle">
              <input
                type="checkbox"
                checked={priorities.avoidStairs}
                onChange={() => toggle('avoidStairs')}
              />
              Avoid stairs
            </label>
            <label className="rp-toggle">
              <input
                type="checkbox"
                checked={priorities.wheelchair}
                onChange={() => toggle('wheelchair')}
              />
              Wheelchair-friendly
            </label>
          </div>
        </div>
      )}

      <div className="rp-actions">
        <button
          type="button"
          className="rp-plan-btn"
          onClick={plan}
          disabled={planning || !origin || !destination}
        >
          {planning ? 'Finding best routes…' : 'Find best routes'}
        </button>
        {routes.length > 0 && (
          <button type="button" className="rp-clear-btn" onClick={clearRoutes}>
            Clear
          </button>
        )}
      </div>

      <label className="rp-heatmap-toggle">
        <input
          type="checkbox"
          checked={showWalkabilityHeatmap}
          onChange={(e) => setShowWalkabilityHeatmap(e.target.checked)}
        />
        Show walkability heatmap
      </label>

      {error && <div className="rp-error" role="alert">{error}</div>}

      {routes.length > 0 && (
        <div className="rp-results">
          <div className="rp-results-head">
            {routes.length} route option{routes.length > 1 ? 's' : ''}
            {meta?.incidentsConsidered > 0 && (
              <span className="rp-results-sub">
                · {meta.incidentsConsidered} nearby report
                {meta.incidentsConsidered > 1 ? 's' : ''} factored in
              </span>
            )}
          </div>
          {routes.map((route) => (
            <RouteCard
              key={route.profile}
              route={route}
              active={activeProfile === route.profile}
              isRecommended={recommended === route.profile}
              onSelect={setActiveProfile}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
