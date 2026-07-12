export default function ModulePicker({ onPick, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>What are you reporting?</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="picker-grid">
          <button
            className="picker-card"
            onClick={() => onPick('accident_conflict')}
          >
            <div className="picker-emoji">🚲</div>
            <h3>Report an accident or near-miss</h3>
            <p>
              A collision, near miss, solo fall, or sub-collision conflict
              with another road user.
            </p>
          </button>

          <button
            className="picker-card"
            onClick={() => onPick('hazard_infrastructure')}
          >
            <div className="picker-emoji">🚧</div>
            <h3>Report a hazard or infrastructure problem</h3>
            <p>
              Potholes, damaged footpaths, flooding, poor lighting, blocked
              paths, faded markings, drainage issues.
            </p>
          </button>

          <button
            className="picker-card picker-card-m3"
            onClick={() => onPick('personal_safety')}
          >
            <div className="picker-emoji">🛟</div>
            <h3>Report a personal-safety concern</h3>
            <p>
              Harassment, threatening environments, unsafe behaviour,
              stalking, theft, or an unsafe-route experience.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
