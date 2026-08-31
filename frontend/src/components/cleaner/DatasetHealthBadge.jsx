//frontend/src/components/cleaner/DatasetHealthBadge.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * DatasetHealthBadge
 * Computes and renders color-coded health rating for datasets.
 */
export default function DatasetHealthBadge({
  score = 0.94,
  label = "Dataset Health",
  size = "md",
  className = "",
}) {
  // Normalize numeric value
  const numericScore =
    typeof score === "number" ? score : parseFloat(score) || 0;
  const percentage =
    numericScore <= 1.0
      ? Math.round(numericScore * 100)
      : Math.round(numericScore);

  let statusText = "Optimal";
  let badgeStyles = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  let dotColor = "bg-emerald-400";

  if (percentage < 75) {
    statusText = "Critical Attention";
    badgeStyles = "bg-rose-500/20 text-rose-300 border-rose-500/30";
    dotColor = "bg-rose-400";
  } else if (percentage < 90) {
    statusText = "Needs Review";
    badgeStyles = "bg-amber-500/20 text-amber-300 border-amber-500/30";
    dotColor = "bg-amber-400";
  }

  const sizeClasses =
    {
      sm: "px-2 py-0.5 text-xs",
      md: "px-3 py-1 text-sm",
      lg: "px-4 py-2 text-base font-semibold",
    }[size] || "px-3 py-1 text-sm";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border shadow-sm ${badgeStyles} ${sizeClasses} ${className}`}
      title={`${label}: ${percentage}%`}
    >
      <span className={`w-2 h-2 rounded-full animate-pulse ${dotColor}`} />
      <span className="font-medium">
        {label}: <strong className="font-bold">{percentage}%</strong> (
        {statusText})
      </span>
    </div>
  );
}

DatasetHealthBadge.propTypes = {
  score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  label: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
};
