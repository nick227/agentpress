import { useState } from 'react'
import { toast } from 'sonner'
import { useCheckResearchSource, useCheckResearchSources } from '@project/sdk'
import type { components } from '@project/sdk'
import { researchCategoryLabel } from './researchCategories'

type ResearchSource = components['schemas']['ResearchSource']

// Owns upstream check mutations and translates their outcomes into sidebar feedback.
export function useResearchRefresh() {
  const [checkingSourceId, setCheckingSourceId] = useState<string | null>(null)
  const checkResearchSources = useCheckResearchSources()
  const checkResearchSource = useCheckResearchSource()

  async function checkResearch(category?: string) {
    const label = category ? researchCategoryLabel(category) : 'Research'
    const toastId = `research-check-${category ?? 'all'}`
    toast.loading(`Checking ${category ? `${label} feeds` : 'all active research feeds'}…`, { id: toastId })

    try {
      const { data: result } = await checkResearchSources.mutateAsync(category ? { category } : {})
      const detail = result.newCount > 0
        ? `${result.newCount} new item${result.newCount === 1 ? '' : 's'}`
        : 'no new items'
      const message = `${label}: checked ${result.checked} feed${result.checked === 1 ? '' : 's'}, ${detail}${result.failed ? `, ${result.failed} failed` : ''}.`

      if (result.failed === result.checked && result.checked > 0) toast.error(message, { id: toastId })
      else if (result.failed > 0) toast.warning(message, { id: toastId })
      else toast.success(message, { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Could not check ${label} feeds`, { id: toastId })
    }
  }

  async function checkSource(source: ResearchSource) {
    setCheckingSourceId(source.id)
    const toastId = `research-check-${source.id}`
    toast.loading(`Checking ${source.name}…`, { id: toastId })

    try {
      const { data: result } = await checkResearchSource.mutateAsync(source.id)
      const message = result.message ?? (result.newCount > 0
        ? `${source.name}: ${result.newCount} new item${result.newCount === 1 ? '' : 's'}.`
        : `${source.name}: no new items.`)

      if (!result.checked) toast.error(message, { id: toastId })
      else if (result.newCount > 0 || result.updatedCount > 0) toast.success(message, { id: toastId })
      else toast.info(message, { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Could not check ${source.name}`, { id: toastId })
    } finally {
      setCheckingSourceId(null)
    }
  }

  return {
    checkResearch: (requestedCategory?: string) => void checkResearch(requestedCategory),
    checkSource: (source: ResearchSource) => void checkSource(source),
    checkingAll: checkResearchSources.isPending,
    checkingSourceId,
    pending: checkResearchSources.isPending || checkResearchSource.isPending,
  }
}
