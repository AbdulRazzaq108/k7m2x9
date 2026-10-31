# Acceptance and verification record

Implementation follows the supplied UK Wind Generation PRD and the five product decisions explicitly approved in this chat.

The user subsequently approved an optional **Illustrative procurement scenario**. It uses hypothetical manual demand and utility-specific supply inputs, calculates non-negative additional power and any surplus, validates entries, and supports resetting the example. It does not consume national wind as a utility allocation, load actual demand, or alter the original Elexon analysis. It is an explicit extension beyond the original wind-only PRD.

## Approved decisions

| Decision | Implemented behavior |
| --- | --- |
| Calendar timezone | Europe/London |
| Bias sign | Forecast minus actual; positive indicates overestimation |
| Accuracy periods | Selected delivery day and pooled whole January-decision period |
| Unavailable/duplicate data | No zero-filling or older-day forecast fallback; identical duplicates collapsed, conflicts flagged and excluded |
| Dashboard | Decision-date selector, next-day delivery, forecast/actual chart, MAE/RMSE/bias cards, period summary, publication/observation table |

## PRD acceptance mapping

| PRD check | Implementation | Evidence |
| --- | --- | --- |
| AC-01: Only Elexon national WIND | `scripts/fetch_data.py` queries WINDFOR and FUELHH WIND | Source responses, manifest URLs, ingestion filter test |
| AC-02: Fetch and store history | `data/raw/`, `data/wind.sqlite3`, `data/manifest.json` | 62 retained chunks, 18,104 forecasts, 1,488 actuals |
| AC-03: January decisions and next-day delivery | `backend/analysis.py`, date selector | January 31 unit/API/browser checks show February 1 delivery |
| AC-04: Latest preceding-day publication per target | `analyze_day()` | Future-leakage, older-day exclusion, timezone and conflicting-revision tests |
| AC-05: Communicate selected forecasts | Dashboard chart and observation table | Browser rendering, date/filter/pagination checks |
| AC-06: Matched actuals and three metrics | Exact timestamp comparison and `metrics()` | Formula, bias, zero, missing, duplicate, resolution and pooled-period tests |
| AC-07: Communicate forecast error | Daily metric cards, period summary and methodology | Real-snapshot API checks and browser checks |

## Verification completed

- Python test suite: **27 passed** (domain calculations, API integration, ingestion). One dependency deprecation warning about the AnyIO BlockingPortal import does not affect test outcomes.
- Production frontend: **TypeScript check and Vite build passed**. Chart code is split into a separate bundle.
- Browser: **passed** in headless Google Chrome at desktop and 390px mobile widths. Checked real data, January date boundaries, February delivery, filters, pagination, methodology expansion, mobile page overflow, error/retry, and uncaught JavaScript errors. The later illustrative-scenario checks also passed: editable inputs, default and changed shortfalls, zero demand/supply, surplus, blank/negative validation, reset, and independence from historical metrics and the selected date.
- Visual review: desktop and mobile screenshots inspected; mobile period-summary overflow was corrected.
- Frontend runtime dependency audit: **0 known vulnerabilities** in `npm audit --omit=dev` at verification time.
- Docker Compose: **configuration validated**. Docker Engine was unavailable; a startup attempt did not make it ready. **Container image build and execution have not been verified.**

The actual-data snapshot yields 744 matched observations across 31 delivery days. There are 744 half-hour slots without a corresponding hourly forecast, zero missing actuals, and zero conflicting selected source groups. The UI explains the native-resolution difference and does not manufacture extra forecasts.

## Pending external steps

- Publish to Vercel or Heroku using the user's hosting account, verify production routes and public access, and add the actual URL to the README.
- Publish to a public GitHub repository with an anonymous/random name using the user's account.
- Record the required unlisted YouTube demo; the included outline is not a recorded video.
- Open submitted URLs in incognito mode and complete the challenge form.

The hosting configuration is prepared against current official Vercel documentation, but it has not been exercised on a signed-in deployment. No live URL, GitHub repository, video upload or form submission is claimed.
