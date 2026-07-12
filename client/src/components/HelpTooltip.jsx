import { useState } from 'react';

/**
 * Inline help icon with a short tooltip. Click or hover to reveal.
 * Used next to form labels that need a one-sentence clarification or
 * an example response. Keep the body terse — anything longer belongs
 * in HelpGuide.
 *
 * Usage:
 *   <label>
 *     <span>Severity <HelpTooltip text="How bad was it? 1 = minor, 5 = fatal." /></span>
 *     ...
 *   </label>
 */
export default function HelpTooltip({ text, label = 'Help' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="help-tooltip-wrap">
      <button
        type="button"
        className="help-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" className="help-tooltip-bubble">
          {text}
        </span>
      )}
    </span>
  );
}
