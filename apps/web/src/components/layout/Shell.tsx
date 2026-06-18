import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, LogOut, Moon, Sun } from 'lucide-react'
import { useLogout } from '@project/sdk'
import { cn } from '@/lib/utils'
import { toggleTheme } from '@/lib/theme'
import { useState } from 'react'

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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r bg-surface py-4 px-3 gap-1">
        <div className="px-3 pb-4 mb-2 border-b">
          <span className="text-sm font-semibold tracking-tight text-foreground">AgentPress</span>
        </div>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )
          }
        >
          <LayoutGrid size={15} />
          Accounts
        </NavLink>

        <div className="mt-auto flex flex-col gap-1">
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
