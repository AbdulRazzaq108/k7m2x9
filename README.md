# Wind generation forecast and accuracy

A React and Python dashboard for UK day-ahead electricity purchasing teams. It shows the latest eligible Elexon wind forecasts and evaluates them against actual wind generation, for purchasing decisions made from **1–31 January 2026**. Corresponding deliveries span **2 January–1 February 2026**.

**Source repository:** [AbdulRazzaq108/k7m2x9](https://github.com/AbdulRazzaq108/k7m2x9). The code has been pushed to GitHub using the required random repository name.

**Application status:** implemented and tested locally, in Docker, and on the public Vercel deployment. The Docker image has been built and run successfully, with `/api/health` returning HTTP 200 on the container exposed at `http://localhost:8001`.

**Live application:** [https://k7m2x9-henna.vercel.app/](https://k7m2x9-henna.vercel.app/) — deployed to Vercel production. The dashboard and API were verified without login, including the 31 January decision / 1 February delivery boundary.

**Demo video:** the MP4 is complete at **8 minutes 58 seconds**, with approximately **4:32 for the customer demonstration** and **4:26 for the technical review**, using male Indian-English generated narration. Uploading it to YouTube as an unlisted video and adding its link are still pending. The recording predates Docker runtime verification and public deployment; both have since been completed.

## What the product does

- Select a January purchasing decision date and see its following-day delivery.
- View forecast and actual generation, three accuracy metrics, and data coverage.
- Inspect every half-hour target, selected forecast publication, actual value, signed error, and availability/conflict status.
- Filter observations, paginate the table, and inspect the selection methodology.
- Review whole-period accuracy calculated from all matched observations.
- Explore an optional, clearly labelled **illustrative procurement scenario** using editable hypothetical demand, utility-specific wind supply, and other secured supply.

The historical wind analysis uses only Elexon WINDFOR and FUELHH WIND data. There is no forecasting model, trading execution, or actual demand/price/utility-portfolio dataset. The separate procurement scenario is a user-approved illustrative extension, not a calculation of the utility's actual purchases.

### Illustrative procurement scenario

Enter customer demand, wind supply allocated to the utility, and other secured supply for the **same delivery period**, in MW. Additional power required is `max(0, demand − utility wind − other secured supply)`. If supply exceeds demand, the result is zero additional power and the surplus is shown separately. Supply categories must not overlap.

The initial example uses **1,000 MW demand, 300 MW wind, and 400 MW other supply**, giving **300 MW additional power**. These values are hypothetical, not estimates of actual UK or customer demand. The national Elexon wind series is never automatically treated as the utility's wind allocation. Inputs remain independent of the selected historical decision date, do not affect forecast-error metrics, and are not stored or sent to the backend. Blank, negative, or non-finite inputs suppress the result; reset restores the example.

## Start with Docker

Prerequisite: Docker Desktop or Docker Engine must be running.

```sh
docker build -t wind-dashboard .
docker run --rm -p 8001:8000 wind-dashboard
```

Open **http://localhost:8001**. This is the verified container startup path; `/api/health` returns HTTP 200. Host port 8001 avoids conflicting with the local Python server on port 8000. The multi-stage image builds React, installs the Python API, and bundles the genuine historical snapshot. No Elexon network calls or API key are needed to run the dashboard. The container runs as a non-root user and has an API health check.

Alternatively, use the included Compose configuration:

```sh
docker compose up --build
```

Compose exposes the app on **http://localhost:8000**; make sure host port 8000 is free before starting it.

## Start locally

Prerequisites: **Python 3.12+**, **Node.js 22.12+**, and npm. The instructions below run from the repository root.

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -X utf8 -m pip install -r requirements-dev.txt
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -X utf8 -m uvicorn app:app --host 127.0.0.1 --port 8000
```

### macOS or Linux

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
npm --prefix frontend ci
npm --prefix frontend run build
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open **http://localhost:8000**. For frontend development, run `npm --prefix frontend run dev` in a second terminal and open **http://localhost:5173**. Vite proxies `/api` to the Python server. To update the production app on port 8000, stop the Python server, rebuild the frontend, then restart Python. This avoids serving partially replaced assets or Windows file locks during a build.

## Data and methodology

### Selection rule

1. Interpret calendar days in **Europe/London**.
2. For decision date D, delivery is the calendar day D + 1.
3. For each target `startTime`, keep only forecasts whose `publishTime` falls on D.
4. Select the greatest eligible `publishTime` independently for each target timestamp.
5. Compare with an actual WIND record at the **exact same `startTime`**.

The entire preceding calendar day is eligible; there is **no intraday purchasing cutoff**. This is the interpretation explicitly approved for this PRD. It must not be described as a simulation of a particular exchange gate-closure time. Delivery on **1 February** is correctly included for the **31 January** decision. Forecasts from a later day or an older day are not substituted.

### Resolution and coverage

The fetched WINDFOR series has **hourly target timestamps**; FUELHH has **30-minute timestamps**. All actual records are retained, but only exact timestamp pairs enter the metrics. **No interpolation, hourly actual averaging, half-hour forecast duplication, or zero-filling is performed.** Lines on the chart connect native points for visual readability only. At half-hour slots without a source forecast, the table shows “No eligible forecast”. This is a source-resolution difference, not a failed download.

The bundled snapshot contains **18,104 forecast records** and **1,488 actual records**, producing **744 matched observations** across 31 delivery days. Raw forecast responses include surrounding target dates contained in each publication; selection restricts the scored delivery date. No invalid records were rejected in this snapshot.

### Metrics in MW

For error `e = forecast − actual` over N matched observations:

- **MAE:** `sum(abs(e)) / N`
- **RMSE:** `sqrt(sum(e * e) / N)`
- **Bias:** `sum(e) / N`; positive indicates overestimation, negative indicates underestimation.

No matches yields `null` metrics, displayed as unavailable. Whole-period metrics pool all matched errors; daily metric values are not averaged. Source records and calculations keep full precision; the interface rounds displayed numbers to one decimal place.

### Missing and duplicate records

Raw source responses are retained without alteration. The index collapses byte-equivalent normalized JSON records by fingerprint. Identical generation values for a selected timestamp/publication are treated as one observation. Conflicting values at the latest eligible forecast publication, or conflicting actual values for the same target, are flagged and excluded from metrics. The system does not silently choose a winner or fall back to an older forecast. Missing actuals and forecasts are separately counted; a row can have both issues. `null`, non-numeric, non-finite, or timezone-less source values are rejected during indexing and counted in the manifest.

### Reproduce or refresh the snapshot

```sh
python -m scripts.fetch_data
python -m scripts.fetch_data --refresh
```

Use your virtual environment's Python. Without `--refresh`, existing compressed source chunks are reused and the SQLite index is rebuilt. Network requests are day-bounded, use four workers, and retry transient failures. Stop the app before refreshing and restart afterward; each server process caches one immutable analysis snapshot.

`data/manifest.json` retains request URLs, record counts and SHA-256 hashes of uncompressed responses. `data/raw/` contains all 62 gzip JSON responses. `data/wind.sqlite3` is a derived, read-only application index. `WIND_DATA_DIR` can point the server to an alternative snapshot directory containing the same database and manifest files.

### Sources and units

- [Elexon WINDFOR stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [Elexon FUELHH stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [Elexon wind-generation explanation](https://bmrs.elexon.co.uk/wind-generation)
- [Elexon API developer portal](https://developer.data.elexon.co.uk/)
- [Elexon NETA Interface Definition Document](https://bscdocs.elexon.co.uk/bsc-module/interface-definition-documents/neta-interface-definition-and-design-document-part-1-interfaces-with-bsc-parties-and-their-agents), which defines wind forecast and half-hourly generation fields in MW.

Data attribution: **Elexon Insights Solution / BMRS**, under the applicable BMRS data licence and API terms. These are the national Elexon series requested by the assignment; their metering coverage should not be interpreted as every UK wind installation or all renewable generation. FUELHH values are the historical actuals currently provided by Elexon, not a separately reconstructed as-of history of actual revisions.

## Architecture and files

```text
frontend/                   React + TypeScript, Vite and Recharts dashboard
  src/main.tsx              UI, API requests, date controls, charts and table
  src/ProcurementScenario.tsx Optional hypothetical supply/demand calculator
  src/types.ts              API response contracts
  src/styles.css            Responsive styling and accessible control states
backend/
  analysis.py               Pure forecast selection, matching and metrics
  store.py                  Read-only SQLite loading and process-level cache
  main.py                   FastAPI endpoints and built-frontend serving
  tests/                    Domain and API integration tests
scripts/
  fetch_data.py             Reproducible Elexon retrieval and indexing
  browser_check.cjs         Browser checks and screenshots using Playwright
data/
  raw/                      Losslessly compressed source responses
  manifest.json             Retrieval provenance and validation counts
  wind.sqlite3              Indexed historical records
docs/
  DEMO.md                   Customer demo and technical walkthrough outline
  ACCEPTANCE.md             PRD acceptance mapping and verification record
app.py                      Shared ASGI entrypoint
requirements*.txt           Python runtime and development dependencies
Dockerfile, compose.yaml    Container build and local startup
vercel.json                 Vercel FastAPI deployment configuration
Procfile, heroku.yml        Alternative Heroku container deployment
```

The browser requests `/api/overview` and `/api/decisions/YYYY-MM-DD`. FastAPI reads the bundled SQLite index, calculates the 31-day analysis once, and reuses the result. SQLite is a deliberately small, portable historical-data store, not a writable production service. There are no credentials, runtime upstream requests, or external database services. The frontend and API use one origin in production.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Snapshot readiness |
| `GET /api/overview` | Whole-period metrics, coverage, dates, provenance |
| `GET /api/decisions/{date}` | Selected delivery-day metrics and observations |
| `GET /docs` | Generated API documentation |

Dates outside January 2026 return HTTP 422. Missing snapshots return HTTP 503 with an actionable message. Unknown API routes return HTTP 404 rather than frontend HTML.

## Verification

Completed checks:

- **Python tests:** 27 passed, covering analysis, ingestion, and API behavior.
- **Frontend:** TypeScript checking and the production Vite build passed.
- **Browser:** desktop/mobile checks passed for date boundaries, filtering, pagination, error/retry behavior, and the illustrative scenario's calculations, validation, reset, and separation from historical metrics.
- **Docker:** the `wind-dashboard` image runs successfully with `-p 8001:8000`; the running container's `/api/health` endpoint returns HTTP 200 and reports all 31 decision days ready.
- **Public Vercel deployment:** `/api/health`, `/api/overview`, and `/api/decisions/2026-01-31` return HTTP 200. The overview contains 744 matched observations; the 31 January decision returns delivery on 1 February with 24 matched observations. The deployed browser checks passed for rendering, dates, filters, pagination, methodology, mobile layout, the illustrative scenario, and error/retry behavior in a fresh browser context without saved login.
- **Repository access:** the unauthenticated GitHub API confirms the repository is public.
- **Demo MP4:** completed at 1920 × 1080, with both parts below five minutes and the full video below ten minutes. Duration, full-file decoding, representative frames, and audio levels were checked.

To reproduce the code checks:

```sh
python -m pytest backend/tests -q
npm --prefix frontend run build
```

The Python tests cover publication eligibility, future leakage, the February boundary, bias sign, metric formulas, missing data, duplicates, conflicting revisions, zero generation, native-resolution matching, timezone-aware dates, pooled whole-period metrics, and API contracts. Tests use synthetic records for edge cases and the bundled real snapshot for API integration; synthetic records are never used by the application.

For browser checks, start the built app, install Playwright in an external tool directory or make it available through `NODE_PATH`, then run:

```sh
node scripts/browser_check.cjs
```

Set `PLAYWRIGHT_MODULE` to an absolute installed module path if needed. The check uses installed Google Chrome in headless mode and verifies rendering, date boundaries, filters, pagination, methodology disclosure, mobile overflow, and error/retry behavior. It also checks the illustrative procurement calculation, zero/surplus cases, input validation, reset, and separation from historical metrics. Screenshots go into ignored `artifacts/`.

## Deploy to Vercel

1. Sign in to Vercel and create/import a project from this repository. Keep the **repository root** as the project root and use the **FastAPI** framework preset.
2. The checked-in `vercel.json` builds the React frontend and exposes `app.py` as the Python entrypoint. The built assets and read-only snapshot are bundled. Do not set the project root to `frontend`, since that would omit the backend.
3. Alternatively, from the repository root, use `npx vercel login`, `npx vercel`, then `npx vercel --prod` after reviewing the preview. Account login is interactive; do not put access tokens into source files.
4. Open `/`, `/api/health`, and the 31 January decision on the published URL. Ensure any deployment protection allows the challenge reviewers to access the production app.
5. Keep the live-application URL at the top of this README current and verify it without login after any deployment changes.

This configuration follows the [Vercel FastAPI deployment documentation](https://vercel.com/docs/frameworks/backend/fastapi). Docker is supplied for reproducible local execution; Vercel runs the Python application as a function rather than executing the Dockerfile. The SQLite database is bundled and opened read-only, which avoids relying on persistent writes in a serverless filesystem. No upstream-data import occurs during cold starts.

## Alternative: Heroku container

From a signed-in Heroku CLI with Docker running:

```sh
heroku create YOUR-ANONYMOUS-APP-NAME --stack container
git push heroku main
heroku open
```

The checked-in `heroku.yml` builds `Dockerfile`; the server respects Heroku's `PORT` environment variable. These commands assume you have committed the repository on a `main` branch. Choose a suitable dyno according to your account, then verify the public app and health endpoint. No paid resources have been created by this implementation.

## AI assistance and submission

**OpenAI Codex was used to assist with implementation, data integration, tests, styling, Docker/deployment configuration, documentation, and preparation of the demonstration video.** The video uses generated male Indian-English narration. The source data is genuine Elexon data, not AI-generated. Review and understand the code and validation results before presenting them.

The code is pushed to the public GitHub repository linked above, Docker startup and health checks have succeeded, the app is deployed to Vercel, and the demo MP4 is created. The remaining submission steps are:

1. Review the completed MP4, upload it to **YouTube as unlisted**, and add the video URL here.
2. Open the repository, deployed app, and video URLs together in **incognito mode** for a final access check before submission. The app has already passed a fresh-browser check and the repository's public visibility has been confirmed.
3. Submit the required links through the original challenge's Microsoft form.

The evaluation starts with the video. `docs/DEMO.md` contains its customer/technical walkthrough outline. The unlisted YouTube upload, final combined submission-link checks, and form submission remain pending.
