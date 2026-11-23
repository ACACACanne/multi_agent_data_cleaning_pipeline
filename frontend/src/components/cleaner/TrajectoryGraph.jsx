// frontend/src/components/cleaner/TrajectoryGraph.jsx
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import zoomPlugin from "chartjs-plugin-zoom";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";

if (!ChartJS._registered) {
  ChartJS.register(
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    TimeScale,
    Tooltip,
    Legend,
    zoomPlugin,
  );
  ChartJS._registered = true;
}

export default function TrajectoryGraph({
  datasetId = null,
  hasDatasets = false,
  trajectories = { baseline: [], agent: [], manual: [] },
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const hasSeriesData =
    hasDatasets &&
    ((Array.isArray(trajectories?.agent) && trajectories.agent.length > 0) ||
      (Array.isArray(trajectories?.manual) && trajectories.manual.length > 0) ||
      (Array.isArray(trajectories?.baseline) &&
        trajectories.baseline.length > 0));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.("2d");
    if (!ctx) return;

    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch {
        // Ignore destruction errors on unmount
      }
      chartRef.current = null;
    }

    if (!hasSeriesData) return;

    const toPoints = (entries) => {
      const list = Array.isArray(entries) ? entries : [];
      const now = Date.now();
      return list
        .map((e, idx) => {
          let rawQ = null;
          if (typeof e === "number") {
            rawQ = e;
          } else if (typeof e === "string") {
            const parsed = parseFloat(e);
            rawQ = Number.isFinite(parsed) ? parsed : null;
          } else if (typeof e === "object" && e !== null) {
            const v = e.quality_score ?? e.quality ?? e.score ?? e.value ?? e.y;
            if (v !== undefined && v !== null) {
              const parsed = typeof v === "number" ? v : parseFloat(String(v));
              rawQ = Number.isFinite(parsed) ? parsed : null;
            }
          }
          if (rawQ === null) return null;
          if (rawQ <= 1.0 && rawQ > 0) {
            rawQ = rawQ * 100;
          }

          let dateVal = null;
          if (typeof e === "object" && e !== null && e.timestamp) {
            const d = new Date(
              typeof e.timestamp === "number"
                ? e.timestamp
                : String(e.timestamp),
            );
            if (!Number.isNaN(d.getTime())) {
              dateVal = d;
            }
          }
          if (!dateVal) {
            dateVal = new Date(
              now - (list.length - idx - 1) * 24 * 60 * 60 * 1000,
            );
          }

          return {
            x: dateVal,
            y: Number(rawQ.toFixed(1)),
          };
        })
        .filter(Boolean);
    };

    const baselineData = toPoints(trajectories?.baseline);
    const agentData = toPoints(trajectories?.agent);
    const manualData = toPoints(trajectories?.manual);

    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Autonomous Agent",
            data: agentData,
            borderColor: "#2cb67d",
            backgroundColor: "rgba(44, 182, 125, 0.12)",
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2cb67d",
            fill: false,
          },
          {
            label: "Manual Remediation",
            data: manualData,
            borderColor: "#818cf8",
            backgroundColor: "rgba(129, 140, 248, 0.12)",
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: "#818cf8",
            borderDash: [3, 3],
            fill: false,
          },
          {
            label: "Raw Baseline",
            data: baselineData,
            borderColor: "#f43f5e",
            backgroundColor: "rgba(244, 63, 94, 0.08)",
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: "#f43f5e",
            borderDash: [5, 5],
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                day: "MMM d",
              },
            },
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
            },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
              callback: (v) => `${v}%`,
            },
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "#cbd5e1",
              boxWidth: 12,
              boxHeight: 6,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(148, 163, 184, 0.2)",
            borderWidth: 1,
            padding: 8,
            callbacks: {
              label: (item) => {
                const v = item.parsed?.y;
                return Number.isFinite(v)
                  ? ` ${item.dataset.label}: ${v.toFixed(1)}%`
                  : ` ${item.dataset.label}: —`;
              },
            },
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true, mode: "xy" },
              mode: "x",
            },
            pan: {
              enabled: true,
              mode: "x",
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        chartRef.current = null;
      }
    };
  }, [datasetId, hasSeriesData, JSON.stringify(trajectories)]);

  const lastAgentVal =
    hasSeriesData &&
    Array.isArray(trajectories?.agent) &&
    trajectories.agent.length > 0
      ? (() => {
          const last = trajectories.agent[trajectories.agent.length - 1];
          const raw =
            typeof last === "object" && last !== null
              ? (last.quality_score ?? last.quality ?? last.score ?? last.value)
              : last;
          const num = Number(raw);
          if (!Number.isFinite(num)) return "—";
          return `${(num <= 1.0 && num > 0 ? num * 100 : num).toFixed(1)}%`;
        })()
      : "—";

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-brand-accent">
            Quality Trajectories ({datasetId || "—"})
          </h3>
          <p className="text-xs text-gray-400">
            Multi-iteration quality progression from pipeline telemetry
          </p>
        </div>
      </div>

      {!hasSeriesData ? (
        <div
          style={{ height: 180 }}
          className="flex items-center justify-center rounded-lg border border-dashed border-brand-accent/15 bg-brand-dark/40 text-xs text-gray-400 italic"
        >
          No trajectory telemetry available (—).
        </div>
      ) : (
        <>
          <div
            style={{ height: 260 }}
            className="relative w-full rounded-lg bg-brand-dark/50 p-2 border border-brand-accent/10"
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Quality trajectories chart for dataset ${datasetId || "none"}`}
              className="w-full h-full"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => chartRef.current?.resetZoom?.()}
              className="px-3 py-1 text-xs rounded bg-brand-dark text-gray-200 border border-brand-accent/20 hover:bg-brand-accent/10 transition cursor-pointer"
            >
              Reset Zoom
            </button>
            <span className="text-xs text-gray-400 font-mono">
              Latest Score:{" "}
              <strong className="text-emerald-400">{lastAgentVal}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const TrajectoryItemPropType = PropTypes.oneOfType([
  PropTypes.number,
  PropTypes.string,
  PropTypes.shape({
    timestamp: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    quality_score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    quality: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    step: PropTypes.number,
  }),
]);

TrajectoryGraph.propTypes = {
  datasetId: PropTypes.string,
  hasDatasets: PropTypes.bool,
  trajectories: PropTypes.shape({
    baseline: PropTypes.arrayOf(TrajectoryItemPropType),
    agent: PropTypes.arrayOf(TrajectoryItemPropType),
    manual: PropTypes.arrayOf(TrajectoryItemPropType),
  }),
};
