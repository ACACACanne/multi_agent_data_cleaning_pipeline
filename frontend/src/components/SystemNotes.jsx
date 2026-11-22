// frontend/src/components/SystemNotes.jsx
import React, { useState, useEffect, useCallback } from "react";
import { client } from "../utils/apiClient";
import { extractErrorMessage } from "../utils/errorUtils";

function extractNoteText(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  return (
    item.text ?? item.content ?? item.message ?? item.note ?? item.body ?? ""
  );
}

function extractNoteTimestamp(item) {
  if (!item || typeof item !== "object") return "";
  const raw = item.timestamp || item.created_at || item.updated_at || "";
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? String(raw) : parsed.toLocaleString();
}

export default function SystemNotes() {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get("/api/notes");
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.notes || res.data?.items || [];
      setNotes(list);
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to load notes.");
      setError(text);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      await client.post("/api/notes", {
        text: trimmed,
        content: trimmed,
        note: trimmed,
      });
      setDraft("");
      await loadNotes();
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to save note.");
      setError(text);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (note, idx) => {
    setError(null);
    const id = note?.id ?? note?._id;
    try {
      if (id !== undefined && id !== null) {
        await client.delete(`/api/notes/${encodeURIComponent(String(id))}`);
        await loadNotes();
      } else {
        setNotes((prev) => prev.filter((_, i) => i !== idx));
      }
    } catch (err) {
      const { text } = extractErrorMessage(err, "Failed to delete note.");
      setError(text);
    }
  };

  return (
    <div className="bg-brand-light p-5 rounded-xl border border-brand-accent/20 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand-accent">System Notes</h3>
        <button
          type="button"
          onClick={loadNotes}
          disabled={loading}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-dark text-gray-200 border border-brand-accent/30 hover:border-brand-accent transition cursor-pointer disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <form onSubmit={handleAddNote} className="space-y-3">
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about experiments, agents, or metrics..."
          className="w-full rounded-lg bg-brand-dark border border-brand-accent/25 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-accent"
        />

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-accent text-black hover:bg-blue-300 transition cursor-pointer disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add Note"}
          </button>
          <button
            type="button"
            onClick={() => setDraft("")}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand-dark text-gray-300 border border-brand-accent/20 hover:border-brand-accent transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {notes.length === 0 ? (
          <div className="p-3 rounded-lg bg-brand-dark/60 border border-brand-accent/10 text-xs text-gray-400 italic">
            No notes yet.
          </div>
        ) : (
          notes.map((item, idx) => {
            const message = extractNoteText(item) || "-";
            const stamp = extractNoteTimestamp(item);
            return (
              <div
                key={item?.id ?? idx}
                className="p-3 rounded-lg bg-brand-dark/70 border border-brand-accent/15 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-gray-100 break-words">
                    {message}
                  </div>
                  {stamp && (
                    <div className="text-xs font-mono text-gray-400 mt-1">
                      {stamp}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(item, idx)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition shrink-0 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
