const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/metrics'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return response.json()
}

export const api = {
  history: (limit = 500) => request(`/api/metrics/history?limit=${limit}`),
  current: () => request('/api/metrics/current'),
  system: () => request('/api/system'),
  alerts: () => request('/api/alerts?limit=100'),
  settings: () => request('/api/settings'),
  updateSettings: (settings) =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
}

export function isNoMetricsError(error) {
  return error?.status === 503
}
