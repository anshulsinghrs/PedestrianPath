import { useEffect, useMemo, useState } from 'react';
import {
  fetchStats,
  fetchInteractionAnalytics,
  fetchInfrastructureConditionAnalytics,
  fetchPersonalSafetyContext,
  fetchSurrogateSafety,
  fetchHazardCategories,
  fetchBehavioralAdaptation,
  fetchDemographicsAnalytics,
  exportUrl,
  fetchExport,
} from '../services/api.js';
import {
  REPORTER_MODES,
  reporterModeLabels,
  INTERACTING_MODES,
  interactingModeLabels,
  interactionTypeLabels,
  collisionTypeLabels,
  nearMissTypeLabels,
  evasiveActionLabels,
  m1IncidentLabels,
  m2HazardLabels,
  hazardCategoryLabels,
  hazardCategoryEmoji,
  hazardDurationLabels,
  hazardVisibilityLabels,
  behavioralImpactLabels,
  m3ConcernLabels,
  m3MobilityActivityLabels,
  m3EnvironmentLabels,
  behavioralAdaptationLabels,
  interventionPreferenceLabels,
  repeatExposureLabels,
  socialContextLabels,
  timeOfDayLabels,
  crowdLevelLabels,
  ageGroupLabels,
  genderLabels,
  modeUsageFrequencyLabels,
  labelize,
  moduleLabels,
} from '../utils/incidentTypes.js';
import {
  HBar,
  Donut,
  Heatmap,
  LineChart,
  StackedBar,
  StatTiles,
  RawDetails,
  PALETTE,
} from './Charts.jsx';

