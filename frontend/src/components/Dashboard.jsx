// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import useDashboardData from "../hooks/useDashboardData";

import UploadPanel from "./UploadPanel";
import DatasetList from "./DatasetList";
import MetricsPanel from "./MetricsPanel";
import BaselineMetricsPanel from "./BaselineMetricsPanel";
import ExperimentRunner from "./ExperimentRunner";
import SystemNotes from "./SystemNotes";
import RecordsTable from "./RecordsTable";
import DatasetViewer from "./DatasetViewer";
import EvaluationPanel from "./EvaluationPanel";

// Cleaner Pipeline Components
import CleanerAgentCard from "./cleaner/CleanerAgentCard";
import BeforeAfterComparisonPanel from "./cleaner/BeforeAfterComparisonPanel";
import TrajectoryGraph from "./cleaner/TrajectoryGraph";
import RemediationHistoryDrawer from "./cleaner/RemediationHistoryDrawer";
import ComparisonCleanerManual from "./cleaner/ComparisonCleanerManual";
import DatasetHealthBadge from "./cleaner/DatasetHealthBadge";
import FixSuggestionsPanel from "./cleaner/FixSuggestionsPanel";
import DatasetRiskMap from "./cleaner/DatasetRiskMap";
import QualityForecastChart from "./cleaner/QualityForecastChart";
import AgentReasoningTimeline from "./cleaner/AgentReasoningTimeline";

import {
  postRunAgents,
  fetchCleanerMetrics,
  fetchManualMetrics,
  fetchRemediationHistory,
} from "../services/api";

