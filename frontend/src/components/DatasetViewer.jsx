// frontend/src/components/DatasetViewer.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { fetchDatasetRows, fetchDatasets } from "../services/api";

/**
 * DatasetViewer
 *
 * Can be used:
 * - via route (/dataset/:id)
 * - via prop datasetId (modal)
 */

export default function DatasetViewer({ datasetId: datasetIdProp }) {
  const params = useParams();
  const datasetId = datasetIdProp || decodeURIComponent(params.id || "");

  const [datasetMeta, setDatasetMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadMeta();
    loadPage(1, pageSize);
    return () => {
      mountedRef.current = false;
    };
  }, [datasetId]);

  useEffect(() => {
    loadPage(page, pageSize);
  }, [page, pageSize]);

  const loadMeta = async () => {
    try {
      const all = await fetchDatasets();
      const found = all.find((d) => d.id === datasetId);
      setDatasetMeta(found || null);
    } catch {
      setDatasetMeta(null);
    }
  };

  const loadPage = async (p, ps) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDatasetRows(datasetId, p, ps);
      if (!mountedRef.current) return;
      setRows(res.items || []);
      setTotal(
        typeof res.total === "number" ? res.total : (res.items || []).length,
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message || String(err));
      setRows([]);
      setTotal(0);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const inferColumns = () => {
    const keys = new Set();
    rows.forEach((r) => {
      if (r && typeof r === "object")
        Object.keys(r).forEach((k) => keys.add(k));
    });
    const preferred = ["id", "created_at"];
    const rest = Array.from(keys).filter((k) => !preferred.includes(k));
    return [...preferred.filter((k) => keys.has(k)), ...rest];
  };

  const columns = inferColumns();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-accent mb-3">
        Dataset: {datasetMeta?.name || datasetId}
      </h2>

      {datasetMeta && (
        <div className="text-xs text-gray-400 mb-2">
          ID: {datasetMeta.id} • {datasetMeta.rows ?? "?"} rows •{" "}
          {datasetMeta.source ? `Source: ${datasetMeta.source}` : null}
          {datasetMeta.excluded ? " • Excluded from analysis" : ""}
          {datasetMeta.hidden ? " • Hidden" : ""}
        </div>
      )}

      {error && <div className="text-red-400 mb-2">{error}</div>}

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-300">
          Page {page} / {totalPages} • {total} rows
        </div>

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(1);
          }}
          className="bg-brand-dark text-gray-200 px-2 py-1 rounded"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="overflow-auto">
        {loading ? (
          <div className="text-gray-400 p-4">Loading rows…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-400 p-4">No rows to display.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-brand-accent/10">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-brand-accent/5">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2 text-xs text-gray-200 whitespace-pre-wrap align-top"
                    >
                      {renderCell(r[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1 rounded bg-brand-dark text-gray-200 border border-brand-accent/20 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Prev
        </button>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded bg-brand-accent text-black font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function renderCell(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
