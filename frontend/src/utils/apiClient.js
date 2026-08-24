// frontend/src/utils/apiClient.js
/**
 * Centralized axios client for the frontend.
 *
 * - Reads Vite env vars VITE_API_BASE and VITE_API_KEY.
 * - Normalizes responses and errors into a consistent shape:
 *   { status, code, message, details }
 *
 * - Exports:
 *   - client: axios instance for direct requests
 *   - normalizeAxiosError: helper to convert axios errors into normalized shape
 *   - normalizeErrorPayload: helper to normalize arbitrary payloads
 */

import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: API_KEY ? { "X-API-Key": API_KEY } : {},
});

// Normalize backend error payloads into a consistent shape
function normalizeErrorPayload(payload, status) {
  if (!payload) {
    return {
      status: status || 0,
      code: undefined,
      message: "Unknown error",
      details: null,
    };
  }

  if (typeof payload === "string") {
    return {
      status: status || 0,
      code: undefined,
      message: payload,
      details: null,
    };
  }

  if (typeof payload === "object") {
    // If backend already uses the recommended contract
    if (payload.status || payload.code || payload.message) {
      return {
        status: payload.status || status || 0,
        code: payload.code,
        message: payload.message || payload.detail || JSON.stringify(payload),
        details: payload.details ?? payload,
      };
    }

    // Common patterns
    if (payload.detail || payload.message) {
      return {
        status: status || 0,
        code: undefined,
        message: payload.detail || payload.message,
        details: payload,
      };
    }

    // Fallback: stringify
    try {
      return {
        status: status || 0,
        code: undefined,
        message: JSON.stringify(payload),
        details: payload,
      };
    } catch {
      return {
        status: status || 0,
        code: undefined,
        message: "Unknown error",
        details: payload,
      };
    }
  }

  return {
    status: status || 0,
    code: undefined,
    message: "Unknown error",
    details: payload,
  };
}

// Convert axios error into normalized shape
function normalizeAxiosError(err) {
  if (!err) {
    return {
      status: 0,
      code: undefined,
      message: "Unknown error",
      details: null,
    };
  }

  // If server responded
  if (err.response) {
    const status = err.response.status;
    const payload = err.response.data;
    return normalizeErrorPayload(payload, status);
  }

  // Request made but no response
  if (err.request) {
    return {
      status: 0,
      code: "NO_RESPONSE",
      message:
        "No response from server. Please check your network or try again.",
      details: null,
    };
  }

  // Something else happened
  return {
    status: 0,
    code: "REQUEST_ERROR",
    message: err.message || "Request error",
    details: null,
  };
}

// Response interceptor: attach normalized error to the error object
client.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      error.normalized = normalizeAxiosError(error);
    } catch {
      error.normalized = {
        status: 0,
        code: "NORMALIZATION_ERROR",
        message: "Failed to normalize error",
        details: null,
      };
    }
    return Promise.reject(error);
  },
);

export { client, normalizeAxiosError, normalizeErrorPayload };
export default client;
