// frontend/src/App.jsx
import React, { useState, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import useDashboardData from "./hooks/useDashboardData";

import NavBar from "./components/NavBar";
import Dashboard from "./components/Dashboard";
import DatasetViewer from "./components/DatasetViewer";
import ErrorBoundary from "./components/ErrorBoundary";
import ReportPage from "./components/ReportPage";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { refreshAll } = useDashboardData({
    autoLoad: true,
  });

  const handleGlobalRefresh = useCallback(async () => {
    if (typeof refreshAll === "function") {
      await refreshAll();
    }
    setRefreshKey((prev) => prev + 1);
  }, [refreshAll]);

  return (
    <div className="w-full min-h-screen bg-brand-dark text-white flex flex-col items-stretch">
      {/* Persistent Navigation Header */}
      <NavBar onRefreshAll={handleGlobalRefresh} />

      {/* Main Application Routes */}
      <main className="w-full flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary>
          <Routes key={refreshKey}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/dataset/:id" element={<DatasetViewer />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
