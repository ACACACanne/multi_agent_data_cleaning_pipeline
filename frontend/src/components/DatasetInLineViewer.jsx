import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import { fetchDatasetRows } from "../services/api";

/**
 * DatasetInlineViewer
 *
 * Compact embeddable table for dataset cards.
 * - datasetId: id of dataset to show
 * - initialPageSize: default rows per page
 */
export default function DatasetInlineViewer({
  datasetId,
  initialPageSize = 5,
}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setPage(1);
    setPageSize(initialPageSize);
    loadPage(1, initialPageSize);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  useEffect(() => {
    loadPage(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const loadPage = async (p = 1, ps = initialPageSize) => {
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
    for (const r of rows) {
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => keys.add(k));
      }
    }
    const preferred = ["id", "created_at"];
    const rest = Array.from(keys).filter((k) => !preferred.includes(k));
    return [...preferred.filter((k) => keys.has(k)), ...rest].slice(0, 6);
  };

  const columns = inferColumns();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div
          className="text-xs text-gray-400"
          aria-live="polite"
          aria-atomic="true"
        >
          Rows: <strong className="text-gray-200">{total}</strong>
          {loading && <span className="sr-only"> Loading</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              const v = Number.isFinite(raw) ? raw : initialPageSize;
              setPageSize(v);
              setPage(1);
            }}
            className="bg-brand-dark text-gray-200 px-2 py-1 rounded text-xs"
            title="Page size"
            aria-label="Page size"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>

          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`px-2 py-1 rounded text-xs ${page <= 1 ? "bg-gray-600 cursor-not-allowed" : "bg-brand-dark text-gray-200 border border-brand-accent/20"}`}
            title="Previous page"
            aria-label="Previous page"
          >
            ◀
          </button>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-2 py-1 rounded text-xs ${page >= totalPages ? "bg-gray-600 cursor-not-allowed" : "bg-brand-accent text-black font-semibold"}`}
            title="Next page"
            aria-label="Next page"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        {loading ? (
          <div className="text-gray-400 text-xs">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-400 italic text-xs">
            No rows to display.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                {columns.map((col) => (
                  <th key={col} className="px-2 py-1">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r?.id ?? `row-${idx}`}
                  className="border-t border-brand-accent/5"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1 align-top text-gray-200">
                      {renderCell(r ? r[col] : undefined)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
    </div>
  );
}

DatasetInlineViewer.propTypes = {
  datasetId: PropTypes.string.isRequired,
  initialPageSize: PropTypes.number,
};

function renderCell(value) {
  if (value === null || value === undefined)
    return <span className="text-gray-400">—</span>;
  if (typeof value === "object")
    return (
      <pre className="m-0 text-xs max-h-28 overflow-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  return String(value);
}
