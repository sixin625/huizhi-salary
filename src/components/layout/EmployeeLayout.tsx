import { type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import {
  ReceiptTextIcon,
  UserIcon,
  LogOutIcon,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const employeeNavItems: NavItem[] = [
  { to: '/employee/payslip', label: '我的工资条', icon: ReceiptTextIcon },
  { to: '/employee/profile', label: '个人信息', icon: UserIcon },
]

export default function EmployeeLayout() {
  const { employee, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white/80 backdrop-blur-[20px] backdrop-saturate-[180%] border border-border rounded-xl m-3 mb-0 flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            喙
          </div>
          <span className="text-sm font-semibold text-foreground hidden sm:inline">
            喙语薪资管理
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {employeeNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {employee?.name || '员工'}
          </span>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOutIcon className="size-4" />
            <span className="sr-only">退出登录</span>
          </Button>
        </div>
      </header>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto m-3">
        <Outlet />
      </main>
    </div>
  )
}
