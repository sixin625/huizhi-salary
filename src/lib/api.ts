import type { TemplateConfig } from '@/lib/salary-catalog'

// 生产环境（部署到 Railway/Render 等单服务主机）留空 → 同源相对路径；
// 本地开发通过 .env.local 的 VITE_API_URL=http://localhost:3001 指向后端。
const API_BASE = import.meta.env.VITE_API_URL || ''

function getToken(): string | null {
  return localStorage.getItem('token')
}

function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

/**
 * 底层 fetch 封装 — 自动附加 Bearer token 和 Content-Type。
 * 后端错误格式为 { error: '...' }，统一抛出 Error。
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || errorBody.message || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * 大部分 REST 端点将数据包装在 { data: ... } 中，
 * 此辅助函数自动解包。Auth 端点（login/me/logout）不使用此包装。
 */
async function apiFetchData<T>(path: string, options?: RequestInit): Promise<T> {
  const result = await apiFetch<{ data: T }>(path, options)
  return result.data
}

// ─── Auth API（不使用 { data } 包装）───

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () =>
    apiFetch<{ user: any }>('/api/auth/me'),
  logout: () =>
    apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
}

// ─── Employee API ───

export const employeeApi = {
  list: (params?: { search?: string; campus_id?: string; department_id?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return apiFetchData<any[]>(`/api/employees${query ? '?' + query : ''}`)
  },
  create: (data: any) =>
    apiFetchData<any>('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    apiFetchData<any>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    apiFetchData<any>(`/api/employees/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}

// ─── Campus / Department API ───

export const campusApi = {
  list: () => apiFetchData<any[]>('/api/campuses'),
}
export const departmentApi = {
  list: () => apiFetchData<any[]>('/api/departments'),
}

// ─── Salary API ───

export const salaryApi = {
  list: (yearMonth: string) =>
    apiFetchData<any[]>(`/api/salary/records?year_month=${yearMonth}`),
  getById: (id: string) =>
    apiFetchData<any>(`/api/salary/records/${id}`),
  save: (data: any) =>
    apiFetchData<any>('/api/salary/records', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    apiFetchData<any>(`/api/salary/records/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id: string) =>
    apiFetch<any>(`/api/salary/records/${id}`, { method: 'DELETE' }),
  getMyRecords: () =>
    apiFetchData<any[]>('/api/salary/my-records'),
  getMyRecord: (month: string) =>
    apiFetchData<any>(`/api/salary/my-records/${month}`),
}

// ─── Salary Template API ───

export const salaryTemplateApi = {
  get: (employeeId: string) =>
    apiFetchData<{ config: TemplateConfig } | null>(`/api/salary-templates/${employeeId}`),
  save: (employeeId: string, config: TemplateConfig) =>
    apiFetchData(`/api/salary-templates/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
}

// ─── Dashboard API ───

export const dashboardApi = {
  stats: () => apiFetchData<any>('/api/dashboard/stats'),
}

// ─── Token helpers（供 auth store 使用）───

export { getToken, setToken }
