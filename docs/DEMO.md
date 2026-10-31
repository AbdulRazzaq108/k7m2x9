# Demo recording outline

Keep the complete unlisted YouTube recording under 10 minutes. Rehearse the actual dashboard and explain the code in your own words. Do not claim a feature or check that you have not verified.

## Customer demonstration — approximately 4 minutes

**0:00–0:40 — Explain the purchasing problem.** The team needs tomorrow's wind outlook and a quantitative understanding of past forecast error. This pilot uses only the national Elexon wind datasets requested in the challenge.

**0:40–1:30 — Choose a January decision date.** Show the following delivery date, explain that only forecasts published on the decision date are eligible, and identify the latest eligible publication in the observations table. The approved rule uses the entire preceding calendar day, not a particular exchange gate-closure time.

**1:30–2:30 — Explain the chart and three metrics.** Compare forecast and actual generation. Explain MAE as typical absolute error, RMSE as more sensitive to large errors, and bias as a directional error. A positive bias means wind was overestimated. Historical actuals become available after the decision; they are shown for retrospective evaluation.

**2:30–3:20 — Show the whole-period summary and illustrative procurement scenario.** Explain that every exact timestamp pair contributes to the January decision summary. Then show the separate hypothetical example: 1,000 MW customer demand minus 300 MW utility wind supply minus 400 MW other secured supply leaves 300 MW additional power. Change an input to demonstrate the calculation. State clearly that the inputs are manual examples, not actual demand or portfolio data; national wind is not automatically assigned to this utility. Do not interpret MW as energy in MWh or claim the result determines the utility's actual purchases.

**3:20–4:00 — Demonstrate transparency.** Show the source publication time, filter to matched rows and unavailable rows, and explain hourly forecasts versus half-hourly actuals. Select 31 January and show 1 February delivery. Open the methodology section and explain that no forecasts were invented for missing timestamps.

## Technical walkthrough — approximately 4½ minutes

**4:00–4:45 — Architecture.** React/TypeScript and Recharts call FastAPI on one origin. A read-only SQLite snapshot keeps page loads independent of upstream API availability and avoids serverless persistent-write assumptions.

**4:45–5:45 — Data ingestion.** Open `scripts/fetch_data.py`. Explain publication-date requests for WINDFOR, settlement-date requests for FUELHH WIND, retries, raw gzip retention, source hashes, validation, and indexing. Show `data/manifest.json`. Raw responses are kept in the repository but omitted from the production image.

**5:45–6:45 — Selection and analysis.** Open `backend/analysis.py`. Show target-date grouping, Europe/London calendar eligibility, latest publication selection per target, conflicts, exact matching, and pooled metrics. Explain the absence of an intraday cutoff and the February boundary.

**6:45–7:30 — API and UI.** Open `backend/main.py` and `frontend/src/main.tsx`. Show endpoint validation, loading/error states, aborted stale requests, and the link between server metrics and UI values.

**7:30–8:30 — Verification and reproducibility.** Run the Python tests and describe the browser checks. Show Docker startup instructions and the Vercel entrypoint. State that Codex assisted with implementation and that this is disclosed in the README.

Leave the remaining time as a buffer. Before recording, ensure the deployed app works without your login, replace the README deployment status with its URL, and use the actual deployed URL in the demo.
