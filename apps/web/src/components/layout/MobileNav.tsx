import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useLogout } from '@project/sdk'
import { toggleTheme } from '@/lib/theme'
import { GlobalExplorerSidebar } from './GlobalExplorerSidebar'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const logout = useLogout()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  function handleToggleTheme() {
    toggleTheme()
    setIsDark(document.documentElement.classList.contains('dark'))
  }

  return (
    <>
      {/* Sticky top header — mobile only */}
      <header className="md:hidden sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b bg-surface px-4">
        <Link
          to="/"
          className="text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
        >
          AgentPress
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Slide-in drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface border-r shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-modal
        role="dialog"
        aria-label="Navigation"
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
          >
            AgentPress
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <GlobalExplorerSidebar />
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex shrink-0 flex-col gap-1 border-t p-3">
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </div>
    </>
  )
}
