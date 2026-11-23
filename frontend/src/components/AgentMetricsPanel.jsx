// frontend/src/components/AgentMetricsPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

const AGENT_METRICS_ENDPOINTS = [
  "/api/agents/metrics",
  "/api/metrics/agents",
  "/api/cleaner/metrics",
];

export default function AgentMetricsPanel({
  hasDatasets = false,
  datasetId = "all",
  refreshTrigger = 0,
  fallbackMetrics = null,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAgentMetrics = useCallback(async () => {
    if (!hasDatasets) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params =
      datasetId && String(datasetId) !== "all"
        ? { dataset_id: datasetId }
        : undefined;

    let resolvedData = null;
    let lastError = null;

    for (const endpoint of AGENT_METRICS_ENDPOINTS) {
      try {
        const res = await client.get(endpoint, { params });
        if (res && res.data && typeof res.data === "object") {
          resolvedData =
            res.data.agent_metrics || res.data.agents_metrics || res.data;
          lastError = null;
          break;
        }
      } catch (err) {
        const status = err?.response?.status;
        lastError = err;
        if (status && status !== 404) {
          break;
        }
      }
    }

    if (resolvedData) {
      setData(resolvedData);
      setError(null);
    } else if (fallbackMetrics && typeof fallbackMetrics === "object") {
      setData(fallbackMetrics);
      setError(null);
    } else if (lastError && lastError?.response?.status !== 404) {
      const { text } = extractErrorMessage(
        lastError,
        "Failed to load agent metrics.",
      );
      setError(text);
      setData(null);
    } else {
      // Suppress 404 banner when the dedicated agent metrics endpoint isn't exposed
      setData(null);
      setError(null);
    }

    setLoading(false);
  }, [hasDatasets, datasetId, fallbackMetrics]);

  useEffect(() => {
    loadAgentMetrics();
  }, [loadAgentMetrics, refreshTrigger]);

  const formatPct = (val) => {
    if (
      !hasDatasets ||
      !data ||
      val === null ||
      val === undefined ||
      val === "" ||
      Number.isNaN(Number(val))
    ) {
      return "—";
    }
    const num = Number(val);
    const pct = num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  };

  const cleanerAcc = formatPct(
    data?.cleaner_accuracy ??
      data?.accuracy ??
      data?.record_accuracy ??
      data?.success_rate,
  );
  const validatorRej = formatPct(
    data?.validator_rejection_rate ?? data?.rejection_rate,
  );

  const agents = [
    {
      key: "auditor",
      name: "Auditor Agent",
      role: "Schema & Anomaly Detection",
      acc: formatPct(
        data?.agents?.auditor?.accuracy ??
          data?.auditor_accuracy ??
          data?.cleaner_accuracy ??
          data?.success_rate,
      ),
      rej: formatPct(
        data?.agents?.auditor?.rejection_rate ??
          data?.auditor_rejection_rate ??
          data?.validator_rejection_rate ??
          data?.rejection_rate,
      ),
    },
    {
      key: "remediator",
      name: "Remediator Agent",
      role: "Imputation & Format Repair",
      acc: formatPct(
        data?.agents?.remediator?.accuracy ??
          data?.remediator_accuracy ??
          data?.cleaner_accuracy ??
          data?.success_rate,
      ),
      rej: formatPct(
        data?.agents?.remediator?.rejection_rate ??
          data?.remediator_rejection_rate ??
          data?.validator_rejection_rate ??
          data?.rejection_rate,
      ),
    },
    {
      key: "validator",
      name: "Validator Agent",
      role: "Contract & Deterministic Rules",
      acc: formatPct(
        data?.agents?.validator?.accuracy ??
          data?.validator_accuracy ??
          data?.cleaner_accuracy ??
          data?.success_rate,
      ),
      rej: formatPct(
        data?.agents?.validator?.rejection_rate ??
          data?.validator_rejection_rate ??
          data?.rejection_rate,
      ),
    },
  ];

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand-accent">Agent Metrics</h3>
        <button
          type="button"
          onClick={loadAgentMetrics}
          disabled={!hasDatasets || loading}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/30 hover:border-brand-accent transition cursor-pointer disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">
            Cleaner accuracy:
          </span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {cleanerAcc}
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">
            Validator rejection rate:
          </span>
          <span className="text-base font-bold font-mono text-indigo-300">
            {validatorRej}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {agents.map((ag) => (
          <div
            key={ag.key}
            className="p-3.5 rounded-lg bg-brand-dark/70 border border-brand-accent/15 flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-sm font-bold text-gray-100">{ag.name}</div>
              <div className="text-xs text-gray-400">{ag.role}</div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-bold text-emerald-400">
                {ag.acc === "—" ? "—" : `${ag.acc} Acc`}
              </div>
              <div className="text-xs text-gray-400">
                {ag.rej === "—" ? "—" : `${ag.rej} Rej`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

AgentMetricsPanel.propTypes = {
  hasDatasets: PropTypes.bool,
  datasetId: PropTypes.string,
  refreshTrigger: PropTypes.number,
  fallbackMetrics: PropTypes.object,
};
