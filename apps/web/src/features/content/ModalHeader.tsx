import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose}>
        <X size={15} />
      </Button>
    </div>
  )
}
