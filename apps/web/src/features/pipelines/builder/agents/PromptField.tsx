import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { components } from '@project/sdk'
import { usePromptAssist, usePrompts, useResearchSources } from '@project/sdk'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PromptTextarea } from '@/components/ui/PromptTextarea'
import { Button } from '@/components/ui/Button'
import { researchSummaryRefHint } from '@/features/research/researchSummaryRef'

type Pipeline = components['schemas']['Pipeline']
type Agent = components['schemas']['PipelineAgent']

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  promptKind: 'system' | 'user'
  pipeline: Pipeline
  agent: Agent
  defaultSaveName: string
  savingPrompt: boolean
  onSavePrompt: (name: string) => Promise<void>
  placeholder?: string
}

export function PromptField({
  label,
  value,
  onChange,
  promptKind,
  pipeline,
  agent,
  defaultSaveName,
  savingPrompt,
  onSavePrompt,
  placeholder,
}: Props) {
  const promptAssist = usePromptAssist()
  const { data: promptsData, isLoading: promptsLoading } = usePrompts({
    kind: 'TRANSFORMATIONAL',
    resolved: true,
  })
  const { data: researchData } = useResearchSources()
  const [showAssist, setShowAssist] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [suggested, setSuggested] = useState('')
  const [showVariableMenu, setShowVariableMenu] = useState(false)
  const [showResearchMenu, setShowResearchMenu] = useState(false)
  const [showPromptMenu, setShowPromptMenu] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [promptName, setPromptName] = useState(defaultSaveName)
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
  const researchSources = (researchData?.data ?? []).filter((source) => (source.itemCount ?? 0) > 0)
  const savedPrompts = promptsData?.data ?? []
  const ownedPrompts = savedPrompts.filter((prompt) => prompt.visibility === 'PRIVATE')
  const communityPrompts = savedPrompts.filter((prompt) => prompt.visibility === 'PUBLIC')

  async function handleSavePrompt() {
    const name = promptName.trim()
    if (!name) return
    try {
      await onSavePrompt(name)
      setShowSavePrompt(false)
      setShowPromptMenu(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not save prompt')
    }
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex flex-wrap gap-1">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPromptMenu((v) => !v)
                setShowVariableMenu(false)
                setShowResearchMenu(false)
              }}
              className="text-xs h-7 gap-1"
            >
              <BookOpen size={11} />
              Prompts <ChevronDown size={11} />
            </Button>
            {showPromptMenu && (
              <div className="absolute right-0 top-8 z-30 w-[min(100vw-2rem,22rem)] overflow-hidden rounded border bg-surface shadow-lg">
                <div className="max-h-64 overflow-y-auto py-1">
                  {promptsLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Loading prompts…</p>
                  ) : savedPrompts.length > 0 ? (
                    <>
                      {ownedPrompts.length > 0 && (
                        <PromptMenuGroup
                          label="Your prompts"
                          prompts={ownedPrompts}
                          promptKind={promptKind}
                          onApply={(text) => { onChange(text); setShowPromptMenu(false) }}
                        />
                      )}
                      {communityPrompts.length > 0 && (
                        <PromptMenuGroup
                          label="Community prompts"
                          prompts={communityPrompts}
                          promptKind={promptKind}
                          onApply={(text) => { onChange(text); setShowPromptMenu(false) }}
                        />
                      )}
                    </>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No prompts available</p>
                  )}
                </div>
                <div className="space-y-1 border-t p-1">
                  {showSavePrompt ? (
                    <div className="space-y-2 p-2">
                      <Input
                        value={promptName}
                        onChange={(e) => setPromptName(e.target.value)}
                        placeholder="Prompt name"
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          loading={savingPrompt}
                          disabled={!promptName.trim() || savingPrompt}
                          onClick={() => void handleSavePrompt()}
                        >
                          Save
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowSavePrompt(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => setShowSavePrompt(true)}
                    >
                      <Save size={11} /> Save current agent prompt…
                    </button>
                  )}
                  <Link
                    to="/community?tab=prompts"
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <BookOpen size={11} /> Browse community prompts
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pipeline.variables.length === 0}
              onClick={() => {
                setShowVariableMenu((v) => !v)
                setShowResearchMenu(false)
                setShowPromptMenu(false)
              }}
              className="text-xs h-7 gap-1"
            >
              Variables <ChevronDown size={11} />
            </Button>
            {showVariableMenu && (
              <div className="absolute right-0 top-8 w-56 bg-surface border rounded shadow-lg z-20 py-1">
                {pipeline.variables.length > 0 ? (
                  pipeline.variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted font-mono"
                      onClick={() => { insertAtCursor(`{${v.key}}`); setShowVariableMenu(false) }}
                    >
                      {`{${v.key}}`}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No variables available</p>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={researchSources.length === 0}
              onClick={() => {
                setShowResearchMenu((v) => !v)
                setShowVariableMenu(false)
                setShowPromptMenu(false)
              }}
              className="text-xs h-7 gap-1"
            >
              Research feeds <ChevronDown size={11} />
            </Button>
            {showResearchMenu && (
              <div className="absolute right-0 top-8 z-20 w-[min(100vw-2rem,28rem)] min-w-0 bg-surface border rounded shadow-lg py-1">
                {researchSources.length > 0 ? (
                  researchSources.map((source) => (
                    <div key={source.id} className="px-1 py-1">
                      <div className="px-2 pb-1">
                        <p className="text-[11px] font-medium truncate">{source.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {researchSummaryRefHint(source)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(['summary', 'date'] as const).map((field) => (
                          <button
                            key={field}
                            type="button"
                            className="text-left px-2 py-1.5 text-xs rounded truncate hover:bg-muted"
                            onClick={() => {
                              insertAtCursor(`{${source.slug}.${field}}`)
                              setShowResearchMenu(false)
                            }}
                          >
                            <span className="font-mono block truncate">{`{${source.slug}.${field}}`}</span>
                            {field === 'summary' && (
                              <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                                {source.pipelineSummaryPromptName ?? 'Summary'}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No research feeds available</p>
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

      <PromptTextarea
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

function PromptMenuGroup({
  label,
  prompts,
  promptKind,
  onApply,
}: {
  label: string
  prompts: components['schemas']['Prompt'][]
  promptKind: 'system' | 'user'
  onApply: (text: string) => void
}) {
  return (
    <div>
      <p className="border-y bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:border-t-0">
        {label}
      </p>
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
          onClick={() => onApply(promptKind === 'system' ? prompt.systemPrompt : prompt.userPrompt)}
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{prompt.name}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{prompt.category}</span>
          </span>
          {prompt.visibility === 'PRIVATE' && (
            <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent">
              Yours
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
