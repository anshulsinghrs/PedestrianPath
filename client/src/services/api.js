import axios from 'axios';

// Resolution order: runtime override (public/config.js) wins over the
// build-time secret so a deployed site can be re-pointed at a different
// backend by editing one static file — no rebuild required.
const runtimeApiUrl =
  typeof window !== 'undefined' &&
  window.__PATHGUARD_CONFIG__ &&
  window.__PATHGUARD_CONFIG__.apiUrl;
const baseURL = runtimeApiUrl || import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${baseURL}/api`,
});

// Attach JWT + pilot cohort tag on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const cohort = localStorage.getItem('pathguard-pilot-cohort');
  if (cohort) config.headers['X-Pilot-Cohort'] = cohort;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

// ----- Deployment config -----
export const fetchDeploymentConfig = () =>
  api.get('/config').then((r) => r.data);

// ----- Incidents (read) -----
export const fetchIncidents = (params = {}) =>
  api.get('/incidents', { params }).then((r) => r.data);

export const fetchIncident = (id) =>
  api.get(`/incidents/${id}`).then((r) => r.data);

export const fetchStats = () =>
  api.get('/incidents/stats/summary').then((r) => r.data);

// ----- Module-specific create endpoints -----
export const createAccidentConflict = (formData) =>
  api
    .post('/incidents/accident-conflict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const createHazardInfrastructure = (formData) =>
  api
    .post('/incidents/hazard-infrastructure', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const createPersonalSafety = (body) =>
  api.post('/incidents/personal-safety', body).then((r) => r.data);

// Legacy alias, retained for older code paths.
export const createIncident = (formData) =>
  api
    .post('/incidents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

// ----- Analytics -----
export const fetchAnalytics = (params = {}) =>
  api.get('/incidents/analytics', { params }).then((r) => r.data);
export const fetchKdeHotspots = (params = {}) =>
  api.get('/incidents/analytics/hotspots/kde', { params }).then((r) => r.data);
export const fetchGetisOrd = (params = {}) =>
  api
    .get('/incidents/analytics/hotspots/getis-ord', { params })
    .then((r) => r.data);
export const fetchInteractionAnalytics = (params = {}) =>
  api.get('/incidents/analytics/interactions', { params }).then((r) => r.data);
export const fetchInfrastructureConditionAnalytics = (params = {}) =>
  api
    .get('/incidents/analytics/infrastructure-conditions', { params })
    .then((r) => r.data);
export const fetchPersonalSafetyContext = (params = {}) =>
  api
    .get('/incidents/analytics/personal-safety-context', { params })
    .then((r) => r.data);
export const fetchPilotMetrics = (cohort, params = {}) =>
  api
    .get(`/incidents/analytics/pilot/${encodeURIComponent(cohort)}`, { params })
    .then((r) => r.data);

// ----- v4.0 analytics endpoints -----
export const fetchSurrogateSafety = (params = {}) =>
  api
    .get('/incidents/analytics/surrogate-safety', { params })
    .then((r) => r.data);
export const fetchHazardCategories = (params = {}) =>
  api
    .get('/incidents/analytics/hazard-categories', { params })
    .then((r) => r.data);
export const fetchBehavioralAdaptation = (params = {}) =>
  api
    .get('/incidents/analytics/behavioral-adaptation', { params })
    .then((r) => r.data);
export const fetchDemographicsAnalytics = (params = {}) =>
  api
    .get('/incidents/analytics/demographics', { params })
    .then((r) => r.data);

// ----- Export -----
export const exportUrl = (format = 'geojson', params = {}) => {
  const clean = Object.fromEntries(
    Object.entries({ format, ...params }).filter(([, v]) => v !== '' && v != null)
  );
  const qs = new URLSearchParams(clean).toString();
  return `${baseURL}/api/incidents/export?${qs}`;
};

export const fetchExport = (params = {}) =>
  api
    .get('/incidents/export', { params: { format: 'geojson', ...params } })
    .then((r) => r.data);

// ----- Auth -----
export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const login = (data) => api.post('/auth/login', data).then((r) => r.data);
export const me = () => api.get('/auth/me').then((r) => r.data);
export const updateProfile = (data) =>
  api.patch('/auth/me', data).then((r) => r.data);
export const verifyEmail = (token) =>
  api.post('/auth/verify-email', { token }).then((r) => r.data);
export const resendVerification = (email) =>
  api.post('/auth/resend-verification', { email }).then((r) => r.data);

// ----- Infrastructure -----
export const fetchInfrastructure = (params = {}) =>
  api.get('/infrastructure', { params }).then((r) => r.data);
export const fetchInfrastructureNear = (lat, lng, radius = 100) =>
  api
    .get('/infrastructure', { params: { near: `${lat},${lng}`, radius } })
    .then((r) => r.data);
export const createInfrastructure = (data) =>
  api.post('/infrastructure', data).then((r) => r.data);

// ----- Route planning (Pedestrian Mobility Platform) -----
export const planRoutes = (body) =>
  api.post('/routes/plan', body).then((r) => r.data);
export const fetchRouteProfiles = () =>
  api.get('/routes/profiles').then((r) => r.data);

// ----- AI image analysis (Vision-Language Models) -----
export const fetchVisionStatus = () =>
  api.get('/vision/status').then((r) => r.data);
export const analyzeReportImage = (file, provider) => {
  const fd = new FormData();
  fd.append('image', file);
  if (provider) fd.append('provider', provider);
  return api
    .post('/vision/analyze', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

// ----- Walkability engine -----
export const fetchWalkabilityWeights = () =>
  api.get('/walkability/weights').then((r) => r.data);
export const scoreWalkability = (body) =>
  api.post('/walkability/score', body).then((r) => r.data);
export const fetchWalkabilityHeatmap = (params = {}) =>
  api.get('/walkability/heatmap', { params }).then((r) => r.data);

// ----- Admin -----
export const fetchAdminStats = () => api.get('/admin/stats').then((r) => r.data);
export const fetchAdminIncidents = (params = {}) =>
  api.get('/admin/incidents', { params }).then((r) => r.data);
export const flagIncident = (id, reason) =>
  api.patch(`/admin/incidents/${id}/flag`, { reason }).then((r) => r.data);
export const approveIncident = (id) =>
  api.patch(`/admin/incidents/${id}/approve`).then((r) => r.data);
export const deleteAdminIncident = (id) =>
  api.delete(`/admin/incidents/${id}`).then((r) => r.data);
export const fetchAuditLog = (params = {}) =>
  api.get('/admin/audit', { params }).then((r) => r.data);
export const fetchPrivacyCellSizes = (params = {}) =>
  api.get('/admin/privacy/cell-sizes', { params }).then((r) => r.data);

// ----- Helpers -----
export const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${baseURL}${url}`;
};

export default api;
