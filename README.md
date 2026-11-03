# MCS customer assessment

A customer-facing questionnaire for port directors and terminal/depot operators. It captures the existing operation, costs, demand and priorities for MCS to prepare a site-specific business case and pricing proposal.

The questionnaire retains the original identifiers for questions that remain; the current revisions are listed in `QUESTIONNAIRE_FEEDBACK.md`. Copy uses direct operational language without marketing slogans. The interface uses the MCS orange (`#f15a24`), black (`#0b0b0b`), warm white (`#f3f3f1`), supplied logo, Syncopate display headings and original photos. Question headings use sentence case and a familiar sans-serif font, with larger text throughout the form for readability. Body text uses the brand's system fallback stack: the publicly available Field Gothic files are trial builds, so they are not redistributed in this customer-facing package. Syncopate is self-hosted with its license; the favicon comes from the MCS website. No fonts, analytics or scripts load from third parties.

## Preview

Requires Node 22 or later.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4173**. Use the local server rather than double-clicking the HTML file: the application uses JavaScript modules. Both `/` and `/MCS_Cleaning_Business_Case_v2.3.html` work.

## Launch on Netlify

```sh
npm run build
```

For a manual deployment, upload the **contents of `dist/`** or drag the `dist` folder into Netlify. The handover ZIP contains those same deployment files at its root. For a Git-connected deployment, `netlify.toml` sets the build command to `npm run build` and publish directory to `dist`.

1. In the Netlify site's **Forms** area, enable **form detection**. Deploy again after enabling it.
2. Confirm that the form named **`mcs-assessment`** appears. The static HTML form registers the fields used by the interactive form.
3. Configure submission notifications to the desired MCS recipient in Netlify. No recipient is hardcoded and no email is sent directly by this application.
4. On the deployed site, submit a clearly labelled test with invented data. Confirm it appears in Netlify's submissions, and check the notification if configured. Test the JSON and text response fields as well as the contact fields.
5. Share the deployed URL with customers.

Form setup reference: [Netlify Forms documentation](https://docs.netlify.com/manage/forms/setup/).

The local preview does not submit. An unprocessed Netlify form is also blocked, rather than showing an incorrect success state. Live receipt remains a deployment check: local tests simulate the endpoint and do not submit data externally.

The server receives company, site, name, email, a submission reference, a readable `assessment_summary`, and a structured `assessment_json`. The latter uses format `mcs-container-wash-assessment-v3.3` and includes active answers, active comments, question labels, baseline indicators, validation checks and modelling assumptions. It is suitable as input to MCS's business case/pricing workflow; this questionnaire itself does not issue a quote or calculate robotic savings.

## Behaviour

- Four sections, with direct navigation and a review screen.
- Questions adapt to own-personnel, on-site contractor, off-site contractor and no-current-cleaning arrangements. The no-current-operation route skips container position, ground layout, current cycle time and handling costs.
- Supplied ground/chassis photos are selectable answer cards. Contamination photos can be enlarged.
- Container percentages (including OOG) and the regular/heavy split update while typing. Chemical use is recorded as a percentage.
- Cleaning cycle time is elapsed time until the container is clean, separate from staff working hours. Throughput bottlenecks are described in free text.
- Reach-stacker costs combine machine and operator. A cost per shift is divided by the entered shift length for the exported hourly rate. No handling cost is automatically added to an all-in baseline.
- Closed-loop water recycling is an optional operational improvement. The outgoing cleaning selling-price question has been removed.
- Unmet demand is separate from containers eventually cleaned after a delay. Interruptions capture affected operating days and containers per year. Delay costs and operational effects are described in one optional text field, without automatic cost calculations.
- Claims and rejections are recorded as an approximate percentage of cleaned containers. Each affected container is counted once.
- Drying, digital interior inspection and cleaning documentation each have one approximate monthly container estimate within V05. Separate service follow-ups, pricing and process questions have been removed. Previous monthly estimates are carried into the matching V05 fields.
- Company, terminal, country, currency, contact name, email and wash arrangement are required for submission. Operational and financial estimates can be left blank or marked unknown.
- Impossible numeric ranges and incorrect container percentage totals block submission. Consistency checks are advisory: seasonality and estimates may explain differences.
- Drafts persist in this browser profile. Drafts from earlier versions are read automatically. Values with changed meanings are flagged for review, not silently converted (for example, Other is not assumed to mean OOG). Drafts do not sync across devices.
- Download JSON or print/save the complete review as PDF. Unknown amounts remain missing, not zero. Inactive branches and their comments are excluded from exports.
- A submission reference is reused after an uncertain network result to help identify duplicates. Retrying is manual. HTTP failures preserve the draft.
- “Start again” clears this browser's draft after confirmation. It does not delete a submitted Netlify record. A plain-language data note explains local storage and submission.
- Search indexing is discouraged via HTML metadata and deployment headers. This is not authentication; anyone with the URL can open the questionnaire.

## Checks

```sh
npm test
npm run test:browser
npm run build
```

The browser suite uses installed Chrome on macOS if available. Elsewhere, run `npx playwright install chromium` once. Tests use isolated browser contexts and synthetic data. The Netlify boundary is mocked; no real forms are submitted.

Tests cover all four operating models, branching, retained hidden data, baseline maths, unknown versus zero values, validation, priorities, shifts, photos, drafts, legacy migration, storage failures, JSON export, print layout, simulated submission success/failure and accessibility at 375, 768 and 1440 px.

## Files

- `index.html`: entry point and static Netlify form schema.
- `MCS_Cleaning_Business_Case_v2.3.html`: matching compatibility entry point for the existing URL.
- `assessment-model.js`: questions, conditions, baseline indicators and validation.
- `app.js`: interface, draft persistence, review, export and submission.
- `styles.css`: responsive brand styling and print layout.
- `assets/`: original images, self-hosted heading font and MCS favicon.
- `QUESTIONNAIRE_FEEDBACK.md`: content feedback and a customer invitation ready to copy.

Brand references: [MCS brand guidelines](https://mcs-website-zeta.vercel.app/brand-guidelines) and [MCS Robotics](https://www.mcsrobotics.com/).
