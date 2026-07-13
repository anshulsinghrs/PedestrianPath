import { useEffect, useRef, useState } from 'react';
import { cityConfig } from '../config/city.js';

/**
 * A single geocoding location input for the route planner. Nominatim
 * autocomplete (same provider as SearchBar), plus an optional "use my
 * location" button. Emits `onChange({ lat, lng, label })`.
 */
export default function LocationField({ label, placeholder, value, onChange, allowMyLocation }) {
  const [q, setQ] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    setQ(value?.label || '');
  }, [value?.label]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      try {
        const params = new URLSearchParams({ q: term, format: 'json', limit: '6' });
        if (cityConfig.osmBbox) {
          params.set('viewbox', cityConfig.osmBbox);
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const head = r.display_name.split(',')[0];
    onChange({ lat, lng, label: head, fullLabel: r.display_name });
    setQ(head);
    setResults([]);
    setOpen(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange({ lat: latitude, lng: longitude, label: 'My location' });
        setQ('My location');
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rp-field" ref={wrapRef}>
      <label className="rp-field-label">{label}</label>
      <div className="rp-field-input-row">
        <input
          className="rp-field-input"
          type="text"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label={label}
        />
        {allowMyLocation && (
          <button
            type="button"
            className="rp-locate-btn"
            onClick={useMyLocation}
            title="Use my current location"
            disabled={locating}
          >
            {locating ? '…' : '📍'}
          </button>
        )}
      </div>
      {open && q.trim().length >= 3 && (
        <ul className="rp-field-results" role="listbox">
          {busy && <li className="rp-field-empty">Searching…</li>}
          {!busy && !results.length && <li className="rp-field-empty">No matches.</li>}
          {results.map((r) => {
            const parts = r.display_name.split(',');
            const head = parts.shift().trim();
            return (
              <li
                key={r.place_id}
                role="option"
                className="rp-field-result"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
              >
                <strong>{head}</strong>
                <span>{parts.join(',').trim()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
