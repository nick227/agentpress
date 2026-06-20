import { useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { useVariablePacks, useUpdatePipeline } from '@project/sdk'
import type { components } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategoryTabBar } from './CategoryTabBar'
import { ModalHeader } from './ModalHeader'

type Pipeline = components['schemas']['Pipeline']
type VariablePack = components['schemas']['VariablePack']

interface Props {
  pipeline: Pipeline
  pipelineId: string
  onClose: () => void
}

const CATEGORY_ORDER = ['seo', 'style', 'product']

export function VariablePackPicker({ pipeline, pipelineId, onClose }: Props) {
  const { data, isLoading } = useVariablePacks()
  const update = useUpdatePipeline()

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<VariablePack | null>(null)

  const packs = data?.data ?? []

  const categories = CATEGORY_ORDER
    .filter((c) => packs.some((p) => p.category === c))
    .map((c) => ({
      id: c,
      label: packs.find((p) => p.category === c)?.categoryLabel ?? c,
    }))

  const filtered = activeCategory
    ? packs.filter((p) => p.category === activeCategory)
    : packs

  const existingKeys = new Set(pipeline.variables.map((v) => v.key))

  function newVariableCount(pack: VariablePack) {
    return pack.variables.filter((v) => !existingKeys.has(v.key)).length
  }

  async function handleImport() {
    if (!selected) return

    const incoming = selected.variables.filter((v) => !existingKeys.has(v.key))
    if (incoming.length === 0) {
      toast.info('All variables in this pack already exist in the pipeline')
      return
    }

    const merged = [
      ...pipeline.variables.map((v, i) => ({ ...v, sortOrder: i })),
      ...incoming.map((v, i) => ({
        key: v.key,
        label: v.label,
        type: v.type,
        required: v.required,
        defaultValue: v.defaultValue,
        exampleValue: v.exampleValue,
        sortOrder: pipeline.variables.length + i,
      })),
    ]

    await update.mutateAsync({ pipelineId, variables: merged })
    toast.success(
      `${incoming.length} variable${incoming.length !== 1 ? 's' : ''} imported from "${selected.name}"`,
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
        <ModalHeader
          title="Import Variable Pack"
          subtitle="New variables are merged in — existing keys are never overwritten"
          onClose={onClose}
        />

        <CategoryTabBar categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} />

        {/* Packs list */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            filtered.map((pack) => {
              const newCount = newVariableCount(pack)
              const isSelected = selected?.id === pack.id
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : pack)}
                  className={`w-full text-left rounded-lg border p-4 transition-all space-y-2 ${
                    isSelected
                      ? 'border-accent bg-accent/5'
                      : 'border-input-border hover:border-muted-foreground/40 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{pack.name}</span>
                    <span className={`text-xs font-medium shrink-0 ${
                      newCount === 0 ? 'text-muted-foreground' : 'text-accent'
                    }`}>
                      {newCount === 0
                        ? 'Already imported'
                        : `+${newCount} new`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{pack.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pack.variables.map((v) => (
                      <span
                        key={v.key}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
                          existingKeys.has(v.key)
                            ? 'border-input-border text-muted-foreground line-through'
                            : 'border-input-border text-foreground'
                        }`}
                      >
                        {existingKeys.has(v.key) && <Check size={9} className="text-green-600 no-underline" />}
                        {v.key}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected || newVariableCount(selected) === 0}
            loading={update.isPending}
            onClick={handleImport}
          >
            {selected
              ? `Import ${newVariableCount(selected)} variable${newVariableCount(selected) !== 1 ? 's' : ''}`
              : 'Select a pack'}
          </Button>
        </div>
      </div>
    </div>
  )
}
