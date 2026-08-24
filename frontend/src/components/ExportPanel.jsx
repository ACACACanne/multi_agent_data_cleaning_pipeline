// frontend/src/components/ExportPanel.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * ExportPanel
 *
 * Minimal export UI for datasets.
 */

export default function ExportPanel({ datasets = [] }) {
  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <h2 className="text-2xl font-bold text-brand-accent mb-4">Export</h2>

      <div className="text-sm text-gray-200">
        <p className="text-gray-400 italic">
          Export dataset snapshots for experiments.
        </p>

        <div className="mt-3 flex gap-2">
          <button className="px-3 py-2 rounded-md bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition">
            Export CSV
          </button>
          <button className="px-3 py-2 rounded-md bg-brand-accent text-black font-semibold hover:bg-blue-300 transition">
            Export JSON
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {datasets.length} datasets available.
        </div>
      </div>
    </div>
  );
}

ExportPanel.propTypes = {
  datasets: PropTypes.array,
};
