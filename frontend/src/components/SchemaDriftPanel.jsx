// frontend/src/components/SchemaDriftPanel.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

/**
 * SchemaDriftPanel
 *
 * - Fetches schema drift from /api/schema/drift.
 * - Accepts either { drift: {...} } or direct object.
 * - Supports optional polling.
 * - Fully Vite‑compatible (no process.env).
 */

export default function SchemaDriftPanel({ pollIntervalMs = null }) {
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDrift = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await client.get("/api/schema/drift");

      // Accept either { drift: {...} } or direct object
      const payload = res?.data?.drift ?? res?.data ?? null;

      // Ensure drift is an object
      const safe =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload
          : null;

      setDrift(safe);
    } catch (err) {
      // Use centralized extractor
      const { text } = extractErrorMessage(
        err,
        "Failed to fetch schema drift.",
      );
      console.error("Failed to fetch schema drift:", text);
      setError(text);
      setDrift(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) fetchDrift();

    let timer = null;

    if (
      pollIntervalMs &&
      typeof pollIntervalMs === "number" &&
      pollIntervalMs > 0
    ) {
      timer = setInterval(() => {
        if (mounted) fetchDrift();
      }, pollIntervalMs);
    }

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs]);

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-brand-accent">Schema Drift</h2>

        <button
          onClick={fetchDrift}
          disabled={loading}
          className={`px-3 py-1 rounded-md transition ${
            loading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-brand-dark hover:border-brand-accent"
          }`}
          title="Refresh drift"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      {drift ? (
        <div className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10">
          {/* Summary */}
          {drift.summary && (
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-brand-accent mb-1">
                Summary
              </h3>
              <p className="text-gray-300 text-sm">{drift.summary}</p>
            </div>
          )}

          {/* Metrics */}
          {drift.metrics && typeof drift.metrics === "object" && (
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-brand-accent mb-1">
                Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-200">
                {Object.entries(drift.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-300">{k}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Field Drift Details */}
          {drift.fields && typeof drift.fields === "object" && (
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-brand-accent mb-2">
                Field Drift Details
              </h3>
              <div className="space-y-2 text-sm">
                {Object.entries(drift.fields).map(([field, info]) => (
                  <div
                    key={field}
                    className="p-2 rounded-md bg-brand-light/10 border border-brand-accent/10"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-gray-200">{field}</strong>
                      <span className="text-gray-400 text-xs">
                        {info?.status ?? "unknown"}
                      </span>
                    </div>

                    <pre className="text-gray-300 text-xs whitespace-pre-wrap">
                      {JSON.stringify(info, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback raw view */}
          {!drift.summary && !drift.metrics && !drift.fields && (
            <pre className="text-gray-300 text-sm whitespace-pre-wrap">
              {JSON.stringify(drift, null, 2)}
            </pre>
          )}
        </div>
      ) : loading ? (
        <p className="text-gray-400 text-sm italic">
          Loading drift information…
        </p>
      ) : (
        <p className="text-gray-400 text-sm italic">
          No drift information available yet.
        </p>
      )}
    </div>
  );
}

SchemaDriftPanel.propTypes = {
  pollIntervalMs: PropTypes.number,
};
