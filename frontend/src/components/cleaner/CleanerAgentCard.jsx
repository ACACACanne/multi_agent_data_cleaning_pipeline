// frontend/src/components/cleaner/CleanerAgentCard.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

/**
 * CleanerAgentCard
 *
 * Displays cleaner agent metrics, controls, and an interactive dataset selector
 * with dedicated batch targets for All Datasets and Synthetic-Only partitions.
 * Fully dynamic: computes metrics, deltas, and improvements directly from live telemetry.
 */
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
  // 1. Synchronized Local Selection State
  const [selectedId, setSelectedId] = useState(datasetId || "all");

  useEffect(() => {
    if (datasetId !== undefined && datasetId !== null) {
      setSelectedId(String(datasetId));
    }
  }, [datasetId]);

  // 2. Normalize and Deduplicate Datasets List without hardcoded mock partitions
  const normalizedDatasets = useMemo(() => {
    let list = [];
    if (Array.isArray(datasets) && datasets.length > 0) {
      list = [...datasets];
    } else if (
      datasets &&
      Array.isArray(datasets.datasets) &&
      datasets.datasets.length > 0
    ) {
      list = [...datasets.datasets];
    }

    // Deduplicate by ID
    const seen = new Set();
    return list.filter((d) => {
      const idStr = String(d?.id || "");
      if (!idStr || seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });
  }, [datasets]);

  // Partition synthetic vs baseline datasets dynamically based on metadata/naming
  const syntheticList = useMemo(() => {
    return normalizedDatasets.filter(
      (d) =>
        String(d.id).startsWith("ds_syn_") ||
        Boolean(d.synthetic_injected) ||
        d.name?.includes("[Synthetic") ||
        d.name?.includes("[injected_") ||
        d.name?.includes("Synthetic"),
    );
  }, [normalizedDatasets]);

  const baselineList = useMemo(() => {
    return normalizedDatasets.filter(
      (d) =>
        !String(d.id).startsWith("ds_syn_") &&
        !Boolean(d.synthetic_injected) &&
        !d.name?.includes("[Synthetic") &&
        !d.name?.includes("[injected_") &&
        !d.name?.includes("Synthetic"),
    );
  }, [normalizedDatasets]);

  // Handle Dropdown Selection
  const handleSelectChange = (e) => {
    e.stopPropagation();
    const nextVal = e.target.value;
    setSelectedId(nextVal);

    if (typeof onSelectDataset === "function") {
      onSelectDataset(nextVal);
    }
    if (typeof onDatasetChange === "function") {
      onDatasetChange(nextVal);
    }
    if (typeof onChange === "function") {
      onChange(nextVal);
    }
  };

  // Safe Numeric Parser
  const safe = (v) => {
    if (v === null || v === undefined) return null;
    const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const activeDatasetObj = normalizedDatasets.find(
    (d) => String(d.id) === String(selectedId),
  );

  const isSynthetic =
    selectedId === "synthetic_all" ||
    String(selectedId).startsWith("ds_syn_") ||
    Boolean(activeDatasetObj?.synthetic_injected) ||
    Boolean(activeDatasetObj?.name?.includes("[Synthetic")) ||
    Boolean(activeDatasetObj?.name?.includes("[injected_"));

  // 3. Dynamic Metrics Extraction
  const baseline = safe(
    metrics?.baseline_quality ??
      metrics?.baselineQuality ??
      metrics?.cleaner?.baseline_quality ??
      metrics?.datasets?.[selectedId]?.baseline_quality,
  );

  const cleaned = safe(
    metrics?.cleaned_quality ??
      metrics?.cleanedQuality ??
      metrics?.global_quality_score ??
      metrics?.cleaner?.cleaned_quality ??
      metrics?.datasets?.[selectedId]?.quality_score,
  );

  const rawActions =
    metrics?.actions ??
    metrics?.actions_count ??
    metrics?.fixes_applied ??
    metrics?.fixes ??
    metrics?.issues_fixed ??
    metrics?.total_actions ??
    metrics?.cleaner?.actions ??
    activeDatasetObj?.anomalies_count ??
    activeDatasetObj?.anomalies;

  const actions = Number.isFinite(safe(rawActions)) ? safe(rawActions) : 0;

  const rawSuccessRate =
    metrics?.success_rate ??
    metrics?.successRate ??
    metrics?.remediation_rate ??
    metrics?.cleaner_accuracy ??
    metrics?.cleaner?.success_rate;

  const successRate = safe(rawSuccessRate);

  const recordAccuracy = safe(
    metrics?.record_accuracy ??
      metrics?.recordAccuracy ??
      metrics?.accuracy ??
      metrics?.cleaner?.record_accuracy,
  );

  // Dynamic delta calculation
  const improvement =
    baseline !== null && cleaned !== null
      ? cleaned <= 1.0 && baseline <= 1.0
        ? cleaned - baseline
        : (cleaned - baseline) / 100
      : null;

  const fmt = (n, opts = { pct: false }) => {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) {
      return "—";
    }
    const num = Number(n);
    if (opts.pct) {
      return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
    }
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-lg font-bold text-brand-accent">
            Cleaner Agent Loop
          </h3>
          <p className="text-xs text-gray-400">
            Automated remediation using iterative validation, outlier bounds,
            and contract enforcement
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
      <div className="mb-4 bg-brand-dark/40 p-3 rounded-lg border border-brand-accent/10">
        <label
          htmlFor="cleaner-dataset-select"
          className="block text-xs font-semibold text-gray-300 mb-1.5"
        >
          Select Target Dataset for Remediation:
        </label>
        <div className="flex items-center gap-2">
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
            {/* Batch Scope Options */}
            <option value="all">
              ⚡ All Datasets (Full Batch Remediation)
            </option>
            {syntheticList.length > 0 && (
              <option value="synthetic_all">
                🧪 All Synthetic / Injected Datasets Only (Batch Synthetic)
              </option>
            )}

            {/* Individual Synthetic Target Partitions */}
            {syntheticList.length > 0 && (
              <optgroup label="Synthetic / Injected Datasets">
                {syntheticList.map((d) => (
                  <option key={String(d.id)} value={String(d.id)}>
                    {d.name || d.id} ({d.id})
                  </option>
                ))}
              </optgroup>
            )}

            {/* Individual Baseline Clinical Partitions */}
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
      </div>

      {/* Execution Buttons with Explicit High-Contrast Dark Styling */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Run Cleaner Button */}
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

        {/* Run All Agents Button */}
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

        <div className="text-xs text-gray-400">
          Active Scope:{" "}
          <strong className="text-gray-200 font-mono">{selectedId}</strong>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
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
