import { useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/auth'
import { BrandIcon } from '@/components/BrandIcon'
import { cn } from '@/lib/utils'
import {
  LayoutDashboardIcon,
  UsersIcon,
  CalculatorIcon,
  FileTextIcon,
  LogOutIcon,
  MenuIcon,
  KeyRoundIcon,
  SettingsIcon,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const adminNavItems: NavItem[] = [
  { to: '/admin/dashboard', label: '数据看板', icon: LayoutDashboardIcon },
  { to: '/admin/employees', label: '员工管理', icon: UsersIcon },
  { to: '/admin/salary/input', label: '薪资录入', icon: CalculatorIcon },
  { to: '/admin/salary/records', label: '薪资记录', icon: FileTextIcon },
  { to: '/admin/change-password', label: '修改密码', icon: KeyRoundIcon },
  { to: '/admin/account', label: '账号设置', icon: SettingsIcon },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {adminNavItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'nav-active bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { employee } = useAuthStore()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        {/* 品牌字标（全站唯一来源：BrandIcon） */}
        <BrandIcon size={36} radius={12} fontSize={15} />
        {/* 双行品牌排印：中文主标题 + 字距英文副标题 */}
        <div className="flex flex-col gap-[3px] leading-none">
          <span className="text-[14px] font-bold tracking-tight text-foreground">
            喙语薪资
          </span>
          <span className="text-[9px] font-semibold tracking-[0.22em] uppercase text-muted-foreground/70">
            Salary · 薪资
          </span>
        </div>
      </div>
      <div className="flex-1 pb-4 pt-2">
        <NavItems onNavigate={onNavigate} />
      </div>
      <div className="p-4 pt-6">
        <p className="text-xs text-muted-foreground truncate">
          {employee?.name || '未登录'}
        </p>
        <p className="text-xs text-muted-foreground/60 truncate">
          {employee?.email || ''}
        </p>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { employee, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0">
        <div className="m-0 h-screen overflow-y-auto anim-slide-left bg-[var(--tile)]">
          <SidebarContent />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="m-0 flex items-center justify-between rounded-none bg-transparent px-6 py-5 anim-fade-in">
          {/* Mobile menu trigger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={(open) => setMobileOpen(open)}>
              <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                <MenuIcon className="size-5" />
                <span className="sr-only">打开菜单</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">导航菜单</SheetTitle>
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-muted-foreground">
              {employee?.name || '管理员'}
            </span>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOutIcon className="size-4" />
              <span className="sr-only">退出登录</span>
            </Button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-6 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
