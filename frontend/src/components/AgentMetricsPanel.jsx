// frontend/src/components/AgentMetricsPanel.jsx
import React, { useEffect, useState } from "react";
import {
  fetchAgentsList,
  fetchAgentsMetrics,
  fetchAgentsMetricsSummary,
  postRunAgents,
  fetchDatasets,
} from "../services/api";

export default function AgentMetricsPanel() {
  const [agents, setAgents] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [alist, ds, hist, sum] = await Promise.all([
          fetchAgentsList(),
          fetchDatasets(),
          fetchAgentsMetrics(),
          fetchAgentsMetricsSummary(),
        ]);
        if (!mounted) return;
        setAgents(alist.agents || []);
        setDatasets(ds || []);
        setHistory(hist || []);
        setSummary(sum || {});
        if (alist.agents && alist.agents.length > 0)
          setSelectedAgent(alist.agents[0]);
        if (ds && ds.length > 0) setSelectedDataset(ds[0].id);
      } catch (err) {
        console.error("AgentMetricsPanel load error:", err);
      }
    })();
    return () => (mounted = false);
  }, []);

  const refreshHistory = async () => {
    try {
      const hist = await fetchAgentsMetrics();
      setHistory(hist || []);
      const sum = await fetchAgentsMetricsSummary();
      setSummary(sum || {});
    } catch (err) {
      console.error("Failed to refresh agent metrics:", err);
    }
  };

  const runAgents = async () => {
    if (!selectedDataset) {
      alert("Select a dataset first");
      return;
    }
    setRunning(true);
    try {
      const agentsToRun = selectedAgent ? [selectedAgent] : null;
      const res = await postRunAgents(selectedDataset, agentsToRun);
      // res.results contains per-agent metrics
      await refreshHistory();
      alert("Agents run complete");
    } catch (err) {
      console.error("Failed to run agents:", err);
      alert("Failed to run agents: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-brand-light p-4 rounded border border-brand-accent/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-brand-accent">
          Agent Metrics
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="bg-brand-dark text-sm px-2 py-1 rounded"
          >
            <option value="">Select dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>

          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-brand-dark text-sm px-2 py-1 rounded"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <button
            onClick={runAgents}
            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>

          <button
            onClick={refreshHistory}
            className="px-3 py-1 rounded bg-gray-700 text-white text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-200 space-y-2">
        <div>
          <strong>Summary</strong>
        </div>
        {Object.keys(summary).length === 0 ? (
          <div className="text-gray-400 text-xs">No agent summary yet.</div>
        ) : (
          <div className="text-xs">
            {Object.entries(summary).map(([agent, s]) => (
              <div key={agent}>
                <strong>{agent}</strong> — runs: {s.runs}, avg success:{" "}
                {s.avg_success}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <strong>Recent runs</strong>
          {history.length === 0 ? (
            <div className="text-gray-400 text-xs">No runs yet.</div>
          ) : (
            <div className="text-xs space-y-1">
              {history.slice(0, 8).map((h) => (
                <div key={h.id} className="border p-2 rounded bg-black/20">
                  <div>
                    <strong>{h.agent}</strong> on <em>{h.dataset_id}</em>
                  </div>
                  <div>
                    Actions: {h.payload.actions} • Success:{" "}
                    {h.payload.success_rate}
                  </div>
                  <div>Record accuracy: {h.payload.record_accuracy}</div>
                  <div>Unsupported fixes: {h.payload.unsupported_fixes}</div>
                  <div className="text-xs text-gray-400">
                    At: {h.created_at}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
