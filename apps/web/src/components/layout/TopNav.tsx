import { useLocation, Link } from 'react-router-dom'
import { CalendarClock, Database, FlaskConical, Globe2, MessageSquareText, Play, Workflow, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  {
    to: '/',
    label: 'Pipelines',
    icon: Workflow,
    match: (p) => p === '/' || p.startsWith('/pipelines'),
  },
  {
    to: '/schedules',
    label: 'Schedules',
    icon: CalendarClock,
    match: (p) => p.startsWith('/schedules'),
  },
  {
    to: '/research',
    label: 'Research',
    icon: FlaskConical,
    match: (p) => p.startsWith('/research'),
  },
  {
    to: '/prompts',
    label: 'Prompts',
    icon: MessageSquareText,
    match: (p) => p.startsWith('/prompts'),
  },
  {
    to: '/destinations',
    label: 'Destinations',
    icon: Database,
    match: (p) => p.startsWith('/destinations'),
  },
  {
    to: '/runs',
    label: 'Runs',
    icon: Play,
    match: (p) => p.startsWith('/runs'),
  },
  {
    to: '/community',
    label: 'Community',
    icon: Globe2,
    match: (p) => p.startsWith('/community'),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: User,
    match: (p) => p.startsWith('/profile'),
  },
]

export function TopNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Main navigation"
      className="shrink-0 border-b bg-surface/80 backdrop-blur-sm"
    >
      <div className="flex items-center overflow-y-hidden scrollbar-none px-2 gap-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'group relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-150',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                size={14}
                className={cn(
                  'transition-colors duration-150 shrink-0',
                  active ? 'text-accent' : 'text-muted-foreground/60 group-hover:text-muted-foreground',
                )}
              />
              {label}

              {/* Active underline */}
              <span
                className={cn(
                  'absolute inset-x-2 bottom-0 h-px rounded-full bg-accent transition-all duration-150',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
                )}
              />
            </Link>
          )
        })}

      </div>
    </nav>
  )
}
