import { useEffect, useRef, useState } from 'react';
import { cityConfig } from '../config/city.js';

/**
 * Map search bar backed by Nominatim (OpenStreetMap geocoder).
 *
 *   - Free, no API key needed (same OSM ecosystem as the tile layer).
 *   - Debounced 350 ms to respect Nominatim's 1 req/sec usage policy.
 *   - Optionally biased toward the configured city via viewbox.
 *   - Esc clears, Enter selects the top result.
 *
 * Receives an `onSelect({ lat, lng, label })` callback that the parent
 * MapView wires up to a flyTo + temporary marker drop.
 */
export default function SearchBar({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced fetch.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      setBusy(false);
      return;
    }
    const t = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      try {
        const params = new URLSearchParams({
          q: term,
          format: 'json',
          limit: '6',
          addressdetails: '1',
        });
        // Bias toward the configured city if a viewbox is available, so
        // "MG Road" resolves to the city's MG Road rather than some
        // far-away match. Bounded=1 hard-limits to the box.
        if (cityConfig.osmBbox) {
          params.set('viewbox', cityConfig.osmBbox);
          params.set('bounded', '1');
        }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          { signal: ctrl.signal, headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setActiveIdx(-1);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Click outside closes the dropdown.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    onSelect({ lat, lng, label: r.display_name });
    setQ(r.display_name.split(',')[0]);
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQ('');
      setResults([]);
      setOpen(false);
      e.target.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[Math.max(activeIdx, 0)]);
    }
  };

  return (
    <div className="map-search" ref={wrapRef}>
      <div className="map-search-input-wrap">
        <span className="map-search-icon" aria-hidden>🔍</span>
        <input
          type="text"
          className="map-search-input"
          placeholder="Search a location…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Search a location"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
        />
        {q && (
          <button
            type="button"
            className="map-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQ('');
              setResults([]);
              setOpen(false);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {open && q.trim().length >= 3 && (
        <ul className="map-search-results" role="listbox">
          {busy && (
            <li className="map-search-empty" aria-live="polite">
              Searching…
            </li>
          )}
          {!busy && results.length === 0 && (
            <li className="map-search-empty">No matches.</li>
          )}
          {results.map((r, i) => {
            const parts = r.display_name.split(',');
            const head = parts.shift().trim();
            const tail = parts.join(',').trim();
            return (
              <li
                key={r.place_id}
                role="option"
                aria-selected={i === activeIdx}
                className={`map-search-result ${
                  i === activeIdx ? 'is-active' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  pick(r);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <strong>{head}</strong>
                {tail && <span>{tail}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
