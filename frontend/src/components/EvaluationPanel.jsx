//frontend/src/components/EvaluationPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

export default function EvaluationPanel({
  hasDatasets = true,
  datasetId = "all",
}) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEvaluations = useCallback(async () => {
    if (!hasDatasets) {
      setEvaluations([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params =
        datasetId && String(datasetId) !== "all"
          ? { dataset_id: datasetId }
          : undefined;
      const res = await client.get("/api/evaluations", { params });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.evaluations || res.data?.items || res.data?.results || [];
      setEvaluations(list);
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to load evaluations.");
      setError(text);
    } finally {
      setLoading(false);
    }
  }, [hasDatasets, datasetId]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const formatScore = (val) => {
    if (val === null || val === undefined || Number.isNaN(Number(val))) {
      return "-";
    }
    const num = Number(val);
    const pct = num <= 1 ? num * 100 : num;
    return `${pct.toFixed(1)}%`;
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand-accent">Evaluation</h3>
        <span className="text-xs text-gray-400">
          {hasDatasets ? "Latest results" : "-"}
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {!hasDatasets || evaluations.length === 0 ? (
        <div className="p-4 rounded-lg bg-brand-dark/60 border border-brand-accent/10 text-xs text-gray-400 italic text-center">
          No evaluations available (-). Upload a dataset to run evaluations.
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev, idx) => {
            const title = ev?.name || ev?.title || `Evaluation #${idx + 1}`;
            const dsLabel =
              ev?.dataset_name || ev?.dataset || ev?.dataset_id || "-";
            const qualityVal =
              ev?.quality_score ?? ev?.metrics?.quality_score ?? ev?.score;
            const issuesVal =
              ev?.issues_count ?? ev?.issues ?? ev?.metrics?.issues ?? 0;

            return (
              <div
                key={ev?.id ?? idx}
                className="p-4 rounded-lg bg-brand-dark/70 border border-brand-accent/15 space-y-3"
              >
                <div>
                  <div className="text-sm font-bold text-gray-100">{title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Dataset: <span className="font-mono">{dsLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded bg-brand-light/60 border border-brand-accent/10">
                    <div className="text-[10px] uppercase text-gray-400 font-semibold">
                      Quality Score
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {formatScore(qualityVal)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-brand-light/60 border border-brand-accent/10">
                    <div className="text-[10px] uppercase text-gray-400 font-semibold">
                      Issues (Count)
                    </div>
                    <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                      {Number(issuesVal) || 0}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

EvaluationPanel.propTypes = {
  hasDatasets: PropTypes.bool,
  datasetId: PropTypes.string,
};
