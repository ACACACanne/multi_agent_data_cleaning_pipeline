// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import useDashboardData from "../hooks/useDashboardData";

import UploadPanel from "./UploadPanel";
import DatasetList from "./DatasetList";
import MetricsPanel from "./MetricsPanel";
import BaselineMetricsPanel from "./BaselineMetricsPanel";
import AgentMetrics from "./AgentMetrics";
import ExperimentRunner from "./ExperimentRunner";
import SystemNotes from "./SystemNotes";
import RecordsTable from "./RecordsTable";
import DatasetViewer from "./DatasetViewer";
import EvaluationPanel from "./EvaluationPanel";

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
  const [activeDataTab, setActiveDataTab] = useState("registry");
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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

  const visibleDatasets = (datasets || []).filter(
    (d) =>
      !d.hidden &&
      !d.flags?.hidden &&
      !d.flags?.is_cleaned &&
      !d.name?.includes("[Cleaned]") &&
      !String(d.id).startsWith("ds_clean_"),
  );

  const hasDatasets = visibleDatasets.length > 0;

  useEffect(() => {
    if (!hasDatasets) {
      setSelectedDataset("all");
      setCleanerMetrics(null);
      setManualMetricsData(null);
    } else if (!selectedDataset) {
      setSelectedDataset("all");
    }
  }, [hasDatasets, selectedDataset, setCleanerMetrics]);

  const effectiveDatasetId = hasDatasets
    ? selectedDataset === "all" ||
      !selectedDataset ||
      !visibleDatasets.some((d) => String(d.id) === String(selectedDataset))
      ? visibleDatasets[0]?.id || null
      : selectedDataset
    : null;

  const refreshHistory = useCallback(
    async (targetId = selectedDataset) => {
      try {
        const dsParam =
          targetId && String(targetId) !== "all" ? String(targetId) : undefined;
        const hist = await fetchRemediationHistory(dsParam);
        setRemediationHistory(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.error("Failed to refresh remediation history:", err);
      }
    },
    [selectedDataset, setRemediationHistory],
  );

  const loadCleanerData = useCallback(
    async (targetId) => {
      if (!hasDatasets) {
        setCleanerMetrics(null);
        setManualMetricsData(null);
        return;
      }

      try {
        const [cleanerRes, manualRes] = await Promise.all([
          fetchCleanerMetrics(targetId).catch(() => null),
          showDiagnostics && fetchManualMetrics
            ? fetchManualMetrics(targetId).catch(() => null)
            : Promise.resolve(null),
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
        console.error("Failed to load cleaner metrics:", err);
      }
    },
    [hasDatasets, setCleanerMetrics, showDiagnostics],
  );

  useEffect(() => {
    loadCleanerData(selectedDataset);
  }, [selectedDataset, loadCleanerData]);

  const handleOpenHistoryDrawer = async () => {
    await refreshHistory(selectedDataset);
    setShowHistoryDrawer(true);
  };

  async function runCleaner() {
    if (!hasDatasets) return;
    const dsId =
      typeof selectedDataset === "object" && selectedDataset !== null
        ? selectedDataset.id
        : selectedDataset || "all";

    setLoadingCleaner(true);
    try {
      const data = await postRunAgents(dsId, ["cleaner"]);

      const exportsList =
        data?.cleaned_exports || data?.results?.cleaner?.cleaned_exports || [];
      const cleanerResult =
        data?.results?.cleaner ?? data?.cleaner ?? data?.summary ?? data ?? {};

      setCleanerMetrics({
        ...cleanerResult,
        cleaned_exports: exportsList,
      });

      await Promise.all([refreshHistory(dsId), refreshAll()]);
    } catch (err) {
      console.error("runCleaner error:", err);
    } finally {
      setLoadingCleaner(false);
    }
  }

  async function runAllAgents() {
    if (!hasDatasets) return;
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

      const exportsList =
        data?.cleaned_exports || data?.results?.cleaner?.cleaned_exports || [];
      const cleanerResult =
        data?.results?.cleaner ?? data?.cleaner ?? data?.summary ?? data ?? {};

      setCleanerMetrics({
        ...cleanerResult,
        cleaned_exports: exportsList,
      });

      await Promise.all([refreshHistory(dsId), refreshAll()]);
    } catch (err) {
      console.error("runAllAgents error:", err);
    } finally {
      setLoadingCleaner(false);
    }
  }

  const selectedTrajectories =
    hasDatasets && effectiveDatasetId
      ? metrics?.trajectories?.[effectiveDatasetId] ||
        metrics?.trajectories?.["all"] ||
        cleanerMetrics?.trajectories || {
          baseline: [],
          agent: [],
          manual: [],
        }
      : { baseline: [], agent: [], manual: [] };

  const baselineQuality = hasDatasets
    ? (cleanerMetrics?.baseline_quality ??
      metrics?.datasets?.[effectiveDatasetId]?.quality_score ??
      0)
    : 0;
  const baselineIssues = hasDatasets
    ? (cleanerMetrics?.issues ??
      metrics?.datasets?.[effectiveDatasetId]?.issues ??
      0)
    : 0;
  const cleanedQuality = hasDatasets
    ? (cleanerMetrics?.cleaned_quality ?? 0)
    : 0;
  const cleanedIssues = hasDatasets ? (cleanerMetrics?.issues ?? 0) : 0;

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
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-light px-4 py-3 rounded-xl border border-brand-accent/20">
        <div className="flex items-center gap-3">
          <DatasetHealthBadge score={baselineQuality} />
          <span className="text-xs text-gray-400">
            Production Pipeline: Upload &rarr; Clean &rarr; Export
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenHistoryDrawer}
            aria-label="View remediation history"
            style={{
              backgroundColor: "#0b1220",
              color: "#e5e7eb",
              border: "1px solid rgba(96, 165, 250, 0.3)",
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg hover:border-brand-accent transition cursor-pointer"
          >
            Remediation History
          </button>

          <button
            type="button"
            onClick={() => setShowDiagnostics((prev) => !prev)}
            style={{
              backgroundColor: showDiagnostics ? "#60a5fa" : "#1e293b",
              color: showDiagnostics ? "#0b1220" : "#e5e7eb",
              border: "1px solid rgba(96, 165, 250, 0.35)",
            }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            {showDiagnostics
              ? "Hide Research & Diagnostics"
              : "Research & Diagnostics"}
          </button>
        </div>
      </div>

      <section aria-label="Upload Dataset">
        <UploadPanel
          onUploaded={async () => {
            await refreshAll();
            await refreshHistory(selectedDataset);
          }}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-brand-light rounded-xl border border-brand-accent/20 shadow-md overflow-hidden">
            <div
              style={{
                backgroundColor: "#0b1220",
                borderColor: "rgba(96, 165, 250, 0.2)",
              }}
              className="p-3 border-b flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDataTab("registry")}
                  style={{
                    backgroundColor:
                      activeDataTab === "registry" ? "#60a5fa" : "#1e293b",
                    color: activeDataTab === "registry" ? "#0b1220" : "#cbd5e1",
                    border:
                      activeDataTab === "registry"
                        ? "1px solid #60a5fa"
                        : "1px solid rgba(96, 165, 250, 0.25)",
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  Dataset Registry ({visibleDatasets.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDataTab("preview")}
                  style={{
                    backgroundColor:
                      activeDataTab === "preview" ? "#60a5fa" : "#1e293b",
                    color: activeDataTab === "preview" ? "#0b1220" : "#cbd5e1",
                    border:
                      activeDataTab === "preview"
                        ? "1px solid #60a5fa"
                        : "1px solid rgba(96, 165, 250, 0.25)",
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  Record Preview ({effectiveDatasetId || "-"})
                </button>
              </div>

              {hasDatasets && effectiveDatasetId && (
                <button
                  type="button"
                  onClick={() => openViewerModal(effectiveDatasetId)}
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#60a5fa",
                    border: "1px solid rgba(96, 165, 250, 0.4)",
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg hover:border-brand-accent hover:text-white transition shrink-0 cursor-pointer"
                >
                  Expand Modal ↗
                </button>
              )}
            </div>

            <div className="p-3.5 max-h-[340px] overflow-y-auto overflow-x-hidden space-y-3">
              {activeDataTab === "registry" ? (
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
              ) : hasDatasets && effectiveDatasetId ? (
                <RecordsTable
                  datasetId={effectiveDatasetId}
                  initialPageSize={5}
                />
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 italic">
                  No dataset loaded (-). Upload a CSV or JSON file to preview
                  records.
                </div>
              )}
            </div>
          </div>

          <CleanerAgentCard
            datasets={visibleDatasets}
            datasetId={selectedDataset}
            onSelectDataset={(id) => setSelectedDataset(id)}
            metrics={hasDatasets ? cleanerMetrics : null}
            loading={loadingCleaner}
            onRunCleaner={runCleaner}
            onRunAllAgents={runAllAgents}
          />

          <BeforeAfterComparisonPanel
            baselineQuality={baselineQuality}
            baselineIssues={baselineIssues}
            cleanedQuality={cleanedQuality}
            cleanedIssues={cleanedIssues}
          />

          {showDiagnostics && hasDatasets && (
            <div className="space-y-6 pt-2 border-t border-brand-accent/20">
              <FixSuggestionsPanel
                suggestions={cleanerMetrics?.suggestions || []}
                onApply={() => runCleaner()}
              />

              <AgentReasoningTimeline
                reasoning={metrics?.reasoning?.[effectiveDatasetId] || []}
              />

              <DatasetRiskMap
                risk={
                  metrics?.risk?.[effectiveDatasetId] || {
                    level: "-",
                    factors: [],
                  }
                }
              />

              <QualityForecastChart
                forecast={metrics?.forecast?.[effectiveDatasetId] || []}
              />

              <TrajectoryGraph
                datasetId={effectiveDatasetId}
                trajectories={selectedTrajectories}
              />

              <ComparisonCleanerManual
                cleanerMetrics={cleanerMetrics}
                manualMetrics={
                  manualMetricsData ||
                  metrics?.manual?.[effectiveDatasetId] ||
                  null
                }
              />
            </div>
          )}

          <RemediationHistoryDrawer
            open={showHistoryDrawer}
            isOpen={showHistoryDrawer}
            history={remediationHistory}
            onClose={() => setShowHistoryDrawer(false)}
          />
        </div>

        <div className="space-y-6">
          <MetricsPanel
            metrics={hasDatasets ? metrics : null}
            datasets={visibleDatasets}
            onRefresh={refreshAll}
          />

          <AgentMetrics hasDatasets={hasDatasets} datasetId={selectedDataset} />

          {showDiagnostics && (
            <>
              <BaselineMetricsPanel />
              <EvaluationPanel
                hasDatasets={hasDatasets}
                datasetId={selectedDataset}
              />
              <ExperimentRunner
                hasDatasets={hasDatasets}
                datasets={visibleDatasets}
                onCompleted={refreshAll}
              />
              <SystemNotes />
            </>
          )}
        </div>
      </div>

      {showDiagnostics && (
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
      )}

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
                style={{
                  backgroundColor: "#0b1220",
                  color: "#e5e7eb",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
                className="px-3 py-1 text-xs font-semibold rounded hover:border-brand-accent hover:text-white transition cursor-pointer"
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
