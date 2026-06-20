import { useState } from 'react'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import { Youtube, MessageSquare, Rss } from 'lucide-react'
import { useCreateResearchSource } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const CATEGORIES = ['ai', 'technology', 'financial', 'culture', 'politics', 'business', 'science', 'health', 'education', 'entertainment', 'sports']

const SOURCE_TYPES = [
  {
    id: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    urlLabel: 'Channel URL',
    placeholder: 'https://www.youtube.com/@handle',
    hint: 'Supports @handle, /channel/, /c/, /user/ formats',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: MessageSquare,
    urlLabel: 'Subreddit URL',
    placeholder: 'https://www.reddit.com/r/wallstreetbets',
    hint: 'Collects a daily digest of the top posts',
  },
  {
    id: 'rss',
    label: 'RSS Feed',
    icon: Rss,
    urlLabel: 'Feed URL',
    placeholder: 'https://feeds.reuters.com/reuters/businessNews',
    hint: 'Any standard RSS or Atom feed',
  },
]

export function ResearchNewPage() {
  const navigate = useNavigate()
  const create = useCreateResearchSource()
  const [sourceType, setSourceType] = useState('youtube')
  const [name, setName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const effectiveCategory = category === '__custom__' ? customCategory.trim() : category
  const typeConfig = SOURCE_TYPES.find((t) => t.id === sourceType)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !sourceUrl.trim()) return
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        sourceType: sourceType as 'youtube' | 'reddit' | 'rss',
        sourceUrl: sourceUrl.trim(),
        category: effectiveCategory || undefined,
      })
      toast.success('Research source created')
      navigate(`/research/${result.data.slug}`, { replace: true })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create source')
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-10">
      <Link to="/" className="mx-6 mt-5 inline-flex text-sm text-muted-foreground hover:text-foreground">← Home</Link>

      <div className="px-6 pt-4">
        <h1 className="text-lg font-semibold mb-1">New Research Source</h1>
        <p className="text-sm text-muted-foreground mb-6">Connect a YouTube channel, subreddit, or RSS feed to pull content into your pipelines.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-1.5">Source type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {SOURCE_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSourceType(t.id); setSourceUrl('') }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded border text-xs font-medium transition-colors ${
                      sourceType === t.id
                        ? 'border-foreground bg-foreground/5 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    }`}
                  >
                    <Icon size={15} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={sourceType === 'reddit' ? 'e.g. WallStreetBets' : sourceType === 'rss' ? 'e.g. Reuters Business' : 'e.g. Vaush'}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{typeConfig.urlLabel}</label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={typeConfig.placeholder}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">{typeConfig.hint}</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Category <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
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

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim() || !sourceUrl.trim()}>
              Create source
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
