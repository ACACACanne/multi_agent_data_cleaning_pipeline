// frontend/src/services/api.jsx
/**
 * Datara Pro API Service
 * Central HTTP client with endpoint routing, error formatting, and token handling.
 */

const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://multi-agent-data-cleaning-pipeline.onrender.com"
    : "http://localhost:8000");

function formatErrorDetail(detail) {
  if (!detail) return "Unknown server error";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item.loc)
          ? item.loc[item.loc.length - 1]
          : "field";
        return `${field}: ${item.msg || "invalid input"}`;
      })
      .join(", ");
  }
  if (typeof detail === "object") {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  return String(detail);
}

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const targetPath =
    cleanEndpoint.startsWith("/api/") || cleanEndpoint === "/api"
      ? cleanEndpoint
      : `/api${cleanEndpoint}`;

  const url = `${BASE}${targetPath}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const token =
    localStorage.getItem("token") || localStorage.getItem("datara_auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = { ...options, headers };

  try {
    const response = await fetch(url, config);

    if (response.status === 404 && targetPath.startsWith("/api/")) {
      const fallbackUrl = `${BASE}${cleanEndpoint}`;
      const fallbackResponse = await fetch(fallbackUrl, config);
      if (fallbackResponse.ok) {
        return await fallbackResponse.json();
      }
    }

    if (!response.ok) {
      let errorDetails = {};
      try {
        errorDetails = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        errorDetails = { detail: text || response.statusText };
      }

      const parsedMessage =
        formatErrorDetail(errorDetails.detail) ||
        errorDetails.message ||
        `Request to ${cleanEndpoint} failed with HTTP ${response.status}`;

      const error = new Error(parsedMessage);
      error.status = response.status;
      error.data = errorDetails;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(
      `[API Error] ${options.method || "GET"} ${url}:`,
      err.message || err,
    );
    throw err;
  }
}

// 1. Pipeline & Agent Operations
export const postRunAgents = (datasetIdOrPayload = {}, agents = []) => {
  let body;
  if (typeof datasetIdOrPayload === "object" && datasetIdOrPayload !== null) {
    body = datasetIdOrPayload;
  } else {
    body = {
      dataset_id: String(datasetIdOrPayload || "ds_001"),
      agents: Array.isArray(agents) && agents.length > 0 ? agents : ["cleaner"],
    };
  }
  return request("/agents/run", { method: "POST", body: JSON.stringify(body) });
};
export const runAgents = postRunAgents;
export const postRunAgent = postRunAgents;
export const runAgent = postRunAgents;
export const executeAgents = postRunAgents;

export const fetchAgentsMetrics = () => request("/metrics/agents");
export const fetchAgentMetrics = fetchAgentsMetrics;
export const getAgentMetrics = fetchAgentsMetrics;
export const fetchAgentsMetricsSummary = fetchAgentsMetrics;
export const fetchAgentMetricsSummary = fetchAgentsMetrics;

export const fetchAgentLogs = (params = {}) => {
  const queryParams =
    typeof params === "number" ? { limit: params } : params || {};
  const query = new URLSearchParams(queryParams).toString();
  return request(`/agents/logs${query ? `?${query}` : ""}`);
};
export const fetchRunLog = fetchAgentLogs;
export const fetchRunLogs = fetchAgentLogs;
export const fetchLogs = fetchAgentLogs;
export const getLogs = fetchAgentLogs;

export const fetchTrajectories = (datasetId) => {
  const targetId = datasetId && datasetId !== "all" ? datasetId : "";
  const query = targetId ? `?dataset_id=${encodeURIComponent(targetId)}` : "";
  return request(`/metrics/trajectories${query}`).catch(() =>
    request(`/agents/trajectories${query}`),
  );
};
export const fetchAgentTrajectories = fetchTrajectories;

// 2. Metrics & Telemetry
export const clearCacheAndRefreshAll = async () => {
  try {
    sessionStorage.clear();
    localStorage.removeItem("datara_cached_metrics");
    localStorage.removeItem("datara_remediation_history");
  } catch (storageErr) {
    console.warn("Client cache clearance notice:", storageErr);
  }

  try {
    return await request("/metrics/refresh", {
      method: "POST",
      body: JSON.stringify({ dataset_id: "all", clear_cache: true }),
    });
  } catch (err) {
    console.error("Backend global metrics refresh warning:", err);
    return { status: "partial", message: "Client cache cleared." };
  }
};
export const purgeCacheAndRefresh = clearCacheAndRefreshAll;
export const flushCacheAndRefresh = clearCacheAndRefreshAll;

export const fetchMetrics = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/metrics${query ? `?${query}` : ""}`);
};
export const getMetrics = fetchMetrics;
export const fetchMetricsSummary = () => request("/metrics/summary");
export const getMetricsSummary = fetchMetricsSummary;
export const fetchMetricsDatasets = () => request("/metrics/datasets");
export const getMetricsDatasets = fetchMetricsDatasets;

