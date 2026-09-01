// frontend/src/components/DatasetList.jsx
import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  fetchDatasetSample,
  injectSyntheticErrors,
  updateDatasetFlags,
  deleteDataset,
} from "../services/api";
import DatasetInlineViewer from "./DatasetInlineViewer";

function convertRecordsToCsv(records) {
  if (!Array.isArray(records) || records.length === 0) return "";
  const headers = Array.from(
    new Set(records.flatMap((rec) => Object.keys(rec || {}))),
  );
  const csvRows = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
  ];

  for (const row of records) {
    if (!row) continue;
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === "object")
        return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\r\n");
}

function triggerFileDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
    const rawVal = injectPercent[datasetId];
    const pct = Number.isFinite(Number(rawVal))
      ? Math.min(50, Math.max(1, Number(rawVal)))
      : 15;

    try {
      setError(null);
      setInjectingId(datasetId);
      const res = await injectSyntheticErrors(datasetId, pct);
      const newId =
        res?.new_dataset_id || res?.dataset_id || res?.dataset?.id || res?.id;
      if (onRefresh) await onRefresh();
      if (newId) {
        await loadSample(newId);
        if (onSelectDataset) onSelectDataset(newId);
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
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

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

  const triggerExport = (e, datasetId, format) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/api/datasets/${datasetId}/export/${format}`, "_blank");
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
            No datasets available in storage. Upload a dataset or inject errors
            to populate.
          </div>
        ) : (
          datasets.map((d) => {
            const isSynthetic =
              Boolean(d.synthetic_injected) ||
              String(d.id).startsWith("ds_syn_") ||
              d.name?.includes("[Synthetic");

            const rowCount = d.rows_count ?? d.rows ?? 299;
            const anomaliesCount = d.anomalies_count ?? d.anomalies ?? 0;
            const injectionBadgePct =
              d.injected_rate ??
              (d.error_rate && d.error_rate <= 1
                ? Math.round(d.error_rate * 100)
                : d.error_rate);

            return (
              <div
                key={d.id}
                onClick={() => onSelectDataset?.(d.id)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  isSynthetic
                    ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-400/50"
                    : "bg-brand-dark/40 border-brand-accent/20 hover:border-brand-accent/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-100 text-sm">
                        {d.name ?? d.id}
                      </span>
                      {isSynthetic && (
                        <span
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            color: "#fbbf24",
                            border: "1px solid rgba(245, 158, 11, 0.4)",
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                        >
                          SYNTHETIC INJECTED{" "}
                          {injectionBadgePct ? `(${injectionBadgePct}%)` : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ID:{" "}
                      <span className="font-mono text-brand-accent font-semibold">
                        {d.id}
                      </span>{" "}
                      &bull; {rowCount.toLocaleString()} rows
                      {anomaliesCount > 0
                        ? ` &bull; ${anomaliesCount} anomalies`
                        : ""}
                      {d.excluded ? " &bull; Excluded" : ""}
                    </div>
                  </div>

                  {/* Actions Button Group with High-Contrast Styles */}
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

                    {/* CSV Button */}
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

                    {/* JSON Button */}
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

                    {/* Delete Button */}
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

                {/* Two-Column Sample Inspector */}
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
                            className="p-2 rounded font-mono bg-brand-dark border border-brand-accent/10 text-gray-200"
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

                {/* Injection Controls */}
                <div
                  className="mt-3 bg-brand-dark/40 p-3 rounded-lg border border-brand-accent/15 flex items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-gray-300 font-semibold">
                    Inject Noise:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={injectPercent[d.id] ?? 15}
                    onChange={(e) =>
                      setInjectPercent((s) => ({
                        ...s,
                        [d.id]: Math.min(
                          50,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      }))
                    }
                    style={{
                      backgroundColor: "#0b1220",
                      color: "#ffffff",
                      border: "1px solid rgba(96, 165, 250, 0.3)",
                    }}
                    className="w-16 px-2 py-1 rounded text-xs text-center font-bold"
                  />
                  <span className="text-xs text-gray-400">%</span>
                  <button
                    type="button"
                    disabled={injectingId === d.id}
                    onClick={() => injectErrors(d.id)}
                    style={{
                      backgroundColor: "#60a5fa",
                      color: "#0b1220",
                      border: "none",
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-300 transition disabled:opacity-50 cursor-pointer"
                  >
                    {injectingId === d.id
                      ? "Injecting..."
                      : "Inject & Save Dataset"}
                  </button>
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
