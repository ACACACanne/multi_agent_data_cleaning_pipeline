// frontend/src/components/UploadPanel.jsx
import React, { useState } from "react";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

/**
 * UploadPanel
 *
 * - Accepts JSON or CSV files.
 * - Shows upload progress, errors, and success callback.
 * - Uses centralized Vite env vars for API base + key.
 */

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    setError(null);
    setProgress(0);

    const selected = e.target.files[0];
    if (!selected) return;

    const name = selected.name.toLowerCase();
    if (!name.endsWith(".json") && !name.endsWith(".csv")) {
      setError("Only JSON or CSV files are allowed.");
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file); // must match backend field name

      const response = await client.post("/api/upload", formData, {
        // Do NOT set Content-Type manually when sending FormData.
        onUploadProgress: (evt) => {
          if (evt.total) {
            const percent = Math.round((evt.loaded * 100) / evt.total);
            setProgress(percent);
          }
        },
        headers: {
          // Let axios set the correct Content-Type for FormData
        },
      });

      if (response.status === 200 || response.status === 201) {
        setFile(null);
        setProgress(0);
        onUploaded?.(response.data);
      } else {
        setError(`Upload failed: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      const { text } = extractErrorMessage(err, "Upload failed.");
      setError(text);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <h2 className="text-2xl font-bold mb-4 text-brand-accent">
        Upload Dataset
      </h2>

      <div className="space-y-4">
        <input
          type="file"
          accept=".json,.csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-300
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-brand-accent file:text-black
                     hover:file:bg-blue-300 cursor-pointer"
        />

        {file && (
          <p className="text-sm text-gray-400">
            Selected: <span className="text-brand-accent">{file.name}</span>
          </p>
        )}

        {progress > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-2 bg-brand-accent transition-all"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`w-full py-2 rounded-lg font-semibold transition
            ${
              uploading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-brand-accent text-black hover:bg-blue-300"
            }`}
        >
          {uploading ? `Uploading… ${progress}%` : "Upload"}
        </button>
      </div>
    </div>
  );
}
