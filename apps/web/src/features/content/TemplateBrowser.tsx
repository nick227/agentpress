import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { X, Layers, Tag } from 'lucide-react'
import { useContentTemplates, useApplyContentTemplate } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

type ContentTemplate = components['schemas']['ContentTemplate']

interface Props {
  accountId: string
  accountSlug: string
  onClose: () => void
}

const CATEGORY_ORDER = ['blog', 'social', 'ecommerce']

export function TemplateBrowser({ accountId, accountSlug, onClose }: Props) {
  const { data, isLoading } = useContentTemplates()
  const apply = useApplyContentTemplate()
  const navigate = useNavigate()

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<ContentTemplate | null>(null)
  const [pipelineName, setPipelineName] = useState('')

  const templates = data?.data ?? []

  const categories = CATEGORY_ORDER
    .filter((c) => templates.some((t) => t.category === c))
    .map((c) => ({
      id: c,
      label: templates.find((t) => t.category === c)?.categoryLabel ?? c,
    }))

  const filtered = activeCategory
    ? templates.filter((t) => t.category === activeCategory)
    : templates

  async function handleApply() {
    if (!selected) return
    const name = pipelineName.trim() || selected.name
    try {
      const result = await apply.mutateAsync({ templateId: selected.id, accountId, name })
      toast.success(`Pipeline "${name}" created from template`)
      onClose()
      navigate(`/accounts/${accountSlug}/pipelines/${result.data.slug}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to apply template')
    }
  }

  function handleSelect(template: ContentTemplate) {
    setSelected(template)
    setPipelineName(template.name)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-3xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Start from Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a template — agents, prompts, and variables are pre-configured
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>

        {/* Category tabs */}
        <div className="px-5 py-3 border-b flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeCategory === null
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selected?.id === template.id}
                  onSelect={() => handleSelect(template)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — pipeline name + apply */}
        {selected && (
          <div className="px-5 py-4 border-t shrink-0 flex items-center gap-3">
            <div className="flex-1">
              <Input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder={selected.name}
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              loading={apply.isPending}
              onClick={handleApply}
              className="shrink-0"
            >
              Create pipeline
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)} className="shrink-0">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: ContentTemplate
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-4 transition-all space-y-2.5 ${
        isSelected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-input-border hover:border-muted-foreground/40 hover:bg-muted/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{template.name}</span>
        {isSelected && (
          <span className="text-xs text-accent font-medium shrink-0">Selected</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {template.description}
      </p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers size={11} />
          {template.agents.length} agent{template.agents.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Tag size={11} />
          {template.variables.length} var{template.variables.length !== 1 ? 's' : ''}
        </span>
      </div>

      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
