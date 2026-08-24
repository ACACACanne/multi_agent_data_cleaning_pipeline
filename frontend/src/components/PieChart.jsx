// frontend/src/components/PieChart.jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Pie } from "react-chartjs-2";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, Filler);

export default function PieChart({
  metrics = {},
  title = "Metrics Pie Chart",
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

  const palette = [
    "#38bdf8",
    "#1e293b",
    "#0f172a",
    "#94a3b8",
    "#22d3ee",
    "#60a5fa",
    "#7dd3fc",
    "#a78bfa",
    "#f472b6",
  ];

  const data = {
    labels,
    datasets: [
      {
        label: "Distribution",
        data: values,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: "#0f172a",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: { color: "#cbd5e1", boxWidth: 12, padding: 12 },
      },
    },
  };

  return (
    <div className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10">
      <h3 className="text-lg font-semibold text-brand-accent mb-2">{title}</h3>
      <div style={{ height }}>
        <Pie data={data} options={options} />
      </div>
    </div>
  );
}

PieChart.propTypes = {
  metrics: PropTypes.object,
  title: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
