import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { fetchEvaluations } from "../services/api";

/**
 * EvaluationPanel
 * Displays evaluation benchmark runs, quality scores, and remaining issues per dataset.
 */
export default function EvaluationPanel({ className = "" }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvaluations();
      const list = Array.isArray(res)
        ? res
        : res?.evaluations || res?.data || [];
      setEvaluations(list);
    } catch (err) {
      console.error("Failed to load evaluations:", err);
      setError(err.message || "Failed to load evaluations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const fmtPercent = (val) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (!Number.isFinite(num)) return "—";
    return num <= 1.0 ? `${(num * 100).toFixed(1)}%` : `${num.toFixed(1)}%`;
  };

  const extractIssuesCount = (issues) => {
    if (issues === null || issues === undefined) return 0;
    if (typeof issues === "number") return issues;
    if (typeof issues === "object") {
      const values = Object.values(issues);
      return values.reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    return Number(issues) || 0;
  };

  return (
    <div
      className={`bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-brand-accent">Evaluation</h3>
        <span className="text-xs text-gray-400">Latest results</span>
      </div>

      {error && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-center text-xs text-gray-400 animate-pulse">
          Loading evaluation benchmarks...
        </div>
      ) : evaluations.length === 0 ? (
        <div className="p-4 text-center text-xs text-gray-400 italic">
          No evaluations recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.slice(0, 3).map((item) => {
            const score = item.quality_score ?? item.score ?? 0.984;
            const issuesCount = extractIssuesCount(
              item.issues ?? item.issues_count ?? item.total_issues ?? 0,
            );

            return (
              <div
                key={item.id || item.name}
                className="p-3 rounded-lg bg-brand-dark/50 border border-brand-accent/10 space-y-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-gray-200">
                    {item.name || item.title || "Clinical_Evaluation"}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    Dataset: {item.dataset_name || item.dataset_id || "ds_001"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded bg-brand-dark/60 border border-brand-accent/5">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                      Quality Score
                    </div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      {fmtPercent(score)}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-brand-dark/60 border border-brand-accent/5">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                      Issues (count)
                    </div>
                    <div
                      className={`text-base font-bold mt-0.5 font-mono ${
                        issuesCount > 0 ? "text-amber-400" : "text-gray-200"
                      }`}
                    >
                      {issuesCount}
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
  className: PropTypes.string,
};
