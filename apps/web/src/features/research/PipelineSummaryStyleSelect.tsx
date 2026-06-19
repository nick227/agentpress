import { toast } from 'sonner'
import { useSummaryPrompts, useUpdateResearchSource } from '@project/sdk'
import type { components } from '@project/sdk'

type ResearchSource = components['schemas']['ResearchSource']

interface Props {
  source: ResearchSource
}

export function PipelineSummaryStyleSelect({ source }: Props) {
  const { data: promptsData } = useSummaryPrompts()
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
        <label className="block text-xs font-medium mb-1">Pipeline summary style</label>
        <p className="text-xs text-muted-foreground mb-2">
          Used when pipelines reference <code className="font-mono bg-muted px-1 rounded">{`{${source.slug}.summary}`}</code>.
          Applies to the latest stored item; auto-generated on run if missing.
        </p>
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
      {source.pipelineSummaryPromptName && (
        <p className="text-xs text-muted-foreground">
          Pipelines currently resolve to <span className="font-medium text-foreground">{source.pipelineSummaryPromptName}</span>
          {source.defaultSummaryPromptId ? ' (feed override)' : ' (global default)'}.
        </p>
      )}
    </div>
  )
}
