import { useState, useRef } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import type { components } from '@project/sdk'
import { usePromptAssist, useResearchSources } from '@project/sdk'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Pipeline = components['schemas']['Pipeline']
type Agent = components['schemas']['PipelineAgent']

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  promptKind: 'system' | 'user'
  pipeline: Pipeline
  agent: Agent
  placeholder?: string
}

export function PromptField({ label, value, onChange, promptKind, pipeline, agent, placeholder }: Props) {
  const promptAssist = usePromptAssist()
  const { data: researchData } = useResearchSources(pipeline.accountId)
  const [showAssist, setShowAssist] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [suggested, setSuggested] = useState('')
  const [showRefMenu, setShowRefMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) { onChange(value + text); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const agentsBefore = pipeline.agents.filter((a) => a.sortOrder < agent.sortOrder)
  const researchSources = researchData?.data ?? []

  async function handleAssist() {
    const result = await promptAssist.mutateAsync({
      pipelineName: pipeline.name,
      variables: pipeline.variables,
      previousAgents: agentsBefore,
      currentAgent: agent,
      promptKind,
      currentPrompt: value,
      userInstruction: instruction,
    })
    setSuggested(result.data.suggestedPrompt)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex gap-1">
          {/* Insert reference menu */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRefMenu((v) => !v)}
              className="text-xs h-7 gap-1"
            >
              Insert ref <ChevronDown size={11} />
            </Button>
            {showRefMenu && (
              <div className="absolute right-0 top-8 w-64 bg-surface border rounded shadow-lg z-20 py-1">
                {pipeline.variables.length > 0 && (
                  <>
                    <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Variables</p>
                    {pipeline.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted font-mono"
                        onClick={() => { insertAtCursor(`{${v.key}}`); setShowRefMenu(false) }}
                      >
                        {`{${v.key}}`}
                      </button>
                    ))}
                  </>
                )}
                {agentsBefore.length > 0 && (
                  <>
                    <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Prior outputs</p>
                    {agentsBefore.map((a) => (
                      <button
                        key={a.uid}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted font-mono"
                        onClick={() => { insertAtCursor(`{agents.${a.uid}.output}`); setShowRefMenu(false) }}
                      >
                        {`{agents.${a.uid}.output}`}
                      </button>
                    ))}
                  </>
                )}
                {researchSources.length > 0 && (
                  <>
                    <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Research feeds</p>
                    {researchSources.map((source) => (
                      <div key={source.id} className="px-1">
                        <p className="px-2 pt-1 text-[11px] text-muted-foreground truncate">{source.name}</p>
                        <div className="grid grid-cols-2 gap-1 pb-1">
                          {(['summary', 'date'] as const).map((field) => (
                            <button
                              key={field}
                              type="button"
                              className="text-left px-2 py-1.5 text-xs hover:bg-muted font-mono rounded truncate"
                              onClick={() => { insertAtCursor(`{${source.slug}.${field}}`); setShowRefMenu(false) }}
                            >
                              {`{${source.slug}.${field}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {pipeline.variables.length === 0 && agentsBefore.length === 0 && researchSources.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No references available</p>
                )}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAssist((v) => !v)}
            className="text-xs h-7 gap-1"
          >
            <Sparkles size={11} />
            AI Assist
          </Button>
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        placeholder={placeholder}
        className="font-mono text-xs"
      />

      {showAssist && (
        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium">AI Prompt Assist</p>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="Write a prompt for a researcher that summarizes the topic..."
          />
          {suggested && (
            <div className="rounded border p-2 bg-surface text-xs font-mono whitespace-pre-wrap">
              {suggested}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              loading={promptAssist.isPending}
              onClick={handleAssist}
            >
              Generate
            </Button>
            {suggested && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onChange(suggested); setSuggested(''); setShowAssist(false) }}
              >
                Apply
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAssist(false); setSuggested('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
