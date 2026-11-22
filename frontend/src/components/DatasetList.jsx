// frontend/src/components/DatasetList.jsx
import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  fetchDatasetSample,
  updateDatasetFlags,
  deleteDataset,
} from "../services/api";
import DatasetInlineViewer from "./DatasetInlineViewer";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://multi-agent-data-cleaning-pipeline.onrender.com"
    : "http://127.0.0.1:8000");

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
  const [deletingId, setDeletingId] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadSamplesForDatasets(datasets);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeleteDataset = async (datasetId, datasetName) => {
    const name = datasetName || datasetId;
    if (
      !window.confirm(
        `Are you sure you want to delete "${name}"?\nThis will permanently remove it from storage.`,
      )
    ) {
      return;
    }

    try {
      setError(null);
      setDeletingId(datasetId);
      await deleteDataset(datasetId);
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
    const nextExcluded = !(current.excluded || current.flags?.excluded);
    try {
      await updateDatasetFlags(datasetId, { excluded: nextExcluded });
      await onRefresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const toggleHidden = async (datasetId) => {
    const current = (datasets || []).find((d) => d.id === datasetId);
    if (!current) return;
    const nextHidden = !(current.hidden || current.flags?.hidden);
    try {
      await updateDatasetFlags(datasetId, { hidden: nextHidden });
      await onRefresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const triggerExport = (e, datasetId, format) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `${API_BASE}/api/datasets/${encodeURIComponent(datasetId)}/export/${format}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-brand-accent">Datasets</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onRefresh();
              refreshAllSamples();
            }}
            style={{
              backgroundColor: "#0b1220",
              color: "#e5e7eb",
              border: "1px solid rgba(96, 165, 250, 0.3)",
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:border-brand-accent transition cursor-pointer"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={refreshAllSamples}
            style={{
              backgroundColor: "#60a5fa",
              color: "#0b1220",
              border: "none",
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-300 transition cursor-pointer"
          >
            Refresh samples
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {datasets.length === 0 ? (
          <div className="bg-brand-light p-6 rounded-xl border border-brand-accent/10 text-gray-400 italic text-center text-xs">
            No datasets available. Upload a CSV or JSON file above to begin.
          </div>
        ) : (
          datasets.map((d) => {
            const isExcluded = Boolean(d.excluded || d.flags?.excluded);
            const isHidden = Boolean(d.hidden || d.flags?.hidden);
            const rowCount = d.rows_count ?? d.rows ?? 0;
            const anomaliesCount = d.anomalies_count ?? d.anomalies ?? 0;

            return (
              <div
                key={d.id}
                onClick={() => onSelectDataset?.(d.id)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  isExcluded
                    ? "bg-gray-900/40 border-gray-700/50 opacity-75"
                    : "bg-brand-dark/40 border-brand-accent/20 hover:border-brand-accent/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-100 text-sm">
                        {d.name ?? d.id}
                      </span>

                      {isExcluded && (
                        <span
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.15)",
                            color: "#f87171",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                        >
                          EXCLUDED FROM CLEANING
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ID:{" "}
                      <span className="font-mono text-brand-accent font-semibold">
                        {d.id}
                      </span>{" "}
                      &bull; {Number(rowCount).toLocaleString()} rows &bull;{" "}
                      {anomaliesCount} anomalies
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => loadSample(d.id)}
                      style={{
                        backgroundColor: "#0b1220",
                        color: "#e5e7eb",
                        border: "1px solid rgba(96, 165, 250, 0.3)",
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:border-brand-accent transition cursor-pointer"
                    >
                      Refresh sample
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleViewer(d.id)}
                      style={{
                        backgroundColor: openViewer[d.id]
                          ? "#60a5fa"
                          : "#0b1220",
                        color: openViewer[d.id] ? "#0b1220" : "#e5e7eb",
                        border: "1px solid rgba(96, 165, 250, 0.3)",
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      {openViewer[d.id] ? "Hide table" : "Show table"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenFullViewer?.(d.id)}
                      style={{
                        backgroundColor: "#60a5fa",
                        color: "#0b1220",
                        border: "none",
                      }}
                      className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-blue-300 transition cursor-pointer"
                    >
                      Open full viewer
                    </button>

                    <button
                      type="button"
                      onClick={(e) => triggerExport(e, d.id, "csv")}
                      style={{
                        backgroundColor: "rgba(6, 78, 59, 0.8)",
                        color: "#34d399",
                        border: "1px solid rgba(52, 211, 153, 0.4)",
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg hover:bg-emerald-800 transition cursor-pointer shadow-sm"
                    >
                      ↓CSV
                    </button>

                    <button
                      type="button"
                      onClick={(e) => triggerExport(e, d.id, "json")}
                      style={{
                        backgroundColor: "rgba(30, 27, 75, 0.8)",
                        color: "#a5b4fc",
                        border: "1px solid rgba(165, 180, 252, 0.4)",
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg hover:bg-indigo-900 transition cursor-pointer shadow-sm"
                    >
                      ↓JSON
                    </button>

                    <button
                      type="button"
                      disabled={deletingId === d.id}
                      onClick={() => handleDeleteDataset(d.id, d.name)}
                      style={{
                        backgroundColor: "rgba(136, 19, 55, 0.3)",
                        color: "#fda4af",
                        border: "1px solid rgba(244, 63, 94, 0.4)",
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-rose-950 transition cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === d.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-brand-dark/60 p-3 rounded-lg border border-brand-accent/15 min-h-[110px]">
                    <div className="text-xs text-gray-400 mb-2 font-semibold">
                      Sample (JSON)
                    </div>
                    {loadingSamples[d.id] ? (
                      <div className="text-gray-400 text-xs">
                        Loading sample…
                      </div>
                    ) : samples[d.id] && samples[d.id].length > 0 ? (
                      <div className="space-y-1.5 text-xs">
                        {samples[d.id].map((row, rIdx) => (
                          <div
                            key={row.id || rIdx}
                            className="p-2 rounded font-mono border bg-brand-dark border-brand-accent/10 text-gray-200"
                          >
                            <pre className="whitespace-pre-wrap text-[11px] m-0">
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

                  <div className="bg-brand-dark/60 p-3 rounded-lg border border-brand-accent/15 min-h-[110px]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-400 font-semibold">
                        Inline Table
                      </div>
                      <div className="text-[11px] text-gray-400 italic">
                        {openViewer[d.id] ? "Visible" : "Hidden"}
                      </div>
                    </div>
                    {openViewer[d.id] ? (
                      <DatasetInlineViewer
                        datasetId={d.id}
                        initialPageSize={5}
                      />
                    ) : (
                      <div className="text-gray-400 italic text-xs py-6 text-center">
                        Click &ldquo;Show table&rdquo; to view records inline.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-300 pt-2.5 border-t border-brand-accent/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => toggleExcluded(d.id)}
                      style={{ accentColor: "#f59e0b" }}
                      className="rounded cursor-pointer w-3.5 h-3.5"
                    />
                    <span
                      className={
                        isExcluded
                          ? "text-amber-400 font-bold"
                          : "text-gray-300 hover:text-white"
                      }
                    >
                      Exclude from metrics / automated data cleaning
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isHidden}
                      onChange={() => toggleHidden(d.id)}
                      style={{ accentColor: "#f43f5e" }}
                      className="rounded cursor-pointer w-3.5 h-3.5"
                    />
                    <span
                      className={
                        isHidden
                          ? "text-rose-400 font-bold"
                          : "text-gray-300 hover:text-white"
                      }
                    >
                      Hide dataset from dashboard
                    </span>
                  </label>
                </div>
              </div>
            );
          })
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
