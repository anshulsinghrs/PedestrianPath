"""
PathGuard analytics microservice.

Stateless FastAPI service that computes spatial statistics on the points
sent by the Node API. The service holds no DB connection; the Node side
fetches incidents from Mongo, calls this service over HTTP, and returns
the result to the client.

Endpoints:
    POST /kde         Kernel-density estimate, returned as GeoJSON.
    POST /getis-ord   Getis-Ord Gi* local statistic per point.
    GET  /health      Liveness probe.
"""

from __future__ import annotations

import math
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from scipy.stats import gaussian_kde, norm

app = FastAPI(
    title="PathGuard Analytics",
    version="3.0.0",
    description="Spatial statistics for vulnerable-road-user safety reports.",
)


# ---------------- Input models ----------------


class Point(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    weight: float = 1.0
    value: Optional[float] = None  # used by Getis-Ord


class KDERequest(BaseModel):
    points: List[Point]
    bandwidth: Optional[float] = None  # in metres; None => Silverman
    resolution_m: float = 50.0
    bbox_padding_m: float = 500.0


class GetisOrdRequest(BaseModel):
    points: List[Point]
    distance_m: float = 200.0


class TemporalEvent(BaseModel):
    """A single timestamped observation, optionally weighted."""

    timestamp: str  # ISO-8601
    weight: float = 1.0


class TemporalPatternRequest(BaseModel):
    events: List[TemporalEvent]
    # If True, include 95% normal-approximation CIs alongside counts.
    include_ci: bool = True


# ---------------- Helpers ----------------


def _meters_per_degree(lat_deg: float) -> tuple[float, float]:
    """Approximate meters per degree (lat, lng) at the given latitude."""
    lat_rad = math.radians(lat_deg)
    m_per_deg_lat = 111_132.92 - 559.82 * math.cos(2 * lat_rad) + 1.175 * math.cos(
        4 * lat_rad
    )
    m_per_deg_lng = 111_412.84 * math.cos(lat_rad) - 93.5 * math.cos(3 * lat_rad)
    return m_per_deg_lat, max(m_per_deg_lng, 1e-6)


def _project_to_local_meters(
    lats: np.ndarray, lngs: np.ndarray
) -> tuple[np.ndarray, np.ndarray, float, float]:
    """Project lat/lng into a local metric frame centred on the data centroid."""
    lat0 = float(np.mean(lats))
    lng0 = float(np.mean(lngs))
    m_lat, m_lng = _meters_per_degree(lat0)
    y = (lats - lat0) * m_lat
    x = (lngs - lng0) * m_lng
    return x, y, lat0, lng0


def _unproject(
    xs: np.ndarray, ys: np.ndarray, lat0: float, lng0: float
) -> tuple[np.ndarray, np.ndarray]:
    m_lat, m_lng = _meters_per_degree(lat0)
    lats = lat0 + ys / m_lat
    lngs = lng0 + xs / m_lng
    return lats, lngs


# ---------------- Routes ----------------


@app.get("/health")
def health():
    return {"status": "ok", "service": "pathguard-analytics", "version": "3.0.0"}


@app.post("/kde")
def kde(req: KDERequest):
    """
    Gaussian kernel-density estimate.

    Bandwidth is interpreted in metres and converted to the local metric
    frame. Default uses Silverman's rule of thumb on the projected data.
    Returns a GeoJSON FeatureCollection of grid centroids with a density
    value, suitable for direct map rendering.
    """
    if len(req.points) < 3:
        raise HTTPException(
            status_code=422,
            detail="At least 3 points are required to compute a KDE.",
        )

    lats = np.array([p.lat for p in req.points], dtype=float)
    lngs = np.array([p.lng for p in req.points], dtype=float)
    weights = np.array([max(p.weight, 0.0) for p in req.points], dtype=float)
    if weights.sum() == 0:
        weights = np.ones_like(weights)

    x, y, lat0, lng0 = _project_to_local_meters(lats, lngs)

    pad = max(req.bbox_padding_m, req.resolution_m)
    x_min, x_max = float(x.min()) - pad, float(x.max()) + pad
    y_min, y_max = float(y.min()) - pad, float(y.max()) + pad

    # Cap grid size to keep response sizes sane.
    max_cells_per_axis = 200
    nx = min(max_cells_per_axis, max(2, int((x_max - x_min) / req.resolution_m)))
    ny = min(max_cells_per_axis, max(2, int((y_max - y_min) / req.resolution_m)))
    xs = np.linspace(x_min, x_max, nx)
    ys = np.linspace(y_min, y_max, ny)
    gx, gy = np.meshgrid(xs, ys)

    data = np.vstack([x, y])
    try:
        kernel = gaussian_kde(data, weights=weights, bw_method="silverman")
    except np.linalg.LinAlgError:
        # Degenerate (collinear) points — jitter slightly.
        jitter = np.random.default_rng(0).normal(scale=1.0, size=data.shape)
        kernel = gaussian_kde(data + jitter, weights=weights, bw_method="silverman")

    if req.bandwidth is not None and req.bandwidth > 0:
        # Override Silverman with a metres-valued bandwidth.
        data_std = float(np.std(data, axis=1).mean())
        if data_std > 0:
            kernel.set_bandwidth(bw_method=req.bandwidth / data_std)

    grid_points = np.vstack([gx.ravel(), gy.ravel()])
    density = kernel(grid_points).reshape(gx.shape)

    # Rescale to [0, 1] for visualisation.
    dmin, dmax = float(density.min()), float(density.max())
    drange = dmax - dmin if dmax > dmin else 1.0
    density_norm = (density - dmin) / drange

    cell_lats, cell_lngs = _unproject(gx.ravel(), gy.ravel(), lat0, lng0)
    flat_norm = density_norm.ravel()
    flat_raw = density.ravel()

    # Drop near-zero cells to keep payload small.
    keep_mask = flat_norm > 0.02
    features = []
    for i in np.flatnonzero(keep_mask):
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(cell_lngs[i]), float(cell_lats[i])],
                },
                "properties": {
                    "density": float(flat_raw[i]),
                    "density_norm": float(flat_norm[i]),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "n_points": int(len(req.points)),
            "grid_nx": int(nx),
            "grid_ny": int(ny),
            "resolution_m": float(req.resolution_m),
            "bandwidth_applied": (
                float(req.bandwidth) if req.bandwidth else "silverman"
            ),
            "density_min": dmin,
            "density_max": dmax,
        },
    }


