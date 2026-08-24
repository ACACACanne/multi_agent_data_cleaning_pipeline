import React from "react";
import PropTypes from "prop-types";

/**
 * RemediationHistoryDrawer
 * Side drawer displaying historical agent and manual remediation actions.
 */
export default function RemediationHistoryDrawer({
  open = false,
  history = [],
  onClose = () => {},
  onApply = () => {},
}) {
  if (!open) return null;

  const historyList = Array.isArray(history) ? history : [];

  const getStatusColor = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "APPLIED" || s === "ACCEPTED" || s === "RESOLVED") {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    }
    if (s === "PENDING_REVIEW" || s === "PROPOSED") {
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    }
    if (s === "REJECTED" || s === "FAILED") {
      return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    }
    return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-brand-dark border-l border-brand-accent/20 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-brand-accent/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-brand-accent">
                Remediation History
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Log of automated fixes and manual overrides
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-brand-accent/10 transition"
              aria-label="Close drawer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {historyList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm italic">
                No remediation history entries found for this dataset.
              </div>
            ) : (
              historyList.map((item, index) => {
                const id = item.id || `rem_${index}`;
                const col = item.column || item.field || "General";
                const fix =
                  item.proposed_fix ||
                  item.action ||
                  item.description ||
                  "Applied rule transformation";
                const status = item.status || "APPLIED";
                const confidence = item.confidence
                  ? `${Math.round(item.confidence * 100)}%`
                  : null;
                const time = item.timestamp
                  ? new Date(item.timestamp).toLocaleString()
                  : "Recently";

                return (
                  <div
                    key={id}
                    className="p-4 rounded-lg bg-brand-light/30 border border-brand-accent/10 space-y-2 transition hover:border-brand-accent/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-brand-accent font-semibold px-2 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/20">
                        {col}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(
                          status,
                        )}`}
                      >
                        {status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-200">{fix}</p>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-brand-accent/5">
                      <span>{time}</span>
                      {confidence && (
                        <span>
                          Confidence:{" "}
                          <strong className="text-gray-300">
                            {confidence}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-brand-accent/10 bg-brand-light/10 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-brand-accent text-brand-dark font-medium hover:bg-brand-accent/90 transition shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

RemediationHistoryDrawer.propTypes = {
  open: PropTypes.bool,
  history: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      column: PropTypes.string,
      field: PropTypes.string,
      proposed_fix: PropTypes.string,
      action: PropTypes.string,
      status: PropTypes.string,
      confidence: PropTypes.number,
      timestamp: PropTypes.string,
    }),
  ),
  onClose: PropTypes.func,
  onApply: PropTypes.func,
};
