import React from "react";
import PropTypes from "prop-types";

/**
 * BeforeAfterComparisonPanel
 * Compares raw ingestion metrics against post-remediation quality indicators.
 * Defensively parses issues whether passed as numbers, strings, or breakdown objects.
 */
export default function BeforeAfterComparisonPanel({
  baselineQuality = null,
  baselineIssues = null,
  cleanedQuality = null,
  cleanedIssues = null,
  className = "",
}) {
  // Safe score formatter (handles 0.94 -> 94.0%, 94 -> 94.0%, null -> —)
  const formatScore = (v) => {
    if (v === null || v === undefined) return "—";
    const num = Number(v);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  // Safe issues counter (handles numbers, objects like { missing_values: 0, ... }, or strings)
  const extractTotalIssues = (issues) => {
    if (issues === null || issues === undefined) return "—";
    if (typeof issues === "number") return issues;
    if (typeof issues === "string" && !Number.isNaN(Number(issues))) {
      return Number(issues);
    }
    if (typeof issues === "object") {
      const values = Object.values(issues);
      if (values.length === 0) return 0;
      return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
    }
    return String(issues);
  };

  // Safe issues breakdown formatter for sub-text details
  const renderIssuesBreakdown = (issues) => {
    if (!issues || typeof issues !== "object" || Array.isArray(issues)) {
      return null;
    }
    const entries = Object.entries(issues);
    if (entries.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.map(([key, count]) => (
          <span
            key={key}
            className="rounded bg-brand-dark/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-300 border border-brand-accent/10"
          >
            {key.replace(/_/g, " ")}: <strong>{Number(count) || 0}</strong>
          </span>
        ))}
      </div>
    );
  };

  const baseScoreNum =
    baselineQuality !== null && Number.isFinite(Number(baselineQuality))
      ? Number(baselineQuality) <= 1.0
        ? Number(baselineQuality) * 100
        : Number(baselineQuality)
      : null;

  const cleanScoreNum =
    cleanedQuality !== null && Number.isFinite(Number(cleanedQuality))
      ? Number(cleanedQuality) <= 1.0
        ? Number(cleanedQuality) * 100
        : Number(cleanedQuality)
      : null;

  const delta =
    baseScoreNum !== null && cleanScoreNum !== null
      ? cleanScoreNum - baseScoreNum
      : null;

  const totalBaseIssues = extractTotalIssues(baselineIssues);
  const totalCleanIssues = extractTotalIssues(cleanedIssues);

  return (
    <div
      className={`rounded-xl border border-brand-accent/20 bg-brand-light p-5 shadow-md ${className}`}
    >
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-brand-accent">
            Before vs. After Cleaning Benchmark
          </h3>
          <p className="text-xs text-gray-400">
            Direct comparison of raw ingestion baseline against autonomous
            remediation
          </p>
        </div>

        {delta !== null && (
          <span
            className={`self-start rounded px-2.5 py-1 text-xs font-semibold sm:self-auto ${
              delta >= 0
                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : "border border-rose-500/30 bg-rose-500/20 text-rose-300"
            }`}
          >
            {delta >= 0
              ? `+${delta.toFixed(1)}% Quality`
              : `${delta.toFixed(1)}% Quality`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Baseline Card */}
        <div className="rounded-lg border border-brand-accent/10 bg-brand-dark/50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Raw Baseline
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-200">
            {formatScore(baselineQuality)}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Issues Flagged:{" "}
            <strong className="text-gray-300 font-mono">
              {String(totalBaseIssues)}
            </strong>
          </div>
          {renderIssuesBreakdown(baselineIssues)}
        </div>

        {/* Cleaned Card */}
        <div className="rounded-lg border border-brand-accent/10 bg-brand-dark/50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Post-Remediation
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {formatScore(cleanedQuality)}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Remaining Anomalies:{" "}
            <strong className="text-emerald-300 font-mono">
              {String(totalCleanIssues)}
            </strong>
          </div>
          {renderIssuesBreakdown(cleanedIssues)}
        </div>
      </div>
    </div>
  );
}

BeforeAfterComparisonPanel.propTypes = {
  baselineQuality: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  baselineIssues: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.object,
  ]),
  cleanedQuality: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  cleanedIssues: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.object,
  ]),
  className: PropTypes.string,
};
