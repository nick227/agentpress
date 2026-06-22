import { useLocation, Link } from 'react-router-dom'
import { Bot, CalendarClock, Database, FlaskConical, Layers, MessageSquareText, Play, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  {
    to: '/schedules',
    label: 'Schedules',
    icon: CalendarClock,
    match: (p) => p.startsWith('/schedules'),
  },
  {
    to: '/pipelines',
    label: 'Pipelines',
    icon: Workflow,
    match: (p) => p.startsWith('/pipelines'),
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
    to: '/agents',
    label: 'Agents',
    icon: Bot,
    match: (p) => p.startsWith('/agents'),
  },
  {
    to: '/workflows',
    label: 'Workflows',
    icon: Layers,
    match: (p) => p.startsWith('/workflows'),
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
]

export function TopNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Main navigation"
      className="w-full min-w-0 shrink-0 border-b backdrop-blur-sm"
    >
      <div className="flex w-full min-w-0 items-center flex-wrap px-2 sm:gap-3 md:gap-5 items-center justify-start lg:justify-center">
        {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'group relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium transition-colors duration-150 sm:gap-2 sm:px-3',
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
