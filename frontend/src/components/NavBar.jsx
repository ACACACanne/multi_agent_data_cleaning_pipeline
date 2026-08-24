// frontend/src/components/NavBar.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { clearCacheAndRefreshAll } from "../services/api";

export default function NavBar({ onRefreshAll = null }) {
  const loc = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleRefreshAndClearCache = async () => {
    setRefreshing(true);
    try {
      try {
        sessionStorage.clear();
        localStorage.removeItem("datara_cached_metrics");
        localStorage.removeItem("datara_remediation_history");
      } catch (storageErr) {
        console.warn("Storage clearance warning:", storageErr);
      }

      if (typeof clearCacheAndRefreshAll === "function") {
        await clearCacheAndRefreshAll();
      }

      if (typeof onRefreshAll === "function") {
        await onRefreshAll();
      } else {
        window.location.reload();
      }

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Global refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="w-full bg-brand-dark border-b border-brand-accent/20 sticky top-0 z-40 print:hidden">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-accent flex items-center justify-center text-black font-extrabold text-sm shadow-md shadow-brand-accent/20">
            DR
          </div>
          <div>
            <div className="text-base font-bold text-brand-accent leading-tight">
              DataRA Pro
            </div>
            <div className="text-[11px] text-gray-400">
              Multi-agent data cleaning
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {/* Dashboard Link */}
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              loc.pathname === "/" || loc.pathname === "/dashboard"
                ? "bg-brand-accent text-black border-brand-accent shadow-sm"
                : "bg-brand-dark text-gray-300 border-brand-accent/20 hover:text-white hover:border-brand-accent/40"
            }`}
          >
            Dashboard
          </Link>

          {/* Refresh All & Clean Caches Button */}
          <button
            type="button"
            onClick={handleRefreshAndClearCache}
            disabled={refreshing}
            title="Purge cache and refresh all evaluations, reports, and metrics"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border cursor-pointer ${
              refreshing
                ? "bg-indigo-950/80 text-indigo-200 border-indigo-500/40 cursor-not-allowed animate-pulse"
                : "bg-brand-dark text-gray-200 border-brand-accent/30 hover:border-brand-accent hover:text-white"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 ${
                refreshing
                  ? "animate-spin text-brand-accent"
                  : "text-brand-accent"
              }`}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>
              {refreshing ? "Refreshing…" : "Refresh All & Clean Caches"}
            </span>
          </button>

          {/* Open Final Report in New Tab */}
          <Link
            to="/report"
            target="_blank"
            rel="noopener noreferrer"
            title="Open comprehensive executive clinical report in a new tab"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border cursor-pointer bg-brand-dark text-gray-200 border-brand-accent/30 hover:border-brand-accent hover:text-white"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-accent shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Generate Final Report ↗</span>
          </Link>

          {/* Help */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              console.info("Debug: NavBar help clicked");
            }}
            className="text-xs text-gray-300 hover:text-white px-2 py-1.5 transition"
          >
            Help
          </a>
        </nav>
      </div>

      {/* Confirmation Toast */}
      {showToast && (
        <div className="absolute top-full right-6 mt-2 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          All caches cleared & metrics refreshed!
        </div>
      )}
    </header>
  );
}

NavBar.propTypes = {
  onRefreshAll: PropTypes.func,
};
