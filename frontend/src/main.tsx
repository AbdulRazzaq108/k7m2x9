import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Calculator,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Table2,
  Target,
  Wind,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Day, Metrics, Observation, Overview } from "./types";
import ProcurementScenario from "./ProcurementScenario";
import "./styles.css";

const number = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const formatNumber = (value: number | null | undefined, signed = false) =>
  value == null
    ? "—"
    : `${signed && value > 0 ? "+" : ""}${number.format(value)}`;
const formatDate = (value: string, long = false) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
const formatPublish = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "—";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    let detail = `The request could not be completed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* Keep the readable default for non-JSON errors. */
    }
    throw new Error(detail);
  }
  return response.json();
}

function MetricCards({
  metrics,
  loading,
}: {
  metrics: Metrics;
  loading: boolean;
}) {
  const bias = metrics.bias;
  const cards = [
    {
      label: "Mean absolute error",
      abbreviation: "MAE",
      value: metrics.mae,
      icon: Target,
      text: "Average size of the forecast error.",
      tone: "mint",
    },
    {
      label: "Root mean squared error",
      abbreviation: "RMSE",
      value: metrics.rmse,
      icon: Activity,
      text: "Gives more weight to larger errors.",
      tone: "sand",
    },
    {
      label: "Forecast bias",
      abbreviation: "BIAS",
      value: bias,
      icon: bias != null && bias < 0 ? ArrowDownRight : ArrowUpRight,
      text:
        bias == null
          ? "No matched observations available."
          : bias > 0
            ? "Wind generation was overestimated on average."
            : bias < 0
              ? "Wind generation was underestimated on average."
              : "No average over- or underestimation.",
      tone: "blue",
    },
  ];
  return (
    <div className="metric-grid" aria-busy={loading}>
      {cards.map(({ label, abbreviation, value, icon: Icon, text, tone }) => (
        <article className="metric-card" key={abbreviation}>
          <div className="metric-top">
            <span className={`metric-icon ${tone}`}>
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <span className="metric-abbreviation">{abbreviation}</span>
          </div>
          <h2>{label}</h2>
          <div className="metric-value">
            {loading ? (
              <span className="number-skeleton" />
            ) : (
              formatNumber(value, abbreviation === "BIAS")
            )}
            <span>MW</span>
          </div>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Observation }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{row.time} GMT</strong>
      <div>
        <span className="dot forecast" />
        Forecast <b>{formatNumber(row.forecast)} MW</b>
      </div>
      <div>
        <span className="dot actual" />
        Actual <b>{formatNumber(row.actual)} MW</b>
      </div>
      {row.error != null && (
        <div className="tooltip-error">
          Error <b>{formatNumber(row.error, true)} MW</b>
        </div>
      )}
      {row.forecast == null && (
        <small>No eligible forecast at this timestamp</small>
      )}
    </div>
  );
}

function GenerationChart({ day, loading }: { day: Day; loading: boolean }) {
  return (
    <section
      className="panel chart-panel"
      aria-labelledby="chart-heading"
      aria-busy={loading}
    >
      <div className="panel-heading">
        <div>
          <div className="section-kicker">THE DELIVERY DAY</div>
          <h2 id="chart-heading">Forecast vs actual generation</h2>
          <p>
            {formatDate(day.delivery_date, true)}{" "}
            <span className="inline-separator">/</span> National wind generation
          </p>
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-line forecast" />
            Forecast
          </span>
          <span>
            <i className="legend-line actual" />
            Actual
          </span>
        </div>
      </div>
      <div className="chart-axis-label">Generation (MW)</div>
      <div
        className={`chart-container ${loading ? "is-loading" : ""}`}
        role="img"
        aria-label={`Wind generation on ${formatDate(day.delivery_date)}. ${day.metrics.count} matched observations. Mean absolute error ${formatNumber(day.metrics.mae)} megawatts. Exact values are in the observations table below.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={day.rows}
            margin={{ top: 10, right: 12, bottom: 4, left: 2 }}
          >
            <defs>
              <linearGradient id="actual-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1b6b59" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#1b6b59" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#e9eeea"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              ticks={[
                "00:00",
                "04:00",
                "08:00",
                "12:00",
                "16:00",
                "20:00",
                "23:30",
              ]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#808c86", fontSize: 11 }}
              minTickGap={18}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#808c86", fontSize: 11 }}
              tickFormatter={(value) => integer.format(value)}
              width={54}
              tickCount={5}
              domain={[0, "auto"]}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "#a5b6ad", strokeDasharray: "4 4" }}
            />
            <Area
              type="linear"
              dataKey="actual"
              name="Actual"
              stroke="#235c50"
              strokeWidth={2.5}
              fill="url(#actual-fill)"
              isAnimationActive={false}
              connectNulls={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
            />
            <Line
              type="linear"
              dataKey="forecast"
              name="Forecast"
              stroke="#81b891"
              strokeWidth={2.5}
              strokeDasharray="6 5"
              dot={false}
              isAnimationActive={false}
              connectNulls
              activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-footnote">
        <Info size={15} />
        <span>
          Hourly forecasts, half-hourly actuals. Metrics use exact timestamp
          matches; no values are filled in. Lines connect available
          observations.
        </span>
        <span className="timezone-label">Europe/London · GMT</span>
      </div>
    </section>
  );
}

