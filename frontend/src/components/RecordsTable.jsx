import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { fetchDatasetRows } from "../services/api";

export default function RecordsTable({
  datasetId = "ds_001",
  initialPageSize = 25,
  className = "",
}) {
  const [records, setRecords] = useState([]);
  const [columns, setColumns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRecords = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);

    try {
      const targetId = datasetId === "all" ? "ds_001" : datasetId;
      const res = await fetchDatasetRows(targetId, {
        page,
        page_size: pageSize,
        limit: pageSize,
        status_filter: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      const items = res?.records || res?.rows || res?.items || res?.data || [];
      const totalCount =
        res?.total ?? res?.total_records ?? res?.count ?? items.length;

      setRecords(items);
      setTotal(totalCount);

      if (
        res?.columns &&
        Array.isArray(res.columns) &&
        res.columns.length > 0
      ) {
        setColumns(res.columns);
      } else if (items.length > 0) {
        setColumns(
          Object.keys(items[0]).map((k) => ({
            key: k,
            label: k.lstrip?.("_") || k.replace(/_/g, " ").toUpperCase(),
            type: typeof items[0][k] === "number" ? "number" : "string",
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load records:", err);
      setError(err.message || "Failed to load records.");
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [datasetId, page, pageSize, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [datasetId, statusFilter, pageSize]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Table Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-brand-accent">
            {statusFilter === "ALL" ? "All Records" : `${statusFilter} Records`}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            (Total: {total})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-brand-dark text-gray-200 text-xs px-2.5 py-1 rounded border border-brand-accent/20 focus:outline-none focus:border-brand-accent"
          >
            <option value="ALL">All Statuses</option>
            <option value="VALID">Valid Only</option>
            <option value="SYNTHETIC_ANOMALY">Synthetic Anomalies</option>
            <option value="REMEDIATED">Remediated</option>
          </select>

          {/* Page Size Selector */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-brand-dark text-gray-200 text-xs px-2 py-1 rounded border border-brand-accent/20 focus:outline-none focus:border-brand-accent font-mono"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 text-xs rounded bg-brand-dark text-gray-200 border border-brand-accent/20 disabled:opacity-40 hover:bg-brand-accent/10 transition"
            >
              Prev
            </button>
            <span className="text-xs text-gray-400 font-mono px-1">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 text-xs rounded bg-brand-accent text-black font-semibold disabled:opacity-40 hover:bg-blue-300 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Table Data Area */}
      <div className="relative overflow-x-auto rounded-lg border border-brand-accent/10 bg-brand-dark/40 max-h-96">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
            Loading records for{" "}
            <span className="font-mono text-brand-accent">{datasetId}</span>…
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 italic">
            No records found for dataset:{" "}
            <span className="font-mono text-gray-300">{datasetId}</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="sticky top-0 bg-brand-dark border-b border-brand-accent/20 text-gray-400 uppercase text-[10px] tracking-wider z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 font-semibold whitespace-nowrap"
                  >
                    {col.label || col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-accent/5 font-mono">
              {records.map((row, rIdx) => {
                const isAnomaly =
                  row._data_status === "SYNTHETIC_ANOMALY" ||
                  row.data_status === "SYNTHETIC_ANOMALY";
                const isRemediated =
                  row._data_status === "REMEDIATED" ||
                  row.data_status === "REMEDIATED";

                return (
                  <tr
                    key={row.id || row.encounter_id || `rec_${rIdx}`}
                    className={`transition hover:bg-brand-accent/5 ${
                      isAnomaly
                        ? "bg-amber-950/20 text-amber-200"
                        : isRemediated
                          ? "bg-emerald-950/20 text-emerald-200"
                          : ""
                    }`}
                  >
                    {columns.map((col) => {
                      const val = row[col.key];

                      if (
                        col.key === "_data_status" ||
                        col.key === "data_status"
                      ) {
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-2 whitespace-nowrap"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                val === "SYNTHETIC_ANOMALY"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : val === "REMEDIATED"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-gray-800 text-gray-300 border-gray-600"
                              }`}
                            >
                              {val || "VALID"}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.key}
                          className="px-3 py-2 whitespace-nowrap"
                        >
                          {val === null || val === undefined ? (
                            <span className="text-rose-400 italic">null</span>
                          ) : typeof val === "number" ? (
                            Number.isInteger(val) ? (
                              val
                            ) : (
                              val.toFixed(2)
                            )
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

RecordsTable.propTypes = {
  datasetId: PropTypes.string,
  initialPageSize: PropTypes.number,
  className: PropTypes.string,
};
