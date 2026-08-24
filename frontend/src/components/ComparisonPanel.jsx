// frontend/src/components/ComparisonPanel.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * ComparisonPanel
 *
 * Placeholder for dataset comparison UI.
 * Props:
 *  - datasets: array
 *  - onCompared: callback when comparison completed
 */

export default function ComparisonPanel({
  datasets = [],
  onCompared = () => {},
}) {
  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-brand-accent">Comparison</h2>
        <div className="text-sm text-gray-400">Compare datasets</div>
      </div>

      <div className="text-sm text-gray-200">
        <p className="text-gray-400 italic">
          Select two datasets to compare (placeholder).
        </p>

        <div className="mt-3">
          <button
            onClick={() => onCompared()}
            className="px-3 py-2 rounded-md bg-brand-accent text-black font-semibold hover:bg-blue-300 transition"
          >
            Run Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

ComparisonPanel.propTypes = {
  datasets: PropTypes.array,
  onCompared: PropTypes.func,
};
