import { useState } from 'react';

/**
 * Reporting guide — comprehensive, tabbed in-app reference.
 *
 * Covers everything in the onboarding spec:
 *   A. About PathGuard
 *   B. How reporting works
 *   C. Reporting categories
 *   D. Photo guidelines
 *   E. Privacy and safety
 *   F. FAQ
 *
 * Opened from the Navbar (?) icon and from the WelcomeModal's
 * "Learn more" button. Stateless — pure render of static content.
 */
const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'how', label: 'How it works' },
  { id: 'categories', label: 'Categories' },
  { id: 'photos', label: 'Photo guidelines' },
  { id: 'privacy', label: 'Privacy & safety' },
  { id: 'faq', label: 'FAQ' },
];

const FAQ = [
  {
    q: 'What is a near-miss?',
    a: 'A near-miss is any situation where an accident was narrowly avoided — for example, a car braked sharply to avoid hitting you, or you had to swerve out of the way. Reporting these is just as valuable as reporting actual collisions, because they expose risk hotspots before someone gets hurt.',
  },
  {
    q: 'What if I don\'t know the exact location?',
    a: 'Place the marker on the closest road or landmark you remember. The map auto-snaps your click to the nearest road segment, so a rough click is usually accurate enough. You can also zoom and drag for precision.',
  },
  {
    q: 'Can I submit a report anonymously?',
    a: 'Yes. You don\'t need to sign in to file a report. Personal-safety reports are stored anonymously by default and any uploaded images have EXIF metadata (including GPS) stripped server-side before storage.',
  },
  {
    q: 'What photos should I upload?',
    a: 'Anything that helps researchers understand the hazard — the pothole itself, the broken sign, the flooded section, the unsafe crossing. Avoid identifiable faces or license plates. See the "Photo guidelines" tab for full details.',
  },
  {
    q: 'What happens after I submit a report?',
    a: 'Your report appears on the map immediately and is included in the aggregate analytics dashboard. Reports are used by urban-planning researchers and safety advocates to identify systemic risks and prioritise interventions.',
  },
  {
    q: 'Do my reports go to the police or municipality?',
    a: 'No — PathGuard is a research and planning tool, not an emergency service. For active emergencies, please contact emergency services directly. For municipal complaints, file separately through your city\'s civic channel.',
  },
];

