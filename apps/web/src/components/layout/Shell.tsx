import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useLogout } from '@project/sdk'
import { toggleTheme } from '@/lib/theme'
import { GlobalExplorerSidebar } from './GlobalExplorerSidebar'

export function Shell() {
  const logout = useLogout()
  const navigate = useNavigate()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  function handleToggleTheme() {
    toggleTheme()
    setIsDark(document.documentElement.classList.contains('dark'))
  }

  return (
    <div className="min-h-screen bg-background flex mx-auto max-w-7xl">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col shrink-0 border-r bg-surface overflow-hidden">
        <div className="shrink-0 border-b px-4 py-3">
          <Link
            to="/"
            className="inline-flex text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
          >
            AgentPress
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <GlobalExplorerSidebar />
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-1 border-t p-3">
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-h-screen overflow-auto max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