@app.post("/getis-ord")
def getis_ord(req: GetisOrdRequest):
    """
    Local Getis-Ord Gi* statistic per point, with HH/HL/LH/LL/NS labels.

    Uses a fixed-distance weights matrix in the local metric frame. The
    z-score and a two-sided p-value are returned alongside the classification.
    """
    if len(req.points) < 5:
        raise HTTPException(
            status_code=422,
            detail="At least 5 points are required for Getis-Ord.",
        )

    lats = np.array([p.lat for p in req.points], dtype=float)
    lngs = np.array([p.lng for p in req.points], dtype=float)
    values = np.array(
        [(p.value if p.value is not None else p.weight) for p in req.points],
        dtype=float,
    )
    x, y, lat0, lng0 = _project_to_local_meters(lats, lngs)

    coords = np.column_stack([x, y])
    n = coords.shape[0]
    # Pairwise squared distances.
    diff = coords[:, None, :] - coords[None, :, :]
    d2 = np.sum(diff * diff, axis=2)
    np.fill_diagonal(d2, np.inf)
    threshold2 = req.distance_m ** 2
    W = (d2 <= threshold2).astype(float)

    # Row-standardise so that isolated points don't blow up.
    row_sums = W.sum(axis=1)
    safe_rows = np.where(row_sums > 0, row_sums, 1)
    W_norm = W / safe_rows[:, None]

    mean_v = float(values.mean())
    std_v = float(values.std(ddof=0))
    if std_v == 0:
        std_v = 1e-9

    lag = W_norm @ values
    # Gi* z-score: standardised difference of local mean from global mean.
    z = (lag - mean_v) / (std_v / np.sqrt(np.maximum(row_sums, 1)))
    p_two = 2 * (1 - norm.cdf(np.abs(z)))

    def classify(zi: float, vi: float) -> str:
        if abs(zi) < 1.96:
            return "NS"
        high_v = vi > mean_v
        high_neighbours = zi > 0
        if high_v and high_neighbours:
            return "HH"
        if (not high_v) and (not high_neighbours):
            return "LL"
        if high_v and (not high_neighbours):
            return "HL"
        return "LH"

    features = []
    for i in range(n):
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(lngs[i]), float(lats[i])],
                },
                "properties": {
                    "value": float(values[i]),
                    "z_score": float(z[i]),
                    "p_value": float(p_two[i]),
                    "cluster": classify(float(z[i]), float(values[i])),
                    "neighbours": int(row_sums[i]),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "n_points": int(n),
            "distance_m": float(req.distance_m),
            "global_mean": mean_v,
            "global_std": std_v,
        },
    }


