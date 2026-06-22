import { Link, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Globe2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobalExplorerSidebar } from './GlobalExplorerSidebar'
import { MobileNav } from './MobileNav'
import { TopNav } from './TopNav'

export function Shell() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-7xl mx-auto overflow-x-clip bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col shrink-0 border-r bg-surface overflow-y-auto h-screen bg-green-500 fixed top-0 left-0">
        <div className="shrink-0 border-b px-4 py-3">
          <Link
            to="/"
            className="inline-flex text-2xl font-semibold tracking-tight text-foreground hover:text-foreground/80 transition-colors"
          >
            AgentPress
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <GlobalExplorerSidebar />
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-1 border-t p-3">
          <Link
            to="/community"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
              pathname.startsWith('/community')
                ? 'text-foreground bg-muted/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <Globe2 size={15} />
            Community
          </Link>
          <Link
            to="/documentation"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
              pathname.startsWith('/documentation')
                ? 'text-foreground bg-muted/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <BookOpen size={15} />
            Help
          </Link>
          <Link
            to="/profile"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
              pathname.startsWith('/profile')
                ? 'text-foreground bg-muted/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <User size={15} />
            Profile
          </Link>
        </div>
      </aside>

      {/* Content column: mobile header + top nav + page content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <TopNav />
        <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
