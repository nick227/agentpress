import { Link, Outlet } from 'react-router-dom'
import { BookOpen, User } from 'lucide-react'
import { GlobalExplorerSidebar } from './GlobalExplorerSidebar'
import { MobileNav } from './MobileNav'
import { TopNav } from './TopNav'

export function Shell() {

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-7xl mx-auto overflow-x-clip bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col shrink-0 border-r bg-surface overflow-hidden">
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
            to="/documentation"
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <BookOpen size={15} />
            Documentation
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
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
