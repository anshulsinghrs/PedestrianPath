import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getSchema,
  visibleSteps,
  visibleFields,
  seedFormState,
  getDeep,
  updateDeep,
} from '../utils/reportingSchema.js';

/**
 * Schema-driven form renderer for the v4.0 reporting workflows.
 *
 *   - Progressive disclosure: only steps whose `condition` is satisfied
 *     render, and within a step only fields whose `condition` matches.
 *   - Step navigation: required-only validation per step.
 *   - Multimodal field types: select / radio / multiselect / scale /
 *     boolean / textarea / image / video / datetime / modeList.
 *   - Mobile-first: every field is a single column, large tap targets,
 *     min-44px controls. Inherits existing .report-form CSS.
 *
 * The caller provides:
 *   - `moduleKey`      : which workflow to render
 *   - `location`       : { lat, lng } (already collected from the map)
 *   - `onSubmit(state)`: receives the assembled state on the final step
 *   - `onClose()`      : modal close hook
 *   - `chrome`         : optional VNode for Module-3 safeguarding banner
 *
 * The renderer DOES NOT call the API — that decision belongs to the
 * thin Module*Form wrappers, so they can apply module-specific
 * serialisation rules (multipart vs JSON, PII pre-screen, etc.).
 */
export default function DynamicReportForm({
  moduleKey,
  location,
  onSubmit,
  onClose,
  initialState,
  chrome,
  submitting,
  error,
  submitLabel = 'Submit report',
}) {
  const schema = useMemo(() => getSchema(moduleKey), [moduleKey]);
  if (!schema) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <p>Unknown reporting module: {moduleKey}</p>
        </div>
      </div>
    );
  }

  const [form, setForm] = useState(() => ({
    ...seedFormState(schema),
    incidentDate: new Date().toISOString().slice(0, 16),
    ...(initialState || {}),
  }));
  const [stepIdx, setStepIdx] = useState(0);
  const [stepErrors, setStepErrors] = useState([]);
  const backdropDownTarget = useRef(null);

  // Auto-detection (weather, road type, …) can arrive a beat after the
  // form mounts. Merge any newly-supplied initialState keys into the
  // form state without overwriting anything the user has already
  // touched.
  useEffect(() => {
    if (!initialState) return;
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [k, v] of Object.entries(initialState)) {
        const cur = prev[k];
        if (v != null && (cur === undefined || cur === '' || cur === null)) {
          next[k] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [initialState]);

  // Recompute the visible step list whenever the form changes — this is
  // what makes branching dynamic without imperative wiring.
  const steps = useMemo(() => visibleSteps(schema, form), [schema, form]);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = stepIdx >= steps.length - 1;

  const setField = (name, value) =>
    setForm((prev) => updateDeep(prev, name, value));

  const validateStep = (s) => {
    const missing = [];
    for (const f of visibleFields(s, form)) {
      if (!f.required) continue;
      const v = getDeep(form, f.name);
      const empty =
        v === undefined ||
        v === null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0);
      if (empty) missing.push(f.label || f.name);
    }
    return missing;
  };

  const goNext = () => {
    const missing = validateStep(step);
    if (missing.length) {
      setStepErrors(missing);
      return;
    }
    setStepErrors([]);
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepErrors([]);
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate every visible step before submission.
    const allMissing = steps.flatMap(validateStep);
    if (allMissing.length) {
      setStepErrors(allMissing);
      return;
    }
    onSubmit(form);
  };

  // Pressing Enter in any single-line input would otherwise submit the
  // form (default browser behaviour for forms with a submit button).
  // On the demographics step this caused unintended submissions when
  // users were just tabbing through the select dropdowns. Only allow
  // Enter inside textareas, where it's the natural newline.
  const blockEnterSubmit = (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
  };

  const backdropMouseDown = (e) => {
    backdropDownTarget.current = e.target;
  };
  const backdropClick = (e) => {
    if (e.target === e.currentTarget && backdropDownTarget.current === e.currentTarget) {
      onClose();
    }
    backdropDownTarget.current = null;
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={backdropMouseDown}
      onClick={backdropClick}
    >
      <div
        className={`modal ${schema.safeguarded ? 'modal-m3' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{schema.title}</h2>
            {schema.subtitle && (
              <p className="form-hint" style={{ marginTop: 4 }}>
                {schema.subtitle}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {chrome}

        {location && (
          <div className="location-strip">
            📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </div>
        )}

        <ProgressBar current={stepIdx + 1} total={steps.length} />

        <form
          className="report-form"
          onSubmit={handleSubmit}
          onKeyDown={blockEnterSubmit}
        >
          <fieldset className="fieldset">
            <legend>
              {stepIdx + 1}. {step.title}
              {step.optional && <span className="form-hint"> (optional)</span>}
            </legend>

            {step.hint && <p className="form-hint">{step.hint}</p>}

            {visibleFields(step, form).map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={getDeep(form, field.name)}
                onChange={(v) => setField(field.name, v)}
              />
            ))}
          </fieldset>

          {stepErrors.length > 0 && (
            <div className="form-error">
              Required: {stepErrors.join(', ')}
            </div>
          )}
          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions" style={{ gap: 8 }}>
            {stepIdx > 0 && (
              <button
                type="button"
                className="ghost-btn"
                onClick={goBack}
                disabled={submitting}
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                className="primary-btn"
                onClick={goNext}
                disabled={submitting}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="primary-btn"
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : submitLabel}
              </button>
            )}
          </div>

          <p className="anon-note">
            Reports are anonymous unless you're signed in. Image EXIF is
            stripped server-side before storage.
          </p>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Step progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }) {
  if (total <= 1) return null;
  const pct = Math.round((current / total) * 100);
  return (
    <div
      style={{
        height: 4,
        background: 'rgba(0,0,0,0.08)',
        borderRadius: 2,
        margin: '0.5rem 0',
        overflow: 'hidden',
      }}
      aria-label={`Step ${current} of ${total}`}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: 'var(--color-primary)',
          transition: 'width 200ms ease',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Field renderer
// ---------------------------------------------------------------------------

function FieldRenderer({ field, value, onChange }) {
  switch (field.type) {
    case 'select':
      return (
        <label>
          <span>
            {field.label}
            {field.required && ' *'}
          </span>
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            required={field.required}
          >
            <option value="">— select —</option>
            {(field.options || []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.emoji ? `${o.emoji} ${o.label}` : o.label}
              </option>
            ))}
          </select>
        </label>
      );

    case 'radio':
      return (
        <fieldset className="factor-fieldset">
          <legend>
            {field.label}
            {field.required && ' *'}
          </legend>
          <div className="factor-grid">
            {(field.options || []).map((o) => (
              <label
                key={o.value}
                className={`factor-chip ${value === o.value ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                />
                <span>
                  {o.emoji && <>{o.emoji} </>}
                  {o.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'multiselect':
      return (
        <fieldset className="factor-fieldset">
          <legend>
            {field.label}
            {field.required && ' *'}
          </legend>
          <div className="factor-grid">
            {(field.options || []).map((o) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(o.value);
              return (
                <label
                  key={o.value}
                  className={`factor-chip ${checked ? 'is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(
                        checked
                          ? arr.filter((x) => x !== o.value)
                          : [...arr, o.value]
                      )
                    }
                  />
                  <span>
                    {o.emoji && <>{o.emoji} </>}
                    {o.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );

    case 'scale': {
      const min = field.min ?? 1;
      const max = field.max ?? 5;
      const step = field.step ?? 1;
      const v = value ?? min;
      return (
        <label>
          <span>
            {field.label}
            {field.required && ' *'}
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <small>Current: {v}</small>
        </label>
      );
    }

    case 'boolean':
      return (
        <fieldset className="factor-fieldset">
          <legend>
            {field.label}
            {field.required && ' *'}
          </legend>
          <div className="factor-grid">
            {[
              { v: true, l: 'Yes' },
              { v: false, l: 'No' },
            ].map(({ v, l }) => (
              <label
                key={String(v)}
                className={`factor-chip ${value === v ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name={field.name}
                  checked={value === v}
                  onChange={() => onChange(v)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'textarea':
      return (
        <label>
          <span>
            {field.label}
            {field.required && ' *'}
          </span>
          <textarea
            rows={field.rows || 3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={field.maxLength || 2000}
            placeholder={field.placeholder}
          />
        </label>
      );

    case 'datetime':
      return (
        <label>
          <span>
            {field.label}
            {field.required && ' *'}
          </span>
          <input
            type="datetime-local"
            value={value ?? new Date().toISOString().slice(0, 16)}
            max={new Date().toISOString().slice(0, 16)}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );

    case 'image':
      return (
        <label>
          <span>{field.label}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      );

    case 'video':
      return (
        <label>
          <span>{field.label}</span>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      );

    case 'modeList':
      return <ModeListField field={field} value={value} onChange={onChange} />;

    case 'text':
    default:
      return (
        <label>
          <span>
            {field.label}
            {field.required && ' *'}
          </span>
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </label>
      );
  }
}

// ---------------------------------------------------------------------------
//  Mode list — collects an arbitrary list of interacting modes
// ---------------------------------------------------------------------------

function ModeListField({ field, value, onChange }) {
  const list = Array.isArray(value) && value.length > 0 ? value : [''];
  const update = (idx, v) => {
    const next = [...list];
    next[idx] = v;
    onChange(next.filter(Boolean));
  };
  const add = () => onChange([...list, '']);
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx).filter(Boolean));

  return (
    <fieldset className="factor-fieldset">
      <legend>
        {field.label}
        {field.required && ' *'}
      </legend>
      {list.map((v, idx) => (
        <div
          key={idx}
          style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}
        >
          <select
            value={v}
            onChange={(e) => update(idx, e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">— select mode —</option>
            {(field.options || []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {list.length > 1 && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => remove(idx)}
              aria-label="Remove mode"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" className="ghost-btn" onClick={add}>
        + Add another mode
      </button>
    </fieldset>
  );
}
