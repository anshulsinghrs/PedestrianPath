// City configuration driven by environment variables so that PathGuard
// can be deployed to any city without code changes. See
// docs/DEPLOY_FOR_YOUR_CITY.md for the full list and a worked example.

export const cityConfig = {
  name: import.meta.env.VITE_CITY_NAME || 'Mumbai',
  initialCenter: [
    parseFloat(import.meta.env.VITE_CITY_LAT || '19.076'),
    parseFloat(import.meta.env.VITE_CITY_LNG || '72.8777'),
  ],
  initialZoom: parseInt(import.meta.env.VITE_CITY_ZOOM || '12', 10),
  locale: import.meta.env.VITE_CITY_LOCALE || 'en',
  // 'minLng,minLat,maxLng,maxLat' — optional, used by OSM-import flows.
  osmBbox: import.meta.env.VITE_CITY_OSM_BBOX || null,
  module3Enabled:
    String(import.meta.env.VITE_MODULE3_ENABLED || 'true').toLowerCase() ===
    'true',
};
