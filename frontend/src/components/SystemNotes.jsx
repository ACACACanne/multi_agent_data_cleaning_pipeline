// frontend/src/components/SystemNotes.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

/**
 * SystemNotes
 *
 * - Fetches notes from /api/system/notes.
 * - Supports optimistic creation + deletion.
 * - Fully Vite‑compatible (no process.env).
 * - Safely handles malformed backend responses.
 */

export default function SystemNotes({ autoLoad = true, maxNotes = 200 }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotes = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await client.get("/api/system/notes");

      const raw = res?.data;
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : [];

      setNotes(data.slice(0, maxNotes));
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to fetch notes.");
      setError(text);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    setError(null);

    const trimmed = (text || "").trim();
    if (!trimmed) {
      setError("Note cannot be empty.");
      return;
    }

    // Optimistic UI
    const temp = {
      id: `temp-${Date.now()}`,
      text: trimmed,
      created_at: new Date().toISOString(),
      saving: true,
    };

    setNotes((prev) => [temp, ...prev].slice(0, maxNotes));
    setText("");
    setSaving(true);

    try {
      const res = await client.post("/api/system/notes", { text: trimmed });
      const created = res?.data;

      setNotes((prev) => {
        if (created && created.id) {
          return [created, ...prev.filter((n) => n.id !== temp.id)].slice(
            0,
            maxNotes,
          );
        }

        // Backend returned no object → keep optimistic note but remove saving flag
        return prev.map((n) =>
          n.id === temp.id ? { ...n, saving: false } : n,
        );
      });
    } catch (err) {
      // Remove optimistic note
      setNotes((prev) => prev.filter((n) => n.id !== temp.id));
      const { text } = extractErrorMessage(err, "Failed to save note.");
      setError(text);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!id) return;

    setError(null);

    const previous = notes;
    setNotes((n) => n.filter((x) => x.id !== id));

    try {
      await client.delete(`/api/system/notes/${encodeURIComponent(id)}`);
    } catch (err) {
      // Roll back
      setNotes(previous);
      const { text } = extractErrorMessage(err, "Failed to delete note.");
      setError(text);
    }
  };

  useEffect(() => {
    if (autoLoad) fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <div className="bg-brand-light p-6 rounded-xl shadow-lg border border-brand-accent/20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-brand-accent">System Notes</h2>

        <div className="flex items-center gap-2">
          {loading && <span className="text-gray-400 text-sm">Loading…</span>}
          <button
            onClick={fetchNotes}
            disabled={loading}
            className="px-3 py-1 rounded-md bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition"
            title="Refresh notes"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      <div className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          className="w-full h-24 p-3 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20"
          placeholder="Add a note about experiments, agents, or metrics..."
        />

        <div className="flex gap-2">
          <button
            onClick={addNote}
            disabled={saving}
            className={`py-2 px-4 rounded-lg font-semibold transition ${
              saving
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-brand-accent text-black hover:bg-blue-300"
            }`}
          >
            {saving ? "Saving…" : "Add Note"}
          </button>

          <button
            onClick={() => {
              setText("");
              setError(null);
            }}
            className="py-2 px-4 rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/20 hover:border-brand-accent transition"
          >
            Clear
          </button>
        </div>

        <div className="bg-brand-dark p-4 rounded-lg border border-brand-accent/10 space-y-2 max-h-64 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No notes yet.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n.id ?? `${n.created_at}-${Math.random()}`}
                className="p-2 rounded-md bg-brand-light/20 border border-brand-accent/10 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">
                    {n.text ?? String(n)}
                  </p>

                  <div className="text-xs text-gray-400 mt-1">
                    {n.created_at
                      ? new Date(n.created_at).toLocaleString()
                      : "unknown"}
                    {n.saving ? " • saving…" : ""}
                  </div>
                </div>

                <button
                  onClick={() => deleteNote(n.id)}
                  disabled={n.saving}
                  className="px-2 py-1 rounded-md bg-red-500 text-black font-semibold hover:bg-red-400 transition shrink-0"
                  title="Delete note"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

SystemNotes.propTypes = {
  autoLoad: PropTypes.bool,
  maxNotes: PropTypes.number,
};
