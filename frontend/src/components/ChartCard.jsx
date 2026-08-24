// frontend/src/components/ChartCard.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * ChartCard
 *
 * - Consistent wrapper for all chart components.
 * - Provides unified padding, background, border, and title styling.
 * - Supports optional subtitle and adjustable height.
 * - Ensures stable rendering even if children are missing.
 */

export default function ChartCard({
  title,
  subtitle = null,
  children = null,
  height = 260,
}) {
  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-brand-accent">{title}</h2>
        {subtitle && (
          <span className="text-sm text-gray-400 truncate">{subtitle}</span>
        )}
      </div>

      <div
        className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10"
        style={{ minHeight: height }}
      >
        {children || (
          <p className="text-gray-400 text-sm italic">
            No chart data available.
          </p>
        )}
      </div>
    </div>
  );
}

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  children: PropTypes.node,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