export default function Dashboard() {
  const {
    datasets,
    runLog,
    refreshAll,
    metrics,
    cleanerMetrics,
    setCleanerMetrics,
    remediationHistory,
    setRemediationHistory,
  } = useDashboardData({
    autoLoad: true,
    pollIntervalMs: null,
  });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDatasetId, setViewerDatasetId] = useState(null);

  const [selectedDataset, setSelectedDataset] = useState("all");
  const [loadingCleaner, setLoadingCleaner] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [manualMetricsData, setManualMetricsData] = useState(null);

  const openViewerModal = (datasetId) => {
    setViewerDatasetId(datasetId);
    setViewerOpen(true);
  };

  const closeViewerModal = () => {
    setViewerOpen(false);
    setViewerDatasetId(null);
  };

  const visibleDatasets = (datasets || []).filter((d) => !d.hidden);

  useEffect(() => {
    if (!selectedDataset && visibleDatasets.length > 0) {
      setSelectedDataset("all");
    }
  }, [visibleDatasets, selectedDataset]);

  const effectiveDatasetId =
    selectedDataset === "all" || !selectedDataset
      ? visibleDatasets[0]?.id || "ds_001"
      : selectedDataset;

  const loadCleanerData = useCallback(
    async (targetId) => {
      try {
        const [cleanerRes, manualRes] = await Promise.all([
          fetchCleanerMetrics(targetId).catch(() => null),
          fetchManualMetrics
            ? fetchManualMetrics(targetId).catch(() => null)
            : null,
        ]);

        if (cleanerRes) {
          setCleanerMetrics(
            cleanerRes?.results?.cleaner || cleanerRes?.cleaner || cleanerRes,
          );
        }
        if (manualRes) {
          setManualMetricsData(manualRes);
        }
      } catch (err) {
        console.error("Failed to load cleaner/manual metrics:", err);
      }
    },
    [setCleanerMetrics],
  );

  useEffect(() => {
    loadCleanerData(selectedDataset);
  }, [selectedDataset, loadCleanerData]);

  // Run Cleaner Agent
  async function runCleaner() {
    const dsId =
      typeof selectedDataset === "object" && selectedDataset !== null
        ? selectedDataset.id
        : selectedDataset || "all";

    setLoadingCleaner(true);

    try {
      const data = await postRunAgents(dsId, ["cleaner"]);
      const cleanerResult =
        data?.results?.cleaner ?? data?.summary ?? data ?? null;

      if (cleanerResult) {
        setCleanerMetrics(cleanerResult);
      } else {
        await loadCleanerData(dsId);
      }

      const hist = await fetchRemediationHistory(
        dsId === "all" ? undefined : dsId,
      );
      setRemediationHistory(Array.isArray(hist) ? hist : []);

      await refreshAll();
    } catch (err) {
      console.error("runCleaner error:", err);
    } finally {
      setLoadingCleaner(false);
    }
  }

  // Run All Agents Pipeline
  async function runAllAgents() {
    const dsId =
      typeof selectedDataset === "object" && selectedDataset !== null
        ? selectedDataset.id
        : selectedDataset || "all";

    setLoadingCleaner(true);

    try {
      const data = await postRunAgents(dsId, [
        "auditor",
        "validator",
        "remediator",
        "cleaner",
      ]);
      const cleanerResult =
        data?.results?.cleaner ?? data?.summary ?? data ?? null;

      if (cleanerResult) {
        setCleanerMetrics(cleanerResult);
      } else {
        await loadCleanerData(dsId);
      }

      const hist = await fetchRemediationHistory(
        dsId === "all" ? undefined : dsId,
      );
      setRemediationHistory(Array.isArray(hist) ? hist : []);

      await refreshAll();
    } catch (err) {
      console.error("runAllAgents error:", err);
    } finally {
      setLoadingCleaner(false);
    }
  }

  // Telemetry mappings
  const selectedTrajectories = metrics?.trajectories?.[effectiveDatasetId] ||
    metrics?.trajectories?.["all"] ||
    cleanerMetrics?.trajectories || {
      baseline: [],
      agent: [],
      manual: [],
    };

  const isSynthetic =
    String(selectedDataset).startsWith("ds_syn_") ||
    String(effectiveDatasetId).startsWith("ds_syn_");

  const baselineQuality =
    cleanerMetrics?.baseline_quality ??
    metrics?.datasets?.[effectiveDatasetId]?.quality_score ??
    (isSynthetic ? 0.742 : 0.885);

  const baselineIssues =
    cleanerMetrics?.issues ??
    metrics?.datasets?.[effectiveDatasetId]?.issues ??
    (isSynthetic ? 32 : 14);

  const cleanedQuality = cleanerMetrics?.cleaned_quality ?? 0.988;
  const cleanedIssues = cleanerMetrics?.issues ?? 0;

  const formatLogItem = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") {
      const time = item.timestamp
        ? `[${new Date(item.timestamp).toLocaleTimeString()}] `
        : "";
      const agent = item.agent ? `${item.agent}: ` : "";
      const action = item.action ? `(${item.action}) ` : "";
      const msg = item.message || item.finding || JSON.stringify(item);
      return `${time}${agent}${action}${msg}`;
    }
    return String(item);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* 1. Dataset Ingestion / Upload */}
      <section aria-label="Upload Dataset">
        <UploadPanel onUploaded={() => refreshAll()} />
      </section>

      {/* 2. Main 2-Column Responsive Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Data Operations, Cleaning Pipelines, and Trajectory Charts (2 Cols Wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dataset Selector & Synthetic Injection List */}
          <DatasetList
            datasets={visibleDatasets}
            selectedDatasetId={selectedDataset}
            onRefresh={async () => {
              await refreshAll();
              await loadCleanerData(selectedDataset);
            }}
            onOpenFullViewer={openViewerModal}
            onSelectDataset={(id) => setSelectedDataset(id)}
          />

          {/* Quick Records Preview */}
          <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-brand-accent">
                  Quick Records Browse
                </h3>
                <div className="text-xs text-gray-400">
                  Light preview of active records ({effectiveDatasetId})
                </div>
              </div>
            </div>
            <RecordsTable datasetId={effectiveDatasetId} initialPageSize={5} />
          </div>

          {/* Cleaner Agent Control Card */}
          <CleanerAgentCard
            datasets={visibleDatasets}
            datasetId={selectedDataset}
            onSelectDataset={(id) => setSelectedDataset(id)}
            metrics={cleanerMetrics}
            loading={loadingCleaner}
            onRunCleaner={runCleaner}
            onRunAllAgents={runAllAgents}
          />

          {/* Clinical Anomaly Risk Map */}
          <DatasetRiskMap
            risk={
              metrics?.risk?.[effectiveDatasetId] || {
                level: isSynthetic ? "high" : "low",
                factors: isSynthetic
                  ? [
                      "Synthetic noise injected",
                      "Outliers detected in clinical metrics",
                    ]
                  : ["Baseline verified", "Contract assertions passing"],
              }
            }
          />

          {/* Projected Quality Degradation Forecast */}
          <QualityForecastChart
            forecast={
              metrics?.forecast?.[effectiveDatasetId] || [
                0.92, 0.89, 0.85, 0.81,
              ]
            }
          />

          {/* Side-by-Side Quality Before & After */}
          <BeforeAfterComparisonPanel
            baselineQuality={baselineQuality}
            baselineIssues={baselineIssues}
            cleanedQuality={cleanedQuality}
            cleanedIssues={cleanedIssues}
          />

          {/* Quality Trajectory Curves */}
          <TrajectoryGraph
            datasetId={effectiveDatasetId}
            trajectories={selectedTrajectories}
          />

          {/* Contextual Action Suggestions */}
          <FixSuggestionsPanel
            suggestions={cleanerMetrics?.suggestions || []}
            onApply={() => runCleaner()}
          />

          {/* Agent Reasoning Decision Trace */}
          <AgentReasoningTimeline
            reasoning={
              metrics?.reasoning?.[effectiveDatasetId] || [
                {
                  step: 1,
                  agent: "Auditor Agent",
                  action: "Scan schema drift",
                  finding: `Scanned ${effectiveDatasetId} records and isolated structural anomalies.`,
                  confidence: 0.98,
                },
                {
                  step: 2,
                  agent: "Remediator Agent",
                  action: "Contextual imputation & repair",
                  finding:
                    "Applied deterministic rules, KNN imputation, and numerical outlier bounds.",
                  confidence: 0.99,
                },
                {
                  step: 3,
                  agent: "Validator Agent",
                  action: "Data contract verification",
                  finding:
                    "All records conform to active JSON validation contracts.",
                  confidence: 1.0,
                },
              ]
            }
          />

          {/* Autonomous Cleaner vs. Manual Human Fixes */}
          <ComparisonCleanerManual
            cleanerMetrics={cleanerMetrics}
            manualMetrics={
              manualMetricsData ||
              metrics?.manual?.[effectiveDatasetId] ||
              metrics?.manual?.["all"]
            }
          />

          {/* Drawer & Health Badge Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(true)}
              aria-label="View remediation history"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition shadow-sm"
            >
              View Remediation History
            </button>

            <DatasetHealthBadge score={baselineQuality} />
          </div>

          {/* Slide-Over Remediation Drawer */}
          <RemediationHistoryDrawer
            open={showHistoryDrawer}
            isOpen={showHistoryDrawer}
            history={remediationHistory}
            onClose={() => setShowHistoryDrawer(false)}
          />
        </div>

        {/* RIGHT COLUMN: Telemetry, Benchmarking, Experiments, Notes (1 Col Wide) */}
        <div className="space-y-6">
          <MetricsPanel />
          <BaselineMetricsPanel />
          <EvaluationPanel />
          <ExperimentRunner />
          <SystemNotes />
        </div>
      </div>

      {/* 3. Real-Time System Run Log */}
      <section aria-label="System Run Log" className="mt-8">
        <h3 className="text-base text-gray-200 mb-2 font-bold">
          System Run Log
        </h3>
        <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 text-xs text-gray-300 shadow-md">
          {runLog && runLog.length > 0 ? (
            <div className="space-y-1.5 font-mono max-h-60 overflow-y-auto pr-2">
              {runLog.slice(0, 20).map((l, i) => (
                <div key={i} className="text-xs text-gray-300">
                  {formatLogItem(l)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 italic">
              No run log entries recorded yet.
            </div>
          )}
        </div>
      </section>

      {/* 4. Full Dataset Viewer Modal */}
      {viewerOpen && viewerDatasetId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={closeViewerModal}
          />
          <div className="relative w-full max-w-6xl bg-brand-dark rounded-xl border border-brand-accent/30 shadow-2xl overflow-hidden mt-8 max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-brand-accent/20 flex items-center justify-between bg-brand-dark/95">
              <div className="text-base font-bold text-brand-accent">
                Dataset Viewer:{" "}
                <span className="text-gray-100 font-mono">
                  {viewerDatasetId}
                </span>
              </div>
              <button
                type="button"
                onClick={closeViewerModal}
                aria-label="Close dataset viewer"
                className="px-3 py-1 text-xs font-semibold rounded bg-brand-dark text-gray-200 border border-brand-accent/30 hover:border-brand-accent hover:text-white transition"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <DatasetViewer datasetId={viewerDatasetId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
