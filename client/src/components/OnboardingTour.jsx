import { useState } from 'react';

/**
 * Lightweight multi-step product tour. Renders a centred card that
 * walks the user through the six key concepts of the app. Avoids
 * element-pinpointing (driver.js-style) on purpose — the tour stays
 * useful on mobile and in dark mode, and doesn't break when DOM
 * changes ship later.
 */
const STEPS = [
  {
    emoji: '🗺️',
    title: 'The map is your starting point',
    body:
      'Every existing report is a pin on the map. Click a pin to see details, or use the sidebar filters to focus on a category, mode, or date range.',
  },
  {
    emoji: '➕',
    title: 'Tap "+ Report incident" to begin',
    body:
      'The blue button in the top-right opens the reporting flow. You can also re-open this guide any time from the ? icon in the navbar.',
  },
  {
    emoji: '🏷️',
    title: 'Three reporting categories',
    body:
      '🚲 Accident or near-miss · 🚧 Hazard or infrastructure · 🛟 Personal-safety concern. Pick the one that best fits — you can read more about each in the Guide.',
  },
  {
    emoji: '📍',
    title: 'Pick a location on the map',
    body:
      'Click anywhere on or near a road. The pin snaps to the nearest road segment automatically, so a rough click is usually accurate enough.',
  },
  {
    emoji: '📝',
    title: 'Fill the form — only what you remember',
    body:
      'Most fields are optional. Add a description and a photo if you have one — EXIF and GPS metadata are stripped server-side for your privacy.',
  },
  {
    emoji: '✅',
    title: 'Submit and you\'re done',
    body:
      'Your report appears on the map immediately and feeds the analytics dashboard. Thanks for contributing to safer streets.',
  },
];

export default function OnboardingTour({ onClose }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const isFirst = i === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-tour"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Quick tour</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Skip tour">
            ✕
          </button>
        </div>

        <div className="tour-body">
          <div className="tour-emoji" aria-hidden>
            {step.emoji}
          </div>
          <h3 className="tour-title">{step.title}</h3>
          <p className="tour-text">{step.body}</p>
        </div>

        <div className="tour-progress" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`tour-dot ${idx === i ? 'active' : ''} ${
                idx < i ? 'done' : ''
              }`}
            />
          ))}
        </div>

        <div className="tour-actions">
          <button
            className="ghost-btn"
            onClick={() => setI((v) => v - 1)}
            disabled={isFirst}
          >
            Back
          </button>
          <span className="tour-counter">
            {i + 1} / {STEPS.length}
          </span>
          {isLast ? (
            <button className="primary-btn" onClick={onClose}>
              Finish
            </button>
          ) : (
            <button
              className="primary-btn"
              onClick={() => setI((v) => v + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
