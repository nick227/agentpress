import { toast } from 'sonner'
import { usePrompts, useUpdateResearchSource } from '@project/sdk'
import type { components } from '@project/sdk'

type ResearchSource = components['schemas']['ResearchSource']

interface Props {
  source: ResearchSource
}

export function PipelineSummaryStyleSelect({ source }: Props) {
  const { data: promptsData } = usePrompts({ kind: 'CONTENT' })
  const updateSource = useUpdateResearchSource()
  const prompts = promptsData?.data ?? []
  const globalDefault = prompts.find((prompt) => prompt.isDefault) ?? prompts[0]

  async function handleChange(value: string) {
    try {
      await updateSource.mutateAsync({
        sourceId: source.id,
        defaultSummaryPromptId: value || null,
      })
      toast.success('Pipeline summary style updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-2 mb-6">
      <div>
        <label className="block text-xs font-medium mb-1">Pipeline summary</label>
        <select
          value={source.defaultSummaryPromptId ?? ''}
          disabled={updateSource.isPending || prompts.length === 0}
          onChange={(e) => void handleChange(e.target.value)}
          className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">
            Global default{globalDefault ? ` (${globalDefault.name})` : ''}
          </option>
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
