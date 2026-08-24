import React from "react";
import PropTypes from "prop-types";

export default function AgentReasoningTimeline({ reasoning = [] }) {
  if (!Array.isArray(reasoning) || reasoning.length === 0) {
    return (
      <div className="bg-brand-light p-4 rounded border border-brand-accent/10">
        <p className="text-gray-400 italic">No reasoning captured yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-brand-light p-6 rounded border border-brand-accent/10 shadow-md">
      <h4 className="text-brand-accent mb-4 text-lg font-semibold">
        Agent Reasoning Timeline
      </h4>

      <div className="space-y-4">
        {reasoning.map((step, i) => (
          <div
            key={step?.id ?? `reasoning-${i}`}
            className="border-l border-brand-accent/30 pl-4 relative"
          >
            <span className="w-2 h-2 rounded-full bg-brand-accent absolute -left-1 top-2" />
            <div className="text-xs text-gray-400">
              {step.timestamp} · {step.agent}
            </div>
            <div className="text-sm text-gray-200 mt-1">{step.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

AgentReasoningTimeline.propTypes = {
  reasoning: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      timestamp: PropTypes.string,
      agent: PropTypes.string,
      summary: PropTypes.string,
    }),
  ),
};
