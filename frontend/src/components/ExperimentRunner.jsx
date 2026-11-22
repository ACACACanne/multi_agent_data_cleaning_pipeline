//frontend/src/components/ExperimentRunner.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

export default function ExperimentRunner({
  hasDatasets = true,
  datasets = [],
  onCompleted = () => {},
}) {
  const [selectedScope, setSelectedScope] = useState("all");
  const [experimentName, setExperimentName] = useState("");
  const [experiments, setExperiments] = useState([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExperiments = useCallback(async () => {
    if (!hasDatasets) {
      setExperiments([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await client.get("/api/experiments");
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.experiments || res.data?.items || [];
      setExperiments(list);
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to load experiments.");
      setError(text);
    } finally {
      setLoading(false);
    }
  }, [hasDatasets]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const handleStartExperiment = async () => {
    if (!hasDatasets) return;
    setRunning(true);
    setError(null);
    try {
      await client.post("/api/experiments", {
        name: experimentName.trim() || `experiment_${Date.now()}`,
        dataset_id: selectedScope,
      });
      setExperimentName("");
      await loadExperiments();
      await onCompleted?.();
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to start experiment.");
      setError(text);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-brand-accent">
            Experiment Runner
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Run automated evaluation experiments and persist quality benchmarks
          </p>
        </div>
        <span className="text-xs text-gray-400 text-right shrink-0">
          Run experiments &amp; save evaluations
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <select
          value={selectedScope}
          onChange={(e) => setSelectedScope(e.target.value)}
          disabled={!hasDatasets}
          className="rounded-lg bg-brand-dark border border-brand-accent/25 px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-brand-accent disabled:opacity-40"
        >
          <option value="all">
            {hasDatasets
              ? `All Active Datasets (${datasets.length})`
              : "No Datasets (-)"}
          </option>
          {(datasets || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || d.id}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={experimentName}
          onChange={(e) => setExperimentName(e.target.value)}
          disabled={!hasDatasets}
          placeholder="Experiment name (optional)"
          className="rounded-lg bg-brand-dark border border-brand-accent/25 px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-accent disabled:opacity-40"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleStartExperiment}
          disabled={!hasDatasets || running}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-accent text-black hover:bg-blue-300 transition cursor-pointer disabled:opacity-40"
        >
          {running ? "Running…" : "Start Experiment"}
        </button>

        <button
          type="button"
          onClick={loadExperiments}
          disabled={!hasDatasets || loading}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-brand-dark text-gray-200 border border-brand-accent/25 hover:border-brand-accent transition cursor-pointer disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-semibold text-gray-200">
            Latest evaluations
          </span>
          <span className="font-mono">
            {hasDatasets ? `${experiments.length} records` : "0 records"}
          </span>
        </div>

        {!hasDatasets || experiments.length === 0 ? (
          <div className="p-3 rounded-lg bg-brand-dark/60 border border-brand-accent/10 text-xs text-gray-400 italic">
            No evaluations recorded (-). Upload a dataset first.
          </div>
        ) : (
          experiments.map((exp, idx) => (
            <div
              key={exp?.id ?? idx}
              className="p-3 rounded-lg bg-brand-dark/70 border border-brand-accent/15 flex items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="font-bold text-gray-100">
                  {exp?.name || `Experiment #${idx + 1}`}
                </div>
                <div className="text-gray-400 font-mono mt-0.5">
                  Dataset: {exp?.dataset_id || "-"}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-brand-accent/10 text-brand-accent font-mono text-[11px]">
                {exp?.results?.status || "COMPLETED"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

ExperimentRunner.propTypes = {
  hasDatasets: PropTypes.bool,
  datasets: PropTypes.array,
  onCompleted: PropTypes.func,
};
