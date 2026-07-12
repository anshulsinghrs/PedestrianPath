import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchIncidents, fetchDeploymentConfig } from '../services/api.js';
import { getSocket, connectSocket, disconnectSocket } from '../services/socket.js';
import { ALL_TYPES, ALL_MODES } from '../utils/incidentTypes.js';
import { cityConfig } from '../config/city.js';

const IncidentContext = createContext(null);

const ALL_SEVERITIES = ['minor', 'moderate', 'major', 'fatal'];

export function IncidentProvider({ children }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Filter state — also stored in this context so Sidebar + MapView share it
  const [filters, setFilters] = useState({
    types: [...ALL_TYPES],
    modes: [...ALL_MODES],
    severities: [...ALL_SEVERITIES],
    from: '',
    to: '',
    schoolZoneOnly: false,
  });

  // Map layer toggles — controlled from the Sidebar, consumed by MapView.
  const [mapLayers, setMapLayers] = useState({
    module1: true,
    module2: true,
    module3: true,
    kde: false,
    infrastructure: false,
  });
  const [kdeLoading, setKdeLoading] = useState(false);

  const [module3Enabled, setModule3Enabled] = useState(cityConfig.module3Enabled);
  useEffect(() => {
    fetchDeploymentConfig()
      .then((c) => setModule3Enabled(!!c.module3Enabled))
      .catch(() => {});
  }, []);

  const projectIncident = (inc) => ({
    ...inc,
    type:
      inc.type ||
      inc.incidentType ||
      inc.hazardType ||
      inc.concernType ||
      'unknown',
    mobilityMode: inc.mobilityMode || inc.reporterMode || 'pedestrian',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.schoolZoneOnly) params.schoolZone = true;
      const data = await fetchIncidents(params);
      setIncidents((data.incidents || []).map(projectIncident));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.schoolZoneOnly]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time incident updates via Socket.IO.
  // On 'incident:new' we do a lightweight reload so the map shows the new pin.
  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socket.on('incident:new', () => load());
    return () => {
      socket.off('incident:new');
      disconnectSocket();
    };
  }, [load]);

  const addIncident = useCallback((incident) => {
    setIncidents((prev) => [projectIncident(incident), ...prev]);
  }, []);

  // Apply type / mode / severity filters on top of fetched data
  const visibleIncidents = useMemo(
    () =>
      incidents.filter(
        (i) =>
          filters.types.includes(i.type) &&
          filters.modes.includes(i.mobilityMode || 'cyclist') &&
          filters.severities.includes(i.severity || 'minor')
      ),
    [incidents, filters.types, filters.modes, filters.severities]
  );

  return (
    <IncidentContext.Provider
      value={{
        incidents: visibleIncidents,
        rawIncidents: incidents,
        allCount: incidents.length,
        loading,
        error,
        filters,
        setFilters,
        mapLayers,
        setMapLayers,
        kdeLoading,
        setKdeLoading,
        module3Enabled,
        reload: load,
        addIncident,
        selectedIncident,
        setSelectedIncident,
      }}
    >
      {children}
    </IncidentContext.Provider>
  );
}

export const useIncidents = () => useContext(IncidentContext);
export { ALL_TYPES, ALL_MODES, ALL_SEVERITIES };
