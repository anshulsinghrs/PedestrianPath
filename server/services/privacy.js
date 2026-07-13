/**
 * Cell-level k-anonymity for PathGuard research exports.
 *
 *   1. Snap each record to a (cell, temporal bucket, mode) group.
 *   2. Drop any group with fewer than k records.
 *   3. Emit one record at the cell centroid with aggregated counts.
 */

function metersPerDegree(latDeg) {
  const latRad = (latDeg * Math.PI) / 180;
  const mPerDegLat =
    111132.92 -
    559.82 * Math.cos(2 * latRad) +
    1.175 * Math.cos(4 * latRad);
  const mPerDegLng =
    111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  return { mPerDegLat, mPerDegLng: Math.max(mPerDegLng, 1e-6) };
}

function temporalBucketKey(date, granularity) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'unknown';
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  if (granularity === 'week') {
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Pick the "mode" key used to stratify groups. For Module 1 this is
 * reporterMode; Module 2 stratifies by hazardType; Module 3 stratifies
 * by concernType so spatial cells don't collapse across categories.
 */
function pickGroupKey(record) {
  if (record.module === 'accident_conflict') {
    return record.reporterMode || record.mobilityMode || 'unknown';
  }
  if (record.module === 'hazard_infrastructure') {
    return record.hazardType || 'unknown';
  }
  if (record.module === 'personal_safety') {
    return record.concernType || 'unknown';
  }
  return record.mobilityMode || 'unknown';
}

/**
 * Aggregate raw incident records under cell-level k-anonymity.
 */
function applyKAnonymity(records, opts) {
  const k = Math.max(1, parseInt(opts?.k, 10) || 5);
  const cellSizeM = Math.max(10, parseInt(opts?.cellSizeM, 10) || 100);
  const temporal = ['day', 'week', 'month'].includes(opts?.temporal)
    ? opts.temporal
    : 'day';

  if (records.length === 0) {
    return {
      rows: [],
      manifest: {
        k_applied: k,
        cellSizeM_applied: cellSizeM,
        temporal_applied: temporal,
        n_input_records: 0,
        n_input_groups: 0,
        n_suppressed_groups: 0,
        n_suppressed_records: 0,
        n_retained_groups: 0,
        n_retained_records: 0,
        retention_fraction: 1,
      },
    };
  }

  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const r of records) {
    const coords = r?.location?.coordinates;
    if (!coords || coords.length !== 2) continue;
    sumLng += coords[0];
    sumLat += coords[1];
    n += 1;
  }
  const lat0 = n ? sumLat / n : 0;
  const lng0 = n ? sumLng / n : 0;
  const { mPerDegLat, mPerDegLng } = metersPerDegree(lat0);
  const cellLatDeg = cellSizeM / mPerDegLat;
  const cellLngDeg = cellSizeM / mPerDegLng;

  const groups = new Map();
  for (const r of records) {
    const coords = r?.location?.coordinates;
    if (!coords || coords.length !== 2) continue;
    const [lng, lat] = coords;
    const cellY = Math.floor((lat - lat0) / cellLatDeg);
    const cellX = Math.floor((lng - lng0) / cellLngDeg);
    const tBucket = temporalBucketKey(r.incidentDate, temporal);
    const groupKey = pickGroupKey(r);
    const key = `${cellX}:${cellY}:${tBucket}:${groupKey}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        cellX,
        cellY,
        temporalBucket: tBucket,
        groupKey,
        records: [],
      };
      groups.set(key, g);
    }
    g.records.push(r);
  }

  const rows = [];
  let suppressedGroups = 0;
  let suppressedRecords = 0;
  let retainedGroups = 0;
  let retainedRecords = 0;

  for (const g of groups.values()) {
    if (g.records.length < k) {
      suppressedGroups += 1;
      suppressedRecords += g.records.length;
      continue;
    }
    retainedGroups += 1;
    retainedRecords += g.records.length;

    const centroidLng = lng0 + (g.cellX + 0.5) * cellLngDeg;
    const centroidLat = lat0 + (g.cellY + 0.5) * cellLatDeg;

    const byPrimary = {};
    const bySeverity = {};
    for (const r of g.records) {
      const primary =
        r.incidentType || r.hazardType || r.concernType || r.type || 'unknown';
      byPrimary[primary] = (byPrimary[primary] || 0) + 1;
      const sev = r.severity || 'minor';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }

    const row = {
      cellId: `${g.cellX}:${g.cellY}`,
      temporalBucket: g.temporalBucket,
      mode: g.groupKey,
      lng: centroidLng,
      lat: centroidLat,
      n_incidents: g.records.length,
      n_by_type: byPrimary,
      n_by_severity: bySeverity,
    };

    const byLighting = {};
    const byWeather = {};
    const byCollisionType = {};
    const byNearMissType = {};
    const byEvasiveAction = {};
    const byHazardCategory = {};
    const byHazardDuration = {};
    const perceivedDangerSum = { sum: 0, n: 0 };
    const perceivedHazardSeveritySum = { sum: 0, n: 0 };
    for (const r of g.records) {
      if (r.lightingCondition) {
        byLighting[r.lightingCondition] =
          (byLighting[r.lightingCondition] || 0) + 1;
      }
      if (r.weather) {
        byWeather[r.weather] = (byWeather[r.weather] || 0) + 1;
      }
      if (r.collisionType) {
        byCollisionType[r.collisionType] =
          (byCollisionType[r.collisionType] || 0) + 1;
      }
      if (r.nearMissType) {
        byNearMissType[r.nearMissType] =
          (byNearMissType[r.nearMissType] || 0) + 1;
      }
      if (r.evasiveAction) {
        byEvasiveAction[r.evasiveAction] =
          (byEvasiveAction[r.evasiveAction] || 0) + 1;
      }
      if (r.hazardCategory) {
        byHazardCategory[r.hazardCategory] =
          (byHazardCategory[r.hazardCategory] || 0) + 1;
      }
      if (r.hazardDuration) {
        byHazardDuration[r.hazardDuration] =
          (byHazardDuration[r.hazardDuration] || 0) + 1;
      }
      if (typeof r.perceivedDangerScale === 'number') {
        perceivedDangerSum.sum += r.perceivedDangerScale;
        perceivedDangerSum.n += 1;
      }
      if (typeof r.hazardSeverityPerceived === 'number') {
        perceivedHazardSeveritySum.sum += r.hazardSeverityPerceived;
        perceivedHazardSeveritySum.n += 1;
      }
    }
    row.n_by_lighting = byLighting;
    row.n_by_weather = byWeather;
    if (Object.keys(byCollisionType).length)
      row.n_by_collisionType = byCollisionType;
    if (Object.keys(byNearMissType).length)
      row.n_by_nearMissType = byNearMissType;
    if (Object.keys(byEvasiveAction).length)
      row.n_by_evasiveAction = byEvasiveAction;
    if (Object.keys(byHazardCategory).length)
      row.n_by_hazardCategory = byHazardCategory;
    if (Object.keys(byHazardDuration).length)
      row.n_by_hazardDuration = byHazardDuration;
    if (perceivedDangerSum.n > 0) {
      row.mean_perceivedDanger =
        perceivedDangerSum.sum / perceivedDangerSum.n;
    }
    if (perceivedHazardSeveritySum.n > 0) {
      row.mean_perceivedHazardSeverity =
        perceivedHazardSeveritySum.sum / perceivedHazardSeveritySum.n;
    }

    rows.push(row);
  }

  const inputRecords = records.length;
  const retention =
    inputRecords > 0
      ? (inputRecords - suppressedRecords) / inputRecords
      : 1;

  return {
    rows,
    manifest: {
      k_applied: k,
      cellSizeM_applied: cellSizeM,
      temporal_applied: temporal,
      cell_centroid_origin_lat: lat0,
      cell_centroid_origin_lng: lng0,
      n_input_records: inputRecords,
      n_input_groups: groups.size,
      n_suppressed_groups: suppressedGroups,
      n_suppressed_records: suppressedRecords,
      n_retained_groups: retainedGroups,
      n_retained_records: retainedRecords,
      retention_fraction: Number(retention.toFixed(6)),
    },
  };
}

module.exports = {
  applyKAnonymity,
  temporalBucketKey,
  metersPerDegree,
};
