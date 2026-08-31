// frontend/src/components/NavBar.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { clearCacheAndRefreshAll } from "../services/api";

// Compact, Fixed-Dimension Shield Emblem (34px x 36px)
export const RemediRaShieldIcon = () => (
  <svg
    width="34"
    height="36"
    viewBox="0 0 100 105"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      minWidth: "34px",
      width: "34px",
      height: "36px",
      display: "block",
    }}
  >
    <defs>
      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#34d399" />
      </linearGradient>
      <linearGradient id="shieldBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0b1220" />
      </linearGradient>
    </defs>

    {/* Outer Shield Boundary */}
    <path
      d="M50 5 L90 20 V58 C90 82 50 96 50 96 C50 96 10 82 10 58 V20 Z"
      fill="url(#shieldBg)"
      stroke="url(#shieldGrad)"
      strokeWidth="3.5"
    />

    {/* Multi-Agent Triad Nodes */}
    <circle cx="28" cy="34" r="6" fill="#60a5fa" />
    <circle cx="72" cy="34" r="6" fill="#38bdf8" />
    <circle cx="50" cy="78" r="6.5" fill="#34d399" />

    {/* Network Invariant Bridges */}
    <line
      x1="28"
      y1="34"
      x2="72"
      y2="34"
      stroke="#60a5fa"
      strokeWidth="2"
      strokeDasharray="3,3"
      opacity="0.8"
    />
    <line
      x1="28"
      y1="34"
      x2="50"
      y2="78"
      stroke="#60a5fa"
      strokeWidth="2"
      strokeDasharray="3,3"
      opacity="0.8"
    />
    <line
      x1="72"
      y1="34"
      x2="50"
      y2="78"
      stroke="#34d399"
      strokeWidth="2"
      strokeDasharray="3,3"
      opacity="0.8"
    />

    {/* Central Verification Pulse Vector */}
    <path
      d="M30 52 L42 52 L47 41 L53 63 L58 48 L62 52 L70 52"
      stroke="url(#shieldGrad)"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function NavBar({ onRefreshAll = null }) {
  const loc = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleRefreshAndClearCache = async () => {
    setRefreshing(true);
    try {
      try {
        sessionStorage.clear();
        localStorage.removeItem("remedira_cached_metrics");
        localStorage.removeItem("remedira_remediation_history");
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
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Logo, Name & Slogan */}
        <Link
          to="/"
          style={{ textDecoration: "none" }}
          className="flex items-center gap-3 shrink-0"
        >
          <RemediRaShieldIcon />

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 leading-none">
              <span className="text-base font-bold text-white tracking-tight">
                Remedi<span className="text-brand-accent">Ra</span>
              </span>
              <span
                style={{
                  fontSize: "9px",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  backgroundColor: "rgba(96, 165, 250, 0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
              >
                PRO
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginTop: "3px",
                whiteSpace: "nowrap",
                fontWeight: "500",
              }}
            >
              Autonomous Data Quality &amp; Contract Invariants
            </span>
          </div>
        </Link>

        {/* Action Controls */}
        <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Dashboard Link */}
          <Link
            to="/"
            style={{ textDecoration: "none" }}
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
                ? "bg-indigo-950 text-indigo-200 border-brand-accent/40 cursor-not-allowed animate-pulse"
                : "bg-brand-dark text-gray-200 border-brand-accent/30 hover:border-brand-accent hover:text-white"
            }`}
          >
            <svg
              width="13"
              height="13"
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
            <span className="hidden sm:inline">
              {refreshing ? "Refreshing…" : "Refresh All & Clean Caches"}
            </span>
            <span className="sm:hidden">{refreshing ? "..." : "Refresh"}</span>
          </button>

          {/* Open Final Report */}
          <Link
            to="/report"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
            title="Open comprehensive executive report in a new tab"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border cursor-pointer bg-brand-dark text-gray-200 border-brand-accent/30 hover:border-brand-accent hover:text-white"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400 shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="hidden sm:inline">Generate Final Report ↗</span>
            <span className="sm:hidden">Report ↗</span>
          </Link>

          {/* Help */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              console.info("Debug: NavBar help clicked");
            }}
            style={{ textDecoration: "none" }}
            className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition"
          >
            Help
          </a>
        </nav>
      </div>

      {/* Confirmation Toast */}
      {showToast && (
        <div className="absolute top-full right-6 mt-2 z-50 bg-emerald-950 border border-brand-accent/40 text-emerald-300 text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          All caches cleared &amp; metrics refreshed!
        </div>
      )}
    </header>
  );
}

NavBar.propTypes = {
  onRefreshAll: PropTypes.func,
};
