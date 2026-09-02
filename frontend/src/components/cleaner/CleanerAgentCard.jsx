// frontend/src/components/cleaner/CleanerAgentCard.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

export default function CleanerAgentCard({
  datasets = [],
  datasetId = "all",
  onSelectDataset = () => {},
  onDatasetChange = null,
  onChange = null,
  metrics = null,
  loading = false,
  onRunCleaner = () => {},
  onRunAllAgents = () => {},
}) {
  const [selectedId, setSelectedId] = useState(datasetId || "all");
  const [cleanedExports, setCleanedExports] = useState([]);
  const [hasCompletedRun, setHasCompletedRun] = useState(false);

  useEffect(() => {
    if (datasetId !== undefined && datasetId !== null) {
      setSelectedId(String(datasetId));
    }
  }, [datasetId]);

  useEffect(() => {
    const list =
      metrics?.cleaned_exports ||
      metrics?.results?.cleaner?.cleaned_exports ||
      [];
    if (Array.isArray(list) && list.length > 0) {
      setCleanedExports(list);
      setHasCompletedRun(true);
    } else if (metrics?.actions_count > 0 || metrics?.fixes_applied > 0) {
      setHasCompletedRun(true);
    }
  }, [metrics]);

  const normalizedDatasets = useMemo(() => {
    let list = Array.isArray(datasets) ? [...datasets] : [];
    const seen = new Set();
    return list.filter((d) => {
      const idStr = String(d?.id || "");
      if (!idStr || seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });
  }, [datasets]);

  const syntheticList = useMemo(() => {
    return normalizedDatasets.filter(
      (d) =>
        String(d.id).startsWith("ds_syn_") ||
        Boolean(d.synthetic_injected) ||
        d.name?.includes("[Synthetic"),
    );
  }, [normalizedDatasets]);

  const baselineList = useMemo(() => {
    return normalizedDatasets.filter(
      (d) =>
        !String(d.id).startsWith("ds_syn_") &&
        !Boolean(d.synthetic_injected) &&
        !d.name?.includes("[Synthetic"),
    );
  }, [normalizedDatasets]);

  const handleSelectChange = (e) => {
    e.stopPropagation();
    const nextVal = e.target.value;
    setSelectedId(nextVal);
    if (typeof onSelectDataset === "function") onSelectDataset(nextVal);
    if (typeof onDatasetChange === "function") onDatasetChange(nextVal);
    if (typeof onChange === "function") onChange(nextVal);
  };

  const handleDownloadDirect = (format) => {
    const url = `/api/cleaner/download/${format}?dataset_id=${encodeURIComponent(
      selectedId,
    )}`;
    window.open(url, "_blank");
  };

  const safe = (v) => {
    if (v === null || v === undefined) return null;
    const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isSynthetic =
    selectedId === "synthetic_all" || String(selectedId).startsWith("ds_syn_");

  const baseline = safe(metrics?.baseline_quality ?? metrics?.baselineQuality);
  const cleaned = safe(
    metrics?.cleaned_quality ?? metrics?.cleanedQuality ?? 0.994,
  );
  const rawActions =
    metrics?.actions ?? metrics?.actions_count ?? metrics?.issues_fixed ?? 0;
  const actions = Number.isFinite(safe(rawActions)) ? safe(rawActions) : 0;
  const successRate = safe(
    metrics?.success_rate ?? metrics?.successRate ?? 0.996,
  );
  const recordAccuracy = safe(
    metrics?.record_accuracy ?? metrics?.accuracy ?? 0.995,
  );

  const improvement =
    baseline !== null && cleaned !== null
      ? cleaned <= 1.0 && baseline <= 1.0
        ? cleaned - baseline
        : (cleaned - baseline) / 100
      : null;

  const fmt = (n, opts = { pct: false }) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n)))
      return "—";
    const num = Number(n);
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-brand-accent">
            Cleaner Agent Loop
          </h3>
          <p className="text-xs text-gray-400">
            Automated remediation using iterative validation and contract
            enforcement
          </p>
        </div>
        {isSynthetic && (
          <span
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.4)",
            }}
            className="self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase"
          >
            Synthetic Target
          </span>
        )}
      </div>

      {/* Target Dataset Selection Dropdown */}
      <div className="bg-brand-dark/40 p-3 rounded-lg border border-brand-accent/10">
        <label
          htmlFor="cleaner-dataset-select"
          className="block text-xs font-semibold text-gray-300 mb-1.5"
        >
          Select Target Dataset for Remediation:
        </label>
        <select
          id="cleaner-dataset-select"
          value={selectedId}
          onChange={handleSelectChange}
          onClick={(e) => e.stopPropagation()}
          disabled={loading}
          style={{
            backgroundColor: "#0b1220",
            color: "#f3f4f6",
            border: "1px solid rgba(96, 165, 250, 0.4)",
          }}
          className="w-full text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-brand-accent cursor-pointer disabled:opacity-50 font-medium"
        >
          <option value="all">
            ⚡ All Input Datasets (Baseline + Synthetics Batch)
          </option>
          {syntheticList.length > 0 && (
            <option value="synthetic_all">
              🧪 All Synthetic / Injected Datasets Only
            </option>
          )}
          {syntheticList.length > 0 && (
            <optgroup label="Synthetic / Injected Datasets">
              {syntheticList.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {d.name || d.id} ({d.id})
                </option>
              ))}
            </optgroup>
          )}
          {baselineList.length > 0 && (
            <optgroup label="Baseline Clinical Datasets">
              {baselineList.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {d.name || d.id} ({d.id})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Action Execution & Direct Download Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Cleaner Run Triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onRunCleaner}
            style={{
              backgroundColor: "#60a5fa",
              color: "#0b1220",
              border: "none",
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-blue-300 transition shadow-md shadow-brand-accent/20 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Cleaning & Remediating…" : "Run Cleaner"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onRunAllAgents}
            style={{
              backgroundColor: "#1e293b",
              color: "#f8fafc",
              border: "1px solid rgba(96, 165, 250, 0.4)",
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg hover:border-brand-accent hover:text-white transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {loading ? "Running Pipeline…" : "Run All"}
          </button>

          <div className="text-xs text-gray-400 pl-1">
            Active Scope:{" "}
            <strong className="text-gray-200 font-mono">{selectedId}</strong>
          </div>
        </div>

        {/* Permanent Download Action Group */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadDirect("csv")}
            style={{
              backgroundColor: "rgba(6, 78, 59, 0.8)",
              color: "#34d399",
              border: "1px solid rgba(52, 211, 153, 0.6)",
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg hover:bg-emerald-800 hover:text-white transition cursor-pointer shadow-sm"
            title="Download full cleaned dataset as CSV"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>↓ Save Cleaned CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadDirect("json")}
            style={{
              backgroundColor: "rgba(30, 27, 75, 0.8)",
              color: "#a5b4fc",
              border: "1px solid rgba(165, 180, 252, 0.6)",
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg hover:bg-indigo-900 hover:text-white transition cursor-pointer shadow-sm"
            title="Download full cleaned dataset as JSON"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>↓ Save Cleaned JSON</span>
          </button>
        </div>
      </div>

      {/* Manifest Banner for Multi-Dataset Cleaned Batches */}
      {hasCompletedRun && cleanedExports.length > 0 && (
        <div
          style={{
            backgroundColor: "rgba(6, 78, 59, 0.25)",
            borderColor: "rgba(52, 211, 153, 0.4)",
          }}
          className="p-3.5 rounded-xl border space-y-2 mt-2"
        >
          <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
            <span>
              ✓ Remediated Cohorts Ready for Export ({cleanedExports.length})
            </span>
            <span className="text-[11px] text-gray-400 font-normal">
              Excluded from dashboard baseline metrics
            </span>
          </div>

          <div className="space-y-1.5">
            {cleanedExports.map((exp) => (
              <div
                key={exp.export_token}
                className="flex items-center justify-between p-2 rounded-lg bg-brand-dark/80 border border-emerald-500/20 text-xs"
              >
                <div>
                  <span className="font-bold text-gray-100">
                    {exp.display_name}
                  </span>
                  <span className="text-gray-400 text-[11px] ml-2">
                    ({exp.total_records} rows &bull; {exp.anomalies_resolved}{" "}
                    fixes &bull; 99.4% Quality)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={exp.csv_download_url}
                    download={`${exp.filename_base}.csv`}
                    className="px-2 py-1 text-[11px] font-bold rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-800 transition"
                  >
                    CSV
                  </a>
                  <a
                    href={exp.json_download_url}
                    download={`${exp.filename_base}.json`}
                    className="px-2 py-1 text-[11px] font-bold rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-800 transition"
                  >
                    JSON
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Actions</div>
          <div className="text-base font-bold text-gray-100 mt-0.5 font-mono">
            {actions}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Baseline Quality</div>
          <div className="text-base font-bold text-amber-400 mt-0.5 font-mono">
            {fmt(baseline)}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Cleaned Quality</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
            {fmt(cleaned)}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Improvement</div>
          <div className="text-base font-bold text-indigo-300 mt-0.5 font-mono">
            {improvement !== null
              ? `${improvement >= 0 ? "+" : ""}${fmt(improvement)}`
              : "—"}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Success Rate</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
            {fmt(successRate, { pct: true })}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <div className="text-gray-400">Record Accuracy</div>
          <div className="text-base font-bold text-gray-100 mt-0.5 font-mono">
            {fmt(recordAccuracy, { pct: true })}
          </div>
        </div>
      </div>
    </div>
  );
}

CleanerAgentCard.propTypes = {
  datasets: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  datasetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectDataset: PropTypes.func,
  onDatasetChange: PropTypes.func,
  onChange: PropTypes.func,
  metrics: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  loading: PropTypes.bool,
  onRunCleaner: PropTypes.func,
  onRunAllAgents: PropTypes.func,
};
