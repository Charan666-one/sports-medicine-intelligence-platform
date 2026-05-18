/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEXUS — Sports Medicine & Anti-Doping Intelligence Platform
 * Enterprise API Client Layer
 *
 * @file    src/lib/api.ts
 * @module  ApiClient
 *
 * ARCHITECTURE:
 *   • Single ApiClient class with typed HTTP primitives (GET, POST, PATCH, DELETE)
 *   • Centralised error handling and JSON parsing
 *   • Dual-envelope normaliser — transparently handles BOTH backend conventions:
 *       Legacy:  { status: 'success', data: ... }
 *       Current: { success: true,     data: ... }
 *   • Domain-scoped API modules exported as singletons
 *   • Zero direct Prisma / schema references — pure HTTP consumer
 *   • Supports multipart/form-data for file uploads
 *   • Future-safe: extend ApiClient for auth headers, retry logic, or interceptors
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared Response Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical response envelope used throughout this client.
 * Every response — regardless of which backend convention produced it —
 * is normalised into this shape before it reaches any caller.
 */
export interface ApiResponse<T = unknown> {
  /** Always present after normalisation. True on 2xx, false on error. */
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    generatedAt?: string;
    module?: string;
    [key: string]: unknown;
  };
}

/**
 * Raw wire shape that may arrive from the backend.
 *
 * Two conventions exist in this codebase:
 *   A) Current controllers  → { success: boolean, data, message, meta }
 *   B) Legacy controllers   → { status: 'success'|'error', data, message }
 *
 * `RawEnvelope` captures both without assumptions so `normaliseEnvelope`
 * can bridge them safely.
 */
type RawEnvelope<T> = {
  // Convention A
  success?: boolean;
  // Convention B
  status?: string;
  // Shared fields
  data?: T;
  message?: string;
  error?: string;
  meta?: Record<string, unknown>;
  // Forward-compatible catch-all
  [key: string]: unknown;
};

/**
 * Normalises any raw backend envelope into the canonical `ApiResponse<T>`.
 *
 * Resolution order for `success`:
 *   1. If `raw.success` is a boolean  → use it directly         (Convention A)
 *   2. If `raw.status` is a string    → truthy when === 'success' (Convention B)
 *   3. Fallback                       → true  (HTTP 2xx already confirmed by caller)
 *
 * Resolution order for `data`:
 *   1. `raw.data` if present
 *   2. Entire raw object as data (some older endpoints return the resource directly)
 */
function normaliseEnvelope<T>(raw: RawEnvelope<T>): ApiResponse<T> {
  // ── Determine success flag ──────────────────────────────────────────────
  let success: boolean;

  if (typeof raw.success === 'boolean') {
    success = raw.success;                        // Convention A
  } else if (typeof raw.status === 'string') {
    success = raw.status === 'success';           // Convention B
  } else {
    success = true;                               // HTTP 2xx confirmed upstream
  }

  // ── Extract data ────────────────────────────────────────────────────────
  // If the response has an explicit `data` key, use it.
  // Otherwise treat the whole object as the payload (bare-resource responses).
  const data: T | undefined =
    'data' in raw ? (raw.data as T) : (raw as unknown as T);

  return {
    success,
    data,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    error:   typeof raw.error   === 'string' ? raw.error   : undefined,
    meta:    raw.meta,
  };
}

/** Generic pagination descriptor included in list endpoints. */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-Doping Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface AntiDopingOverviewSummary {
  totalAthletes: number;
  flaggedAthletes: number;
  totalReports: number;
  flaggedReports: number;
  anomalyCount: number;
  auditStatus: 'NOMINAL' | 'MONITORING' | 'ELEVATED' | 'CRITICAL' | string;
}

export interface AntiDopingIntelligenceMetrics {
  complianceRate: number;
  avgRiskScore: number;
  modelVersion: string;
  lastSyncedAt: string;
  activeSurveillanceNodes: number;
}

export interface AntiDopingOverviewData {
  summary: AntiDopingOverviewSummary;
  intelligenceMetrics: AntiDopingIntelligenceMetrics;
}

export interface AnomalyRecord {
  athleteId: string;
  athleteName: string;
  sport: string | null;
  anomalyScore: number;
  riskCategory: RiskCategory;
  biomarkerInstability: number;
  flaggedMarkers: string[];
  detectedAt: string;
  passportId: string;
}

export interface AnomalyFilters {
  riskCategory?: RiskCategory;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}

export interface AnomalyRiskDistribution {
  LOW: number;
  MODERATE: number;
  HIGH: number;
  CRITICAL: number;
}

