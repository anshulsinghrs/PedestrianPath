/**
 * Auto-detect environmental context for a clicked map location.
 *
 *  - Weather  : Open-Meteo (open-meteo.com) — completely free, no API
 *               key, supports historical lookups when the incident
 *               date is in the past.
 *  - Road type: Overpass API — queries OpenStreetMap for the nearest
 *               highway-tagged way within 25 m and maps the OSM
 *               `highway` value onto our internal road-type enum.
 *
 * Both calls return null on failure so the caller can fall back to
 * 'unknown' silently — auto-detection should never block a user's
 * report submission.
 */

// ---------- Weather (Open-Meteo) ---------------------------------------

// WMO weather codes → our `weatherOptions` enum.
// https://open-meteo.com/en/docs has the full table.
function wmoCodeToWeather(code) {
  if (code == null) return null;
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'clear'; // mainly clear / partly cloudy
  if (code === 3) return 'clear'; // overcast — closest mapping
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return null;
}

/**
 * Resolve the weather category for a lat/lng + ISO timestamp.
 * Returns one of weatherOptions or null on failure.
 */
export async function fetchWeatherForLocation(lat, lng, isoDate) {
  try {
    const when = isoDate ? new Date(isoDate) : new Date();
    const now = new Date();
    const hoursAgo = (now.getTime() - when.getTime()) / 3_600_000;

    let url;
    if (hoursAgo > 24) {
      // Historical — Open-Meteo's archive API
      const d = when.toISOString().slice(0, 10);
      url =
        `https://archive-api.open-meteo.com/v1/archive` +
        `?latitude=${lat}&longitude=${lng}` +
        `&start_date=${d}&end_date=${d}` +
        `&hourly=weather_code&timezone=auto`;
    } else {
      // Recent / current — forecast API also serves the last 48h
      url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lng}` +
        `&current=weather_code&timezone=auto`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.current?.weather_code != null) {
      return wmoCodeToWeather(data.current.weather_code);
    }
    // Historical: pick the hour closest to `when`.
    const times = data.hourly?.time || [];
    const codes = data.hourly?.weather_code || [];
    if (!times.length) return null;
    const targetHour = when.toISOString().slice(0, 13);
    let idx = times.findIndex((t) => t.startsWith(targetHour));
    if (idx < 0) idx = Math.floor(times.length / 2);
    return wmoCodeToWeather(codes[idx]);
  } catch {
    return null;
  }
}

// ---------- Road type (Overpass / OSM) ---------------------------------

// OSM highway tag → our `roadTypes` enum.
function osmHighwayToRoadType(tag) {
  if (!tag) return null;
  if (['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(tag))
    return 'highway';
  if (['primary', 'primary_link', 'secondary', 'secondary_link'].includes(tag))
    return 'arterial';
  if (
    ['residential', 'tertiary', 'tertiary_link', 'living_street', 'unclassified', 'service'].includes(
      tag
    )
  )
    return 'residential';
  if (['cycleway'].includes(tag)) return 'bike_lane';
  if (['footway', 'sidewalk', 'steps'].includes(tag)) return 'footpath';
  if (['path', 'track'].includes(tag)) return 'shared_path';
  if (['pedestrian'].includes(tag)) return 'pedestrian_zone';
  return null;
}

/**
 * Resolve the road type for a lat/lng. Returns one of roadTypes or
 * null on failure. Uses Overpass which has a relaxed but real
 * rate-limit; cap the timeout to 5 s and just give up on failure.
 */
export async function fetchRoadTypeForLocation(lat, lng) {
  try {
    const query =
      `[out:json][timeout:5];` +
      `way(around:25,${lat},${lng})[highway];` +
      `out tags 1;`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const tag = data.elements?.[0]?.tags?.highway;
    return osmHighwayToRoadType(tag);
  } catch {
    return null;
  }
}

// ---------- Combined ---------------------------------------------------

/**
 * Fetch weather + road type in parallel. Returns an object with
 * whichever fields could be auto-detected; missing fields are simply
 * absent (callers should fall back to user input or 'unknown').
 */
export async function fetchLocationContext({ lat, lng, isoDate }) {
  const [weather, roadType] = await Promise.all([
    fetchWeatherForLocation(lat, lng, isoDate),
    fetchRoadTypeForLocation(lat, lng),
  ]);
  const out = {};
  if (weather) out.weather = weather;
  if (roadType) out.roadType = roadType;
  return out;
}
