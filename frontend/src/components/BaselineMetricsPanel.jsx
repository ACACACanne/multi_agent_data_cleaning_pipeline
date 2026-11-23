// frontend/src/components/BaselineMetricsPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { fetchAgentsMetrics } from "../services/api";

export default function BaselineMetricsPanel({
  className = "",
  hasDatasets = false,
  refreshTrigger = 0,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBaselineMetrics = useCallback(async () => {
    if (!hasDatasets) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchAgentsMetrics();
      setData(res || null);
    } catch (err) {
      if (err?.response?.status === 404) {
        setData(null);
        setError(null);
      } else {
        console.error("Failed to load baseline telemetry:", err);
        setError(err.message || "Failed to load baseline telemetry.");
      }
    } finally {
      setLoading(false);
    }
  }, [hasDatasets]);

  useEffect(() => {
    loadBaselineMetrics();
  }, [loadBaselineMetrics, refreshTrigger]);

  const fmtPercent = (val) => {
    if (!hasDatasets || !data || val === null || val === undefined) return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  const safeFloat = (v) => {
    if (v === null || v === undefined) return null;
    const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const baselineAccuracy = safeFloat(
    data?.baseline_accuracy ??
      data?.cleaner_accuracy ??
      data?.cleanerAccuracy ??
      data?.accuracy,
  );

  const baselineRejection = safeFloat(
    data?.validator_rejection_rate ??
      data?.validatorRejectionRate ??
      data?.rejection_rate,
  );

  const agentsList =
    hasDatasets && Array.isArray(data?.agents)
      ? data.agents
      : hasDatasets && Array.isArray(data?.agent_metrics)
        ? data.agent_metrics
        : [];

  return (
    <div
      className={`bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-brand-accent">
          Baseline Telemetry
        </h3>
        <button
          type="button"
          onClick={loadBaselineMetrics}
          disabled={!hasDatasets || loading}
          className="px-2.5 py-1 text-xs rounded bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition disabled:opacity-40 cursor-pointer"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <span className="text-gray-300 font-medium">Baseline accuracy:</span>
          <strong className="text-emerald-400 font-mono text-sm">
            {fmtPercent(baselineAccuracy)}
          </strong>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-brand-dark/50 border border-brand-accent/10">
          <span className="text-gray-300 font-medium">
            Contract rejection rate:
          </span>
          <strong className="text-indigo-300 font-mono text-sm">
            {fmtPercent(baselineRejection)}
          </strong>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {agentsList.length === 0 ? (
          <div className="text-gray-400 italic text-xs p-3 text-center bg-brand-dark/30 rounded-lg border border-brand-accent/5">
            {hasDatasets
              ? "No baseline telemetry captured yet. Run the pipeline to compute metrics."
              : "No datasets available (—)."}
          </div>
        ) : (
          agentsList.map((agent, idx) => {
            const acc = safeFloat(agent.accuracy ?? agent.success_rate);
            const rej = safeFloat(agent.rejection_rate);

            return (
              <div
                key={agent.name || idx}
                className="p-2.5 rounded-lg bg-brand-dark/40 border border-brand-accent/10 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-200">
                    {agent.name || `Agent ${idx + 1}`}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {agent.role || agent.action || "Pipeline Agent"}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-emerald-400 font-bold">
                    {fmtPercent(acc)} Acc
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {fmtPercent(rej)} Rej
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

BaselineMetricsPanel.propTypes = {
  className: PropTypes.string,
  hasDatasets: PropTypes.bool,
  refreshTrigger: PropTypes.number,
};