export interface AnomaliesData {
  anomalies: AnomalyRecord[];
  riskDistribution: AnomalyRiskDistribution;
  pagination: PaginationMeta;
}

export type AuditScope = 'all' | 'flagged' | 'new';
export type AuditStatus = 'QUEUED' | 'RUNNING' | 'COMPLETE' | 'FAILED';

export interface AuditJobResult {
  jobId: string;
  status: AuditStatus;
  scope: AuditScope;
  athletesProcessed: number;
  anomaliesFound: number;
  estimatedMs: number;
  startedAt: string;
}

export interface RunAuditPayload {
  scope?: AuditScope;
  notify?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Athlete Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Athlete {
  id: string;
  name: string;
  sport: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  riskScore?: number | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown; // forward-compatible with schema additions
}

export interface AthleteListData {
  athletes: Athlete[];
  pagination?: PaginationMeta;
}

export interface RiskRecalculationResult {
  athleteId: string;
  previousScore?: number | null;
  newScore: number;
  recalculatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicalReport {
  id: string;
  athleteId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown; // forward-compatible with schema additions
}

export interface ReportListData {
  reports: MedicalReport[];
  pagination?: PaginationMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  athleteId?: string;
  message: string;
  severity?: string;
  resolved: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface AlertListData {
  alerts: Alert[];
  pagination?: PaginationMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiError — typed runtime error surfaced to callers
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;
  public readonly serverMessage?: string;

  constructor(params: {
    message: string;
    status: number;
    endpoint: string;
    serverMessage?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.endpoint = params.endpoint;
    this.serverMessage = params.serverMessage;

    // Maintains proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiClient — Core HTTP Primitive
// ─────────────────────────────────────────────────────────────────────────────

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
  }

  // ── Internal fetch wrapper ──────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      body?: unknown;
      formData?: FormData;
      query?: Record<string, string | number | boolean | undefined | null>;
    } = {},
  ): Promise<ApiResponse<T>> {
    const url = new URL(
      `${this.baseUrl}${path}`,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );

    // Append query parameters — skip nullish values
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    let fetchBody: BodyInit | undefined;

    if (options.formData) {
      // Let the browser set Content-Type + boundary automatically for multipart
      fetchBody = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(options.body);
    }

    let response: Response;

    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: fetchBody,
      });
    } catch (networkError) {
      throw new ApiError({
        message: `Network error — unable to reach ${path}`,
        status: 0,
        endpoint: path,
        serverMessage: (networkError as Error).message,
      });
    }

    // Parse JSON body regardless of status code so we can surface server errors
    let raw: RawEnvelope<T>;
    try {
      raw = (await response.json()) as RawEnvelope<T>;
    } catch {
      throw new ApiError({
        message: `Invalid JSON response from ${path} (HTTP ${response.status})`,
        status: response.status,
        endpoint: path,
      });
    }

    // Non-2xx: surface the server's error message before normalising
    if (!response.ok) {
      throw new ApiError({
        message:
          (typeof raw.error   === 'string' ? raw.error   : undefined) ??
          (typeof raw.message === 'string' ? raw.message : undefined) ??
          `Request failed with HTTP ${response.status}`,
        status: response.status,
        endpoint: path,
        serverMessage: typeof raw.message === 'string' ? raw.message : undefined,
      });
    }

    // Normalise BOTH backend envelope conventions into a single canonical shape
    return normaliseEnvelope<T>(raw);
  }

  // ── Public HTTP primitives ──────────────────────────────────────────────

  async get<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, { query });
  }

  async post<T>(
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { body });
  }

  async postForm<T>(
    path: string,
    formData: FormData,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { formData });
  }

  async patch<T>(
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { body });
  }

  async delete<T>(
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, { body });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared singleton client — all domain modules share this instance
// ─────────────────────────────────────────────────────────────────────────────

const client = new ApiClient('/api/v1');

// ─────────────────────────────────────────────────────────────────────────────
// Anti-Doping API Module
// ─────────────────────────────────────────────────────────────────────────────

