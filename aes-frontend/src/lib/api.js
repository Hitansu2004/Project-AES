/**
 * AES Customer Portal — API Gateway
 * Centralized HTTP client for all backend communication.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('aes_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An unexpected error occurred',
      res.status
    );
  }

  return data.data !== undefined ? data.data : data;
}

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

// ─── User ───────────────────────────────────────────────────
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
  list: () => request('/installation-requests'),
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
