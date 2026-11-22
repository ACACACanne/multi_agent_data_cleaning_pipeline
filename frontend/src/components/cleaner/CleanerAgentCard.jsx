// frontend/src/components/cleaner/CleanerAgentCard.jsx
import React from "react";
import PropTypes from "prop-types";
import { client } from "../../utils/apiClient";

export default function CleanerAgentCard({
  datasets = [],
  datasetId = "all",
  onSelectDataset = () => {},
  metrics = null,
  loading = false,
  onRunCleaner = () => {},
  onRunAllAgents = () => {},
}) {
  const hasDatasets = Array.isArray(datasets) && datasets.length > 0;
  const activeMetrics = hasDatasets && metrics ? metrics : null;

  const formatScore = (val) => {
    if (
      !activeMetrics ||
      val === null ||
      val === undefined ||
      Number.isNaN(Number(val))
    ) {
      return "—";
    }
    const num = Number(val);
    const pct = num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  };

  const actionsCount = activeMetrics
    ? Number(
        activeMetrics.actions ??
          activeMetrics.actions_count ??
          activeMetrics.fixes_applied ??
          activeMetrics.issues_fixed ??
          0,
      )
    : 0;

  const baselineQualityText = formatScore(activeMetrics?.baseline_quality);
  const cleanedQualityText = formatScore(activeMetrics?.cleaned_quality);

  const improvementText = (() => {
    if (!activeMetrics) return "—";
    if (
      activeMetrics.baseline_quality !== undefined &&
      activeMetrics.baseline_quality !== null &&
      activeMetrics.cleaned_quality !== undefined &&
      activeMetrics.cleaned_quality !== null
    ) {
      const b =
        Number(activeMetrics.baseline_quality) <= 1
          ? Number(activeMetrics.baseline_quality) * 100
          : Number(activeMetrics.baseline_quality);
      const c =
        Number(activeMetrics.cleaned_quality) <= 1
          ? Number(activeMetrics.cleaned_quality) * 100
          : Number(activeMetrics.cleaned_quality);
      const delta = (c - b).toFixed(1);
      return `${Number(delta) >= 0 ? "+" : ""}${delta}%`;
    }
    return activeMetrics.improvement || "—";
  })();

  const successRateText = formatScore(activeMetrics?.success_rate);
  const recordAccuracyText = formatScore(
    activeMetrics?.record_accuracy ?? activeMetrics?.accuracy,
  );

  const handleDownload = async (format) => {
    if (!hasDatasets) return;
    const targetParam =
      datasetId && String(datasetId) !== "all"
        ? `?dataset_id=${encodeURIComponent(String(datasetId))}`
        : "?dataset_id=all";
    const url = `/api/cleaner/download/${format}${targetParam}`;
    try {
      const response = await client.get(url, { responseType: "blob" });
      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackName =
        targetParam === "?dataset_id=all"
          ? `clean_all_datasets.${format}`
          : `clean_${datasetId}.${format}`;
      const filename = match ? match[1] : fallbackName;

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(`Failed to download cleaned ${format.toUpperCase()}:`, err);
    }
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div>
        <h3 className="text-lg font-bold text-brand-accent">
          Cleaner Agent Loop
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Automated remediation using iterative validation and contract
          enforcement
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-300">
          Select Target Dataset for Remediation:
        </label>
        <select
          value={hasDatasets ? datasetId || "all" : "all"}
          onChange={(e) => onSelectDataset(e.target.value)}
          disabled={!hasDatasets}
          className="w-full rounded-lg bg-brand-dark border border-brand-accent/25 px-3.5 py-2.5 text-sm font-semibold text-gray-100 focus:outline-none focus:border-brand-accent disabled:opacity-40"
        >
          {hasDatasets ? (
            <>
              <option value="all">
                All Input Datasets ({datasets.length} active)
              </option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.id} ({d.id})
                </option>
              ))}
            </>
          ) : (
            <option value="all">No Datasets Available (—)</option>
          )}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRunCleaner}
            disabled={!hasDatasets || loading}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-accent text-black hover:bg-blue-300 transition cursor-pointer disabled:opacity-40"
          >
            {loading ? "Running…" : "Run Cleaner"}
          </button>

          <button
            type="button"
            onClick={onRunAllAgents}
            disabled={!hasDatasets || loading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-dark text-gray-200 border border-brand-accent/25 hover:border-brand-accent transition cursor-pointer disabled:opacity-40"
          >
            Run All
          </button>

          <span className="text-xs text-gray-400 font-mono ml-1">
            Active Scope:{" "}
            <strong className="text-gray-200">
              {hasDatasets ? datasetId || "all" : "—"}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownload("csv")}
            disabled={!hasDatasets}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-600 transition cursor-pointer disabled:opacity-40"
          >
            &darr; Save Cleaned CSV
          </button>

          <button
            type="button"
            onClick={() => handleDownload("json")}
            disabled={!hasDatasets}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-900 text-indigo-100 border border-indigo-400/30 hover:bg-indigo-800 transition cursor-pointer disabled:opacity-40"
          >
            &darr; Save Cleaned JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Actions</div>
          <div className="text-lg font-bold font-mono text-gray-100 mt-1">
            {actionsCount}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Baseline Quality</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-1">
            {baselineQualityText}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Cleaned Quality</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {cleanedQualityText}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Improvement</div>
          <div className="text-lg font-bold font-mono text-sky-400 mt-1">
            {improvementText}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Success Rate</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {successRateText}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15">
          <div className="text-xs text-gray-400">Record Accuracy</div>
          <div className="text-lg font-bold font-mono text-gray-100 mt-1">
            {recordAccuracyText}
          </div>
        </div>
      </div>
    </div>
  );
}

CleanerAgentCard.propTypes = {
  datasets: PropTypes.array,
  datasetId: PropTypes.string,
  onSelectDataset: PropTypes.func,
  metrics: PropTypes.object,
  loading: PropTypes.bool,
  onRunCleaner: PropTypes.func,
  onRunAllAgents: PropTypes.func,
};
