import { useState } from 'react';
import DynamicReportForm from './DynamicReportForm.jsx';
import { createHazardInfrastructure } from '../services/api.js';
import { useIncidents } from '../context/IncidentContext.jsx';
import { extractApiError } from '../utils/apiError.js';
import ThankYouPage from './ThankYouPage.jsx';

/**
 * Module 2 — Mobility-Relevant Hazard Reporting.
 *
 * Thin wrapper around the schema-driven DynamicReportForm. Maps the
 * v4.0 hazardCategory + hazardType + behavioural-impact fields back
 * onto the existing `/api/incidents/hazard-infrastructure` endpoint.
 */
export default function Module2Form({ location, onClose }) {
  const { addIncident } = useIncidents();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      const append = (k, v) => {
        if (v === '' || v == null) return;
        fd.append(k, v);
      };

      // Core
      append('hazardType', form.hazardType);
      append('hazardCategory', form.hazardCategory);
      append('severity', form.severity || 'moderate');
      append(
        'incidentDate',
        new Date(form.incidentDate || Date.now()).toISOString()
      );
      append('lat', location.lat);
      append('lng', location.lng);
      append('reporterMode', form.reporterMode || 'pedestrian');

      // v4.0 hazard-specific
      append('hazardSeverityPerceived', form.hazardSeverityPerceived);
      append('hazardDuration', form.hazardDuration);
      appendList(fd, 'hazardVisibilityConditions', form.hazardVisibilityConditions);
      appendList(fd, 'affectedUserGroups', form.affectedUserGroups);
      append('behaviorAffected', boolToString(form.behaviorAffected));
      appendList(fd, 'behavioralImpactTypes', form.behavioralImpactTypes);

      // Environment
      append('weather', form.weather || 'unknown');
      append('lightingCondition', form.lightingCondition || 'unknown');
      append('roadType', form.roadType || 'unknown');
      appendList(
        fd,
        'infrastructureContributingFactors',
        form.infrastructureContributingFactors
      );

      // Media
      append('description', form.description);
      if (form.image) fd.append('image', form.image);
      if (form.video) fd.append('video', form.video);

      if (form.demographics && Object.keys(form.demographics).length) {
        fd.append('demographics', JSON.stringify(form.demographics));
      }

      const created = await createHazardInfrastructure(fd);
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
      moduleKey="hazard_infrastructure"
      location={location}
      onClose={onClose}
      onSubmit={handleSubmit}
      initialState={{
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
