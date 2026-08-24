import React from "react";
import PropTypes from "prop-types";

/**
 * DatasetRiskMap
 *
 * Displays a risk level badge and a list of contributing factors.
 * Defensive against missing or malformed props and accessible to screen readers.
 */
export default function DatasetRiskMap({ risk = null }) {
  if (!risk) {
    return (
      <div className="bg-brand-light p-4 rounded border border-brand-accent/10">
        <p className="text-gray-400 italic">No risk assessment available.</p>
      </div>
    );
  }

  const level =
    typeof risk.level === "string" ? risk.level.toLowerCase() : "unknown";

  const levelColors = {
    low: "bg-green-900/40 border-green-400/40 text-green-300",
    medium: "bg-yellow-900/40 border-yellow-400/40 text-yellow-300",
    high: "bg-orange-900/40 border-orange-400/40 text-orange-300",
    critical: "bg-red-900/40 border-red-400/40 text-red-300",
    unknown: "bg-gray-800 border-gray-500 text-gray-300",
  };

  const badgeClass = levelColors[level] || levelColors.unknown;

  const factors = Array.isArray(risk.factors) ? risk.factors : [];

  return (
    <div
      className="bg-brand-light p-6 rounded border border-brand-accent/10 shadow-md"
      role="region"
      aria-labelledby="dataset-risk-heading"
      title={
        level !== "unknown" ? `Risk level: ${level}` : "Risk level unknown"
      }
    >
      <h4
        id="dataset-risk-heading"
        className="text-brand-accent mb-3 text-lg font-semibold"
      >
        Dataset Risk Map
      </h4>

      <div
        className={`inline-flex items-center px-3 py-2 rounded border ${badgeClass}`}
      >
        <span className="font-bold text-sm uppercase tracking-wide">
          {level || "unknown"}
        </span>
      </div>

      {factors.length === 0 ? (
        <div className="mt-4 text-sm text-gray-400 italic">
          No contributing factors listed.
        </div>
      ) : (
        <ul
          className="mt-4 space-y-2 text-sm text-gray-300"
          aria-label="Risk factors"
        >
          {factors.map((f, i) => {
            const key =
              typeof f === "string" && f.length > 0 ? f : `factor-${i}`;
            return (
              <li key={key} className="flex items-start gap-2">
                <span className="text-brand-accent mt-0.5">•</span>
                <span>{String(f)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

DatasetRiskMap.propTypes = {
  risk: PropTypes.shape({
    level: PropTypes.string,
    factors: PropTypes.arrayOf(PropTypes.string),
  }),
};
