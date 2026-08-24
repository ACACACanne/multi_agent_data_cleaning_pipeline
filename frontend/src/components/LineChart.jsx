// frontend/src/components/LineChart.jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

export default function LineChart({
  metrics = {},
  title = "Metrics Line Chart",
  height = 260,
}) {
  const safeMetrics =
    metrics && typeof metrics === "object" && !Array.isArray(metrics)
      ? metrics
      : {};

  const labels = useMemo(() => Object.keys(safeMetrics), [safeMetrics]);
  const values = useMemo(
    () =>
      labels.map((k) => {
        const v = safeMetrics[k];
        const num = typeof v === "number" ? v : Number(v);
        return Number.isFinite(num) ? num : 0;
      }),
    [labels, safeMetrics],
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Values",
        data: values,
        fill: true,
        backgroundColor: "rgba(56, 189, 248, 0.25)",
        borderColor: "#38bdf8",
        tension: 0.3,
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

  return (
    <div className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10">
      <h3 className="text-lg font-semibold text-brand-accent mb-2">{title}</h3>
      <div style={{ height }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

LineChart.propTypes = {
  metrics: PropTypes.object,
  title: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
