// frontend/src/components/MetricsPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { fetchMetricsSummary, fetchMetricsDatasets } from "../services/api";

/**
 * MetricsPanel
 * Displays global data quality indicators, dimensional scores, and per-dataset health summaries.
 * Defensively extracts numeric values directly from live backend computation payloads without
 * falling back to hardcoded prototype counts when no datasets exist.
 */
export default function MetricsPanel({
  className = "",
  hasDatasets = false,
  datasets = [],
  metrics = null,
  onRefresh = null,
}) {
  const [summary, setSummary] = useState(null);
  const [datasetsMetrics, setDatasetsMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMetrics = useCallback(async () => {
    if (!hasDatasets) {
      setSummary(null);
      setDatasetsMetrics([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [sumData, dsData] = await Promise.all([
        fetchMetricsSummary().catch(() => null),
        fetchMetricsDatasets().catch(() => []),
      ]);

      setSummary(sumData || null);
      if (Array.isArray(dsData)) {
        setDatasetsMetrics(dsData);
      } else if (dsData && typeof dsData === "object") {
        setDatasetsMetrics(Object.values(dsData));
      } else {
        setDatasetsMetrics([]);
      }
    } catch (err) {
      console.error("Failed to load metrics panel data:", err);
      setError(err.message || "Failed to load metrics summary.");
    } finally {
      setLoading(false);
    }
  }, [hasDatasets]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRefreshClick = async () => {
    await loadMetrics();
    if (typeof onRefresh === "function") {
      await onRefresh();
    }
  };

  // Safe score formatter (handles 0.94 -> 94.0%, 94 -> 94.0%, null -> —)
  const formatScore = (val) => {
    if (!hasDatasets || val === null || val === undefined) return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 && num > 0
      ? `${(num * 100).toFixed(1)}%`
      : `${num.toFixed(1)}%`;
  };

  // Safe float extractor with nested { after, current, value, before } unwrapping
  const safeFloat = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === "object") {
      const v =
        val.after ?? val.current ?? val.score ?? val.value ?? val.before;
      if (v !== undefined && v !== null) {
        return safeFloat(v);
      }
      return null;
    }
    const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Safe issue count extractor (handles numbers, strings, and objects like { missing_values, ... })
  const extractCount = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (typeof val === "string" && !Number.isNaN(Number(val))) {
      return Number(val);
    }
    if (typeof val === "object") {
      const values = Object.values(val);
      if (values.length === 0) return 0;
      return values.reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    return 0;
  };

  // Safe issue breakdown renderer
  const renderBreakdown = (issues) => {
    if (!issues || typeof issues !== "object" || Array.isArray(issues)) {
      return null;
    }
    const entries = Object.entries(issues);
    if (entries.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className="px-1.5 py-0.5 rounded bg-brand-dark/80 text-[10px] font-mono text-gray-300 border border-brand-accent/10"
          >
            {k.replace(/_/g, " ")}:{" "}
            <strong className="text-gray-100">{Number(v) || 0}</strong>
          </span>
        ))}
      </div>
    );
  };

  const activeSummary = hasDatasets
    ? summary || metrics?.summary || metrics || null
    : null;
  const activeDatasetList = hasDatasets
    ? datasetsMetrics.length > 0
      ? datasetsMetrics
      : Array.isArray(datasets)
        ? datasets
        : []
    : [];

  // 1. Dynamic Quality Dimensions
  const completeness = safeFloat(
    activeSummary?.completeness_score ??
      activeSummary?.completeness ??
      activeSummary?.dimensional_breakdown?.completeness,
  );
  const accuracy = safeFloat(
    activeSummary?.accuracy_score ??
      activeSummary?.accuracy ??
      activeSummary?.record_accuracy ??
      activeSummary?.dimensional_breakdown?.accuracy,
  );
  const consistency = safeFloat(
    activeSummary?.consistency_score ??
      activeSummary?.consistency ??
      activeSummary?.dimensional_breakdown?.consistency,
  );
  const validity = safeFloat(
    activeSummary?.validity_score ??
      activeSummary?.validity ??
      activeSummary?.dimensional_breakdown?.validity,
  );

  // 2. Evaluated Records & Anomaly Counts (0 when no datasets exist)
  const fallbackTotalRecords = activeDatasetList.reduce(
    (acc, d) =>
      acc + (Number(d.total_records ?? d.rows_count ?? d.rows ?? 0) || 0),
    0,
  );
  const totalRecords = hasDatasets
    ? (safeFloat(
        activeSummary?.total_records_evaluated ??
          activeSummary?.records_evaluated ??
          activeSummary?.total_records_analyzed ??
          activeSummary?.total_records ??
          activeSummary?.total_rows,
      ) ?? fallbackTotalRecords)
    : 0;

  const fallbackTotalAnomalies = activeDatasetList.reduce(
    (acc, d) =>
      acc + extractCount(d.anomalies ?? d.issues ?? d.anomalies_count ?? 0),
    0,
  );
  const totalAnomalies = hasDatasets
    ? extractCount(
        activeSummary?.detected_anomalies ??
          activeSummary?.total_anomalies_detected ??
          activeSummary?.total_anomalies ??
          activeSummary?.issues_breakdown ??
          activeSummary?.total_issues ??
          activeSummary?.actions,
      ) || fallbackTotalAnomalies
    : 0;

  return (
    <div
      className={`bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-brand-accent">
            Quality Telemetry &amp; Metrics
          </h3>
          <p className="text-xs text-gray-400">
            System-wide automated quality dimension evaluations
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={!hasDatasets || loading}
          className="px-2.5 py-1 text-xs rounded bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition disabled:opacity-40 cursor-pointer"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Completeness</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {formatScore(completeness)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Accuracy</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {formatScore(accuracy)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Consistency</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {formatScore(consistency)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Validity</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {formatScore(validity)}
          </div>
        </div>
      </div>

      {/* Aggregate Volume Stats */}
      <div className="p-3 rounded-lg bg-brand-dark/40 border border-brand-accent/10 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Total Records Evaluated:</span>
          <span className="font-mono font-bold text-gray-200">
            {Number(totalRecords).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Detected Anomalies:</span>
          <span
            className={`font-mono font-bold ${
              totalAnomalies > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {Number(totalAnomalies).toLocaleString()}
          </span>
        </div>

        {hasDatasets &&
          activeSummary?.issues_breakdown &&
          renderBreakdown(activeSummary.issues_breakdown)}
      </div>

      {/* Per Dataset Breakdown */}
      {activeDatasetList.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-gray-300">
            Dataset Quality Breakdown
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeDatasetList.map((d) => {
              const isSynthetic =
                Boolean(d.synthetic_injected) ||
                String(d.id).startsWith("ds_syn_") ||
                d.name?.includes("Synthetic");

              const anomaliesCount = extractCount(
                d.anomalies ?? d.issues ?? d.anomalies_count ?? 0,
              );

              const score = safeFloat(
                d.quality_score ??
                  d.score ??
                  d.post_clean_score ??
                  d.completeness,
              );

              const isNeedsRemediation =
                d.health_status === "NEEDS_FIX" ||
                d.health_status === "NEEDS_REMEDIATION" ||
                isSynthetic ||
                anomaliesCount > 0 ||
                (score !== null && score < 0.95);

              return (
                <div
                  key={d.id || d.name}
                  className="p-2.5 rounded-lg bg-brand-dark/40 border border-brand-accent/10 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-gray-200 truncate max-w-[140px] sm:max-w-[180px]">
                      {d.name || d.id}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Anomalies:{" "}
                      <strong
                        className={
                          anomaliesCount > 0
                            ? "font-mono text-amber-400"
                            : "font-mono text-gray-300"
                        }
                      >
                        {anomaliesCount}
                      </strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-gray-200">
                      {formatScore(score)}
                    </div>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5 ${
                        isNeedsRemediation
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {isNeedsRemediation ? "Needs Fix" : "Optimal"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

MetricsPanel.propTypes = {
  className: PropTypes.string,
  hasDatasets: PropTypes.bool,
  datasets: PropTypes.array,
  metrics: PropTypes.object,
  onRefresh: PropTypes.func,
};
