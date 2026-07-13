/**
 * Small geodesy helpers shared by the routing engine. Pure functions,
 * no dependencies — units are metres and decimal degrees throughout.
 */
'use strict';

const R = 6371008.8; // mean Earth radius, metres (IUGG)

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between [lng,lat] pairs. */
function haversine(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Bounding box [minLng,minLat,maxLng,maxLat] around two points + margin (m). */
function bboxAround(a, b, marginMeters = 400) {
  const minLng = Math.min(a[0], b[0]);
  const maxLng = Math.max(a[0], b[0]);
  const minLat = Math.min(a[1], b[1]);
  const maxLat = Math.max(a[1], b[1]);
  const midLat = (minLat + maxLat) / 2;
  const dLat = marginMeters / 111320;
  const dLng = marginMeters / (111320 * Math.cos(toRad(midLat)) || 1);
  return [minLng - dLng, minLat - dLat, maxLng + dLng, maxLat + dLat];
}

module.exports = { haversine, bboxAround, toRad, EARTH_RADIUS: R };
