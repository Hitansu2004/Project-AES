/**
 * AES Customer Portal — API Gateway
 *
 * Centralized HTTP client for all backend communication. Handles:
 *  - Bearer token injection from localStorage
 *  - Automatic 401 → /auth/refresh retry (single attempt, then sign-out)
 *  - Backend error envelope unwrapping
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const TOKEN_KEY = 'aes_token';
const REFRESH_KEY = 'aes_refresh_token';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let refreshInFlight = null;
let onAuthFail = null;

export function setAuthFailureHandler(fn) { onAuthFail = fn; }

function readToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
function writeToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
function readRefresh() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}
function writeRefresh(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearAuthTokens() {
  writeToken(null);
  writeRefresh(null);
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = readRefresh();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) return null;
      const newAccess = json.data?.accessToken;
      if (newAccess) writeToken(newAccess);
      return newAccess || null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function rawRequest(endpoint, options = {}, attempt = 0) {
  const url = `${API_BASE}${endpoint}`;
  const token = readToken();

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

  const config = { ...options, headers };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (networkErr) {
    throw new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection.', 0);
  }

  // Try refresh on 401 once
  if (res.status === 401 && !options.skipAuth && attempt === 0) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return rawRequest(endpoint, options, attempt + 1);
    }
    clearAuthTokens();
    if (onAuthFail) onAuthFail();
    throw new ApiError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401);
  }

  let json;
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok || json?.success === false) {
    throw new ApiError(
      json?.error?.code || 'UNKNOWN_ERROR',
      json?.error?.message || `Request failed with status ${res.status}`,
      res.status
    );
  }

  return json?.data !== undefined ? json.data : json;
}

const request = (endpoint, options) => rawRequest(endpoint, options);

// ─── Auth ───────────────────────────────────────────────────
export const auth = {
  sendOtp: (phoneNumber) =>
    request('/auth/send-otp', { method: 'POST', body: { phoneNumber }, skipAuth: true }),

  verifyOtp: (phoneNumber, otp) =>
    request('/auth/verify-otp', { method: 'POST', body: { phoneNumber, otp }, skipAuth: true }),

  staffLogin: (phoneNumber, password) =>
    request('/auth/staff-login', { method: 'POST', body: { phoneNumber, password }, skipAuth: true }),

  refresh: (refreshToken) =>
    request('/auth/refresh', { method: 'POST', body: { refreshToken }, skipAuth: true }),

  logout: (refreshToken) =>
    request('/auth/logout', { method: 'POST', body: { refreshToken } }),
};

// ─── User / Profile ─────────────────────────────────────────
export const user = {
  getMe: () => request('/users/me'),
  updateMe: (data) => request('/users/me', { method: 'PUT', body: data }),
};

// ─── Properties ─────────────────────────────────────────────
export const properties = {
  list: () => request('/properties'),
  create: (data) => request('/properties', { method: 'POST', body: data }),
  get: (id) => request(`/properties/${id}`),
  update: (id, data) => request(`/properties/${id}`, { method: 'PUT', body: data }),
};

// ─── AC Units ───────────────────────────────────────────────
export const acUnits = {
  list: (propertyId) => request(`/properties/${propertyId}/ac-units`),
  create: (propertyId, data) =>
    request(`/properties/${propertyId}/ac-units`, { method: 'POST', body: data }),
  update: (acUnitId, data) =>
    request(`/ac-units/${acUnitId}`, { method: 'PUT', body: data }),
};

// ─── Installation Requests ──────────────────────────────────
export const installations = {
  create: (data) => request('/installation-requests', { method: 'POST', body: data }),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/installation-requests${query ? `?${query}` : ''}`);
  },
  get: (id) => request(`/installation-requests/${id}`),
};

// ─── Service Tickets ────────────────────────────────────────
export const tickets = {
  create: (data) => request('/service-tickets', { method: 'POST', body: data }),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/service-tickets${query ? `?${query}` : ''}`);
  },
  get: (ticketNumber) => request(`/service-tickets/${ticketNumber}`),
  getSlaStatus: (ticketNumber) => request(`/service-tickets/${ticketNumber}/sla-status`),
};

// ─── Ticket Actions ─────────────────────────────────────────
export const ticketActions = {
  acknowledge: (ticketNumber) =>
    request(`/service-tickets/${ticketNumber}/acknowledge`, { method: 'POST' }),
  assignEngineer: (ticketNumber, data) =>
    request(`/service-tickets/${ticketNumber}/assign-engineer`, { method: 'POST', body: data }),
  escalate: (ticketNumber, data) =>
    request(`/service-tickets/${ticketNumber}/escalate`, { method: 'POST', body: data }),
  resolve: (ticketNumber, data) =>
    request(`/service-tickets/${ticketNumber}/resolve`, { method: 'POST', body: data }),
  rate: (ticketNumber, data) =>
    request(`/service-tickets/${ticketNumber}/rate`, { method: 'POST', body: data }),
};

// ─── AMC ────────────────────────────────────────────────────
export const amc = {
  myContracts: () => request('/amc/my-contracts'),
  getContract: (id) => request(`/amc/contracts/${id}`),
  scheduleVisit: (visitId, data) =>
    request(`/amc/visits/${visitId}/schedule`, { method: 'POST', body: data }),
};

// ─── Dashboard ──────────────────────────────────────────────
export const dashboard = {
  customer: () => request('/dashboard/customer'),
  crm: () => request('/dashboard/crm'),
  escalation: () => request('/dashboard/escalation'),
};

// ─── Notifications ──────────────────────────────────────────
export const notifications = {
  list: (limit = 50) => request(`/notifications?limit=${limit}`),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
};
