import { type Dispatch, type RefObject, type SetStateAction, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { Compass, LogOut, Moon, PanelLeft, Sun } from 'lucide-react'
import { useLogout } from '@project/sdk'
import { cn } from '@/lib/utils'
import { toggleTheme } from '@/lib/theme'
import { GlobalExplorerSidebar } from './GlobalExplorerSidebar'

export interface ShellChrome {
  focusSidebar?: boolean
  mainClassName?: string
}

export interface ShellOutletContext {
  setChrome: Dispatch<SetStateAction<ShellChrome>>
  sidebarSlotRef: RefObject<HTMLDivElement>
}

const DEFAULT_CHROME: ShellChrome = {}

function useShellChrome(chrome: ShellChrome) {
  const { setChrome } = useOutletContext<ShellOutletContext>()

  useLayoutEffect(() => {
    setChrome(chrome)
    return () => setChrome(DEFAULT_CHROME)
  }, [setChrome, chrome.focusSidebar, chrome.mainClassName])
}

export function useFocusSidebar(chrome: Omit<ShellChrome, 'focusSidebar'> = {}) {
  useShellChrome({ ...chrome, focusSidebar: true })
}

export function Shell() {
  const logout = useLogout()
  const navigate = useNavigate()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [chrome, setChrome] = useState<ShellChrome>(DEFAULT_CHROME)
  const [sidebarMode, setSidebarMode] = useState<'explorer' | 'focus'>('explorer')
  const sidebarSlotRef = useRef<HTMLDivElement>(null)
  const outletContext = useMemo(() => ({ setChrome, sidebarSlotRef }), [])
  const focusAvailable = Boolean(chrome.focusSidebar)

  useLayoutEffect(() => {
    if (!focusAvailable) {
      setSidebarMode('explorer')
      return
    }
    const stored = sessionStorage.getItem('agentpress.sidebar.focus-mode')
    setSidebarMode(stored === 'explorer' ? 'explorer' : 'focus')
  }, [focusAvailable])

  function selectSidebarMode(mode: 'explorer' | 'focus') {
    setSidebarMode(mode)
    sessionStorage.setItem('agentpress.sidebar.focus-mode', mode)
  }

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

        {focusAvailable && (
          <div className="shrink-0 border-b p-2">
            <div className="grid grid-cols-2 rounded bg-muted/70 p-0.5">
              <button type="button" onClick={() => selectSidebarMode('explorer')} className={cn('flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-muted-foreground', sidebarMode === 'explorer' && 'bg-surface text-foreground shadow-sm')}>
                <Compass size={12} /> Explorer
              </button>
              <button type="button" onClick={() => selectSidebarMode('focus')} className={cn('flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-muted-foreground', sidebarMode === 'focus' && 'bg-surface text-foreground shadow-sm')}>
                <PanelLeft size={12} /> Current
              </button>
            </div>
          </div>
        )}

        <div className={cn('flex min-h-0 flex-1 flex-col', sidebarMode !== 'explorer' && 'hidden')}>
          <GlobalExplorerSidebar />
        </div>

        {/* Keep the focus portal host mounted so mode switches preserve editor state. */}
        <div
          ref={sidebarSlotRef}
          className={cn(
            'flex flex-col flex-1 min-h-0 overflow-hidden',
            (!focusAvailable || sidebarMode !== 'focus') && 'hidden',
          )}
        />

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
      <main className={cn('flex-1 min-h-screen overflow-auto max-w-7xl mx-auto', chrome.mainClassName)}>
        <Outlet context={outletContext} />
      </main>
    </div>
  )
}
