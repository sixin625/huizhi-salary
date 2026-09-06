import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth'

const THEMES = ['paper', 'obsidian'] as const
type Theme = (typeof THEMES)[number]

function readTheme(): Theme {
  const q = new URLSearchParams(window.location.search).get('theme')
  if (q === 'paper' || q === 'obsidian') return q
  const saved = localStorage.getItem('salary-theme')
  if (saved === 'paper' || saved === 'obsidian') return saved
  return 'paper'
}

function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('salary-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'paper' ? 'obsidian' : 'paper'))

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
      {/* 临时对比开关：选定方案后可移除 */}
      <button
        type="button"
        onClick={toggleTheme}
        title="切换视觉方案（A 白纸 / B 暗场）"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-lg transition-transform hover:scale-105"
      >
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ background: 'var(--primary)' }}
        />
        {theme === 'paper' ? '方案 A · 白纸' : '方案 B · 暗场'}
      </button>
    </>
  )
}

export default App
