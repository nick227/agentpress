import { Link } from 'react-router-dom'

interface Props {
  accountSlug: string
  title: string
  eyebrow: string
  allHref: string
  allLabel: string
}

export function FocusSidebarHeader({ accountSlug, title, eyebrow, allHref, allLabel }: Props) {
  return (
    <div className="px-4 py-3 border-b shrink-0">
      <Link
        to={allHref}
        className="inline-flex text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {allLabel}
      </Link>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      <p className="mt-1 text-sm font-semibold truncate" title={title}>
        {title}
      </p>
      <Link
        to={`/accounts/${accountSlug}`}
        className="mt-1 inline-flex max-w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        title={`Open ${accountSlug}`}
      >
        <span className="truncate">Account: {accountSlug}</span>
      </Link>
    </div>
  )
}