function MonthSummary({ overview }: { overview: Overview }) {
  return (
    <section
      id="accuracy"
      className="period-panel"
      aria-labelledby="period-heading"
    >
      <div className="period-intro">
        <div className="section-kicker">THE BIGGER PICTURE</div>
        <h2 id="period-heading">January decision summary</h2>
        <p>1–31 Jan decisions · 2 Jan–1 Feb deliveries</p>
        <span className="period-count">
          <CheckCheck size={15} />
          {integer.format(overview.metrics.count)} matched observations
        </span>
      </div>
      <div className="period-metrics">
        {[
          ["MAE", overview.metrics.mae],
          ["RMSE", overview.metrics.rmse],
          ["BIAS", overview.metrics.bias],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {formatNumber(value as number | null, label === "BIAS")}
              <small>MW</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="period-bottom">
        Calculated across all matched observations in the period. Positive bias
        means overestimation.
      </div>
    </section>
  );
}

const statusLabel = (row: Observation) =>
  row.status === "matched"
    ? "Matched"
    : row.issues.some((issue) => issue.startsWith("conflicting"))
      ? "Conflicting data"
      : row.issues.includes("missing_actual")
        ? "Actual unavailable"
        : "No eligible forecast";

function ObservationTable({ day, loading }: { day: Day; loading: boolean }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [day.decision_date, filter]);
  const filtered = day.rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "matched"
        ? row.status === "matched"
        : row.status !== "matched"),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const visible = filtered.slice(page * 8, page * 8 + 8);
  return (
    <section
      id="observations"
      className="panel table-panel"
      aria-labelledby="table-heading"
      aria-busy={loading}
    >
      <div className="panel-heading">
        <div>
          <div className="section-kicker">BEHIND THE NUMBERS</div>
          <h2 id="table-heading">Delivery observations</h2>
          <p>Selected forecasts, publication times and actual generation.</p>
        </div>
        <label className="filter-select">
          <span className="sr-only">Filter observations</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All observations</option>
            <option value="matched">Matched only</option>
            <option value="unavailable">Unavailable / conflicting</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Observations for delivery on {formatDate(day.delivery_date)}. All
            times Europe/London. All generation and errors in MW.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                Delivery time <span>GMT</span>
              </th>
              <th scope="col">
                Forecast published <span>GMT</span>
              </th>
              <th scope="col" className="numeric">
                Forecast <span>MW</span>
              </th>
              <th scope="col" className="numeric">
                Actual <span>MW</span>
              </th>
              <th scope="col" className="numeric">
                Error <span>MW</span>
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.start_time}>
                <td className="time-cell">{row.time}</td>
                <td className="published-cell">
                  {formatPublish(row.publish_time)}
                </td>
                <td className="numeric">{formatNumber(row.forecast)}</td>
                <td className="numeric">{formatNumber(row.actual)}</td>
                <td
                  className={`numeric ${row.error == null ? "" : row.error > 0 ? "positive-error" : "negative-error"}`}
                >
                  {formatNumber(row.error, true)}
                </td>
                <td>
                  <span
                    className={`status-pill ${row.status === "matched" ? "matched" : row.issues.some((issue) => issue.startsWith("conflicting")) ? "conflict" : "unavailable"}`}
                  >
                    {row.status === "matched" && <Check size={11} />}
                    {statusLabel(row)}
                  </span>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No observations match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          {filtered.length
            ? `${page * 8 + 1}–${Math.min((page + 1) * 8, filtered.length)}`
            : "0"}{" "}
          of {filtered.length} observations
        </span>
        <span className="table-error-note">Error = forecast − actual</span>
        <div className="pagination">
          <button
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            aria-label="Next page"
            disabled={page >= pages - 1}
            onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Methodology({ overview }: { overview: Overview }) {
  const rejected = Object.values(overview.source.rejected_records).reduce(
    (sum, value) => sum + value,
    0,
  );
  return (
    <section
      id="methodology"
      className="methodology"
      aria-labelledby="methodology-heading"
    >
      <div className="methodology-icon">
        <Layers3 size={21} />
      </div>
      <div className="methodology-body">
        <h2 id="methodology-heading">Know what goes into the analysis</h2>
        <p>
          For each delivery timestamp, we select the latest WINDFOR forecast
          published on the preceding calendar day in Europe/London. There is no
          intraday cutoff. We compare it with FUELHH WIND actuals at the exact
          same timestamp.
        </p>
        <details>
          <summary>
            Selection rules, metrics & data quality <ChevronDown size={14} />
          </summary>
          <div className="methodology-details">
            <p>
              <strong>Native resolution.</strong> Forecasts in this snapshot are
              hourly; actual generation is half-hourly. All actuals are
              retained. Only exact matches enter the metrics; forecasts are
              never interpolated or carried into another time slot.
            </p>
            <p>
              <strong>Accuracy.</strong> MAE = mean(|forecast − actual|). RMSE =
              √mean((forecast − actual)²). Bias = mean(forecast − actual). All
              three use MW. The period summary pools individual matched
              observations, rather than averaging daily metrics.
            </p>
            <p>
              <strong>Unavailable and conflicting records.</strong> Missing
              values remain unavailable. Exact duplicates are collapsed.
              Different values at the latest eligible publication time, or
              conflicting actual values for a target time, are flagged and
              excluded. No older forecast is substituted.
            </p>
            <p>
              <strong>Historical evaluation.</strong> Actuals show what happened
              after the purchasing decision. The historical wind analysis does
              not calculate the utility’s actual purchases. The separate
              procurement scenario uses hypothetical manual inputs for one
              delivery period. These datasets represent the Elexon wind series,
              not every form of UK renewable generation.
            </p>
            <p>
              <strong>Source snapshot.</strong>{" "}
              {integer.format(overview.source.indexed_records.WINDFOR)} forecast
              records and{" "}
              {integer.format(overview.source.indexed_records.FUELHH)} WIND
              actual records indexed. {rejected} invalid source records
              rejected. Raw responses and request provenance are retained with
              the application.
            </p>
            <div className="source-links">
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
                target="_blank"
                rel="noreferrer"
              >
                WINDFOR source <ArrowUpRight size={13} />
              </a>
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
                target="_blank"
                rel="noreferrer"
              >
                FUELHH source <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

const emptyMetrics: Metrics = { mae: null, rmse: null, bias: null, count: 0 };

function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [decision, setDecision] = useState("2026-01-01");
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const controller = new AbortController();
    get<Overview>("/api/overview", controller.signal)
      .then(setOverview)
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    get<Day>(`/api/decisions/${decision}`, controller.signal)
      .then((value) => {
        setDay(value);
        setLoading(false);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [decision, reload]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -35% 0px", threshold: [0, 0.1, 0.5] },
    );
    document
      .querySelectorAll("main section[id]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [overview, day]);

  const selectedIndex =
    overview?.days.findIndex((item) => item.decision_date === decision) ?? -1;
  const changeDate = (direction: number) => {
    const next = overview?.days[selectedIndex + direction];
    if (next) setDecision(next.decision_date);
  };
  const selectedDelivery = overview?.days.find(
    (item) => item.decision_date === decision,
  )?.delivery_date;
  const hasCurrentDay = day?.decision_date === decision;
  const displayDay = hasCurrentDay ? day : null;
  const navItems = [
    { id: "overview", label: "Day-ahead overview", icon: BarChart3 },
    { id: "accuracy", label: "Forecast accuracy", icon: Target },
    { id: "procurement", label: "Procurement scenario", icon: Calculator },
    { id: "observations", label: "Observations", icon: Table2 },
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Wind dashboard home">
          <span className="brand-mark">
            <Wind size={28} strokeWidth={1.7} />
          </span>
          <span>
            wind<span className="brand-period">.</span>
          </span>
        </a>
        <div className="brand-description">DAY-AHEAD INTELLIGENCE</div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <a
              href={`#${id}`}
              key={id}
              onClick={() => setActiveSection(id)}
              className={activeSection === id ? "nav-item active" : "nav-item"}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
              {activeSection === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-context">
          <span className="context-icon">
            <Wind size={22} />
          </span>
          <h2>A month in focus</h2>
          <p>
            National wind generation.
            <br />
            January 2026 decisions.
          </p>
          <span className="context-tag">31 decision days</span>
          <div className="wind-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="sidebar-bottom">
          <a href="#methodology">
            <CircleHelp size={17} />
            About this analysis
            <ArrowUpRight size={14} />
          </a>
          <div>
            <span className="tiny-source-dot" />
            Powered by Elexon data
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>Wind generation</span>
          </div>
          <div className="topbar-right">
            <span className="region">
              <Globe2 size={14} />
              United Kingdom
            </span>
            <span className="historical-tag">
              <span />
              Historical analysis
            </span>
          </div>
        </header>
        <main id="main-content">
          <section id="overview" className="overview-section">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span />
                  WIND GENERATION / JANUARY 2026
                </div>
                <h1>Day-ahead wind outlook</h1>
                <p>
                  A clear view of expected generation and the uncertainty behind
                  it.
                </p>
              </div>
              <span className="source-badge">
                <Database size={15} />
                Elexon · National WIND
              </span>
            </div>

            <div className="date-toolbar">
              <div className="decision-picker">
                <div className="toolbar-icon">
                  <CalendarDays size={21} strokeWidth={1.7} />
                </div>
                <label htmlFor="decision-date">
                  <span className="field-label">PURCHASING DECISION</span>
                  <div className="date-select-wrap">
                    <select
                      id="decision-date"
                      value={decision}
                      onChange={(event) => setDecision(event.target.value)}
                      disabled={!overview}
                    >
                      {(overview?.days ?? [{ decision_date: decision }]).map(
                        (item) => (
                          <option
                            key={item.decision_date}
                            value={item.decision_date}
                          >
                            {formatDate(item.decision_date)}
                          </option>
                        ),
                      )}
                    </select>
                    <ChevronDown size={15} />
                  </div>
                </label>
              </div>
              <ArrowRight
                className="delivery-arrow"
                size={20}
                strokeWidth={1.5}
              />
              <div className="delivery-date">
                <span className="field-label">NEXT-DAY DELIVERY</span>
                <strong>
                  {selectedDelivery ? formatDate(selectedDelivery) : "Loading…"}
                </strong>
              </div>
              <div className="date-navigation">
                <button
                  aria-label="Previous decision day"
                  disabled={selectedIndex <= 0 || loading}
                  onClick={() => changeDate(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  aria-label="Next decision day"
                  disabled={selectedIndex < 0 || selectedIndex >= 30 || loading}
                  onClick={() => changeDate(1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <span className="decision-rule">
                <span className="rule-dot" />
                Latest preceding-day forecast
              </span>
            </div>

            <div className="selection-note">
              <Info size={14} />
              <span>
                Only forecasts published on{" "}
                <strong>{formatDate(decision)}</strong> are eligible. All
                calendar days use Europe/London.
              </span>
            </div>
            <div className="daily-metrics-label">
              <h2>
                Forecast accuracy <span>/ selected delivery day</span>
              </h2>
              <span aria-live="polite">
                {loading ? (
                  <>
                    <LoaderCircle size={13} className="spin" />
                    Loading observations
                  </>
                ) : displayDay ? (
                  <>
                    <span className="small-check">
                      <Check size={10} />
                    </span>
                    {displayDay.metrics.count} matched timestamps
                  </>
                ) : (
                  "Observations unavailable"
                )}
              </span>
            </div>
            <MetricCards
              metrics={displayDay?.metrics ?? emptyMetrics}
              loading={loading}
            />
            {error && (
              <div className="error-panel" role="alert">
                <Info size={20} />
                <div>
                  <strong>We couldn’t load the analysis.</strong>
                  <p>{error}</p>
                </div>
                <button onClick={() => setReload((value) => value + 1)}>
                  <RefreshCw size={15} />
                  Try again
                </button>
              </div>
            )}
            {displayDay && (
              <GenerationChart day={displayDay} loading={loading} />
            )}
            {!displayDay && loading && (
              <div className="panel chart-placeholder">
                <LoaderCircle size={24} className="spin" />
                <span>Preparing wind generation observations…</span>
              </div>
            )}
            {displayDay && (
              <div className="coverage-strip">
                <div>
                  <span className="coverage-icon">
                    <CheckCheck size={18} />
                  </span>
                  <span>
                    <strong>{displayDay.coverage.matched} matched</strong> of{" "}
                    {displayDay.coverage.total_slots} half-hour delivery slots
                  </span>
                </div>
                <div>
                  <span className="neutral-dot" />
                  {displayDay.coverage.missing_forecast} without an eligible
                  forecast
                </div>
                <div>
                  <span className="neutral-dot" />
                  {displayDay.coverage.missing_actual} missing actuals
                </div>
                <div
                  className={
                    displayDay.coverage.conflicting_actual +
                      displayDay.coverage.conflicting_forecast >
                    0
                      ? "has-conflicts"
                      : ""
                  }
                >
                  <span className="neutral-dot" />
                  {displayDay.coverage.conflicting_actual +
                    displayDay.coverage.conflicting_forecast}{" "}
                  conflicting source groups
                </div>
              </div>
            )}
          </section>
          {overview && <MonthSummary overview={overview} />}
          <ProcurementScenario />
          {displayDay && (
            <ObservationTable day={displayDay} loading={loading} />
          )}
          {overview && <Methodology overview={overview} />}
          <footer className="footer">
            <span>
              <Wind size={16} />
              Wind generation intelligence
            </span>
            <span>
              {overview
                ? `Elexon snapshot · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(overview.source.fetched_at))}`
                : "Historical data from Elexon"}
              <span className="footer-separator">·</span>All generation in MW
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