const TABS = [
  { id: 'accident_conflict', label: 'Module 1 · Mobility conflict' },
  { id: 'hazard_infrastructure', label: 'Module 2 · Hazard & infrastructure' },
  { id: 'personal_safety', label: 'Module 3 · Perceived safety' },
  { id: 'demographics', label: 'Demographics' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* Convert a Mongo-style agg result [{_id, count}] into chart rows. */
function toRows(arr, labelMap = {}, { sort = true, max = Infinity } = {}) {
  const rows = (arr || []).map((r) => ({
    key: r._id,
    label: labelMap[r._id] || labelize(r._id),
    value: r.count || 0,
  }));
  if (sort) rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, max);
}

export default function AnalyticsDashboard({ module3Enabled = false }) {
  const [tab, setTab] = useState('accident_conflict');
  return (
    <div className="analytics">
      <div className="tab-strip">
        {TABS.map((t) => {
          const disabled =
            (t.id === 'personal_safety' && !module3Enabled) || false;
          return (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              title={
                disabled
                  ? 'Module 3 not enabled in this deployment'
                  : undefined
              }
            >
              {t.label}
              {disabled ? ' (off)' : ''}
            </button>
          );
        })}
      </div>

      {tab === 'accident_conflict' && <Module1Tab />}
      {tab === 'hazard_infrastructure' && <Module2Tab />}
      {tab === 'personal_safety' && module3Enabled && <Module3Tab />}
      {tab === 'demographics' && <DemographicsTab />}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Module 1 tab                                                            */
/* ----------------------------------------------------------------------- */
function Module1Tab() {
  const [stats, setStats] = useState(null);
  const [interactions, setInteractions] = useState(null);
  const [surrogate, setSurrogate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchStats(),
      fetchInteractionAnalytics(),
      fetchSurrogateSafety().catch(() => null),
    ])
      .then(([s, i, ss]) => {
        setStats(s);
        setInteractions(i);
        setSurrogate(ss);
      })
      .finally(() => setLoading(false));
  }, []);

  const matrix = useMemo(() => {
    const m = {};
    (interactions?.matrix || []).forEach((row) => {
      const r = row._id?.reporter || 'unknown';
      const o = row._id?.other || 'none';
      m[r] = m[r] || {};
      m[r][o] = row.count;
    });
    return m;
  }, [interactions]);

  if (loading) return <div className="analytics-card">Loading…</div>;

  const matrixTotal = Object.values(matrix).reduce(
    (a, row) => a + Object.values(row).reduce((b, v) => b + v, 0),
    0
  );

  const interactionRows = toRows(
    interactions?.byInteractionType,
    interactionTypeLabels
  );
  const totalInteractions = interactionRows.reduce((a, r) => a + r.value, 0);
  const topInteraction = interactionRows[0];

  return (
    <>
      <StatTiles
        items={[
          {
            value: stats?.total ?? '—',
            label: 'Total records',
            sub: 'across all modules',
          },
          {
            value: matrixTotal,
            label: 'Conflict reports',
          },
          {
            value: totalInteractions,
            label: 'Interactions logged',
          },
          {
            value: topInteraction ? topInteraction.label : '—',
            label: 'Most common interaction',
            sub: topInteraction
              ? `${topInteraction.value} reports`
              : undefined,
          },
        ]}
      />

      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3>Interaction-type frequency</h3>
          <p className="form-hint">
            How conflicts are distributed across interaction types.
          </p>
          <HBar data={interactionRows} maxRows={10} />
          <RawDetails>
            <ol className="counts-list">
              {interactionRows.map((r) => (
                <li key={r.key}>
                  {r.label} · {r.value}
                </li>
              ))}
            </ol>
          </RawDetails>
        </div>

        <div className="analytics-card">
          <h3>Reporter mode share</h3>
          <p className="form-hint">
            Share of conflict reports by the reporter's mode of travel.
          </p>
          <Donut
            data={REPORTER_MODES.map((r) => ({
              label: reporterModeLabels[r] || labelize(r),
              value: Object.values(matrix[r] || {}).reduce((a, v) => a + v, 0),
            })).filter((r) => r.value > 0)}
            centerLabel="conflicts"
          />
        </div>
      </div>

      <div className="analytics-card">
        <h3>Mode × interacting-mode heatmap</h3>
        <p className="form-hint">
          Counts of conflict reports cross-tabbed by the reporter's mode (rows)
          and the other party (columns). Solo incidents appear under{' '}
          <em>none</em>.
        </p>
        <Heatmap
          rows={REPORTER_MODES}
          cols={INTERACTING_MODES}
          rowLabels={reporterModeLabels}
          colLabels={interactingModeLabels}
          matrix={matrix}
          rowHeader="reporter mode"
          colHeader="other party"
        />
        <RawDetails>
          <table className="analytics-matrix">
            <thead>
              <tr>
                <th>Reporter ↓ / Other →</th>
                {INTERACTING_MODES.map((m) => (
                  <th key={m}>{interactingModeLabels[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REPORTER_MODES.map((r) => (
                <tr key={r}>
                  <th>{reporterModeLabels[r]}</th>
                  {INTERACTING_MODES.map((o) => (
                    <td key={o}>{matrix[r]?.[o] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </RawDetails>
      </div>

      <div className="analytics-card">
        <h3>Interaction × infrastructure feature (top 15)</h3>
        <p className="form-hint">
          Counts stratified by the infrastructure feature each incident is
          linked to.
        </p>
        <HBar
          data={(interactions?.byInfrastructureFeature || [])
            .slice(0, 15)
            .map((row) => ({
              label: `${row._id?.featureType} · ${
                interactionTypeLabels[row._id?.interactionType] ||
                row._id?.interactionType
              }`,
              value: row.count,
            }))}
          maxRows={15}
        />
      </div>

      <SurrogateSafetyCards data={surrogate} />

      <SummaryCard stats={stats} />
    </>
  );
}

function SurrogateSafetyCards({ data }) {
  if (!data) return null;
  const byIncidentRows = toRows(data.byIncidentType, m1IncidentLabels);
  const total = byIncidentRows.reduce((a, r) => a + r.value, 0);
  if (total === 0) {
    return (
      <div className="analytics-card">
        <h3>Surrogate safety (v4.0)</h3>
        <p className="form-hint">
          No near-miss / forced-evasive / aggressive-interaction records yet.
        </p>
      </div>
    );
  }
  const futureImpact = data.futureRouteImpact || {};
  const totalImpact = (futureImpact.true || 0) + (futureImpact.false || 0);
  return (
    <>
      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3>Surrogate-safety event distribution</h3>
          <p className="form-hint">
            Near misses, forced evasive actions and aggressive interactions —
            the v4.0 surrogate-safety event set.
          </p>
          <Donut data={byIncidentRows} centerLabel="events" />
        </div>

        {(data.byNearMissType || []).length > 0 && (
          <div className="analytics-card">
            <h3>Near-miss subtype</h3>
            <HBar
              data={toRows(data.byNearMissType, nearMissTypeLabels)}
              maxRows={10}
            />
          </div>
        )}

        {(data.byEvasiveAction || []).length > 0 && (
          <div className="analytics-card">
            <h3>Evasive action taken</h3>
            <HBar
              data={toRows(data.byEvasiveAction, evasiveActionLabels)}
              maxRows={10}
            />
          </div>
        )}

        {(data.byPerceivedDanger || []).length > 0 && (
          <div className="analytics-card">
            <h3>Perceived danger (1–5)</h3>
            <p className="form-hint">
              Reporter's self-rated severity, on a 5-point Likert scale.
            </p>
            <HBar
              data={(data.byPerceivedDanger || [])
                .slice()
                .sort((a, b) => Number(a._id) - Number(b._id))
                .map((r, i) => ({
                  label: `Level ${r._id}`,
                  value: r.count,
                }))}
              colorBy="gradient"
              maxRows={5}
            />
          </div>
        )}
      </div>

      {(data.perceivedDangerByMode || []).length > 0 && (
        <div className="analytics-card">
          <h3>Mean perceived danger by reporter mode</h3>
          <HBar
            data={data.perceivedDangerByMode
              .slice()
              .sort((a, b) => b.mean - a.mean)
              .map((row) => ({
                label: `${reporterModeLabels[row._id] || labelize(row._id)} · (n=${row.n})`,
                value: Number(Number(row.mean).toFixed(2)),
              }))}
            showPercent={false}
          />
          <p className="form-hint">
            Bar length proportional to mean danger (1–5).
          </p>
        </div>
      )}

      {totalImpact > 0 && (
        <div className="analytics-card">
          <h3>Future route impact</h3>
          <p className="form-hint">
            Did the event change how reporters routed afterwards? A direct
            proxy for behavioural adaptation in Module 1.
          </p>
          <StackedBar
            segments={[
              { label: 'Changed route', value: futureImpact.true || 0, color: PALETTE[3] },
              { label: 'No change', value: futureImpact.false || 0, color: PALETTE[5] },
            ]}
          />
        </div>
      )}

      {(data.repeatExposure || []).length > 0 && (
        <div className="analytics-card">
          <h3>Repeat exposure at this location</h3>
          <HBar
            data={toRows(data.repeatExposure, repeatExposureLabels)}
          />
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Module 2 tab                                                            */
/* ----------------------------------------------------------------------- */
function Module2Tab() {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchInfrastructureConditionAnalytics(),
      fetchHazardCategories().catch(() => null),
    ])
      .then(([d, c]) => {
        setData(d);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build month-by-hazard line series (must be called before any early return)
  const trendSeries = useMonthlyHazardSeries(data?.monthlyTrend);

  if (loading) return <div className="analytics-card">Loading…</div>;

  const hazardRows = toRows(data?.byHazardType, m2HazardLabels);
  const hazardTotal = hazardRows.reduce((a, r) => a + r.value, 0);

  return (
    <>
      <StatTiles
        items={[
          { value: hazardTotal, label: 'Hazard reports' },
          {
            value: hazardRows[0]?.label || '—',
            label: 'Most common hazard',
            sub: hazardRows[0] ? `${hazardRows[0].value} reports` : undefined,
          },
          {
            value: (data?.byFeatureTypeXHazardType || []).length,
            label: 'Distinct feature × hazard pairs',
          },
          {
            value: trendSeries.monthCount,
            label: 'Months with reports',
          },
        ]}
      />

      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3>Hazard-type distribution</h3>
          <HBar data={hazardRows} maxRows={12} />
        </div>

        <div className="analytics-card">
          <h3>Hazard mix</h3>
          <Donut data={hazardRows.slice(0, 8)} centerLabel="hazards" />
        </div>
      </div>

      <div className="analytics-card">
        <h3>Hazard × infrastructure feature (top 15)</h3>
        <HBar
          data={(data?.byFeatureTypeXHazardType || [])
            .slice(0, 15)
            .map((row) => ({
              label: `${row._id?.featureType} · ${
                m2HazardLabels[row._id?.hazardType] || row._id?.hazardType
              }`,
              value: row.count,
            }))}
          maxRows={15}
        />
      </div>

      <div className="analytics-card">
        <h3>Monthly trend by hazard type</h3>
        <p className="form-hint">
          Top {trendSeries.series.length} hazard types over time.
        </p>
        <LineChart series={trendSeries.series} height={240} yLabel="reports" />
        <RawDetails>
          <table className="analytics-matrix">
            <thead>
              <tr><th>Month</th><th>Hazard</th><th>Count</th></tr>
            </thead>
            <tbody>
              {(data?.monthlyTrend || []).slice(0, 60).map((row, i) => (
                <tr key={i}>
                  <td>{row._id?.ym}</td>
                  <td>{m2HazardLabels[row._id?.hazardType] || row._id?.hazardType}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </RawDetails>
      </div>

      <HazardCategoryCards data={categories} />
    </>
  );
}

function useMonthlyHazardSeries(monthlyTrend) {
  return useMemo(() => {
    const arr = monthlyTrend || [];
    // Pick top N hazards by total
    const totals = {};
    const months = new Set();
    arr.forEach((row) => {
      const h = row._id?.hazardType || 'unknown';
      const m = row._id?.ym || '';
      totals[h] = (totals[h] || 0) + row.count;
      if (m) months.add(m);
    });
    const topHazards = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    const series = topHazards.map((h) => ({
      name: m2HazardLabels[h] || labelize(h),
      points: Array.from(months)
        .sort()
        .map((m) => {
          const row = arr.find(
            (r) => r._id?.ym === m && r._id?.hazardType === h
          );
          return { x: m, y: row ? row.count : 0 };
        }),
    }));
    return { series, monthCount: months.size };
  }, [monthlyTrend]);
}

function HazardCategoryCards({ data }) {
  if (!data) return null;
  const categoryRows = toRows(data.byCategory, hazardCategoryLabels);
  const total = categoryRows.reduce((a, r) => a + r.value, 0);
  if (total === 0) {
    return (
      <div className="analytics-card">
        <h3>Hazard categories (v4.0)</h3>
        <p className="form-hint">
          No v4.0 hazard-category data yet. New hazard reports default to
          carrying a category; older records will be re-classified by the v4.0
          migration.
        </p>
      </div>
    );
  }

  // Re-label with emoji prefix for the bar list
  const categoryRowsEmoji = categoryRows.map((r) => ({
    ...r,
    label: `${hazardCategoryEmoji[r.key] || ''} ${r.label}`.trim(),
  }));

  return (
    <>
      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3>Hazard category</h3>
          <p className="form-hint">
            Five-category taxonomy: surface / accessibility / cycling /
            visibility / traffic.
          </p>
          <Donut data={categoryRowsEmoji} centerLabel="hazards" />
        </div>

        {(data.byDuration || []).length > 0 && (
          <div className="analytics-card">
            <h3>How long the hazard has existed</h3>
            <HBar
              data={toRows(data.byDuration, hazardDurationLabels)}
            />
          </div>
        )}

        {(data.byVisibilityCondition || []).length > 0 && (
          <div className="analytics-card">
            <h3>When the hazard is most noticeable</h3>
            <HBar
              data={toRows(data.byVisibilityCondition, hazardVisibilityLabels)}
            />
          </div>
        )}

        {(data.behavioralImpactTypes || []).length > 0 && (
          <div className="analytics-card">
            <h3>Behavioural impact types reported</h3>
            <HBar
              data={toRows(data.behavioralImpactTypes, behavioralImpactLabels)}
              maxRows={10}
            />
          </div>
        )}
      </div>

      {(data.perceivedSeverityByCategory || []).length > 0 && (
        <div className="analytics-card">
          <h3>Mean perceived hazard severity by category (1–5)</h3>
          <HBar
            data={data.perceivedSeverityByCategory
              .slice()
              .sort((a, b) => b.mean - a.mean)
              .map((row) => ({
                label: `${hazardCategoryEmoji[row._id] || ''} ${
                  hazardCategoryLabels[row._id] || labelize(row._id)
                } · (n=${row.n})`,
                value: Number(Number(row.mean).toFixed(2)),
              }))}
            showPercent={false}
          />
        </div>
      )}

      {(data.behaviourAffectedRate || []).length > 0 && (
        <div className="analytics-card">
          <h3>Behaviour-affected rate per category</h3>
          <p className="form-hint">
            Share of reporters who changed their behaviour in response to a
            hazard of this category.
          </p>
          <HBar
            data={data.behaviourAffectedRate
              .slice()
              .sort((a, b) => (b.rate || 0) - (a.rate || 0))
              .map((row) => ({
                label: `${
                  hazardCategoryLabels[row.hazardCategory] ||
                  labelize(row.hazardCategory)
                } · (n=${row.n})`,
                value:
                  row.rate != null ? Math.round(row.rate * 100) : 0,
              }))}
            showPercent={false}
          />
          <p className="form-hint">
            Values shown as percentage (%) of reporters affected.
          </p>
        </div>
      )}

      {(data.byAffectedUserGroup || []).length > 0 && (
        <CategoryByUserGroupHeatmap data={data.byAffectedUserGroup} />
      )}
    </>
  );
}

function CategoryByUserGroupHeatmap({ data }) {
  const { rows, cols, matrix } = useMemo(() => {
    const m = {};
    const rowsSet = new Set();
    const colsSet = new Set();
    data.forEach((row) => {
      const r = row._id?.category;
      const c = row._id?.userGroup;
      if (!r || !c) return;
      rowsSet.add(r);
      colsSet.add(c);
      m[r] = m[r] || {};
      m[r][c] = (m[r][c] || 0) + row.count;
    });
    return {
      rows: Array.from(rowsSet),
      cols: Array.from(colsSet),
      matrix: m,
    };
  }, [data]);

  if (!rows.length) return null;

  return (
    <div className="analytics-card">
      <h3>Hazard category × most-affected user group</h3>
      <Heatmap
        rows={rows}
        cols={cols}
        rowLabels={hazardCategoryLabels}
        colLabels={reporterModeLabels}
        matrix={matrix}
        rowHeader="hazard category"
        colHeader="user group"
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Module 3 tab                                                            */
/* ----------------------------------------------------------------------- */
function Module3Tab() {
  const [data, setData] = useState(null);
  const [adaptation, setAdaptation] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPersonalSafetyContext(),
      fetchBehavioralAdaptation().catch(() => null),
    ])
      .then(([d, a]) => {
        setData(d);
        setAdaptation(a);
      })
      .catch((e) => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="analytics-card">Loading…</div>;
  if (err) return <div className="analytics-card form-error">Module 3 analytics unavailable: {err}</div>;

  const concernRows = toRows(data?.byConcern, m3ConcernLabels);
  const totalConcerns = concernRows.reduce((a, r) => a + r.value, 0);

  return (
    <>
      <StatTiles
        items={[
          { value: totalConcerns, label: 'Safety-context reports' },
          {
            value: concernRows[0]?.label || '—',
            label: 'Most common concern',
            sub: concernRows[0] ? `${concernRows[0].value} reports` : undefined,
          },
          {
            value: meanRisk(data?.byRisk),
            label: 'Mean perceived risk (1–5)',
          },
        ]}
      />

      <div className="analytics-grid-2">
        <div className="analytics-card">
          <h3>Concern type</h3>
          <HBar data={concernRows} maxRows={10} />
        </div>

        <div className="analytics-card">
          <h3>Time of day</h3>
          <Donut
            data={toRows(data?.byTimeOfDay, timeOfDayLabels)}
            centerLabel="reports"
          />
        </div>

        <div className="analytics-card">
          <h3>Crowd level</h3>
          <HBar data={toRows(data?.byCrowdLevel, crowdLevelLabels)} />
        </div>

        <div className="analytics-card">
          <h3>Lighting</h3>
          <HBar data={toRows(data?.byLighting)} />
        </div>

        <div className="analytics-card">
          <h3>Perceived risk level (1–5)</h3>
          <HBar
            data={(data?.byRisk || [])
              .slice()
              .sort((a, b) => Number(a._id) - Number(b._id))
              .map((r) => ({
                label: `Level ${r._id}`,
                value: r.count,
              }))}
            colorBy="gradient"
            maxRows={5}
          />
        </div>

        {(data?.byMobilityActivity || []).length > 0 && (
          <div className="analytics-card">
            <h3>Mobility activity</h3>
            <p className="form-hint">
              What the reporter was doing when the concern occurred.
            </p>
            <HBar
              data={toRows(data.byMobilityActivity, m3MobilityActivityLabels)}
              maxRows={10}
            />
          </div>
        )}

        {(data?.byEnvironmentalContext || []).length > 0 && (
          <div className="analytics-card">
            <h3>Environmental contributors</h3>
            <HBar
              data={toRows(data.byEnvironmentalContext, m3EnvironmentLabels)}
              maxRows={10}
            />
          </div>
        )}

        {(data?.bySocialContext || []).length > 0 && (
          <div className="analytics-card">
            <h3>Social context</h3>
            <HBar
              data={toRows(data.bySocialContext, socialContextLabels)}
            />
          </div>
        )}
      </div>

      <BehavioralAdaptationCards data={adaptation} />

      <div className="analytics-card">
        <h3>Privacy manifest (this view)</h3>
        <pre className="manifest-pre">
          {JSON.stringify(data?.privacyManifest, null, 2)}
        </pre>
      </div>
    </>
  );
}

function meanRisk(byRisk) {
  if (!byRisk?.length) return '—';
  let total = 0;
  let n = 0;
  byRisk.forEach((r) => {
    total += Number(r._id) * r.count;
    n += r.count;
  });
  return n ? (total / n).toFixed(2) : '—';
}

function BehavioralAdaptationCards({ data }) {
  if (!data) return null;

  const m2 = data.module2;
  const m3 = data.module3;

  return (
    <>
      {m3 ? (
        <div className="analytics-grid-2">
          {m3.affected && (
            <div className="analytics-card">
              <h3>Did this concern affect mobility behaviour?</h3>
              <StackedBar
                segments={[
                  { label: 'Yes', value: m3.affected.yes, color: PALETTE[3] },
                  { label: 'No', value: m3.affected.no, color: PALETTE[5] },
                ]}
              />
              <p className="form-hint">n = {m3.affected.total}</p>
            </div>
          )}

          {(m3.adaptations || []).length > 0 && (
            <div className="analytics-card">
              <h3>Behavioural adaptations</h3>
              <HBar
                data={toRows(m3.adaptations, behavioralAdaptationLabels)}
                maxRows={10}
              />
            </div>
          )}

          {(m3.interventionPreferences || []).length > 0 && (
            <div className="analytics-card">
              <h3>Intervention preferences</h3>
              <p className="form-hint">
                What reporters say would make them feel safer at this location.
              </p>
              <HBar
                data={toRows(
                  m3.interventionPreferences,
                  interventionPreferenceLabels
                )}
                maxRows={10}
              />
            </div>
          )}

          {(m3.repeatExposure || []).length > 0 && (
            <div className="analytics-card">
              <h3>Repeat exposure</h3>
              <HBar
                data={toRows(m3.repeatExposure, repeatExposureLabels)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="analytics-card">
          <h3>Behavioural adaptation</h3>
          <p className="form-hint">
            Module 3 behavioural-adaptation aggregates are admin-gated. The
            Module 2 cascade is summarised below.
          </p>
          {m2?.affected && (
            <StackedBar
              segments={[
                { label: 'Affected', value: m2.affected.yes, color: PALETTE[3] },
                { label: 'Not affected', value: m2.affected.no, color: PALETTE[5] },
              ]}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Demographics tab                                                        */
/* ----------------------------------------------------------------------- */
function DemographicsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDemographicsAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Hooks must be called before any early return
  const ageModuleMatrix = useMemo(() => {
    const m = {};
    const moduleSet = new Set();
    const ageSet = new Set();
    (data?.ageByModule || []).forEach((row) => {
      const mod = row._id?.module;
      const age = row._id?.ageGroup;
      if (!mod || !age) return;
      moduleSet.add(mod);
      ageSet.add(age);
      m[mod] = m[mod] || {};
      m[mod][age] = (m[mod][age] || 0) + row.count;
    });
    return {
      rows: Array.from(moduleSet),
      cols: Array.from(ageSet),
      matrix: m,
    };
  }, [data]);

  const ageModeMatrix = useMemo(() => {
    const m = {};
    const modeSet = new Set();
    const ageSet = new Set();
    (data?.ageByReporterMode || []).forEach((row) => {
      const mode = row._id?.reporterMode;
      const age = row._id?.ageGroup;
      if (!mode || !age) return;
      modeSet.add(mode);
      ageSet.add(age);
      m[mode] = m[mode] || {};
      m[mode][age] = (m[mode][age] || 0) + row.count;
    });
    return {
      rows: Array.from(modeSet),
      cols: Array.from(ageSet),
      matrix: m,
    };
  }, [data]);

  if (loading) return <div className="analytics-card">Loading…</div>;
  if (!data) return <div className="analytics-card">No data.</div>;

  const ageRows = toRows(data.byAgeGroup, ageGroupLabels);
  const genderRows = toRows(data.byGender, genderLabels);
  const modeRows = toRows(data.byModeUsage, modeUsageFrequencyLabels);
  const totalAge = ageRows.reduce((a, r) => a + r.value, 0);

  return (
    <>
      <div className="analytics-card">
        <h3>About this view</h3>
        <p className="form-hint">
          The optional demographics layer (age, gender, mode-usage frequency)
          is stored on a per-record basis with no link to a reporter identity.
          Module 3 records are excluded from this view for non-admin requests.
        </p>
        {data.note && <p className="form-hint">{data.note}</p>}
      </div>

      {totalAge === 0 ? (
        <div className="analytics-card">
          <h3>No demographic data yet</h3>
          <p className="form-hint">
            v4.0 reports collect demographics as a final, optional step.
            Records will appear here once reporters opt in.
          </p>
        </div>
      ) : (
        <>
          <StatTiles
            items={[
              { value: totalAge, label: 'Records with demographics' },
              {
                value: ageRows[0]?.label || '—',
                label: 'Most-represented age group',
                sub: ageRows[0] ? `${ageRows[0].value} reports` : undefined,
              },
              {
                value: genderRows[0]?.label || '—',
                label: 'Most-represented gender',
                sub: genderRows[0] ? `${genderRows[0].value} reports` : undefined,
              },
            ]}
          />

          <div className="analytics-grid-2">
            <div className="analytics-card">
              <h3>Age group</h3>
              <Donut data={ageRows} centerLabel="reporters" />
            </div>

            <div className="analytics-card">
              <h3>Gender</h3>
              <Donut data={genderRows} centerLabel="reporters" />
            </div>

            <div className="analytics-card">
              <h3>Primary-mode usage frequency</h3>
              <HBar data={modeRows} />
            </div>
          </div>

          {ageModuleMatrix.rows.length > 0 && (
            <div className="analytics-card">
              <h3>Age × module</h3>
              <Heatmap
                rows={ageModuleMatrix.rows}
                cols={ageModuleMatrix.cols}
                rowLabels={moduleLabels}
                colLabels={ageGroupLabels}
                matrix={ageModuleMatrix.matrix}
                rowHeader="module"
                colHeader="age group"
              />
            </div>
          )}

          {ageModeMatrix.rows.length > 0 && (
            <div className="analytics-card">
              <h3>Age × reporter mode</h3>
              <Heatmap
                rows={ageModeMatrix.rows}
                cols={ageModeMatrix.cols}
                rowLabels={reporterModeLabels}
                colLabels={ageGroupLabels}
                matrix={ageModeMatrix.matrix}
                rowHeader="reporter mode"
                colHeader="age group"
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Summary + export                                                        */
/* ----------------------------------------------------------------------- */
function SummaryCard({ stats }) {
  if (!stats) return null;
  const moduleRows = toRows(stats.byModule, moduleLabels);
  return (
    <div className="analytics-card">
      <h3>Totals</h3>
      <p className="form-hint">
        Total records (excluding Module 3): <strong>{stats.total}</strong>
      </p>
      <HBar data={moduleRows} />
    </div>
  );
}

function ExportPanel({ module, module3Enabled }) {
  const isM3 = module === 'personal_safety';
  // Module 3 export: k locked at 10 in UI, cell size locked at 500.
  const [k, setK] = useState(isM3 ? 10 : 5);
  const [cellSizeM, setCellSizeM] = useState(isM3 ? 500 : 100);
  const [temporal, setTemporal] = useState('day');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isM3) {
      if (k < 10) setK(10);
      if (cellSizeM < 500) setCellSizeM(500);
    }
  }, [isM3]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = {
    k: isM3 ? Math.max(10, k) : k,
    cellSizeM: isM3 ? Math.max(500, cellSizeM) : cellSizeM,
    temporal,
    module,
  };

  const doPreview = async () => {
    setBusy(true);
    try {
      const fc = await fetchExport(params);
      setPreview(fc);
    } finally {
      setBusy(false);
    }
  };

  const csvUrl = exportUrl('csv', params);
  const geoUrl = exportUrl('geojson', params);

  return (
    <div className="analytics-card">
      <h3>Export ({moduleLabels[module] || module})</h3>
      <div className="export-grid">
        <label>
          k (group size)
          <input
            type="number"
            min={1}
            value={k}
            onChange={(e) => setK(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <label>
          Cell size (m)
          <input
            type="number"
            min={10}
            value={cellSizeM}
            onChange={(e) => setCellSizeM(Math.max(10, Number(e.target.value)))}
          />
        </label>
        <label>
          Temporal
          <select value={temporal} onChange={(e) => setTemporal(e.target.value)}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </label>
      </div>

      <div className="modal-actions">
        <button className="ghost-btn" onClick={doPreview} disabled={busy}>
          {busy ? 'Loading…' : 'Preview manifest'}
        </button>
        <a className="primary-btn" href={geoUrl} target="_blank" rel="noreferrer">
          Download GeoJSON
        </a>
        <a className="ghost-btn" href={csvUrl} target="_blank" rel="noreferrer">
          Download CSV
        </a>
      </div>

      {preview && (
        <pre className="manifest-pre">
          {JSON.stringify(preview.privacyManifest, null, 2)}
        </pre>
      )}
    </div>
  );
}
