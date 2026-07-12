import { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminStats,
  fetchAdminIncidents,
  flagIncident,
  approveIncident,
  deleteAdminIncident,
  fetchAuditLog,
  fetchPrivacyCellSizes,
} from '../services/api.js';

const TABS = ['overview', 'incidents', 'audit', 'privacy'];

export default function AdminDashboard({ onClose }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [cellSizes, setCellSizes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [flagTarget, setFlagTarget] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminIncidents(statusFilter ? { status: statusFilter } : {});
      setIncidents(data.incidents || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadAudit = useCallback(async () => {
    try {
      const data = await fetchAuditLog();
      setAuditLog(data.entries || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadCellSizes = useCallback(async () => {
    try {
      const data = await fetchPrivacyCellSizes();
      setCellSizes(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'incidents') loadIncidents();
    if (tab === 'audit') loadAudit();
    if (tab === 'privacy') loadCellSizes();
  }, [tab, loadIncidents, loadAudit, loadCellSizes]);

  async function handleFlag(id) {
    try {
      await flagIncident(id, flagReason || 'Flagged by admin');
      setFlagTarget(null);
      setFlagReason('');
      loadIncidents();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleApprove(id) {
    try {
      await approveIncident(id);
      loadIncidents();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Permanently delete this incident?')) return;
    try {
      await deleteAdminIncident(id);
      loadIncidents();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal admin-dashboard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Admin dashboard"
      >
        <div className="modal-header">
          <h2>Admin Dashboard</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`admin-tab${tab === t ? ' active' : ''}`}
              onClick={() => { setTab(t); setError(null); }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="admin-error" role="alert">
            {error}
            <button className="link-btn" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <div className="admin-body">
          {tab === 'overview' && stats && (
            <div className="admin-stats-grid">
              <StatCard label="Total incidents" value={stats.total} />
              <StatCard label="Flagged" value={stats.flagged} highlight={stats.flagged > 0} />
              <StatCard label="Users" value={stats.users} />
              {(stats.byModule || []).map((m) => (
                <StatCard key={m._id} label={m._id} value={m.count} />
              ))}
            </div>
          )}

          {tab === 'incidents' && (
            <div>
              <div className="admin-toolbar">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter incidents"
                >
                  <option value="">All incidents</option>
                  <option value="flagged">Flagged only</option>
                </select>
                <button className="ghost-btn" onClick={loadIncidents}>Refresh</button>
              </div>

              {flagTarget && (
                <div className="admin-flag-dialog">
                  <input
                    placeholder="Flag reason…"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                  />
                  <button className="primary-btn" onClick={() => handleFlag(flagTarget)}>
                    Confirm flag
                  </button>
                  <button className="ghost-btn" onClick={() => setFlagTarget(null)}>Cancel</button>
                </div>
              )}

              {loading ? (
                <p className="admin-loading">Loading…</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Date</th>
                      <th>Severity</th>
                      <th>Risk</th>
                      <th>Flagged</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr key={inc._id} className={inc.adminFlagged ? 'row-flagged' : ''}>
                        <td>{inc.module}</td>
                        <td>{new Date(inc.incidentDate).toLocaleDateString()}</td>
                        <td>{inc.severity}</td>
                        <td>{inc.riskScore ?? '—'}</td>
                        <td>{inc.adminFlagged ? `⚑ ${inc.adminFlagReason || ''}` : '—'}</td>
                        <td className="admin-actions">
                          {inc.adminFlagged ? (
                            <button className="ghost-btn" onClick={() => handleApprove(inc._id)}>
                              Approve
                            </button>
                          ) : (
                            <button
                              className="ghost-btn"
                              onClick={() => { setFlagTarget(inc._id); setFlagReason(''); }}
                            >
                              Flag
                            </button>
                          )}
                          <button
                            className="ghost-btn danger-btn"
                            onClick={() => handleDelete(inc._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {incidents.length === 0 && (
                      <tr><td colSpan={6} className="empty-state">No incidents found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div>
              <h3>Moderation audit log</h3>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Module</th>
                    <th>Flagged at</th>
                    <th>Reason</th>
                    <th>Flagged by</th>
                    <th>Approved at</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry._id}>
                      <td>{String(entry._id).slice(-6)}</td>
                      <td>{entry.module}</td>
                      <td>{entry.adminFlaggedAt ? new Date(entry.adminFlaggedAt).toLocaleString() : '—'}</td>
                      <td>{entry.adminFlagReason || '—'}</td>
                      <td>{entry.adminFlaggedBy?.name || '—'}</td>
                      <td>{entry.adminApprovedAt ? new Date(entry.adminApprovedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">No audit entries.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'privacy' && cellSizes && (
            <div>
              <h3>k-anonymity cell size audit</h3>
              <div className="admin-stats-grid">
                <StatCard label="Total cells" value={cellSizes.cellCount} />
                <StatCard
                  label="Cells below k=5"
                  value={cellSizes.smallCellsBelow5}
                  highlight={cellSizes.smallCellsBelow5 > 0}
                />
                <StatCard label="Input records" value={cellSizes.manifest?.n_input_records} />
                <StatCard label="Retained records" value={cellSizes.manifest?.n_retained_records} />
              </div>
              <pre className="admin-manifest">
                {JSON.stringify(cellSizes.manifest, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`admin-stat-card${highlight ? ' highlight' : ''}`}>
      <span className="stat-value">{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
