# PathGuard pilot — participant consent (template)

> **This is a template only.** Each institution running a PathGuard
> pilot is responsible for adapting this text to local law and securing
> appropriate ethics / IRB approval before recruiting participants. The
> PathGuard project provides this template as a starting point and
> makes no warranty about its sufficiency for any specific jurisdiction.

---

## 1. Study title

A participatory study of road-safety conditions for vulnerable road
users in **[CITY / NEIGHBOURHOOD]**, using the PathGuard platform.

## 2. Investigator(s) and institution

- **[PRINCIPAL INVESTIGATOR NAME, TITLE]**
- **[DEPARTMENT / SCHOOL]**, **[INSTITUTION]**
- Contact: **[EMAIL]**, **[PHONE]**

## 3. What you are being asked to do

If you agree to participate, you will use PathGuard — a free, open-source
mobile-friendly website — to report road-safety incidents you observe or
experience over the **[N WEEK]** pilot period. Each report takes about
30 seconds and includes:

- the type of incident (collision, near-miss, unsafe crossing, …),
- the location (you pin it on a map; you may move it before submitting),
- the date and time,
- optional details such as severity, weather, and a short description,
- optionally a photograph of the location.

You may submit as many or as few reports as you wish. You may pause or
withdraw at any time.

## 4. What we will do with your reports

Reports are stored in a research database managed by **[INSTITUTION]**.
Each record submitted during the pilot carries a `dataProvenance: pilot`
tag and an opaque cohort identifier (e.g. `[COHORT_TAG]`) so we can
distinguish pilot data from other sources.

We will use this data to:

- understand which locations in **[CITY]** are unsafe for which
  vulnerable road users,
- generate aggregate statistics for academic publication and for
  sharing with local authorities,
- inform future safety interventions.

We will **not**:

- share your individual reports with non-research third parties,
- attempt to identify you from your reports,
- use your data for commercial purposes,
- combine your data with personally identifying information from any
  external source.

## 5. Privacy and data minimisation

PathGuard is designed to collect as little personal information as
possible:

- Reports are **anonymous by default**. You do not need to create an
  account to submit a report.
- If you choose to create an account (to view your own reports later),
  we store only your name, email, and self-described mobility profile.
- Photographs uploaded to PathGuard have their **EXIF metadata
  (including GPS coordinates) automatically stripped** on the server
  before the image is stored.
- Research exports of the data use **cell-level k-anonymity**: every
  exported record is the aggregate of at least *k* (default 5) reports
  in the same spatial cell, time window, and mode. Individual reports
  are never released.

A full description of the privacy architecture is published at
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

## 6. Risks

There are minimal foreseeable risks. The largest is the small
possibility that someone with access to the raw database could
re-identify you from the combination of report time, location, and
mobility mode. We mitigate this by:

- restricting raw-database access to the named investigator(s) and
  approved research staff,
- never publishing the raw database,
- applying k-anonymity to all data released to third parties.

## 7. Benefits

You may experience no direct benefit from participating. The aggregated
findings will be shared with **[CITY AGENCY / LOCAL AUTHORITY]** and may
inform future infrastructure or policy changes.

## 8. Compensation

**[STATE COMPENSATION IF ANY, ELSE: "There is no compensation for
participation."]**

## 9. Right to withdraw

You may withdraw from the pilot at any time and for any reason. To
withdraw:

- click **"Leave pilot"** in the banner shown at the bottom of the
  PathGuard interface, or
- email **[CONTACT EMAIL]** with the subject line "withdraw from
  PathGuard pilot".

If you withdraw, no further reports will be tagged with the pilot
cohort. Reports already submitted will be **[RETAINED IN ANONYMISED
FORM / DELETED ON REQUEST]** in accordance with **[INSTITUTION'S]** IRB
guidance.

## 10. Confidentiality of this consent form

This consent form is stored separately from the PathGuard database
itself; no field in the PathGuard data model contains your name or
contact details.

## 11. Contact for questions

- About the study: **[PI NAME] — [EMAIL]**
- About your rights as a research participant: **[IRB OFFICE — EMAIL,
  PHONE]**

## 12. Declaration

I have read this consent form. My questions have been answered. I agree
to participate in the PathGuard **[COHORT_TAG]** pilot.

| Signature | Date |
|-----------|------|
|           |      |

| Printed name | |
|--------------|-|
|              | |
