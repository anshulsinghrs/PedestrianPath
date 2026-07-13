import {
  recordPrimaryLabel,
  recordPrimaryColor,
  typeLabels,
  typeColors,
  severityLabels,
  injuryLevelLabels,
  modeLabels,
  modeEmoji,
  reporterModeLabels,
  reporterModeEmoji,
  interactingModeLabels,
  collisionTypeLabels,
  nearMissTypeLabels,
  evasiveActionLabels,
  soloFallContributorLabels,
  hazardCategoryLabels,
  hazardCategoryEmoji,
  m2HazardLabels,
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
  factorLabels,
  labelize,
} from '../utils/incidentTypes.js';
import { resolveImageUrl } from '../services/api.js';

/**
 * Generic key → label resolver: tries each provided map in order and
 * falls back to title-casing the raw value.
 */
function resolveLabel(value, ...maps) {
  if (value == null || value === '') return value;
  for (const m of maps) {
    if (m && m[value]) return m[value];
  }
  return labelize(value);
}

function joinList(list, ...maps) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((v) => resolveLabel(v, ...maps)).join(', ');
}

export default function IncidentDetail({ incident, onClose }) {
  const date = new Date(incident.incidentDate).toLocaleString();
  const lat = incident.lat ?? incident.location?.coordinates?.[1];
  const lng = incident.lng ?? incident.location?.coordinates?.[0];

  // v4.0 records carry `reporterMode`; legacy records use `mobilityMode`.
  const reporterMode = incident.reporterMode || incident.mobilityMode;
  const headerColor = recordPrimaryColor(incident) || typeColors[incident.type];
  const headerLabel =
    recordPrimaryLabel(incident) || typeLabels[incident.type] || incident.type;

  const Row = ({ label, value }) =>
    value === undefined || value === null || value === '' ? null : (
      <div className="detail-row">
        <span className="detail-label">{label}</span>
        <span>{value}</span>
      </div>
    );

  const isM1 = incident.module === 'accident_conflict';
  const isM2 = incident.module === 'hazard_infrastructure';
  const isM3 = incident.module === 'personal_safety';

  return (
    <div className="detail-panel">
      <div className="detail-header" style={{ borderTopColor: headerColor }}>
        <h2>
          {headerLabel}
          <span className="detail-mode-chip">
            {reporterMode
              ? `${reporterModeEmoji[reporterMode] || modeEmoji[reporterMode] || ''} ${
                  reporterModeLabels[reporterMode] || modeLabels[reporterMode] || labelize(reporterMode)
                }`
              : ''}
          </span>
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="detail-body">
        <Row label="When" value={date} />
        <Row
          label="Severity"
          value={severityLabels[incident.severity] || labelize(incident.severity)}
        />
        <Row label="Injury" value={injuryLevelLabels[incident.injuryLevel] || labelize(incident.injuryLevel)} />
        <Row label="Risk score" value={incident.riskScore != null ? `${incident.riskScore}/100` : null} />

        {/* ---------- Module 1 (Mobility Conflict) ---------- */}
        {isM1 && (
          <>
            <Row
              label="Collision type"
              value={resolveLabel(incident.collisionType, collisionTypeLabels)}
            />
            <Row
              label="Near-miss type"
              value={resolveLabel(incident.nearMissType, nearMissTypeLabels)}
            />
            <Row
              label="Evasive action"
              value={resolveLabel(incident.evasiveAction, evasiveActionLabels)}
            />
            <Row
              label="Perceived danger"
              value={
                incident.perceivedDangerScale != null
                  ? `${incident.perceivedDangerScale} / 5`
                  : null
              }
            />
            <Row
              label="Solo-fall contributors"
              value={joinList(incident.soloFallContributors, soloFallContributorLabels)}
            />
            <Row
              label="Other parties"
              value={joinList(incident.interactingModes, interactingModeLabels)}
            />
            <Row
              label="Affected future route"
              value={
                incident.affectsFutureRoute === true
                  ? 'Yes'
                  : incident.affectsFutureRoute === false
                  ? 'No'
                  : null
              }
            />
            <Row
              label="Repeat exposure"
              value={resolveLabel(incident.repeatLocationHistory, repeatExposureLabels)}
            />
          </>
        )}

        {/* ---------- Module 2 (Hazard) ---------- */}
        {isM2 && (
          <>
            <Row
              label="Hazard category"
              value={
                incident.hazardCategory
                  ? `${hazardCategoryEmoji[incident.hazardCategory] || ''} ${
                      hazardCategoryLabels[incident.hazardCategory] || labelize(incident.hazardCategory)
                    }`
                  : null
              }
            />
            <Row
              label="Hazard type"
              value={resolveLabel(incident.hazardType, m2HazardLabels)}
            />
            <Row
              label="Perceived severity"
              value={
                incident.hazardSeverityPerceived != null
                  ? `${incident.hazardSeverityPerceived} / 5`
                  : null
              }
            />
            <Row
              label="How long present"
              value={resolveLabel(incident.hazardDuration, hazardDurationLabels)}
            />
            <Row
              label="Most noticeable when"
              value={joinList(
                incident.hazardVisibilityConditions,
                hazardVisibilityLabels
              )}
            />
            <Row
              label="Most-affected groups"
              value={joinList(incident.affectedUserGroups, reporterModeLabels)}
            />
            <Row
              label="Behaviour affected"
              value={
                incident.behaviorAffected === true
                  ? 'Yes'
                  : incident.behaviorAffected === false
                  ? 'No'
                  : null
              }
            />
            <Row
              label="Behavioural impact"
              value={joinList(
                incident.behavioralImpactTypes,
                behavioralImpactLabels
              )}
            />
          </>
        )}

        {/* ---------- Module 3 (Perceived Safety) ---------- */}
        {isM3 && (
          <>
            <Row
              label="Concern"
              value={resolveLabel(incident.concernType, m3ConcernLabels)}
            />
            <Row
              label="Mobility activity"
              value={resolveLabel(
                incident.mobilityActivity,
                m3MobilityActivityLabels
              )}
            />
            <Row
              label="Environmental context"
              value={joinList(
                incident.environmentalContext,
                m3EnvironmentLabels
              )}
            />
            <Row
              label="Perceived risk"
              value={
                incident.perceivedRiskLevel != null
                  ? `${incident.perceivedRiskLevel} / 5`
                  : null
              }
            />
            <Row
              label="Time of day"
              value={resolveLabel(incident.timeOfDayContext, timeOfDayLabels)}
            />
            <Row
              label="Crowd level"
              value={resolveLabel(incident.crowdLevel, crowdLevelLabels)}
            />
            <Row
              label="Social context"
              value={resolveLabel(incident.socialContext, socialContextLabels)}
            />
            <Row
              label="Repeat exposure"
              value={resolveLabel(incident.repeatExposure, repeatExposureLabels)}
            />
            <Row
              label="Behaviour affected"
              value={
                incident.behaviorAffected === true
                  ? 'Yes'
                  : incident.behaviorAffected === false
                  ? 'No'
                  : null
              }
            />
            <Row
              label="Behavioural adaptations"
              value={joinList(
                incident.behavioralAdaptations,
                behavioralAdaptationLabels
              )}
            />
            <Row
              label="Intervention preferences"
              value={joinList(
                incident.interventionPreferences,
                interventionPreferenceLabels
              )}
            />
          </>
        )}

        {/* ---------- Shared context ---------- */}
        <Row label="Trip purpose" value={labelize(incident.tripPurpose)} />
        <Row label="Road type" value={labelize(incident.roadType)} />
        <Row label="Crossing" value={labelize(incident.crossingType)} />
        <Row label="Weather" value={labelize(incident.weather)} />
        <Row label="Lighting" value={labelize(incident.lightingCondition)} />
        <Row label="School zone" value={incident.schoolZone ? 'Yes' : null} />
        <Row
          label="Infrastructure factors"
          value={joinList(
            incident.infrastructureContributingFactors,
            factorLabels
          )}
        />

        {/* ---------- Demographics (optional, all modules) ---------- */}
        {incident.demographics && (
          <>
            <Row
              label="Reporter age"
              value={resolveLabel(
                incident.demographics.ageGroup,
                ageGroupLabels
              )}
            />
            <Row
              label="Reporter gender"
              value={resolveLabel(incident.demographics.gender, genderLabels)}
            />
            <Row
              label="Mode usage"
              value={resolveLabel(
                incident.demographics.modeUsageFrequency,
                modeUsageFrequencyLabels
              )}
            />
          </>
        )}

        <Row
          label="Location"
          value={
            lat != null && lng != null
              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : null
          }
        />
        <Row
          label="Reported by"
          value={
            incident.isAnonymous
              ? 'Anonymous'
              : incident.reporter?.name || '—'
          }
        />
        <Row
          label="Schema"
          value={incident.schemaVersion ? `v${incident.schemaVersion}` : null}
        />

        {incident.description && (
          <div className="detail-description">
            <span className="detail-label">Description</span>
            <p>{incident.description}</p>
          </div>
        )}
        {incident.imageUrl && !isM3 && (
          <img
            src={resolveImageUrl(incident.imageUrl)}
            alt="Incident"
            className="detail-image"
          />
        )}
        {incident.videoUrl && !isM3 && (
          <video
            controls
            src={resolveImageUrl(incident.videoUrl)}
            className="detail-image"
          />
        )}
        {incident.aiAnalysis && !isM3 && (
          <AiAnalysisPanel analysis={incident.aiAnalysis} />
        )}
        <div className="detail-meta">
          Reported {new Date(incident.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the AI image-analysis predictions stored with a hazard report
 * (services/vision). Shows detected features, the auto-generated caption,
 * and the suggested severity.
 */
function AiAnalysisPanel({ analysis }) {
  const det = analysis.detections || {};
  const detected = Object.entries(det)
    .filter(([key, v]) =>
      key === 'lighting' ? v?.level && v.level !== 'unknown' : v?.present
    )
    .map(([key, v]) => (key === 'lighting' ? `${v.level} lighting` : key));

  return (
    <div className="detail-ai">
      <span className="detail-label">
        🤖 AI analysis
        <span className="detail-ai-provider"> · {analysis.provider}</span>
      </span>
      {analysis.description && <p className="detail-ai-caption">{analysis.description}</p>}
      {detected.length > 0 && (
        <div className="detail-ai-tags">
          {detected.map((d) => (
            <span key={d} className="detail-ai-tag">{d}</span>
          ))}
        </div>
      )}
      <div className="detail-ai-meta">
        {analysis.walkabilityEstimate != null && (
          <span>Walkability ≈ {analysis.walkabilityEstimate}/100</span>
        )}
        {analysis.suggestedSeverity && (
          <span>Suggested severity: <strong>{analysis.suggestedSeverity}</strong></span>
        )}
      </div>
    </div>
  );
}
