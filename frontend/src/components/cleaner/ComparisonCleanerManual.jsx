// frontend/src/components/cleaner/ComparisonCleanerManual.jsx
import React from "react";
import PropTypes from "prop-types";

export default function ComparisonCleanerManual({
  cleanerMetrics = null,
  manualMetrics = null,
  datasetId = "all",
  hasDatasets = true,
}) {
  const safeFloat = (v, fallback = null) => {
    if (v === null || v === undefined) return fallback;
    const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const activeCleaner = hasDatasets ? cleanerMetrics : null;
  const activeManual = hasDatasets ? manualMetrics : null;

  const cleanerObj =
    activeCleaner?.cleaner ??
    activeCleaner?.[datasetId] ??
    activeCleaner ??
    null;

  const cleanerQualityRaw = cleanerObj
    ? safeFloat(
        cleanerObj?.cleaned_quality ??
          cleanerObj?.quality_score ??
          cleanerObj?.quality,
        null,
      )
    : null;
  const cleanerRecordAccRaw = cleanerObj
    ? safeFloat(cleanerObj?.record_accuracy ?? cleanerObj?.accuracy, null)
    : null;
  const cleanerActions = cleanerObj
    ? (safeFloat(
        cleanerObj?.actions ??
          cleanerObj?.fixes_applied ??
          cleanerObj?.actions_count ??
          cleanerObj?.issues_fixed,
        0,
      ) ?? 0)
    : 0;

  const manualObj =
    activeManual?.manual ??
    activeManual?.[datasetId] ??
    activeManual?.["all"] ??
    activeManual ??
    null;

  const manualQualityRaw = manualObj
    ? safeFloat(
        manualObj?.quality_score ??
          manualObj?.cleaned_quality ??
          manualObj?.quality,
        null,
      )
    : null;
  const manualRecordAccRaw = manualObj
    ? safeFloat(manualObj?.record_accuracy ?? manualObj?.accuracy, null)
    : null;
  const manualIssues = manualObj
    ? (safeFloat(
        manualObj?.issues_fixed ??
          manualObj?.actions ??
          manualObj?.issues ??
          manualObj?.fixes,
        0,
      ) ?? 0)
    : 0;

  const fmtPercent = (val) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  const fmtScore = (val) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 ? num.toFixed(2) : (num / 100).toFixed(2);
  };

  return (
    <div className="bg-brand-light p-6 rounded-xl border border-brand-accent/20 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-brand-accent text-lg font-bold">
          Cleaner vs Manual Fixes
        </h4>
        <span className="text-[11px] font-mono text-gray-400">
          Partition:{" "}
          <strong className="text-gray-200">
            {hasDatasets ? datasetId : "—"}
          </strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="cleaner-heading"
          className="p-4 rounded-xl bg-brand-dark border border-brand-accent/20 space-y-3"
        >
          <div className="flex justify-between items-center">
            <h5
              id="cleaner-heading"
              className="text-gray-200 font-bold text-xs uppercase tracking-wider"
            >
              Autonomous Cleaner Agent
            </h5>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {cleanerQualityRaw !== null ? "Active Telemetry" : "—"}
            </span>
          </div>

          <div>
            <div className="text-xs text-gray-400">Quality Score</div>
            <div className="text-brand-accent text-2xl font-extrabold font-mono mt-0.5">
              {fmtScore(cleanerQualityRaw)}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Record Accuracy</div>
            <div className="text-emerald-400 text-lg font-bold font-mono mt-0.5">
              {fmtPercent(cleanerRecordAccRaw)}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Issues Fixed</div>
            <div className="text-gray-100 text-lg font-bold font-mono mt-0.5">
              {hasDatasets ? cleanerActions : 0}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="manual-heading"
          className="p-4 rounded-xl bg-brand-dark border border-brand-accent/15 space-y-3"
        >
          <div className="flex justify-between items-center">
            <h5
              id="manual-heading"
              className="text-gray-300 font-bold text-xs uppercase tracking-wider"
            >
              Manual Data Steward Fixes
            </h5>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              NHS Band 8a Standard
            </span>
          </div>

          <div>
            <div className="text-xs text-gray-400">Quality Score</div>
            <div className="text-indigo-300 text-2xl font-extrabold font-mono mt-0.5">
              {fmtScore(manualQualityRaw)}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Record Accuracy</div>
            <div className="text-indigo-300 text-lg font-bold font-mono mt-0.5">
              {fmtPercent(manualRecordAccRaw)}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Issues Fixed</div>
            <div className="text-amber-400 text-lg font-bold font-mono mt-0.5">
              {hasDatasets ? manualIssues : 0}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

ComparisonCleanerManual.propTypes = {
  cleanerMetrics: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  manualMetrics: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  datasetId: PropTypes.string,
  hasDatasets: PropTypes.bool,
};
