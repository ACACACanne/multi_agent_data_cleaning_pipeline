// frontend/src/utils/errorUtils.js
/**
 * Error utilities for UI-friendly messages.
 *
 * - extractErrorMessage(err, fallback)
 *   Accepts:
 *     - axios error (with .normalized attached by apiClient)
 *     - normalized error object { status, code, message, details }
 *     - plain string
 *   Returns:
 *     - { text: string, structured: { status, code, message, details } }
 *
 * Use this helper in components to produce consistent inline alerts and toasts.
 */

import { normalizeAxiosError } from "./apiClient";

export function extractErrorMessage(err, fallback = "An error occurred.") {
  if (!err) {
    return {
      text: fallback,
      structured: {
        status: 0,
        code: undefined,
        message: fallback,
        details: null,
      },
    };
  }

  // If it's already a normalized object
  if (err && typeof err === "object" && "message" in err && "status" in err) {
    const structured = {
      status: err.status || 0,
      code: err.code,
      message: err.message || fallback,
      details: err.details ?? null,
    };
    return { text: String(structured.message), structured };
  }

  // If axios error with normalized attached
  if (err && err.normalized) {
    const s = err.normalized;
    return { text: String(s.message || fallback), structured: s };
  }

  // If axios error without normalized (fallback)
  if (err && err.response) {
    const s = normalizeAxiosError(err);
    return { text: String(s.message || fallback), structured: s };
  }

  // If plain string
  if (typeof err === "string") {
    return {
      text: err,
      structured: { status: 0, code: undefined, message: err, details: null },
    };
  }

  // Unknown object
  try {
    const text = JSON.stringify(err);
    return {
      text,
      structured: { status: 0, code: undefined, message: text, details: err },
    };
  } catch {
    return {
      text: fallback,
      structured: {
        status: 0,
        code: undefined,
        message: fallback,
        details: null,
      },
    };
  }
}
