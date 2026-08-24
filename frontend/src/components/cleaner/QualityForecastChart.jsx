// frontend/src/components/cleaner/QualityForecastChart.jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";

/**
 * QualityForecastChart
 * Visualizes projected data quality drift and degradation timelines.
 * Robustly normalizes input scores whether received as fractions (0.95) or percentages (95.0).
 */
export default function QualityForecastChart({
  forecast = [],
  title = "Quality Drift & Health Forecast",
  className = "",
}) {
  // Normalize input forecast array to standard [{ day, score }] with score in [0.0, 1.0]
  const normalizedPoints = useMemo(() => {
    let rawList = [];
    if (Array.isArray(forecast)) {
      rawList = forecast;
    } else if (typeof forecast === "object" && forecast !== null) {
      rawList =
        forecast.forecast_points || forecast.points || forecast.forecast || [];
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    return rawList.map((p, idx) => {
      let rawScore = 0.95;
      let day = idx * 7;

      if (typeof p === "number") {
        rawScore = p;
      } else if (typeof p === "object" && p !== null) {
        day = p.day !== undefined ? Number(p.day) : idx * 7;
        rawScore = p.projected_score ?? p.score ?? p.predicted_quality ?? 0.95;
      }

      let parsed = parseFloat(String(rawScore));
      if (isNaN(parsed)) parsed = 0.95;

      // Ensure normalized score is strictly within [0.0, 1.0]
      const scoreFraction = parsed > 1.0 ? parsed / 100.0 : parsed;

      return {
        day,
        score: Math.min(1.0, Math.max(0.0, scoreFraction)),
      };
    });
  }, [forecast]);

  const width = 500;
  const height = 140;
  const padding = 30;

  const minScore = 0.5;
  const maxScore = 1.0;

  const svgPoints = useMemo(() => {
    if (normalizedPoints.length === 0) return "";
    return normalizedPoints
      .map((p, idx) => {
        const x =
          padding +
          (idx / Math.max(1, normalizedPoints.length - 1)) *
            (width - 2 * padding);
        const normalizedY = (p.score - minScore) / (maxScore - minScore);
        const y = height - padding - normalizedY * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [normalizedPoints]);

  return (
    <div
      className={`bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-brand-accent">{title}</h3>
          <p className="text-xs text-gray-400">
            Projected quality score degradation over time without cleaning
            cycles
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Drift: Stable
        </span>
      </div>

      {normalizedPoints.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-brand-accent/10 text-xs text-gray-400">
          No forecast metrics available for the selected dataset.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lightweight SVG Line Chart */}
          <div className="relative w-full overflow-hidden rounded-lg bg-brand-dark/60 p-2 border border-brand-accent/10">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-36 overflow-visible"
            >
              {/* Grid Lines */}
              <line
                x1={padding}
                y1={padding}
                x2={width - padding}
                y2={padding}
                stroke="currentColor"
                className="text-gray-800"
                strokeDasharray="3 3"
              />
              <line
                x1={padding}
                y1={height / 2}
                x2={width - padding}
                y2={height / 2}
                stroke="currentColor"
                className="text-gray-800"
                strokeDasharray="3 3"
              />
              <line
                x1={padding}
                y1={height - padding}
                x2={width - padding}
                y2={height - padding}
                stroke="currentColor"
                className="text-gray-800"
                strokeDasharray="3 3"
              />

              {/* Area fill */}
              {svgPoints && (
                <polygon
                  points={`${padding},${height - padding} ${svgPoints} ${
                    width - padding
                  },${height - padding}`}
                  className="fill-brand-accent/10"
                />
              )}

              {/* Line */}
              {svgPoints && (
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-brand-accent"
                  points={svgPoints}
                />
              )}

              {/* Data Dots & Day Labels */}
              {normalizedPoints.map((p, idx) => {
                const x =
                  padding +
                  (idx / Math.max(1, normalizedPoints.length - 1)) *
                    (width - 2 * padding);
                const normalizedY =
                  (p.score - minScore) / (maxScore - minScore);
                const y =
                  height - padding - normalizedY * (height - 2 * padding);

                return (
                  <g key={idx}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-brand-dark stroke-brand-accent"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-gray-400 text-[10px]"
                    >
                      Day {p.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Forecast Legend Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {normalizedPoints.slice(0, 4).map((p, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-brand-dark/40 border border-brand-accent/5"
              >
                <div className="text-gray-400">Day {p.day}</div>
                <div className="font-bold text-gray-200 mt-0.5 font-mono">
                  {(p.score * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

QualityForecastChart.propTypes = {
  forecast: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  title: PropTypes.string,
  className: PropTypes.string,
};
