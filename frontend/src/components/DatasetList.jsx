// frontend/src/components/DatasetList.jsx
import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  fetchDatasetSample,
  injectSyntheticErrors,
  updateDatasetFlags,
  deleteDataset,
  exportDatasetCsv,
  exportDatasetJson,
} from "../services/api";
import DatasetInlineViewer from "./DatasetInlineViewer";

export default function DatasetList({
  datasets = [],
  onRefresh = () => {},
  onOpenFullViewer = null,
  onSelectDataset = () => {},
}) {
  const [samples, setSamples] = useState({});
  const [loadingSamples, setLoadingSamples] = useState({});
  const [error, setError] = useState(null);
  const [openViewer, setOpenViewer] = useState({});
  const [injectPercent, setInjectPercent] = useState({});
  const [injectingId, setInjectingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadSamplesForDatasets(datasets);
    return () => {
      mountedRef.current = false;
    };
  }, [datasets]);

  const loadSamplesForDatasets = async (list) => {
    setError(null);
    const toLoad = (list || []).filter((d) => d?.id && !samples[d.id]);
    await Promise.all(toLoad.map((d) => loadSample(d.id)));
  };

  const loadSample = async (datasetId, limit = 3) => {
    if (!datasetId) return;
    setLoadingSamples((s) => ({ ...s, [datasetId]: true }));
    try {
      const response = await fetchDatasetSample(datasetId, limit);
      if (!mountedRef.current) return;

      const rows = Array.isArray(response)
        ? response
        : response?.sample_rows || response?.rows || response?.data || [];

      setSamples((s) => ({ ...s, [datasetId]: rows }));
    } catch (err) {
      console.error("Failed to load sample for", datasetId, err);
      if (!mountedRef.current) return;
      setError(err.message || String(err));
      setSamples((s) => ({ ...s, [datasetId]: [] }));
    } finally {
      if (mountedRef.current)
        setLoadingSamples((s) => ({ ...s, [datasetId]: false }));
    }
  };

  const refreshAllSamples = async () => {
    setError(null);
    const ids = (datasets || []).map((d) => d.id).filter(Boolean);
    await Promise.all(ids.map((id) => loadSample(id)));
  };

  const toggleViewer = (datasetId) => {
    setOpenViewer((s) => ({ ...s, [datasetId]: !s[datasetId] }));
  };

  const injectErrors = async (datasetId) => {
    const pct = injectPercent[datasetId] || 5;
    try {
      setError(null);
      setInjectingId(datasetId);

      const res = await injectSyntheticErrors(datasetId, pct);
      const newId = res?.new_dataset_id || res?.dataset?.id;

      // Refresh the dataset list in parent component / dashboard
      await onRefresh?.();

      // Immediately fetch samples for the new synthetic dataset & select it
      if (newId) {
        await loadSample(newId);
        onSelectDataset?.(newId);
      }
      await loadSample(datasetId);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setInjectingId(null);
    }
  };

  const handleDeleteDataset = async (datasetId, datasetName) => {
    const name = datasetName || datasetId;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?\nThis will permanently remove it from storage.`,
    );
    if (!confirmed) return;

    try {
      setError(null);
      setDeletingId(datasetId);

      await deleteDataset(datasetId);

      // Clean local samples cache
      setSamples((prev) => {
        const next = { ...prev };
        delete next[datasetId];
        return next;
      });

      await onRefresh?.();
    } catch (err) {
      setError(err.message || `Failed to delete ${datasetId}`);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExcluded = async (datasetId) => {
    const current = (datasets || []).find((d) => d.id === datasetId);
    if (!current) return;
    try {
      await updateDatasetFlags(datasetId, { excluded: !current.excluded });
      await onRefresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const toggleHidden = async (datasetId) => {
    const current = (datasets || []).find((d) => d.id === datasetId);
    if (!current) return;
    try {
      await updateDatasetFlags(datasetId, { hidden: !current.hidden });
      await onRefresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand-accent">Datasets</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onRefresh();
              refreshAllSamples();
            }}
            className="px-3 py-1 rounded-md bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition cursor-pointer"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={refreshAllSamples}
            className="px-3 py-1 rounded-md bg-brand-accent text-black font-semibold hover:bg-blue-300 transition cursor-pointer"
            title="Refresh dataset samples"
          >
            Refresh samples
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {datasets.length === 0 ? (
          <div className="bg-brand-light p-6 rounded-xl border border-brand-accent/10 text-gray-400 italic text-center">
            No datasets available in storage. Upload a dataset or inject errors
            to populate.
          </div>
        ) : (
          datasets.map((d) => (
            <div
              key={d.id}
              onClick={() => onSelectDataset?.(d.id)}
              className={`p-4 rounded-md border transition cursor-pointer ${
                d.synthetic_injected || d.name?.includes("[Synthetic")
                  ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-400/50"
                  : "bg-brand-dark/10 border-brand-accent/10 hover:border-brand-accent/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-100 text-base">
                      {d.name ?? d.id}
                    </span>
                    {(d.synthetic_injected ||
                      d.name?.includes("[Synthetic")) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Injected Noise
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ID: <span className="font-mono text-gray-300">{d.id}</span>{" "}
                    • {d.rows_count ?? d.rows ?? "299"} rows
                    {d.file_size ? ` • ${d.file_size}` : ""}
                    {d.anomalies_count
                      ? ` • ${d.anomalies_count} anomalies`
                      : ""}
                    {d.excluded ? " • Excluded" : ""}
                    {d.hidden ? " • Hidden" : ""}
                  </div>
                </div>

                {/* Actions Button Group with Export Actions */}
                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => loadSample(d.id)}
                    className="px-2.5 py-1 text-xs rounded-md bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition cursor-pointer"
                  >
                    Refresh sample
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleViewer(d.id)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                      openViewer[d.id]
                        ? "bg-brand-accent text-black"
                        : "bg-brand-dark text-gray-200 border border-brand-accent/20 hover:bg-brand-accent/10"
                    }`}
                  >
                    {openViewer[d.id] ? "Hide table" : "Show table"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenFullViewer?.(d.id)}
                    className="px-3 py-1 text-xs rounded-md bg-brand-accent text-black font-semibold hover:bg-blue-300 transition cursor-pointer"
                    title={`Open full viewer for ${d.id}`}
                  >
                    Open full viewer
                  </button>

                  {/* Export CSV Button */}
                  <a
                    href={exportDatasetCsv(d.id)}
                    download={`${d.id}_cleaned.csv`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-semibold hover:bg-emerald-900/80 hover:text-white transition cursor-pointer shadow-sm"
                    title={`Export cleaned CSV for ${d.name || d.id}`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    CSV
                  </a>

                  {/* Export JSON Button */}
                  <a
                    href={exportDatasetJson(d.id)}
                    download={`${d.id}_cleaned.json`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 font-semibold hover:bg-indigo-900/80 hover:text-white transition cursor-pointer shadow-sm"
                    title={`Export cleaned JSON for ${d.name || d.id}`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    JSON
                  </a>

                  {/* Permanent Delete Button */}
                  <button
                    type="button"
                    disabled={deletingId === d.id}
                    onClick={() => handleDeleteDataset(d.id, d.name)}
                    className="px-2.5 py-1 text-xs rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300 font-medium hover:bg-rose-500/20 hover:border-rose-500/50 transition disabled:opacity-50 cursor-pointer"
                    title={`Delete dataset ${d.name || d.id}`}
                  >
                    {deletingId === d.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>

              {/* Two-column preview area */}
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left: JSON sample */}
                <div className="bg-brand-light p-3 rounded border border-brand-accent/10 min-h-[120px]">
                  <div className="text-xs text-gray-400 mb-2 font-semibold">
                    Sample (JSON)
                  </div>

                  {loadingSamples[d.id] ? (
                    <div className="text-gray-400 text-xs">Loading sample…</div>
                  ) : samples[d.id] && samples[d.id].length > 0 ? (
                    <div className="space-y-2 text-xs text-gray-200">
                      {samples[d.id].map((row, rIdx) => (
                        <div
                          key={
                            row.id || row.encounter_id || `sample_row_${rIdx}`
                          }
                          className={`p-2 rounded-md font-mono ${
                            row._data_status === "SYNTHETIC_ANOMALY" ||
                            row.data_status === "SYNTHETIC_ANOMALY"
                              ? "bg-amber-950/40 border border-amber-500/40 text-amber-200"
                              : "bg-brand-dark/40 border border-brand-accent/5"
                          }`}
                        >
                          <pre className="whitespace-pre-wrap text-xs m-0">
                            {JSON.stringify(row, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 italic text-xs">
                      No sample available.
                    </div>
                  )}
                </div>

                {/* Right: Inline table */}
                <div className="bg-brand-light p-3 rounded border border-brand-accent/10 min-h-[120px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400 font-semibold">
                      Inline Table
                    </div>
                    <div className="text-xs text-gray-400 italic">
                      {openViewer[d.id] ? "Visible" : "Hidden"}
                    </div>
                  </div>

                  {openViewer[d.id] ? (
                    <DatasetInlineViewer datasetId={d.id} initialPageSize={5} />
                  ) : (
                    <div className="text-gray-400 italic text-xs py-8 text-center">
                      Click “Show table” to view a paginated table for this
                      dataset.
                    </div>
                  )}
                </div>
              </div>

              {/* Synthetic Error Injection */}
              <div
                className="mt-3 bg-brand-dark/20 p-3 rounded border border-brand-accent/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-gray-400 mb-2 font-semibold">
                  Inject Synthetic Errors (1–50%)
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={injectPercent[d.id] ?? 5}
                    onChange={(e) =>
                      setInjectPercent((s) => ({
                        ...s,
                        [d.id]: Math.min(
                          50,
                          Math.max(1, Number(e.target.value) || 5),
                        ),
                      }))
                    }
                    className="w-20 bg-brand-dark text-gray-200 px-2 py-1 rounded text-xs border border-brand-accent/20 focus:outline-none focus:border-brand-accent"
                  />
                  <button
                    type="button"
                    disabled={injectingId === d.id}
                    onClick={() => injectErrors(d.id)}
                    className="px-3 py-1 rounded bg-brand-accent text-black font-semibold text-xs hover:bg-blue-300 transition disabled:opacity-50 cursor-pointer"
                  >
                    {injectingId === d.id
                      ? "Injecting & Generating..."
                      : "Inject & save dataset"}
                  </button>
                </div>
              </div>

              {/* Dataset flags */}
              <div
                className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-300"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!d.excluded}
                    onChange={() => toggleExcluded(d.id)}
                    className="rounded border-gray-600 text-brand-accent focus:ring-0"
                  />
                  Exclude from metrics / analysis / baseline
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!d.hidden}
                    onChange={() => toggleHidden(d.id)}
                    className="rounded border-gray-600 text-brand-accent focus:ring-0"
                  />
                  Hide dataset from dashboard
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

DatasetList.propTypes = {
  datasets: PropTypes.array,
  onRefresh: PropTypes.func,
  onOpenFullViewer: PropTypes.func,
  onSelectDataset: PropTypes.func,
};
