// frontend/src/hooks/useDashboardData.js
import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchDatasets,
  fetchMetrics,
  fetchRunLog,
  fetchRemediationHistory,
  fetchMetricsDatasets,
  fetchAgentMetricsSummary,
  fetchCleanerMetrics,
  fetchRiskMetrics,
  fetchForecastMetrics,
  fetchReasoningMetrics,
  fetchEvaluations,
} from "../services/api";

/**
 * useDashboardData
 *
 * Dynamically binds backend multi-agent evaluation telemetry,
 * hardware profiling, dimensional metrics, and execution trajectories.
 *
 * - autoLoad: boolean (default true)
 * - pollIntervalMs: number | null
 */
export default function useDashboardData({
  autoLoad = true,
  pollIntervalMs = null,
} = {}) {
  const [datasets, setDatasets] = useState([]);
  const [metrics, setMetrics] = useState({
    datasets: {},
    trajectories: { agent: [], manual: [], baseline: [] },
    risk: {},
    forecast: {},
    reasoning: [],
    manual: {},
    dimensional_breakdown: {},
    completeness: null,
    accuracy: null,
    validity: null,
    consistency: null,
    uniqueness: null,
  });
  const [metricsDatasets, setMetricsDatasets] = useState(null);
  const [agentMetricsSummary, setAgentMetricsSummary] = useState(null);
  const [cleanerMetrics, setCleanerMetrics] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [forecastMetrics, setForecastMetrics] = useState(null);
  const [reasoningMetrics, setReasoningMetrics] = useState(null);
  const [evaluations, setEvaluations] = useState(null);
  const [runLog, setRunLog] = useState([]);
  const [remediationHistory, setRemediationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const manualMetrics = {
    review_hours_per_dataset: 4.5,
    steward_hourly_rate_gbp: 71.11,
  };

  const mountedRef = useRef(true);
  const pollRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetchDatasets(),
        fetchMetrics(),
        fetchRunLog(),
        fetchRemediationHistory(),
        fetchMetricsDatasets(),
        fetchAgentMetricsSummary(),
        fetchCleanerMetrics(),
        fetchRiskMetrics(),
        fetchForecastMetrics(),
        fetchReasoningMetrics(),
        fetchEvaluations(),
      ]);

      if (!mountedRef.current) return;

      const [
        dsRes,
        metricsRes,
        runsRes,
        histRes,
        metricsDatasetsRes,
        agentSummaryRes,
        cleanerRes,
        riskRes,
        forecastRes,
        reasoningRes,
        evaluationsRes,
      ] = results;

      // 1. Datasets Array Parsing
      let currentDatasets = [];
      if (dsRes.status === "fulfilled" && dsRes.value) {
        currentDatasets = Array.isArray(dsRes.value)
          ? dsRes.value
          : dsRes.value.datasets || [];
        setDatasets(currentDatasets);
      }

      // 2. Logs and History
      if (runsRes.status === "fulfilled" && runsRes.value) {
        setRunLog(Array.isArray(runsRes.value) ? runsRes.value : []);
      }

      if (histRes.status === "fulfilled" && histRes.value) {
        setRemediationHistory(
          Array.isArray(histRes.value) ? histRes.value : [],
        );
      }

      // 3. Sub-system Metric States
      if (metricsDatasetsRes.status === "fulfilled")
        setMetricsDatasets(metricsDatasetsRes.value ?? null);

      if (agentSummaryRes.status === "fulfilled")
        setAgentMetricsSummary(agentSummaryRes.value ?? null);

      let currentCleaner = null;
      if (cleanerRes.status === "fulfilled" && cleanerRes.value) {
        currentCleaner = cleanerRes.value;
        setCleanerMetrics(currentCleaner);
      }

      if (riskRes.status === "fulfilled") setRiskMetrics(riskRes.value ?? null);
      if (forecastRes.status === "fulfilled")
        setForecastMetrics(forecastRes.value ?? null);
      if (reasoningRes.status === "fulfilled")
        setReasoningMetrics(reasoningRes.value ?? null);
      if (evaluationsRes.status === "fulfilled")
        setEvaluations(evaluationsRes.value ?? null);

      // 4. Build Structured Dynamic Metrics Object
      const primaryDatasetId = currentDatasets[0]?.id || "ds_001";
      const mObj = {
        datasets: {},
        trajectories: { agent: [], manual: [], baseline: [] },
        risk: {},
        forecast: {},
        reasoning: [],
        manual: manualMetrics,
        dimensional_breakdown: {},
      };

      if (metricsRes.status === "fulfilled" && metricsRes.value) {
        const rawMetrics = metricsRes.value;
        const dsId = rawMetrics.dataset_id || primaryDatasetId;

        mObj.datasets[dsId] = {
          quality_score:
            rawMetrics.cleaned_quality ??
            rawMetrics.global_quality_score ??
            null,
          issues: rawMetrics.issues_breakdown || rawMetrics.issues || {},
        };

        // Extract Trajectories dynamically if supplied by backend
        if (rawMetrics.trajectories) {
          mObj.trajectories = rawMetrics.trajectories;
        }

        // Extract Dimensional Breakdown
        if (rawMetrics.dimensional_breakdown) {
          mObj.dimensional_breakdown = rawMetrics.dimensional_breakdown;
          mObj.completeness = rawMetrics.dimensional_breakdown.completeness;
          mObj.accuracy = rawMetrics.dimensional_breakdown.accuracy;
          mObj.validity = rawMetrics.dimensional_breakdown.validity;
          mObj.consistency = rawMetrics.dimensional_breakdown.consistency;
          mObj.uniqueness = rawMetrics.dimensional_breakdown.uniqueness;
        }

        // Merge all top-level raw metric attributes
        Object.assign(mObj, rawMetrics);
      }

      if (forecastRes.status === "fulfilled" && forecastRes.value) {
        const fc = forecastRes.value;
        const dsId = fc.dataset_id || primaryDatasetId;
        mObj.forecast[dsId] = fc.forecast_points || [];
      }

      if (reasoningRes.status === "fulfilled" && reasoningRes.value) {
        const rs = reasoningRes.value;
        const dsId = rs.dataset_id || primaryDatasetId;
        mObj.reasoning = Array.isArray(rs) ? rs : rs.steps || [];
        mObj.reasoning[dsId] = rs.steps || [];
      }

      if (riskRes.status === "fulfilled" && riskRes.value) {
        const rk = riskRes.value;
        const dsId = rk.dataset_id || primaryDatasetId;
        mObj.risk[dsId] = rk;
      }

      // If cleaner metrics were returned embedded in the metrics payload, synchronize them
      if (metricsRes.status === "fulfilled" && metricsRes.value?.cleaner) {
        setCleanerMetrics(metricsRes.value.cleaner);
      }

      setMetrics((prev) => ({ ...prev, ...mObj }));
    } catch (err) {
      console.error("useDashboardData loadAll error:", err);
      setError(err.message || "Failed to load dashboard telemetry.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoLoad) loadAll();

    if (pollIntervalMs && Number.isFinite(Number(pollIntervalMs))) {
      pollRef.current = setInterval(() => {
        loadAll();
      }, Number(pollIntervalMs));
    }

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoLoad, pollIntervalMs, loadAll]);

  return {
    datasets,
    metrics,
    metricsDatasets,
    agentMetricsSummary,
    cleanerMetrics,
    manualMetrics,
    riskMetrics,
    forecastMetrics,
    reasoningMetrics,
    evaluations,
    runLog,
    remediationHistory,
    loading,
    error,
    setCleanerMetrics,
    setRemediationHistory,
    refreshAll,
  };
}
