import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { IncidentProvider } from './context/IncidentContext.jsx';
import { RouteProvider } from './context/RouteContext.jsx';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <IncidentProvider>
          <RouteProvider>
            <App />
          </RouteProvider>
        </IncidentProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
