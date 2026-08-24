import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

// Guard duplicate registration across HMR reloads
if (!ChartJS._registered) {
  ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Filler,
  );
  ChartJS._registered = true;
}

export default function BarChart({
  metrics = {},
  title = "Metrics Bar Chart",
  height = 260,
}) {
  const safeMetrics =
    metrics && typeof metrics === "object" && !Array.isArray(metrics)
      ? metrics
      : {};

  const labels = useMemo(
    () => Object.keys(safeMetrics),
    [JSON.stringify(safeMetrics)],
  );
  const values = useMemo(
    () =>
      labels.map((k) => {
        const v = safeMetrics[k];
        const num = typeof v === "number" ? v : Number(v);
        return Number.isFinite(num) ? num : 0;
      }),
    [labels, JSON.stringify(safeMetrics)],
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Values",
        data: values,
        backgroundColor: "rgba(56, 189, 248, 0.5)",
        borderColor: "#38bdf8",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#cbd5e1" } },
    },
    scales: {
      x: { ticks: { color: "#cbd5e1" } },
      y: { ticks: { color: "#cbd5e1" } },
    },
  };

  const styleHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10">
      <h3 className="text-lg font-semibold text-brand-accent mb-2">{title}</h3>
      <div style={{ height: styleHeight }} role="img" aria-label={title}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

BarChart.propTypes = {
  metrics: PropTypes.object,
  title: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
