import { useIncidents, ALL_MODES, ALL_SEVERITIES } from '../context/IncidentContext.jsx';
import {
  typeLabels,
  typeColors,
  modeLabels,
  modeEmoji,
  severityLabels,
} from '../utils/incidentTypes.js';

export default function Sidebar({ onClose }) {
  const {
    filters,
    setFilters,
    incidents,
    allCount,
    loading,
    setSelectedIncident,
    mapLayers,
    setMapLayers,
    kdeLoading,
    module3Enabled,
  } = useIncidents();

  const toggle = (key, value) =>
    setFilters((f) => {
      const next = f[key].includes(value)
        ? f[key].filter((t) => t !== value)
        : [...f[key], value];
      return { ...f, [key]: next };
    });

  const setLayer = (key, value) =>
    setMapLayers((l) => ({ ...l, [key]: value }));

  const setRange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearDates = () => setFilters((f) => ({ ...f, from: '', to: '' }));
  const showAllModes = () => setFilters((f) => ({ ...f, modes: [...ALL_MODES] }));

  const modeCounts = ALL_MODES.reduce((acc, m) => {
    acc[m] = incidents.filter((i) => (i.mobilityMode || 'cyclist') === m).length;
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Filters</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close sidebar">
          ✕
        </button>
      </div>

      <section className="filter-section">
        <h3>Report categories</h3>
        <label className="filter-row">
          <input
            type="checkbox"
            checked={mapLayers.module1}
            onChange={(e) => setLayer('module1', e.target.checked)}
          />
          <span className="filter-label">💥 Accident / conflict</span>
        </label>
        <label className="filter-row">
          <input
            type="checkbox"
            checked={mapLayers.module2}
            onChange={(e) => setLayer('module2', e.target.checked)}
          />
          <span className="filter-label">🚧 Hazard / infrastructure</span>
        </label>
        {module3Enabled && (
          <label className="filter-row">
            <input
              type="checkbox"
              checked={mapLayers.module3}
              onChange={(e) => setLayer('module3', e.target.checked)}
            />
            <span className="filter-label">🛟 Personal safety</span>
          </label>
        )}
      </section>

      <section className="filter-section">
        <h3>Analysis layers</h3>
        <label className="filter-row">
          <input
            type="checkbox"
            checked={mapLayers.kde}
            onChange={(e) => setLayer('kde', e.target.checked)}
          />
          <span className="filter-label">
            🔥 Heatmap (KDE density){kdeLoading ? ' …' : ''}
          </span>
        </label>
        <label className="filter-row">
          <input
            type="checkbox"
            checked={mapLayers.infrastructure}
            onChange={(e) => setLayer('infrastructure', e.target.checked)}
          />
          <span className="filter-label">🛣 Infrastructure overlay</span>
        </label>
      </section>

      <section className="filter-section">
        <div className="filter-section-head">
          <h3>Mobility mode</h3>
          <button className="link-btn" onClick={showAllModes}>Show all</button>
        </div>
        {ALL_MODES.map((m) => (
          <label key={m} className="filter-row">
            <input
              type="checkbox"
              checked={filters.modes.includes(m)}
              onChange={() => toggle('modes', m)}
            />
            <span className="filter-label">
              {modeEmoji[m]} {modeLabels[m]}
            </span>
            <span className="filter-count">{modeCounts[m]}</span>
          </label>
        ))}
      </section>

      <section className="filter-section">
        <h3>Severity</h3>
        {ALL_SEVERITIES.map((s) => (
          <label key={s} className="filter-row">
            <input
              type="checkbox"
              checked={filters.severities.includes(s)}
              onChange={() => toggle('severities', s)}
            />
            <span className="filter-label">{severityLabels[s]}</span>
          </label>
        ))}
      </section>

      <section className="filter-section">
        <div className="filter-section-head">
          <h3>Date range</h3>
          {(filters.from || filters.to) && (
            <button className="link-btn" onClick={clearDates}>Clear</button>
          )}
        </div>
        <label className="date-field">
          <span>From</span>
          <input type="date" value={filters.from} onChange={(e) => setRange('from', e.target.value)} />
        </label>
        <label className="date-field">
          <span>To</span>
          <input type="date" value={filters.to} onChange={(e) => setRange('to', e.target.value)} />
        </label>
        <label className="filter-row">
          <input
            type="checkbox"
            checked={filters.schoolZoneOnly}
            onChange={(e) => setRange('schoolZoneOnly', e.target.checked)}
          />
          <span className="filter-label">🏫 School zones only</span>
        </label>
      </section>

      <section className="filter-section">
        <h3>
          {loading ? 'Loading…' : `Showing ${incidents.length} of ${allCount}`}
        </h3>
        <ul className="incident-list">
          {incidents.slice(0, 50).map((i) => (
            <li
              key={i._id}
              className="incident-list-item"
              onClick={() => setSelectedIncident(i)}
            >
              <span className="dot" style={{ background: typeColors[i.type] }} aria-hidden />
              <div className="incident-list-text">
                <strong>{typeLabels[i.type] || i.type}</strong>
                <small>
                  {modeEmoji[i.mobilityMode] || ''}{' '}
                  {new Date(i.incidentDate).toLocaleDateString()}
                </small>
              </div>
            </li>
          ))}
          {incidents.length === 0 && !loading && (
            <li className="empty-state">No incidents match your filters.</li>
          )}
        </ul>
      </section>
    </aside>
  );
}
