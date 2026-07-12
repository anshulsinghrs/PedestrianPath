import { useState } from 'react';
import DynamicReportForm from './DynamicReportForm.jsx';
import { createAccidentConflict } from '../services/api.js';
import { useIncidents } from '../context/IncidentContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { extractApiError } from '../utils/apiError.js';
import ThankYouPage from './ThankYouPage.jsx';

/**
 * Module 1 — Mobility Conflict & Surrogate Safety Reporting.
 *
 * Thin wrapper around the schema-driven DynamicReportForm. The wrapper's
 * job is to:
 *   1. seed the form with sensible defaults derived from the signed-in
 *      user's mobilityMode (if any),
 *   2. translate the form state into the multipart payload our existing
 *      `/api/incidents/accident-conflict` endpoint expects, and
 *   3. flatten v4.0-only fields into the legacy `interactingMode` /
 *      `interactionType` slots so the existing analytics pipeline keeps
 *      working while we transition.
 */
export default function Module1Form({ location, onClose }) {
  const { addIncident } = useIncidents();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const defaultMode = user?.mobilityMode || 'cyclist';

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      const append = (k, v) => {
        if (v === '' || v == null) return;
        fd.append(k, v);
      };

      // Core required fields
      append('reporterMode', form.reporterMode);
      append('incidentType', form.incidentType);
      append('severity', form.severity || 'minor');
      append('injuryLevel', form.injuryLevel || 'none');
      append(
        'incidentDate',
        new Date(form.incidentDate || Date.now()).toISOString()
      );
      append('lat', location.lat);
      append('lng', location.lng);

      // v4.0 conflict fields
      append('collisionType', form.collisionType);
      append('nearMissType', form.nearMissType);
      append('evasiveAction', form.evasiveAction);
      append('perceivedDangerScale', form.perceivedDangerScale);
      append('affectsFutureRoute', boolToString(form.affectsFutureRoute));
      append('repeatLocationHistory', form.repeatLocationHistory);
      append('indirectContribution', boolToString(form.indirectContribution));
      appendList(fd, 'soloFallContributors', form.soloFallContributors);
      appendList(fd, 'interactingModes', form.interactingModes);

      // Map v4.0 fields back onto the legacy single-valued slots so
      // existing analytics endpoints keep returning useful counts.
      const firstInteractingMode = (form.interactingModes || []).find(Boolean);
      if (firstInteractingMode) append('interactingMode', firstInteractingMode);
      append('interactionType', form.collisionType || form.nearMissType);

      // Environment
      append('weather', form.weather || 'unknown');
      append('lightingCondition', form.lightingCondition || 'unknown');
      append('roadType', form.roadType || 'unknown');
      append('crossingType', form.crossingType);
      appendList(
        fd,
        'infrastructureContributingFactors',
        form.infrastructureContributingFactors
      );

      // Narrative / media
      append('description', form.description);
      if (form.image) fd.append('image', form.image);
      if (form.video) fd.append('video', form.video);

      // Demographics (sent as a JSON blob so they live in extras on the
      // server without forcing schema changes for partial deployments)
      if (form.demographics && Object.keys(form.demographics).length) {
        fd.append('demographics', JSON.stringify(form.demographics));
      }

      const created = await createAccidentConflict(fd);
      addIncident(created);
      setSubmitted(true);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <ThankYouPage onClose={onClose} />;
  }

  const auto = location?.autoContext || {};
  return (
    <DynamicReportForm
      moduleKey="accident_conflict"
      location={location}
      onClose={onClose}
      onSubmit={handleSubmit}
      initialState={{
        reporterMode: defaultMode,
        ...(auto.weather ? { weather: auto.weather } : {}),
        ...(auto.roadType ? { roadType: auto.roadType } : {}),
      }}
      submitting={submitting}
      error={error}
    />
  );
}

function boolToString(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  return undefined;
}

function appendList(fd, key, list) {
  if (Array.isArray(list) && list.length) {
    fd.append(key, list.join(','));
  }
}