export default function HelpGuide({ onClose }) {
  const [active, setActive] = useState('about');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-guide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>PathGuard — Reporting Guide</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="guide-body">
          <nav className="guide-tabs" aria-label="Guide sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`guide-tab ${active === s.id ? 'active' : ''}`}
                onClick={() => setActive(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="guide-content">
            {active === 'about' && <SectionAbout />}
            {active === 'how' && <SectionHow />}
            {active === 'categories' && <SectionCategories />}
            {active === 'photos' && <SectionPhotos />}
            {active === 'privacy' && <SectionPrivacy />}
            {active === 'faq' && <SectionFAQ />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionAbout() {
  return (
    <article className="guide-article">
      <h3>About PathGuard</h3>
      <p>
        PathGuard is a participatory urban-safety platform that turns
        first-hand experiences from pedestrians, cyclists, two-wheeler
        riders, and other vulnerable road users into open data for
        researchers, urban planners, and civic advocates.
      </p>
      <p>
        Every collision you avoid, every pothole you swerve around, every
        poorly-lit corner you take a detour to skip — these are signals
        that traditional crash-statistics miss. PathGuard collects them at
        community scale.
      </p>
      <h4>How your reports are used</h4>
      <ul>
        <li>Identifying high-risk locations before someone gets hurt</li>
        <li>Quantifying infrastructure deficits across neighbourhoods</li>
        <li>Producing aggregate analytics for transport authorities</li>
        <li>Academic research on mobility safety and equity</li>
      </ul>
    </article>
  );
}

function SectionHow() {
  return (
    <article className="guide-article">
      <h3>How reporting works — in six steps</h3>
      <ol className="guide-steps">
        <li>
          <strong>Click "+ Report incident"</strong> in the top-right of
          the screen.
        </li>
        <li>
          <strong>Choose a category</strong> — accident, hazard, or
          personal safety. (See the next tab for guidance.)
        </li>
        <li>
          <strong>Click on the map</strong> where the incident happened.
          The pin will snap to the nearest road automatically.
        </li>
        <li>
          <strong>Fill in the form</strong>. Most fields are optional —
          only the things you actually remember matter.
        </li>
        <li>
          <strong>Attach a photo</strong> if you have one. EXIF / GPS data
          is stripped server-side for your privacy.
        </li>
        <li>
          <strong>Submit</strong>. Your report appears on the map
          instantly and feeds the analytics dashboard.
        </li>
      </ol>
    </article>
  );
}

function SectionCategories() {
  return (
    <article className="guide-article">
      <h3>Choosing the right category</h3>

      <details className="guide-detail" open>
        <summary>
          <span className="cat-emoji">🚲</span>
          <strong>Accident or near-miss</strong>
        </summary>
        <p>
          Anything involving a collision, fall, or evasive manoeuvre — even
          if no one was hurt.
        </p>
        <p>
          <em>Examples:</em> vehicle collisions, bicycle crashes,
          pedestrian incidents, solo falls (slipped on wet road, hit a
          pothole), near-misses where a vehicle had to brake or you had to
          swerve.
        </p>
        <p>
          <em>Please include:</em> what mode you were in, the other party's
          mode (if any), the type of conflict, and how dangerous it felt
          (1–5).
        </p>
      </details>

      <details className="guide-detail">
        <summary>
          <span className="cat-emoji">🚧</span>
          <strong>Hazard or infrastructure problem</strong>
        </summary>
        <p>
          Persistent issues built into the streetscape — things that put
          people at risk every day, not just once.
        </p>
        <p>
          <em>Examples:</em> potholes, damaged sidewalks, flooding,
          drainage issues, broken or missing traffic signs, poor lighting,
          blocked pathways, faded road markings, missing crosswalks.
        </p>
        <p>
          <em>Please include:</em> the hazard type, how severe it is, who
          it affects (pedestrians, cyclists, etc.), and a photo if safe to
          take.
        </p>
      </details>

      <details className="guide-detail">
        <summary>
          <span className="cat-emoji">🛟</span>
          <strong>Personal-safety concern</strong>
        </summary>
        <p>
          Situations where your safety as a person — not just as a road
          user — was at risk.
        </p>
        <p>
          <em>Examples:</em> harassment, stalking, theft or attempted
          theft, threatening behaviour, aggressive driving directed at
          you, unsafe walking or cycling environments, poorly-lit or
          isolated stretches.
        </p>
        <p>
          <em>Privacy:</em> these reports are stored anonymously by
          default and aggregated to neighbourhood level in analytics —
          they never appear as individual pins on public dashboards.
        </p>
      </details>
    </article>
  );
}

function SectionPhotos() {
  return (
    <article className="guide-article">
      <h3>Photo guidelines</h3>
      <p>
        Photos make reports far more actionable for researchers, but only
        take them if it is safe to do so.
      </p>
      <h4>Good photos</h4>
      <ul>
        <li>Show the hazard clearly (close up + wide shot if possible)</li>
        <li>Include a recognisable landmark for context</li>
        <li>Are taken in daylight where feasible</li>
      </ul>
      <h4>Please avoid</h4>
      <ul>
        <li>Identifiable faces of bystanders</li>
        <li>License plates of uninvolved vehicles</li>
        <li>Other people's children</li>
        <li>Photos that put you in danger to take</li>
      </ul>
      <p className="guide-note">
        EXIF metadata (including GPS) is stripped server-side before any
        image is stored, so your location data stays private.
      </p>
    </article>
  );
}

function SectionPrivacy() {
  return (
    <article className="guide-article">
      <h3>Privacy and safety</h3>
      <ul>
        <li>
          <strong>Anonymous by default.</strong> You don't need an account
          to file a report.
        </li>
        <li>
          <strong>EXIF stripping.</strong> All uploaded images have GPS
          and device metadata removed before storage.
        </li>
        <li>
          <strong>Personal-safety reports are aggregated.</strong>{' '}
          Individual reports never appear as pins; they only contribute
          to neighbourhood-level statistics protected by k-anonymity.
        </li>
        <li>
          <strong>No tracking.</strong> PathGuard does not use third-party
          analytics or advertising cookies.
        </li>
        <li>
          <strong>Quick exit.</strong> While filling a personal-safety
          report, the "Quick exit" button instantly redirects to a
          neutral page.
        </li>
      </ul>
      <p className="guide-note">
        <strong>If you are in immediate danger</strong>, contact
        emergency services directly. PathGuard is a research and planning
        tool, not an emergency response service.
      </p>
    </article>
  );
}

function SectionFAQ() {
  return (
    <article className="guide-article">
      <h3>Frequently asked questions</h3>
      {FAQ.map((item) => (
        <details key={item.q} className="guide-detail">
          <summary>
            <strong>{item.q}</strong>
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </article>
  );
}
