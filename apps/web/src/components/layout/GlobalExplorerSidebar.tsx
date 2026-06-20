import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { GlobalExplorerSections } from './explorer/GlobalExplorerSections'
import { useGlobalExplorerSidebar } from './explorer/useGlobalExplorerSidebar'

// Thin shell: the hook owns behavior and the sections own resource-specific rendering.
export function GlobalExplorerSidebar() {
  const explorer = useGlobalExplorerSidebar()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b p-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={explorer.query}
            onChange={(event) => explorer.setQuery(event.target.value)}
            placeholder="Filter navigation"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <GlobalExplorerSections explorer={explorer} />
      </div>
    </div>
  )
}