class RiskFeatures(BaseModel):
    """Raw features from a single incident used to compute a risk score."""

    module: str = "accident_conflict"
    severity: str = "minor"
    injury_level: str = "none"
    weather: str = "clear"
    lighting_condition: str = "daylight"
    school_zone: bool = False
    reporter_mode: str = "cyclist"
    incident_type: Optional[str] = None
    collision_type: Optional[str] = None
    perceived_danger_scale: Optional[float] = None
    hazard_severity_perceived: Optional[float] = None
    perceived_risk_level: Optional[float] = None
    affect_future_route: Optional[bool] = None
    repeat_exposure: Optional[str] = None
    concern_type: Optional[str] = None
    hour_of_day: Optional[int] = None


# Domain-knowledge feature weights (logit scale). These encode the relative
# contribution of each feature to risk. Intercept is set so that a "minor
# collision in daylight, clear weather" maps to ~20/100.
_WEIGHTS: dict[str, dict[str, float]] = {
    "severity": {"minor": 0.0, "moderate": 1.2, "major": 2.4, "fatal": 3.8},
    "injury_level": {"none": 0.0, "minor": 0.5, "serious": 1.2, "severe": 2.0, "fatal": 3.0},
    "weather": {"clear": 0.0, "cloudy": 0.1, "fog": 0.9, "rain": 0.7, "snow": 1.1, "storm": 1.3},
    "lighting": {"daylight": 0.0, "overcast": 0.1, "dusk": 0.5, "dawn": 0.4, "dark_lit": 0.6, "dark_unlit": 1.2},
    "reporter_mode": {
        "pedestrian": 0.6, "wheelchair": 0.8, "cyclist": 0.3, "ebike_scooter": 0.3,
        "two_wheeler": 0.1, "car_driver": -0.1, "public_transport": 0.0, "observer": -0.2, "other": 0.0,
    },
    "incident_type": {
        "collision": 2.0, "near_miss": 0.8, "forced_evasive": 0.9, "aggressive_interaction": 0.7,
        "solo_fall": 0.5, "harassment": 0.6, "physical_assault": 2.5,
    },
    "collision_type": {
        "head_on": 2.0, "rear_end": 1.0, "side_swipe": 0.8, "t_bone": 1.5,
        "run_over": 2.5, "dooring": 0.9,
    },
    "repeat_exposure": {
        "first_time": 0.0, "occasional": 0.2, "frequent": 0.5, "daily": 0.8,
    },
    "concern_type": {
        "harassment": 0.8, "stalking": 1.2, "physical_threat": 1.8,
        "unsafe_lighting": 0.6, "unsafe_route": 0.5,
    },
}

_INTERCEPT = -1.5  # maps to ~18% base probability ≈ score 18/100


