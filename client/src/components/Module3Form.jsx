import { useState } from 'react';
import DynamicReportForm from './DynamicReportForm.jsx';
import { createPersonalSafety } from '../services/api.js';
import { useIncidents } from '../context/IncidentContext.jsx';
import { extractApiError } from '../utils/apiError.js';
import ThankYouPage from './ThankYouPage.jsx';

export default function Module3Form({ location, onClose }) {
  const { addIncident } = useIncidents();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        mobilityActivity: form.mobilityActivity,
        concernType: form.concernType,
        transitStopLit: form.transitStopLit,
        transitWaitMinutes: form.transitWaitMinutes,
        transitOthersWaiting: form.transitOthersWaiting,
        crossingType: form.crossingType,
        crossingSignal: form.crossingSignal,
        crossingVehicleYielded: form.crossingVehicleYielded,
        environmentalContext: form.environmentalContext,
        infrastructureContributingFactors: form.infrastructureContributingFactors,
        timeOfDayContext: form.timeOfDayContext,
        perceivedRiskLevel: form.perceivedRiskLevel,
        crowdLevel: form.crowdLevel,
        lightingCondition: form.lightingCondition,
        behaviorAffected: form.behaviorAffected,
        behavioralAdaptations: form.behavioralAdaptations,
        interventionPreferences: form.interventionPreferences,
        repeatExposure: form.repeatExposure,
        socialContext: form.socialContext,
        description: form.description,
        consentForResearch: form.consentForResearch ?? true,
        exportSuppressed: form.exportSuppressed ?? false,
        demographics: form.demographics,
        lat: location.lat,
        lng: location.lng,
        incidentDate: new Date(form.incidentDate || Date.now()).toISOString(),
      };

      const created = await createPersonalSafety(body);
      addIncident(created);
      setSubmitted(true);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <ThankYouPage variant="m3" onClose={onClose} />;
  }

  return (
    <DynamicReportForm
      moduleKey="personal_safety"
      location={location}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    />
  );
}
