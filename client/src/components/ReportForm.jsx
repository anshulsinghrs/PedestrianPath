import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  createIncident,
  fetchInfrastructureNear,
  createInfrastructure,
} from '../services/api.js';
import { useIncidents } from '../context/IncidentContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  typeLabels,
  ALL_TYPES,
  ALL_MODES,
  modeLabels,
  modeEmoji,
  tripPurposes,
  speedCategories,
  roadInteractions,
  weatherOptions,
  lightingOptions,
  roadTypes,
  crossingTypes,
  INFRA_CONTRIBUTING_FACTORS,
  factorLabels,
  labelize,
} from '../utils/incidentTypes.js';

/**
 * Two-tier report flow:
 *
 *   Step 1 (required, ~30s) — mode, type, severity, optional description,
 *     optional photo. Submit is enabled the moment these are valid.
 *   Step 2 (optional) — environmental context (trip, road, weather…).
 *   Step 3 (optional) — infrastructure linkage: pick nearby features on
 *     a mini-map, report a new feature inline, choose contributing
 *     factors.
 */
export default function ReportForm({ location, onClose }) {
  const { addIncident } = useIncidents();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({ context: false, infra: false });

  const defaultMode = user?.mobilityMode || 'cyclist';

  const [form, setForm] = useState({
    type: 'collision',
    severity: 'minor',
    injuryLevel: 'none',
    description: '',
    incidentDate: new Date().toISOString().slice(0, 16),
    image: null,
    mobilityMode: defaultMode,
    tripPurpose: 'commute',
    speedCategory:
      defaultMode === 'pedestrian' || defaultMode === 'wheelchair'
        ? 'walking'
        : defaultMode === 'runner'
        ? 'jogging'
        : 'cycling',
    roadInteraction: 'sharing_lane',
    weather: 'clear',
    lightingCondition: 'daylight',
    roadType: 'residential',
    crossingType: '',
    signalAvailable: '',
    waitingTimeSeconds: '',
    vehicleYielded: '',
    footpathWidthMeters: '',
    accessibilityRating: '',
    schoolZone: false,
    pedestrianDensity: 'unknown',
    consentForResearch: true,
    linkedInfrastructure: [],
    infrastructureContributingFactors: [],
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleFactor = (factor) =>
    setForm((f) => ({
      ...f,
      infrastructureContributingFactors:
        f.infrastructureContributingFactors.includes(factor)
          ? f.infrastructureContributingFactors.filter((x) => x !== factor)
          : [...f.infrastructureContributingFactors, factor],
    }));

  const toggleInfraLink = (id) =>
    setForm((f) => ({
      ...f,
      linkedInfrastructure: f.linkedInfrastructure.includes(id)
        ? f.linkedInfrastructure.filter((x) => x !== id)
        : [...f.linkedInfrastructure, id],
    }));

  const isPedestrianMode =
    form.mobilityMode === 'pedestrian' ||
    form.mobilityMode === 'wheelchair' ||
    form.mobilityMode === 'runner';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      const append = (k, v) => {
        if (v === '' || v === null || v === undefined) return;
        fd.append(k, v);
      };

      append('type', form.type);
      append('severity', form.severity);
      append('injuryLevel', form.injuryLevel);
      append('description', form.description);
      append('incidentDate', new Date(form.incidentDate).toISOString());
      append('lat', location.lat);
      append('lng', location.lng);
      append('mobilityMode', form.mobilityMode);
      append('tripPurpose', form.tripPurpose);
      append('speedCategory', form.speedCategory);
      append('roadInteraction', form.roadInteraction);
      append('weather', form.weather);
      append('lightingCondition', form.lightingCondition);
      append('roadType', form.roadType);
      append('crossingType', form.crossingType);
      append('signalAvailable', form.signalAvailable);
      append('waitingTimeSeconds', form.waitingTimeSeconds);
      append('vehicleYielded', form.vehicleYielded);
      append('footpathWidthMeters', form.footpathWidthMeters);
      append('accessibilityRating', form.accessibilityRating);
      append('schoolZone', form.schoolZone ? 'true' : 'false');
      append('pedestrianDensity', form.pedestrianDensity);
      append('consentForResearch', form.consentForResearch ? 'true' : 'false');
      if (form.linkedInfrastructure.length) {
        fd.append('linkedInfrastructure', form.linkedInfrastructure.join(','));
      }
      if (form.infrastructureContributingFactors.length) {
        fd.append(
          'infrastructureContributingFactors',
          form.infrastructureContributingFactors.join(',')
        );
      }
      if (form.image) fd.append('image', form.image);

      const created = await createIncident(fd);
      addIncident(created);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !!form.type && !!form.mobilityMode && !!form.severity && !submitting;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Report a road safety incident</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="location-strip">
          📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </div>

        <p className="form-hint">
          The fast path takes about 30 seconds. You can stop at any time
          once the required fields are filled.
        </p>

        <form onSubmit={handleSubmit} className="report-form">
          {/* ---------- Step 1: required fast path ---------- */}
          <fieldset className="fieldset">
            <legend>1. The basics (required)</legend>

            <label>
              <span>You are reporting as *</span>
              <select
                value={form.mobilityMode}
                onChange={(e) => update('mobilityMode', e.target.value)}
                required
              >
                {ALL_MODES.map((m) => (
                  <option key={m} value={m}>
                    {modeEmoji[m]} {modeLabels[m]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Incident type *</span>
              <select
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
                required
              >
                {ALL_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {typeLabels[k]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Severity *</span>
              <select
                value={form.severity}
                onChange={(e) => update('severity', e.target.value)}
              >
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
                <option value="fatal">Fatal</option>
              </select>
            </label>

            <label>
              <span>Date & time *</span>
              <input
                type="datetime-local"
                value={form.incidentDate}
                onChange={(e) => update('incidentDate', e.target.value)}
                max={new Date().toISOString().slice(0, 16)}
                required
              />
            </label>

            <label>
              <span>Short description</span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What happened? (optional, 200 chars)"
                maxLength={200}
              />
            </label>

            <label>
              <span>Photo (optional)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => update('image', e.target.files[0] || null)}
              />
            </label>
          </fieldset>

          {/* ---------- Step 2: optional context ---------- */}
          <details
            className="fieldset"
            open={expanded.context}
            onToggle={(e) =>
              setExpanded((x) => ({ ...x, context: e.target.open }))
            }
          >
            <summary>2. Add more detail (optional)</summary>

            <label>
              <span>Injury level</span>
              <select
                value={form.injuryLevel}
                onChange={(e) => update('injuryLevel', e.target.value)}
              >
                <option value="none">No injury</option>
                <option value="minor">Minor injury</option>
                <option value="serious">Serious injury</option>
                <option value="severe">Severe injury</option>
                <option value="fatal">Fatal</option>
              </select>
            </label>

            <label>
              <span>Trip purpose</span>
              <select
                value={form.tripPurpose}
                onChange={(e) => update('tripPurpose', e.target.value)}
              >
                {tripPurposes.map((p) => (
                  <option key={p} value={p}>{labelize(p)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Movement speed</span>
              <select
                value={form.speedCategory}
                onChange={(e) => update('speedCategory', e.target.value)}
              >
                {speedCategories.map((s) => (
                  <option key={s} value={s}>{labelize(s)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Road interaction</span>
              <select
                value={form.roadInteraction}
                onChange={(e) => update('roadInteraction', e.target.value)}
              >
                {roadInteractions.map((r) => (
                  <option key={r} value={r}>{labelize(r)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Road type</span>
              <select
                value={form.roadType}
                onChange={(e) => update('roadType', e.target.value)}
              >
                {roadTypes.map((r) => (
                  <option key={r} value={r}>{labelize(r)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Weather</span>
              <select
                value={form.weather}
                onChange={(e) => update('weather', e.target.value)}
              >
                {weatherOptions.map((w) => (
                  <option key={w} value={w}>{labelize(w)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Lighting</span>
              <select
                value={form.lightingCondition}
                onChange={(e) => update('lightingCondition', e.target.value)}
              >
                {lightingOptions.map((l) => (
                  <option key={l} value={l}>{labelize(l)}</option>
                ))}
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.schoolZone}
                onChange={(e) => update('schoolZone', e.target.checked)}
              />
              <span>This is a school zone</span>
            </label>

            {isPedestrianMode && (
              <>
                <label>
                  <span>Crossing type</span>
                  <select
                    value={form.crossingType}
                    onChange={(e) => update('crossingType', e.target.value)}
                  >
                    <option value="">—</option>
                    {crossingTypes.map((c) => (
                      <option key={c} value={c}>{labelize(c)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Signal available?</span>
                  <select
                    value={form.signalAvailable}
                    onChange={(e) => update('signalAvailable', e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>

                <label>
                  <span>Waiting time (s)</span>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={form.waitingTimeSeconds}
                    onChange={(e) => update('waitingTimeSeconds', e.target.value)}
                  />
                </label>

                <label>
                  <span>Did vehicle yield?</span>
                  <select
                    value={form.vehicleYielded}
                    onChange={(e) => update('vehicleYielded', e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>

                <label>
                  <span>Footpath width (m)</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={form.footpathWidthMeters}
                    onChange={(e) => update('footpathWidthMeters', e.target.value)}
                  />
                </label>

                <label>
                  <span>Accessibility (1-5)</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.accessibilityRating}
                    onChange={(e) => update('accessibilityRating', e.target.value)}
                  />
                </label>

                <label>
                  <span>Pedestrian density</span>
                  <select
                    value={form.pedestrianDensity}
                    onChange={(e) => update('pedestrianDensity', e.target.value)}
                  >
                    <option value="unknown">—</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </>
            )}
          </details>

          {/* ---------- Step 3: optional infrastructure linkage ---------- */}
          <details
            className="fieldset"
            open={expanded.infra}
            onToggle={(e) =>
              setExpanded((x) => ({ ...x, infra: e.target.open }))
            }
          >
            <summary>3. Link an infrastructure feature (optional)</summary>
            <p className="form-hint">
              Were any of these conditions involved? Tap a feature within
              100&nbsp;m on the mini-map, or report a new feature inline.
            </p>
            <InfrastructureLinker
              center={location}
              selected={form.linkedInfrastructure}
              onToggle={toggleInfraLink}
            />
            <fieldset className="factor-fieldset">
              <legend>Contributing factor(s)</legend>
              <div className="factor-grid">
                {INFRA_CONTRIBUTING_FACTORS.map((f) => (
                  <label key={f} className="factor-chip">
                    <input
                      type="checkbox"
                      checked={form.infrastructureContributingFactors.includes(
                        f
                      )}
                      onChange={() => toggleFactor(f)}
                    />
                    <span>{factorLabels[f]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.consentForResearch}
              onChange={(e) => update('consentForResearch', e.target.checked)}
            />
            <span>Allow this anonymised report to be used for safety research</span>
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="submit"
              className="primary-btn"
              disabled={!canSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>

          <p className="anon-note">
            Reports are anonymous unless you're signed in. Image EXIF (incl.
            GPS) is stripped server-side before storage.
          </p>
        </form>
      </div>
    </div>
  );
}

// ---------------- Infrastructure linker mini-map ----------------

function InfrastructureLinker({ center, selected, onToggle }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState('crossing');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInfrastructureNear(center.lat, center.lng, 150)
      .then((d) => {
        if (!cancelled) setFeatures(d.items || []);
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.9,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    features.forEach((f) => {
      const [lng, lat] = f.location.coordinates;
      const isSelected = selected.includes(f._id);
      const isOsm = f.dataProvenance === 'osm_import';
      const colour = isSelected ? '#22c55e' : isOsm ? '#0ea5e9' : '#f97316';
      const m = L.circleMarker([lat, lng], {
        radius: isSelected ? 9 : 6,
        color: colour,
        fillColor: colour,
        fillOpacity: 0.7,
        weight: 2,
      });
      m.bindTooltip(
        `${f.featureType}${f.name ? ` — ${f.name}` : ''}`,
        { direction: 'top' }
      );
      m.on('click', () => onToggle(f._id));
      m.addTo(layer);
    });
    return () => {
      layer.remove();
    };
  }, [features, selected, onToggle]);

  const reportNewFeature = async () => {
    try {
      const created = await createInfrastructure({
        featureType: newType,
        lat: center.lat,
        lng: center.lng,
      });
      setFeatures((f) => [...f, created]);
      onToggle(created._id);
      setCreating(false);
    } catch {
      /* ignore for now; the modal-level error handler covers serious failures */
    }
  };

  return (
    <div className="infra-linker">
      <div ref={containerRef} className="infra-minimap" />
      <div className="infra-legend">
        <span className="dot dot-osm" /> OSM
        <span className="dot dot-user" /> User
        <span className="dot dot-selected" /> Linked
      </div>
      <div className="infra-actions">
        {loading && <span className="form-hint">Loading nearby features…</span>}
        {!loading && features.length === 0 && (
          <span className="form-hint">No features within 150 m.</span>
        )}
        {!creating ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setCreating(true)}
          >
            + Report a new feature here
          </button>
        ) : (
          <div className="infra-new-row">
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="crossing">Crossing</option>
              <option value="sidewalk">Sidewalk</option>
              <option value="bike_lane">Bike lane</option>
              <option value="intersection">Intersection</option>
              <option value="bus_stop">Bus stop</option>
              <option value="shared_path">Shared path</option>
              <option value="other">Other</option>
            </select>
            <button type="button" className="ghost-btn" onClick={reportNewFeature}>
              Add
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
