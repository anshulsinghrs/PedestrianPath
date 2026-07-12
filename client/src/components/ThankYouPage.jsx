/**
 * Final-screen confirmation shown after a report is successfully
 * submitted. Replaces the previous 1.2-second auto-closing toast with
 * a deliberate "page 7" that:
 *
 *   - Acknowledges the contribution
 *   - Explains what happens next
 *   - Offers explicit "Close" and "Submit another" actions
 *
 * The variant prop ('default' | 'm3') just adds the .modal-m3 class
 * so personal-safety reports keep the calmer purple chrome they have
 * everywhere else.
 */
export default function ThankYouPage({
  variant = 'default',
  onClose,
  onSubmitAnother,
}) {
  return (
    <div className="modal-backdrop">
      <div
        className={`modal modal-thankyou ${variant === 'm3' ? 'modal-m3' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="thankyou-hero">
          <div className="thankyou-emoji" aria-hidden>✅</div>
          <h2>Report submitted</h2>
          <p className="thankyou-tagline">
            Thank you for making your city safer.
          </p>
        </div>

        <div className="thankyou-body">
          <p>
            Your report is now on the map and counted in the public
            analytics dashboard. Researchers, urban planners, and safety
            advocates use this data to identify risk hotspots and
            prioritise interventions.
          </p>

          <h4>What happens next</h4>
          <ul className="thankyou-steps">
            <li>
              <span className="thankyou-bullet" aria-hidden>📍</span>
              <div>
                <strong>Visible on the map</strong>
                <span>
                  Your report appears immediately as a pin in its category
                  layer.
                </span>
              </div>
            </li>
            <li>
              <span className="thankyou-bullet" aria-hidden>📊</span>
              <div>
                <strong>Counted in analytics</strong>
                <span>
                  Aggregated into hotspot maps, severity distributions,
                  and trend charts on the Analytics tab.
                </span>
              </div>
            </li>
            <li>
              <span className="thankyou-bullet" aria-hidden>🔒</span>
              <div>
                <strong>Stored privately</strong>
                <span>
                  Anonymous by default. Image EXIF and GPS metadata are
                  stripped server-side before storage.
                </span>
              </div>
            </li>
          </ul>

          {variant === 'm3' && (
            <p className="thankyou-note">
              Personal-safety reports are aggregated to neighbourhood
              level and never appear as individual pins on public
              dashboards.
            </p>
          )}
        </div>

        <div className="thankyou-actions">
          {onSubmitAnother && (
            <button className="ghost-btn" onClick={onSubmitAnother}>
              Submit another report
            </button>
          )}
          <button className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
