// frontend/src/components/MetricsCharts.jsx
import React from "react";

/**
 * MetricsCharts
 *
 * Placeholder for charts. Accepts metrics prop but renders a simple summary.
 */

export default function MetricsCharts({ metrics = null }) {
  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <h2 className="text-2xl font-bold text-brand-accent mb-4">
        Metrics Charts
      </h2>

      {metrics ? (
        <div className="text-sm text-gray-200">
          <div>
            Quality: <strong>{metrics.quality_score ?? "—"}</strong>
          </div>
          <div>
            Issues: <strong>{metrics.issues_count ?? "—"}</strong>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 italic">No metrics to chart yet.</p>
      )}
    </div>
  );
}
