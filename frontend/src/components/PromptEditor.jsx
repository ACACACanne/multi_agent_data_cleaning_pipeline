// frontend/src/components/PromptEditor.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

/**
 * PromptEditor
 *
 * - Loads and saves the system/agent prompt.
 * - Uses centralized base URL + optional API key from Vite env vars.
 * - Accepts either { prompt: "..." } or plain string from backend.
 * - Shows loading, saving, saved indicator, and errors.
 */

export default function PromptEditor({ autoLoad = true }) {
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const loadPrompt = async () => {
    setError(null);
    setLoading(true);
    setSaved(false);

    try {
      const res = await client.get("/api/prompt");

      const p =
        res?.data?.prompt ?? (typeof res?.data === "string" ? res.data : "");

      setPrompt(p || "");
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to load prompt.");
      setError(text);
      setPrompt("");
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    setError(null);
    setSaved(false);

    if (!prompt.trim()) {
      setError("Prompt cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      await client.post("/api/prompt/update", { prompt });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to save prompt.");
      setError(text);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (autoLoad) loadPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-brand-accent">Prompt Editor</h2>

        <div className="flex items-center gap-3">
          {loading && <span className="text-gray-400 text-sm">Loading…</span>}
          {saved && <span className="text-green-400 text-sm">Saved</span>}
        </div>
      </div>

      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSaved(false);
            setError(null);
          }}
          className="w-full h-40 p-3 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20"
          placeholder="Edit system or agent prompt here..."
        />

        {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={savePrompt}
            disabled={saving}
            className={`py-2 px-4 rounded-lg font-semibold transition ${
              saving
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-brand-accent text-black hover:bg-blue-300"
            }`}
          >
            {saving ? "Saving…" : "Save Prompt"}
          </button>

          <button
            onClick={loadPrompt}
            disabled={loading}
            className="py-2 px-4 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

PromptEditor.propTypes = {
  autoLoad: PropTypes.bool,
};
