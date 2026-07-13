import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { useIncidents } from '../context/IncidentContext.jsx';
import { useRoutes, PROFILE_COLORS } from '../context/RouteContext.jsx';
import SearchBar from './SearchBar.jsx';
import {
  recordPrimaryLabel,
  recordPrimaryColor,
  reporterModeLabels,
  severityLabels,
} from '../utils/incidentTypes.js';
import {
  fetchInfrastructure,
  fetchWalkabilityHeatmap,
  resolveImageUrl,
} from '../services/api.js';
import { cityConfig } from '../config/city.js';

// Default Leaflet icons rely on relative URLs that break under bundlers.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Uniform marker size for every incident regardless of severity. The
// outsized "fatal" pin (44px) used to dominate the map; severity is
// already encoded by colour, so the extra size cue is redundant.
const MARKER_SIZE = 30;

function moduleEmojiFor(inc) {
  if (inc.module === 'accident_conflict') return '💥';
  if (inc.module === 'hazard_infrastructure') return '🚧';
  if (inc.module === 'personal_safety') return '🛟';
  return '•';
}

const buildIcon = (inc) => {
  const color = recordPrimaryColor(inc);
  const emoji = moduleEmojiFor(inc);
  const size = MARKER_SIZE;
  return L.divIcon({
    className: 'incident-marker',
    html: `<div class="marker-pin" style="background:${color};width:${size}px;height:${size}px"><span>${emoji}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

function inferModule(inc) {
  if (inc.module) return inc.module;
  // Legacy fallback for un-migrated points.
  if (inc.type === 'harassment') return 'personal_safety';
  if (inc.type === 'hazard') return 'hazard_infrastructure';
  if (['collision', 'near_miss', 'vehicle_conflict'].includes(inc.type)) {
    return 'accident_conflict';
  }
  return 'hazard_infrastructure';
}

function buildUserLocationLayer(latitude, longitude, accuracy) {
  const group = L.layerGroup();
  L.circle([latitude, longitude], {
    radius: accuracy || 30,
    color: '#2563eb',
    fillColor: '#2563eb',
    fillOpacity: 0.12,
    weight: 1,
  }).addTo(group);
  L.circleMarker([latitude, longitude], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#2563eb',
    fillOpacity: 1,
  })
    .addTo(group)
    .bindPopup('<strong>You are here</strong>');
  return group;
}

export default function MapView({ pickingLocation, onMapPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const m1ClusterRef = useRef(null);
  const m2ClusterRef = useRef(null);
  const m3ClusterRef = useRef(null);
  const kdeLayerRef = useRef(null);
  const infraLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const odLayerRef = useRef(null);
  const walkHeatRef = useRef(null);
  const pickMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const userLocationMarkerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const pickingRef = useRef(pickingLocation);
  const onPickRef = useRef(onMapPick);
  useEffect(() => { pickingRef.current = pickingLocation; }, [pickingLocation]);
  useEffect(() => { onPickRef.current = onMapPick; }, [onMapPick]);

  const { incidents, setSelectedIncident, mapLayers, setKdeLoading } = useIncidents();
  const {
    routes,
    activeProfile,
    origin: routeOrigin,
    destination: routeDestination,
    showWalkabilityHeatmap,
  } = useRoutes();
  const showModule1 = mapLayers.module1;
  const showModule2 = mapLayers.module2;
  const showModule3 = mapLayers.module3;
  const showKde = mapLayers.kde;
  const showInfrastructure = mapLayers.infrastructure;

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: cityConfig.initialCenter,
      zoom: cityConfig.initialZoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    let firstFix = true;
    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
          }
          const group = buildUserLocationLayer(latitude, longitude, accuracy);
          group.addTo(map);
          userLocationMarkerRef.current = group;
          if (firstFix) {
            map.setView([latitude, longitude], 15);
            firstFix = false;
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    const m1Cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
    });
    const m2Cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
    });
    const m3Cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
    });
    map.addLayer(m1Cluster);
    map.addLayer(m2Cluster);
    map.addLayer(m3Cluster);

    map.on('click', async (e) => {
      if (!pickingRef.current) return;
      if (pickMarkerRef.current) pickMarkerRef.current.remove();
      pickMarkerRef.current = L.marker(e.latlng, { opacity: 0.5 }).addTo(map);

      try {
        const res = await fetch(
          `https://router.project-osrm.org/nearest/v1/driving/${e.latlng.lng},${e.latlng.lat}?number=1`
        );
        const data = await res.json();
        if (data.code === 'Ok' && data.waypoints?.length) {
          const [lng, lat] = data.waypoints[0].location;
          const snapped = L.latLng(lat, lng);
          pickMarkerRef.current.setLatLng(snapped);
          pickMarkerRef.current.setOpacity(1);
          onPickRef.current?.(snapped);
          return;
        }
      } catch {
        // OSRM unavailable — fall back to raw click position.
      }
      pickMarkerRef.current.setOpacity(1);
      onPickRef.current?.(e.latlng);
    });

    mapRef.current = map;
    m1ClusterRef.current = m1Cluster;
    m2ClusterRef.current = m2Cluster;
    m3ClusterRef.current = m3Cluster;

    return () => {
      if (watchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = pickingLocation ? 'crosshair' : '';
    if (!pickingLocation && pickMarkerRef.current) {
      pickMarkerRef.current.remove();
      pickMarkerRef.current = null;
    }
  }, [pickingLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const m1 = m1ClusterRef.current;
    const m2 = m2ClusterRef.current;
    const m3 = m3ClusterRef.current;
    if (!map || !m1 || !m2 || !m3) return;

    m1.clearLayers();
    m2.clearLayers();
    m3.clearLayers();

    const handleVisibility = (cluster, visible) => {
      if (visible && !map.hasLayer(cluster)) map.addLayer(cluster);
      if (!visible && map.hasLayer(cluster)) map.removeLayer(cluster);
    };
    handleVisibility(m1, showModule1);
    handleVisibility(m2, showModule2);
    handleVisibility(m3, showModule3);

    incidents.forEach((inc) => {
      const lat = inc.lat ?? inc.location?.coordinates?.[1];
      const lng = inc.lng ?? inc.location?.coordinates?.[0];
      if (lat == null || lng == null) return;

      const m = inferModule(inc);
      const target =
        m === 'accident_conflict' ? m1 : m === 'personal_safety' ? m3 : m2;

      const marker = L.marker([lat, lng], { icon: buildIcon(inc) });
      const date = new Date(inc.incidentDate).toLocaleDateString();
      const reporter =
        inc.reporterMode && reporterModeLabels[inc.reporterMode]
          ? reporterModeLabels[inc.reporterMode]
          : inc.mobilityMode || 'unknown';

      marker.bindPopup(`
        <div class="popup">
          <strong>${recordPrimaryLabel(inc)}</strong>
          <div class="popup-meta">${reporter} · ${
        severityLabels[inc.severity] || inc.severity || ''
      }</div>
          <div class="popup-date">${date}</div>
          <div class="popup-desc">${(inc.description || '').slice(0, 120)}${
        inc.description && inc.description.length > 120 ? '…' : ''
      }</div>
          <button class="popup-btn" data-id="${inc._id}">View details</button>
        </div>
      `);

      marker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.querySelector(`.popup-btn[data-id="${inc._id}"]`);
          if (btn) btn.onclick = () => setSelectedIncident(inc);
        }, 0);
      });
      target.addLayer(marker);
    });
  }, [incidents, setSelectedIncident, showModule1, showModule2, showModule3]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (kdeLayerRef.current) {
      map.removeLayer(kdeLayerRef.current);
      kdeLayerRef.current = null;
    }
    if (!showKde) return;

    // Client-side heatmap from the currently-loaded incidents. Avoids the
    // round-trip to the Python KDE service (which can be cold or
    // unreachable on Render free tier) and updates instantly when the
    // sidebar filters change.
    const sevWeight = { minor: 0.4, moderate: 0.7, major: 1.0, fatal: 1.4 };
    const points = incidents
      .map((inc) => {
        const lat = inc.lat ?? inc.location?.coordinates?.[1];
        const lng = inc.lng ?? inc.location?.coordinates?.[0];
        if (lat == null || lng == null) return null;
        return [lat, lng, sevWeight[inc.severity] || 0.6];
      })
      .filter(Boolean);

    if (!points.length) return;

    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: {
        0.2: '#3b528b',
        0.4: '#21918c',
        0.6: '#5ec962',
        0.8: '#fde725',
        1.0: '#dc2626',
      },
    });
    layer.addTo(map);
    kdeLayerRef.current = layer;
  }, [showKde, incidents]);

  // Infrastructure overlay.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (infraLayerRef.current) {
      map.removeLayer(infraLayerRef.current);
      infraLayerRef.current = null;
    }
    if (!showInfrastructure) return;
    let cancelled = false;
    fetchInfrastructure({})
      .then((res) => {
        if (cancelled || !res?.items?.length) return;
        const layer = L.layerGroup();
        res.items.forEach((f) => {
          const [lng, lat] = f.location.coordinates;
          const isOsm = f.dataProvenance === 'osm_import';
          const colour = isOsm ? '#0ea5e9' : '#f97316';
          const m = L.circleMarker([lat, lng], {
            radius: 6,
            color: colour,
            weight: 2,
            fillColor: colour,
            fillOpacity: 0.4,
          });
          const imageHtml = f.imageUrls?.[0]
            ? `<img src="${resolveImageUrl(f.imageUrls[0])}" alt="" style="max-width:160px;display:block;margin:4px 0" />`
            : '';
          m.bindPopup(`
            <div class="popup">
              <strong>${f.featureType}${f.name ? ` — ${f.name}` : ''}</strong>
              <div class="popup-meta">${isOsm ? 'OSM-imported' : 'User-reported'}</div>
              ${
                f.condition?.rating != null
                  ? `<div>Condition rating: ${f.condition.rating}/5</div>`
                  : ''
              }
              ${imageHtml}
            </div>
          `);
          m.addTo(layer);
        });
        layer.addTo(map);
        infraLayerRef.current = layer;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showInfrastructure]);

  // ----- Planned routes + origin/destination markers -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (odLayerRef.current) {
      map.removeLayer(odLayerRef.current);
      odLayerRef.current = null;
    }
    if (!routes.length) return;

    const group = L.layerGroup();
    // Draw non-active routes first so the active one lands on top.
    const ordered = [...routes].sort(
      (a, b) =>
        (a.profile === activeProfile ? 1 : 0) -
        (b.profile === activeProfile ? 1 : 0)
    );
    ordered.forEach((r) => {
      // Skip geometry-identical duplicates unless they're the active one.
      if (r.sameAs && r.profile !== activeProfile) return;
      const isActive = r.profile === activeProfile;
      const latlngs = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      if (latlngs.length < 2) return;
      L.polyline(latlngs, {
        color: PROFILE_COLORS[r.profile] || '#64748b',
        weight: isActive ? 7 : 4,
        opacity: isActive ? 0.95 : 0.4,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(group);
    });
    group.addTo(map);
    routeLayerRef.current = group;

    // Origin / destination markers (A / B).
    const odGroup = L.layerGroup();
    const endpointIcon = (letter, color) =>
      L.divIcon({
        className: 'route-endpoint',
        html: `<div class="route-endpoint-pin" style="background:${color}">${letter}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
    if (routeOrigin)
      L.marker([routeOrigin.lat, routeOrigin.lng], {
        icon: endpointIcon('A', '#16a34a'),
      })
        .bindPopup(`<strong>Start</strong><br/>${routeOrigin.label || ''}`)
        .addTo(odGroup);
    if (routeDestination)
      L.marker([routeDestination.lat, routeDestination.lng], {
        icon: endpointIcon('B', '#dc2626'),
      })
        .bindPopup(`<strong>Destination</strong><br/>${routeDestination.label || ''}`)
        .addTo(odGroup);
    odGroup.addTo(map);
    odLayerRef.current = odGroup;

    // Frame the active route.
    const active = routes.find((r) => r.profile === activeProfile) || routes[0];
    const pts = active.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 17 });
    }
  }, [routes, activeProfile, routeOrigin, routeDestination]);

  // ----- Walkability heatmap overlay -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (walkHeatRef.current) {
      map.removeLayer(walkHeatRef.current);
      walkHeatRef.current = null;
    }
    if (!showWalkabilityHeatmap) return;
    let cancelled = false;
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
    fetchWalkabilityHeatmap({ bbox })
      .then((fc) => {
        if (cancelled || !fc?.features?.length) return;
        const group = L.layerGroup();
        fc.features.forEach((f) => {
          const [lng, lat] = f.geometry.coordinates;
          L.circleMarker([lat, lng], {
            radius: 7,
            color: f.properties.color,
            fillColor: f.properties.color,
            fillOpacity: 0.7,
            weight: 0,
          })
            .bindPopup(
              `<strong>${f.properties.featureType}</strong><br/>Walkability ${f.properties.walkability} (${f.properties.rating})`
            )
            .addTo(group);
        });
        group.addTo(map);
        walkHeatRef.current = group;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showWalkabilityHeatmap]);

  const handleSearchSelect = ({ lat, lng, label }) => {
    const map = mapRef.current;
    if (!map) return;
    if (searchMarkerRef.current) searchMarkerRef.current.remove();
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    searchMarkerRef.current = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<strong>${label}</strong>`)
      .openPopup();
  };

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by your browser.');
      return;
    }
    if (window.isSecureContext === false) {
      setLocateError(
        'Location requires HTTPS. Open the site over https:// or localhost.'
      );
      return;
    }
    setLocateError('');
    setLocating(true);

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      map.flyTo([latitude, longitude], 16, { duration: 0.8 });
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
      }
      const group = buildUserLocationLayer(latitude, longitude, accuracy);
      group.addTo(map);
      userLocationMarkerRef.current = group;
      setLocating(false);
    };

    const messageFor = (err) => {
      if (err.code === 1) return 'Location permission denied.';
      if (err.code === 2) return 'Location unavailable. Check device GPS / network.';
      if (err.code === 3) return 'Location request timed out.';
      return 'Could not determine your location.';
    };

    // First try with high accuracy (GPS). If it fails or times out — common
    // on desktops without GPS — fall back to a coarser network-based fix
    // before surfacing the error.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => {
            setLocating(false);
            setLocateError(messageFor(err2.code ? err2 : err));
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  return (
    <div className="map-wrap">
      <SearchBar onSelect={handleSearchSelect} />
      <button
        type="button"
        className="map-locate-btn"
        onClick={handleLocateMe}
        disabled={locating}
        aria-label="Show my current location"
        title={locateError || 'Show my current location'}
      >
        {locating ? (
          <span className="map-locate-spinner" aria-hidden />
        ) : (
          <span aria-hidden>📍</span>
        )}
      </button>
      {locateError && (
        <div className="map-locate-error" role="status">
          {locateError}
        </div>
      )}
      <div ref={containerRef} className="map" />
    </div>
  );
}
