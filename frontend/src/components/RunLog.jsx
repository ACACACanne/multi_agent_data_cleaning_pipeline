// frontend/src/components/RunLog.jsx
import React, { useEffect, useRef, useMemo } from "react";
import PropTypes from "prop-types";

/**
 * RunLog
 *
 * - Displays a scrollable run log and auto-scrolls to the bottom when logs update.
 * - Accepts an array of log entries (strings or objects with message/action/agent + optional timestamp).
 * - Safe against malformed entries and object children.
 */

export default function RunLog({
  logs = [],
  maxEntries = 1000,
  className = "",
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  // Trim logs for rendering performance
  const visibleLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const start = Math.max(0, logs.length - maxEntries);
    return logs.slice(start);
  }, [logs, maxEntries]);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [visibleLogs.length]);

  return (
    <div
      className={`bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20 ${className}`}
    >
      <h2 className="text-2xl font-bold mb-4 text-brand-accent">Run Log</h2>

      <div
        ref={containerRef}
        className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10 h-64 overflow-y-auto space-y-2"
        aria-live="polite"
        role="log"
      >
        {visibleLogs.length === 0 ? (
          <p className="text-gray-400 text-sm italic">
            No logs yet. Actions will appear here.
          </p>
        ) : (
          visibleLogs.map((entry, index) => {
            if (!entry) return null;

            const isString = typeof entry === "string";

            // Safely extract message from different backend formats
            let message = "";
            if (isString) {
              message = entry;
            } else if (typeof entry === "object") {
              const agentPrefix = entry.agent ? `[${entry.agent}] ` : "";
              const actionPrefix = entry.action ? `${entry.action} - ` : "";
              message = `${agentPrefix}${actionPrefix}${entry.message || entry.finding || JSON.stringify(entry)}`;
            } else {
              message = String(entry);
            }

            const tsRaw = isString
              ? null
              : (entry?.ts ?? entry?.timestamp ?? null);

            let tsFormatted = null;
            if (tsRaw != null) {
              const d = new Date(tsRaw);
              tsFormatted = Number.isNaN(d.getTime())
                ? null
                : d.toLocaleTimeString();
            }

            return (
              <div
                key={index}
                className="p-2 rounded-md bg-brand-light/20 border border-brand-accent/10"
              >
                <div className="flex items-start gap-3">
                  <div className="text-xs text-gray-400 w-24 shrink-0">
                    {tsFormatted || "Just now"}
                  </div>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap break-words">
                    {message}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

RunLog.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        message: PropTypes.string,
        agent: PropTypes.string,
        action: PropTypes.string,
        status: PropTypes.string,
        ts: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      }),
    ]),
  ),
  maxEntries: PropTypes.number,
  className: PropTypes.string,
};
