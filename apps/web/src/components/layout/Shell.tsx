import { type Dispatch, type RefObject, type SetStateAction, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { LayoutGrid, LogOut, Moon, Sun } from 'lucide-react'
import { useLogout } from '@project/sdk'
import { cn } from '@/lib/utils'
import { toggleTheme } from '@/lib/theme'

export interface ShellChrome {
  customSidebar?: boolean
  mainClassName?: string
}

export interface ShellOutletContext {
  setChrome: Dispatch<SetStateAction<ShellChrome>>
  sidebarSlotRef: RefObject<HTMLDivElement>
}

const DEFAULT_CHROME: ShellChrome = {}

export function useShellChrome(chrome: ShellChrome) {
  const { setChrome } = useOutletContext<ShellOutletContext>()

  useLayoutEffect(() => {
    setChrome(chrome)
    return () => setChrome(DEFAULT_CHROME)
  }, [setChrome, chrome.customSidebar, chrome.mainClassName])
}

export function Shell() {
  const logout = useLogout()
  const navigate = useNavigate()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [chrome, setChrome] = useState<ShellChrome>(DEFAULT_CHROME)
  const sidebarSlotRef = useRef<HTMLDivElement>(null)
  const outletContext = useMemo(() => ({ setChrome, sidebarSlotRef }), [])
  const customSidebar = Boolean(chrome.customSidebar)

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
      <aside
        className={cn(
          'hidden md:flex w-60 flex-col shrink-0 border-r bg-surface overflow-hidden',
        )}
      >
        <div className="shrink-0 border-b px-4 py-3">
          <Link
            to="/"
            className="inline-flex text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
          >
            AgentPress
          </Link>
        </div>

        {customSidebar ? (
          <div ref={sidebarSlotRef} className="flex flex-col flex-1 min-h-0 overflow-hidden" />
        ) : (
          <div className="flex flex-col gap-1 p-3">
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
          </div>
        )}

        <div className={cn('mt-auto flex flex-col gap-1 p-3', customSidebar && 'border-t')}>
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
      <main className={cn('flex-1 min-h-screen overflow-auto max-w-7xl mx-auto', chrome.mainClassName)}>
        <Outlet context={outletContext} />
      </main>
    </div>
  )
}
