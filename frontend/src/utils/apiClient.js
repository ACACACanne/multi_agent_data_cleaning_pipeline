// frontend/src/utils/apiClient.js
/**
 * Centralized axios client for the frontend.
 *
 * - Reads Vite env var VITE_API_URL with sensible dev/prod fallbacks.
 * - Attaches runtime auth token if present in localStorage.
 * - Normalizes responses and errors into a consistent shape:
 *   { status, code, message, details }
 */

import axios from "axios";

const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://multi-agent-data-cleaning-pipeline.onrender.com"
    : "http://127.0.0.1:8000");

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  try {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("datara_auth_token");
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return config;
});

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
    if (payload.status || payload.code || payload.message) {
      return {
        status: payload.status || status || 0,
        code: payload.code,
        message: payload.message || payload.detail || JSON.stringify(payload),
        details: payload.details ?? payload,
      };
    }

    if (payload.detail) {
      const detailMsg = Array.isArray(payload.detail)
        ? payload.detail
            .map((d) =>
              typeof d === "string"
                ? d
                : `${Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "field"}: ${d.msg || "invalid input"}`,
            )
            .join(", ")
        : typeof payload.detail === "object"
          ? payload.detail.message ||
            payload.detail.msg ||
            JSON.stringify(payload.detail)
          : String(payload.detail);

      return {
        status: status || 0,
        code: undefined,
        message: detailMsg,
        details: payload,
      };
    }

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

function normalizeAxiosError(err) {
  if (!err) {
    return {
      status: 0,
      code: undefined,
      message: "Unknown error",
      details: null,
    };
  }

  if (err.response) {
    return normalizeErrorPayload(err.response.data, err.response.status);
  }

  if (err.request) {
    return {
      status: 0,
      code: "NO_RESPONSE",
      message:
        "No response from server. Please check your network or try again.",
      details: null,
    };
  }

  return {
    status: 0,
    code: "REQUEST_ERROR",
    message: err.message || "Request error",
    details: null,
  };
}

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
