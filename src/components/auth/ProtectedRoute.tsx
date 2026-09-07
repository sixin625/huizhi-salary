import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

interface ProtectedRouteProps {
  /** 系统已下线员工自助端，仅保留管理员入口 */
  role?: 'admin'
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg
              className="size-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>加载中...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'admin' && !isAdmin()) {
    // 员工自助端已下线：非管理员直接登出并回到登录页
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
