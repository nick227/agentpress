import { useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useCreateResearchSource } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const CATEGORIES = [
  'politics',
  'technology',
  'finance',
  'health',
  'entertainment',
  'sports',
  'education',
  'science',
  'business',
  'culture',
]

interface Props {
  accountId: string
  accountSlug: string
  onClose: () => void
}

export function CreateResearchSourceDialog({ accountId, accountSlug, onClose }: Props) {
  const navigate = useNavigate()
  const create = useCreateResearchSource()
  const [name, setName] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const effectiveCategory = category === '__custom__' ? customCategory.trim() : category

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !youtubeUrl.trim()) return
    try {
      const result = await create.mutateAsync({
        accountId,
        name: name.trim(),
        youtubeUrl: youtubeUrl.trim(),
        category: effectiveCategory || undefined,
      })
      toast.success('Research source created')
      onClose()
      navigate(`/accounts/${accountSlug}/research/${result.data.slug}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create source')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-sm shadow-xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">New Research Source</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vaush"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">YouTube Channel URL</label>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/@Vaush"
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports @handle, /channel/, /c/, /user/ formats
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory(category === '__custom__' ? '' : '__custom__')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  category === '__custom__'
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                other…
              </button>
            </div>
            {category === '__custom__' && (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. cooking"
                className="h-8 text-sm"
                autoFocus
              />
            )}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim() || !youtubeUrl.trim()}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
