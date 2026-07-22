import { create } from 'zustand'
import { authApi, getToken, setToken } from '@/lib/api'

interface Employee {
  id: string
  username: string
  name: string
  phone: string
  email: string | null
  campus_id: string | null
  department_id: string | null
  campus_name?: string | null
  department_name?: string | null
  hire_date: string
  base_salary: number | null
  status: string
  is_admin: boolean
}

interface AuthUser {
  id: string
  username: string
  name: string
  email: string | null
}

interface AuthState {
  user: AuthUser | null
  employee: Employee | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  employee: null,
  loading: true,

  signIn: async (username, password) => {
    try {
      // 后端登录返回 { token, user }，user 对象中同时包含用户和员工字段
      const { token, user } = await authApi.login(username, password)
      setToken(token)
      set({ user, employee: user as unknown as Employee, loading: false })
      return { error: null }
    } catch (e: any) {
      return { error: e.message || '登录失败，请检查用户名和密码' }
    }
  },

  signOut: async () => {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出错误（JWT 无服务端状态）
    }
    setToken(null)
    set({ user: null, employee: null })
  },

  initialize: async () => {
    const token = getToken()
    if (!token) {
      set({ user: null, employee: null, loading: false })
      return
    }
    try {
      // 后端 /api/auth/me 返回 { user }，user 对象包含全部员工字段
      const { user } = await authApi.me()
      set({ user, employee: user as unknown as Employee, loading: false })
    } catch {
      setToken(null)
      set({ user: null, employee: null, loading: false })
    }
  },

  // 后端 SQLite 中 is_admin 为 0/1，使用 Boolean() 兼容
  isAdmin: () => Boolean(get().employee?.is_admin),
}))
