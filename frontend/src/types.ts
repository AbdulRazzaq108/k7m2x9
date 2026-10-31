export type Metrics = {
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  count: number;
};
export type Coverage = {
  total_slots: number;
  matched: number;
  forecast_available: number;
  actual_available: number;
  missing_forecast: number;
  missing_actual: number;
  conflicting_forecast: number;
  conflicting_actual: number;
};
export type Observation = {
  start_time: string;
  time: string;
  publish_time: string | null;
  forecast: number | null;
  actual: number | null;
  error: number | null;
  status: string;
  issues: string[];
};
export type DaySummary = {
  decision_date: string;
  delivery_date: string;
  metrics: Metrics;
  coverage: Coverage;
};
export type Day = DaySummary & {
  timezone: string;
  units: string;
  rows: Observation[];
  publication_times: string[];
};
export type Overview = {
  decision_from: string;
  decision_to: string;
  delivery_from: string;
  delivery_to: string;
  timezone: string;
  units: string;
  metrics: Metrics;
  coverage: Coverage;
  days: DaySummary[];
  source: {
    source: string;
    fetched_at: string;
    indexed_records: Record<string, number>;
    rejected_records: Record<string, number>;
  };
};
