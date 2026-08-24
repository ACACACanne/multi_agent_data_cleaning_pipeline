// frontend/src/components/CleaningOptions.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * CleaningOptions
 *
 * Placeholder for cleaning configuration UI.
 */

export default function CleaningOptions({ datasets = [] }) {
  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <h2 className="text-2xl font-bold text-brand-accent mb-4">
        Cleaning Options
      </h2>

      <p className="text-sm text-gray-200">
        Configure cleaning strategies and agent parameters.
      </p>

      <div className="mt-3 text-xs text-gray-400">
        {datasets.length} datasets available.
      </div>
    </div>
  );
}

CleaningOptions.propTypes = {
  datasets: PropTypes.array,
};