export const postRefreshMetrics = (datasetIdOrPayload) => {
  let body;
  if (typeof datasetIdOrPayload === "object" && datasetIdOrPayload !== null) {
    body = datasetIdOrPayload;
  } else {
    body = datasetIdOrPayload ? { dataset_id: String(datasetIdOrPayload) } : {};
  }
  return request("/metrics/refresh", {
    method: "POST",
    body: JSON.stringify(body),
  });
};
export const refreshMetrics = postRefreshMetrics;
export const recomputeMetrics = postRefreshMetrics;

export const fetchCleanerMetrics = (datasetId) => {
  const targetId = datasetId && datasetId !== "all" ? datasetId : "";
  const query = targetId ? `?dataset_id=${encodeURIComponent(targetId)}` : "";
  return request(`/cleaner/metrics${query}`).catch(() =>
    request(`/cleaner${query}`),
  );
};
export const getCleanerMetrics = fetchCleanerMetrics;

export const fetchManualMetrics = (datasetId) => {
  const targetId = datasetId && datasetId !== "all" ? datasetId : "";
  const query = targetId ? `?dataset_id=${encodeURIComponent(targetId)}` : "";
  return request(`/metrics/manual${query}`).catch(() =>
    request(`/cleaner/manual${query}`),
  );
};
export const getManualMetrics = fetchManualMetrics;
export const fetchManualFixMetrics = fetchManualMetrics;

export const fetchBaselineMetrics = () => request("/metrics/baseline");
export const getBaselineMetrics = fetchBaselineMetrics;

export const fetchRiskMetrics = (datasetId) =>
  request(`/metrics/risk${datasetId ? `?dataset_id=${datasetId}` : ""}`);
export const getRiskMetrics = fetchRiskMetrics;

export const fetchForecastMetrics = (datasetId) =>
  request(`/metrics/forecast${datasetId ? `?dataset_id=${datasetId}` : ""}`);
export const getForecastMetrics = fetchForecastMetrics;

export const fetchReasoningMetrics = (datasetId) =>
  request(`/metrics/reasoning${datasetId ? `?dataset_id=${datasetId}` : ""}`);
export const getReasoningMetrics = fetchReasoningMetrics;

// 3. Experiments & Evaluations
export const fetchExperiments = () => request("/experiments");
export const getExperiments = fetchExperiments;
export const postExperimentRun = (payload) =>
  request("/experiments/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const runExperiment = postExperimentRun;
export const postRunExperiment = postExperimentRun;

export const fetchEvaluations = (datasetId) => {
  const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : "";
  return request(`/evaluations${query}`);
};
export const getEvaluations = fetchEvaluations;
export const postEvaluationRun = (data) =>
  request("/evaluations", { method: "POST", body: JSON.stringify(data) });
export const createEvaluation = postEvaluationRun;

// 4. Datasets & Records
export const fetchDatasets = () => request("/datasets");
export const getDatasets = fetchDatasets;
export const fetchDatasetById = (id) => request(`/datasets/${id}`);
export const getDatasetById = fetchDatasetById;

export const updateDatasetFlags = (id, flags) =>
  request(`/datasets/${id}/flags`, {
    method: "PATCH",
    body: JSON.stringify(flags),
  });
export const patchDatasetFlags = updateDatasetFlags;

export const deleteDataset = (id) =>
  request(`/datasets/${id}`, { method: "DELETE" });

export const fetchDatasetSample = (datasetId, params = {}) => {
  const queryParams =
    typeof params === "number" ? { limit: params } : params || {};
  const query = new URLSearchParams(queryParams).toString();
  return request(`/datasets/${datasetId}/sample${query ? `?${query}` : ""}`);
};
export const getDatasetSample = fetchDatasetSample;

export const fetchDatasetRows = (datasetId, params = {}) => {
  const queryParams =
    typeof params === "number" ? { limit: params } : params || {};
  const query = new URLSearchParams(queryParams).toString();
  const targetId = datasetId && datasetId !== "all" ? datasetId : "";
  return request(`/records/${targetId}${query ? `?${query}` : ""}`).catch(() =>
    request(
      `/records${query ? `?dataset_id=${targetId}&${query}` : `?dataset_id=${targetId}`}`,
    ),
  );
};
export const getDatasetRows = fetchDatasetRows;

export const uploadDatasetFile = async (file, metadata = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  Object.keys(metadata).forEach((key) => formData.append(key, metadata[key]));
  return request("/upload", { method: "POST", body: formData });
};
export const uploadDataset = uploadDatasetFile;

// 5. Cleaner & Remediation Pipeline
export const runCleanerPipeline = (payload) =>
  request("/cleaner/run", { method: "POST", body: JSON.stringify(payload) });
export const postRunCleaner = runCleanerPipeline;
export const runCleaner = runCleanerPipeline;

export const fetchCleanerComparison = (datasetId) =>
  request(`/cleaner/compare/${datasetId}`);
export const getCleanerComparison = fetchCleanerComparison;

export const fetchRemediationHistory = (datasetId) => {
  const query =
    datasetId && datasetId !== "all" ? `?dataset_id=${datasetId}` : "";
  return request(`/remediation${query}`);
};

export const applyRemediation = (remediationId, action) =>
  request(`/remediation/${remediationId}/apply`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });

export const fetchFixSuggestions = (datasetId) => {
  const query =
    datasetId && datasetId !== "all" ? `?dataset_id=${datasetId}` : "";
  return request(`/cleaner/suggestions${query}`).catch(() =>
    request(`/remediation/suggestions${query}`),
  );
};
export const getFixSuggestions = fetchFixSuggestions;

// 6. Schema Drift & Synthetic Injection
export const fetchSchemaDrift = (datasetId) =>
  request(`/schema/drift${datasetId ? `?dataset_id=${datasetId}` : ""}`);
export const getSchemaDrift = fetchSchemaDrift;

export const injectSyntheticErrors = (datasetIdOrPayload, errorRate = 15) => {
  let body;
  if (typeof datasetIdOrPayload === "object" && datasetIdOrPayload !== null) {
    body = datasetIdOrPayload;
  } else {
    const rateNum = Number(errorRate) || 15;
    body = {
      dataset_id: datasetIdOrPayload,
      datasetId: datasetIdOrPayload,
      error_rate: rateNum,
      injected_rate: rateNum,
      pct: rateNum,
      percentage: rateNum,
      rate: rateNum,
    };
  }
  return request("/synthetic/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
};
export const generateSyntheticErrors = injectSyntheticErrors;

// 7. System Notes & Exports
export const fetchSystemNotes = () => request("/system/notes");
export const saveSystemNote = (note) =>
  request("/system/notes", { method: "POST", body: JSON.stringify(note) });
export const deleteSystemNote = (id) =>
  request(`/system/notes/${id}`, { method: "DELETE" });

export const exportDatasetFhir = (datasetId) =>
  request(`/export/fhir/${datasetId}`);
export const exportDatasetCsv = (datasetId) =>
  `${BASE}/api/export/csv/${datasetId}`;
export const exportDatasetJson = (datasetId) =>
  `${BASE}/api/export/json/${datasetId}`;
export const generateReport = (datasetId) =>
  request(`/export/report/${datasetId}`, { method: "POST" });

export default {
  postRunAgents,
  runAgents,
  fetchAgentsMetrics,
  fetchAgentLogs,
  fetchTrajectories,
  clearCacheAndRefreshAll,
  fetchMetrics,
  fetchMetricsSummary,
  fetchMetricsDatasets,
  postRefreshMetrics,
  fetchCleanerMetrics,
  fetchManualMetrics,
  fetchRiskMetrics,
  fetchForecastMetrics,
  fetchReasoningMetrics,
  fetchExperiments,
  postExperimentRun,
  fetchEvaluations,
  postEvaluationRun,
  fetchDatasets,
  updateDatasetFlags,
  deleteDataset,
  fetchDatasetSample,
  fetchDatasetRows,
  uploadDatasetFile,
  runCleanerPipeline,
  fetchCleanerComparison,
  fetchRemediationHistory,
  applyRemediation,
  fetchFixSuggestions,
  fetchSchemaDrift,
  injectSyntheticErrors,
  fetchSystemNotes,
  saveSystemNote,
  deleteSystemNote,
  exportDatasetFhir,
  exportDatasetCsv,
  exportDatasetJson,
  generateReport,
};