export const antiDopingAPI = {
  /**
   * GET /api/v1/anti-doping/overview
   * Retrieves the dashboard intelligence summary.
   */
  getOverview(): Promise<ApiResponse<AntiDopingOverviewData>> {
    return client.get<AntiDopingOverviewData>('/anti-doping/overview');
  },

  /**
   * GET /api/v1/anti-doping/anomalies
   * Returns the paginated suspicious-athlete anomaly feed.
   * All filter fields are optional.
   */
  getAnomalies(
    filters: AnomalyFilters = {},
  ): Promise<ApiResponse<AnomaliesData>> {
    return client.get<AnomaliesData>('/anti-doping/anomalies', {
      riskCategory: filters.riskCategory,
      limit:        filters.limit,
      offset:       filters.offset,
      from:         filters.from,
      to:           filters.to,
    });
  },

  /**
   * POST /api/v1/anti-doping/run-audit
   * Triggers an enterprise-wide anti-doping recalculation.
   * Returns 202 Accepted immediately; processing is async.
   */
  runGlobalAudit(
    payload: RunAuditPayload = {},
  ): Promise<ApiResponse<AuditJobResult>> {
    return client.post<AuditJobResult>('/anti-doping/run-audit', payload);
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Athlete API Module
// ─────────────────────────────────────────────────────────────────────────────

export const athleteAPI = {
  /**
   * GET /api/v1/athletes
   * Returns the full monitored athlete roster.
   */
  getAll(): Promise<ApiResponse<AthleteListData>> {
    return client.get<AthleteListData>('/athletes');
  },

  /**
   * GET /api/v1/athletes/:id
   * Returns full profile for a single athlete.
   */
  getById(id: string): Promise<ApiResponse<Athlete>> {
    return client.get<Athlete>(`/athletes/${encodeURIComponent(id)}`);
  },

  /**
   * POST /api/v1/athletes/:id/recalculate-risk
   * Triggers a risk score recalculation for a single athlete.
   */
  recalculateRisk(id: string): Promise<ApiResponse<RiskRecalculationResult>> {
    return client.post<RiskRecalculationResult>(
      `/athletes/${encodeURIComponent(id)}/recalculate-risk`,
    );
  },

  /**
   * POST /api/v1/athletes/recalculate-all
   * Triggers a platform-wide risk score recalculation for all athletes.
   */
  recalculateAll(): Promise<ApiResponse<{ processed: number; updatedAt: string }>> {
    return client.post<{ processed: number; updatedAt: string }>(
      '/athletes/recalculate-all',
    );
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Report API Module
// ─────────────────────────────────────────────────────────────────────────────

export const reportAPI = {
  /**
   * GET /api/v1/reports
   * Returns all medical reports across the platform.
   */
  getAll(): Promise<ApiResponse<ReportListData>> {
    return client.get<ReportListData>('/reports');
  },

  /**
   * GET /api/v1/reports/:id
   * Returns a single medical report by ID.
   */
  getById(id: string): Promise<ApiResponse<MedicalReport>> {
    return client.get<MedicalReport>(`/reports/${encodeURIComponent(id)}`);
  },

  /**
   * POST /api/v1/reports/upload
   * Uploads a new report. Accepts multipart/form-data.
   * The caller constructs and populates the FormData object.
   */
  uploadReport(formData: FormData): Promise<ApiResponse<MedicalReport>> {
    return client.postForm<MedicalReport>('/reports/upload', formData);
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Alert API Module
// ─────────────────────────────────────────────────────────────────────────────

export const alertAPI = {
  /**
   * GET /api/v1/alerts
   * Returns all platform alerts (resolved and unresolved).
   */
  getAll(): Promise<ApiResponse<AlertListData>> {
    return client.get<AlertListData>('/alerts');
  },

  /**
   * PATCH /api/v1/alerts/:id/resolve
   * Marks a single alert as resolved.
   */
  resolve(id: string): Promise<ApiResponse<Alert>> {
    return client.patch<Alert>(`/alerts/${encodeURIComponent(id)}/resolve`);
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Re-export ApiClient for projects that need custom instances (e.g. testing)
// ─────────────────────────────────────────────────────────────────────────────

export { ApiClient };

// ─────────────────────────────────────────────────────────────────────────────
// Default export — the shared singleton for the most common import pattern:
//   import api from '@/lib/api'
//   api.antiDoping.getOverview()
// ─────────────────────────────────────────────────────────────────────────────

const api = {
  // ─────────────────────────────────────────
  // LEGACY COMPATIBILITY LAYER
  // Restores support for:
  // api.get(...)
  // api.post(...)
  // api.patch(...)
  // api.delete(...)
  // ─────────────────────────────────────────

  get: client.get.bind(client),
  post: client.post.bind(client),
  patch: client.patch.bind(client),
  delete: client.delete.bind(client),

  // ─────────────────────────────────────────
  // ENTERPRISE DOMAIN MODULES
  // ─────────────────────────────────────────

  antiDoping: antiDopingAPI,
  athlete: athleteAPI,
  report: reportAPI,
  alert: alertAPI,
} as const;

export { api };
export default api;