def _logistic(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


@app.post("/risk-score")
def risk_score(req: RiskFeatures):
    """
    Feature-weighted logistic risk score for a single incident.

    Returns a score in [0, 100] where higher means greater inferred risk.
    Uses domain-knowledge weights rather than fitted parameters so the
    endpoint works without training data.
    """
    logit = _INTERCEPT

    logit += _WEIGHTS["severity"].get(req.severity, 0.0)
    logit += _WEIGHTS["injury_level"].get(req.injury_level, 0.0)
    logit += _WEIGHTS["weather"].get(req.weather, 0.0)
    logit += _WEIGHTS["lighting"].get(req.lighting_condition, 0.0)
    logit += _WEIGHTS["reporter_mode"].get(req.reporter_mode, 0.0)

    if req.school_zone:
        logit += 0.4
    if req.incident_type:
        logit += _WEIGHTS["incident_type"].get(req.incident_type, 0.0)
    if req.collision_type:
        logit += _WEIGHTS["collision_type"].get(req.collision_type, 0.0)
    if req.repeat_exposure:
        logit += _WEIGHTS["repeat_exposure"].get(req.repeat_exposure, 0.0)
    if req.concern_type:
        logit += _WEIGHTS["concern_type"].get(req.concern_type, 0.0)

    # Continuous scales — normalise to [0, 1] then weight.
    if req.perceived_danger_scale is not None:
        logit += ((req.perceived_danger_scale - 1) / 4) * 1.5
    if req.hazard_severity_perceived is not None:
        logit += ((req.hazard_severity_perceived - 1) / 4) * 1.2
    if req.perceived_risk_level is not None:
        logit += ((req.perceived_risk_level - 1) / 4) * 1.0

    # Night-time hours add extra risk.
    if req.hour_of_day is not None and (req.hour_of_day >= 21 or req.hour_of_day <= 5):
        logit += 0.5

    # Route-change intention signals serious perceived risk.
    if req.affect_future_route is True:
        logit += 0.3

    score = round(_logistic(logit) * 100, 1)
    return {
        "risk_score": score,
        "logit": round(logit, 4),
        "probability": round(_logistic(logit), 4),
        "band": "high" if score >= 70 else "medium" if score >= 40 else "low",
    }


@app.post("/temporal-pattern")
def temporal_pattern(req: TemporalPatternRequest):
    """
    Hour-of-day and day-of-week aggregations with optional 95% normal-
    approximation CIs. Used by all three modules; for Module 3 this is
    one of the few endpoints that surface aggregated information.
    """
    if not req.events:
        return {
            "by_hour": [],
            "by_dow": [],
            "metadata": {"n_events": 0},
        }

    from datetime import datetime

    by_hour: dict[int, float] = {}
    by_dow: dict[int, float] = {}
    n_parsed = 0
    for ev in req.events:
        try:
            t = datetime.fromisoformat(ev.timestamp.replace("Z", "+00:00"))
        except ValueError:
            continue
        n_parsed += 1
        w = max(float(ev.weight), 0.0)
        by_hour[t.hour] = by_hour.get(t.hour, 0.0) + w
        by_dow[t.weekday()] = by_dow.get(t.weekday(), 0.0) + w

    def with_ci(buckets: dict[int, float], n_buckets: int) -> list[dict]:
        rows = []
        total = sum(buckets.values()) or 1.0
        for key in range(n_buckets):
            count = buckets.get(key, 0.0)
            p = count / total if total > 0 else 0.0
            if req.include_ci and total >= 30:
                # Normal-approximation 95% CI on the proportion.
                se = math.sqrt(max(p * (1 - p) / total, 1e-12))
                lo = max(0.0, p - 1.96 * se)
                hi = min(1.0, p + 1.96 * se)
            else:
                lo = hi = p
            rows.append(
                {
                    "key": key,
                    "count": count,
                    "share": p,
                    "ci_low": lo,
                    "ci_high": hi,
                }
            )
        return rows

    return {
        "by_hour": with_ci(by_hour, 24),
        "by_dow": with_ci(by_dow, 7),
        "metadata": {
            "n_events_input": int(len(req.events)),
            "n_events_parsed": int(n_parsed),
        },
    }
