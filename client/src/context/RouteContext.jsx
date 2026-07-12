import { createContext, useContext, useState, useCallback } from 'react';
import { planRoutes as planRoutesApi } from '../services/api.js';

/**
 * RouteContext — shared state for the intelligent pedestrian route planner.
 *
 * The RoutePlanner panel writes origin/destination/priorities and triggers
 * `plan()`; MapView reads `routes` + `activeProfile` to draw the ranked
 * polylines and endpoint markers. Keeping this in context (mirroring
 * IncidentContext) means the planner UI and the map never talk directly.
 */
const RouteContext = createContext(null);

/** Stable colour per objective, shared by the cards and the map polylines. */
export const PROFILE_COLORS = {
  fastest: '#f59e0b',
  shortest: '#64748b',
  safest: '#2563eb',
  comfortable: '#16a34a',
  recommended: '#7c3aed',
  custom: '#db2777',
};

export const DEFAULT_PRIORITIES = {
  safety: 0,
  greenery: 0,
  sidewalks: 0,
  comfort: 0,
  accessibility: 0,
  speed: 0,
  avoidStairs: false,
  wheelchair: false,
};

export function RouteProvider({ children }) {
  const [origin, setOrigin] = useState(null); // { lat, lng, label }
  const [destination, setDestination] = useState(null);
  const [priorities, setPriorities] = useState({ ...DEFAULT_PRIORITIES });
  const [routes, setRoutes] = useState([]);
  const [recommended, setRecommended] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState(null);
  const [showWalkabilityHeatmap, setShowWalkabilityHeatmap] = useState(false);

  const hasActivePriorities = useCallback(
    (p) =>
      p.avoidStairs ||
      p.wheelchair ||
      ['safety', 'greenery', 'sidewalks', 'comfort', 'accessibility', 'speed'].some(
        (k) => Number(p[k]) > 0
      ),
    []
  );

  const plan = useCallback(async () => {
    if (!origin || !destination) {
      setError('Set both a start and a destination.');
      return;
    }
    setPlanning(true);
    setError(null);
    try {
      const body = {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
      };
      if (hasActivePriorities(priorities)) body.priorities = priorities;
      const res = await planRoutesApi(body);
      setRoutes(res.routes || []);
      setRecommended(res.recommended || null);
      setActiveProfile(res.recommended || res.routes?.[0]?.profile || null);
      setMeta(res.meta || null);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Route planning failed';
      setError(msg);
      setRoutes([]);
      setActiveProfile(null);
    } finally {
      setPlanning(false);
    }
  }, [origin, destination, priorities, hasActivePriorities]);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
    setActiveProfile(null);
    setRecommended(null);
    setMeta(null);
    setError(null);
  }, []);

  return (
    <RouteContext.Provider
      value={{
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
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

export const useRoutes = () => useContext(RouteContext);
