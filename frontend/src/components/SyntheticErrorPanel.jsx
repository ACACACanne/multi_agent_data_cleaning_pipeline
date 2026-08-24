// frontend/src/components/SyntheticErrorPanel.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

/**
 * SyntheticErrorPanel
 *
 * - Uses centralized base URL + optional API key from Vite env vars.
 * - Validates config JSON client-side before sending.
 * - Calls POST /api/synthetic/generate and GET /api/synthetic/errors.
 * - Shows loading, error, and results; surfaces readable error messages.
 */

export default function SyntheticErrorPanel({ initialConfig = "" }) {
  const [config, setConfig] = useState(initialConfig);
  const [errors, setErrors] = useState(null);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const generateErrors = async () => {
    setErrorMsg(null);
    setErrors(null);

    // Validate JSON config if provided
    let parsedConfig = null;
    if (config && config.trim() !== "") {
      try {
        parsedConfig = JSON.parse(config);
      } catch {
        setErrorMsg("Config JSON is invalid. Fix JSON syntax and try again.");
        return;
      }
    }

    try {
      setLoadingGenerate(true);

      const payload = parsedConfig !== null ? { config: parsedConfig } : {};
      const res = await client.post("/api/synthetic/generate", payload);

      setErrors(res.data ?? { message: "No synthetic errors returned" });
    } catch (err) {
      const { text } = extractErrorMessage(
        err,
        "Failed to generate synthetic errors.",
      );
      setErrorMsg(text);
    } finally {
      setLoadingGenerate(false);
    }
  };

  const fetchErrors = async () => {
    setErrorMsg(null);
    setErrors(null);

    try {
      setLoadingFetch(true);

      const res = await client.get("/api/synthetic/errors");
      setErrors(res.data ?? []);
    } catch (err) {
      const { text } = extractErrorMessage(
        err,
        "Failed to fetch synthetic errors.",
      );
      setErrorMsg(text);
    } finally {
      setLoadingFetch(false);
    }
  };

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <h2 className="text-2xl font-bold mb-4 text-brand-accent">
        Synthetic Errors
      </h2>

      <div className="space-y-4">
        <textarea
          value={config}
          onChange={(e) => {
            setConfig(e.target.value);
            setErrorMsg(null);
          }}
          className="w-full h-32 p-3 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20"
          placeholder='Optional JSON config, e.g. {"type":"missing_values","rate":0.05}'
        />

        {errorMsg && (
          <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateErrors}
            disabled={loadingGenerate}
            className="px-4 py-2 rounded-lg bg-brand-accent text-black font-semibold hover:bg-blue-300 transition"
            title="Generate synthetic errors based on config"
          >
            {loadingGenerate ? "Generating…" : "Generate Errors"}
          </button>

          <button
            onClick={fetchErrors}
            disabled={loadingFetch}
            className="px-4 py-2 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/30 hover:border-brand-accent transition"
            title="Load existing synthetic errors"
          >
            {loadingFetch ? "Loading…" : "Load Existing Errors"}
          </button>
        </div>

        {errors && (
          <div className="mt-4 bg-brand-dark p-4 rounded-lg border border-brand-accent/10">
            <h3 className="text-lg font-semibold text-brand-accent mb-2">
              Synthetic Error Data
            </h3>
            <pre className="text-gray-300 text-sm whitespace-pre-wrap">
              {typeof errors === "string"
                ? errors
                : JSON.stringify(errors, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

SyntheticErrorPanel.propTypes = {
  initialConfig: PropTypes.string,
};
