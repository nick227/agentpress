import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { components } from '@project/sdk'
import { useGenerateImageAsset, useImageAssets, useUpdatePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PromptField } from './PromptField'

type Pipeline = components['schemas']['Pipeline']
type Agent = components['schemas']['PipelineAgent']
type ImageAsset = components['schemas']['ImageAsset']

interface Props {
  agent: Agent
  pipeline: Pipeline
  pipelineId: string
  onSaved: (id: string) => void
  onDeleted: () => void
}

const TEXT_OUTPUT_TARGETS = [
  { value: 'none', label: 'Not included in final post' },
  { value: 'body', label: 'Body (section)' },
  { value: 'title', label: 'Title' },
  { value: 'excerpt', label: 'Excerpt' },
  { value: 'thumbnail_prompt', label: 'Thumbnail prompt (text)' },
] as const

const IMAGE_OUTPUT_TARGETS = [
  { value: 'image', label: 'Inline image' },
  { value: 'thumbnail', label: 'Thumbnail' },
] as const

const TEXT_OUTPUT_FORMATS = ['text', 'markdown', 'json'] as const
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function isImageAgent(agent: { outputFormat: string }) {
  return agent.outputFormat === 'image'
}

export function BuilderAgent({ agent, pipeline, pipelineId, onSaved, onDeleted }: Props) {
  const update = useUpdatePipeline()
  const generateImage = useGenerateImageAsset()
  const imageAgent = isImageAgent(agent)
  const { data: imageAssetsData } = useImageAssets(imageAgent ? pipelineId : '', imageAgent ? agent.id : undefined)
  const imageAssets = imageAssetsData?.data ?? []
  const [form, setForm] = useState({
    uid: agent.uid,
    name: agent.name,
    outputTarget: agent.outputTarget,
    outputFormat: agent.outputFormat,
    imageMode: agent.imageMode ?? 'generate',
    selectedImageAssetId: agent.selectedImageAssetId ?? '',
    enabled: agent.enabled,
    systemPrompt: agent.systemPrompt,
    userPrompt: agent.userPrompt,
  })

  useEffect(() => {
    setForm({
      uid: agent.uid,
      name: agent.name,
      outputTarget: agent.outputTarget,
      outputFormat: agent.outputFormat,
      imageMode: agent.imageMode ?? 'generate',
      selectedImageAssetId: agent.selectedImageAssetId ?? '',
      enabled: agent.enabled,
      systemPrompt: agent.systemPrompt,
      userPrompt: agent.userPrompt,
    })
  }, [agent.id])

  function patch<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function toAgentPayload(a: Agent, overrides?: Partial<typeof form>) {
    const next = overrides ? { ...form, ...overrides } : form
    return {
      id: a.id,
      uid: next.uid,
      name: next.name,
      systemPrompt: isImageAgent({ outputFormat: next.outputFormat }) ? '' : next.systemPrompt,
      userPrompt: next.userPrompt,
      outputTarget: next.outputTarget as Agent['outputTarget'],
      outputFormat: next.outputFormat as Agent['outputFormat'],
      imageMode: next.imageMode as Agent['imageMode'],
      selectedImageAssetId: next.selectedImageAssetId || null,
      enabled: next.enabled,
      sortOrder: a.sortOrder,
    }
  }

  async function saveAgentPatch(overrides: Partial<typeof form>) {
    const nextForm = { ...form, ...overrides }
    setForm(nextForm)
    const result = await update.mutateAsync({
      pipelineId,
      agents: pipeline.agents.map((a) =>
        a.id === agent.id ? toAgentPayload(a, nextForm) : toAgentPayload(a, {
          uid: a.uid,
          name: a.name,
          outputTarget: a.outputTarget,
          outputFormat: a.outputFormat,
          imageMode: a.imageMode ?? 'generate',
          selectedImageAssetId: a.selectedImageAssetId ?? '',
          enabled: a.enabled,
          systemPrompt: a.systemPrompt,
          userPrompt: a.userPrompt,
        }),
      ),
    })
    const savedAgent = result.data.agents.find((item) => item.uid === nextForm.uid)
    if (savedAgent) onSaved(savedAgent.id)
  }

  async function handleSave() {
    const agentIndex = pipeline.agents.findIndex((a) => a.id === agent.id)
    const result = await update.mutateAsync({
      pipelineId,
      agents: pipeline.agents.map((a) =>
        a.id === agent.id ? toAgentPayload(a) : toAgentPayload(a, {
          uid: a.uid,
          name: a.name,
          outputTarget: a.outputTarget,
          outputFormat: a.outputFormat,
          imageMode: a.imageMode ?? 'generate',
          selectedImageAssetId: a.selectedImageAssetId ?? '',
          enabled: a.enabled,
          systemPrompt: a.systemPrompt,
          userPrompt: a.userPrompt,
        }),
      ),
    })
    const savedAgent = result.data.agents[agentIndex]
    if (savedAgent) onSaved(savedAgent.id)
    toast.success('Agent saved')
  }

  async function handleDelete() {
    await update.mutateAsync({
      pipelineId,
      agents: pipeline.agents
        .filter((a) => a.id !== agent.id)
        .map((a) => toAgentPayload(a, {
          uid: a.uid,
          name: a.name,
          outputTarget: a.outputTarget,
          outputFormat: a.outputFormat,
          imageMode: a.imageMode ?? 'generate',
          selectedImageAssetId: a.selectedImageAssetId ?? '',
          enabled: a.enabled,
          systemPrompt: a.systemPrompt,
          userPrompt: a.userPrompt,
        })),
    })
    toast.success('Agent deleted')
    onDeleted()
  }

  async function handleGenerateImage() {
    try {
      const prompt = form.userPrompt.trim()
      if (!prompt) {
        toast.error('Image prompt is required')
        return
      }
      const result = await generateImage.mutateAsync({ pipelineId, agentId: agent.id, prompt })
      await saveAgentPatch({ imageMode: 'selected', selectedImageAssetId: result.data.id })
      toast.success('Image generated')
    } catch (err: any) {
      toast.error(err.message ?? 'Image generation failed')
    }
  }

  async function handleSelectImage(asset: ImageAsset) {
    await saveAgentPatch({ imageMode: 'selected', selectedImageAssetId: asset.id })
    toast.success('Selected image saved')
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{imageAgent ? 'Image Agent' : 'Agent'}</h2>
        {imageAgent && (
          <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
            image
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="UID">
          <Input
            value={form.uid}
            onChange={(e) => patch('uid', e.target.value)}
            placeholder={imageAgent ? 'hero-image' : 'researcher'}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">Used in <code className="bg-muted px-1 rounded">{`{agents.${form.uid || 'uid'}.output}`}</code></p>
        </Field>
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder={imageAgent ? 'Hero Image' : 'Researcher'}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Output target">
          <select
            value={form.outputTarget}
            onChange={(e) => patch('outputTarget', e.target.value as typeof form.outputTarget)}
            className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(imageAgent ? IMAGE_OUTPUT_TARGETS : TEXT_OUTPUT_TARGETS).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        {imageAgent ? (
          <Field label="Output format">
            <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border rounded bg-muted/20">
              image
            </div>
          </Field>
        ) : (
          <Field label="Output format">
            <select
              value={form.outputFormat}
              onChange={(e) => patch('outputFormat', e.target.value as typeof form.outputFormat)}
              className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TEXT_OUTPUT_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {imageAgent && (
        <p className="text-xs text-muted-foreground -mt-2">
          Prompt is sent directly to the image provider (DALL-E). Use the smallest size during development.
        </p>
      )}

      <Field label="">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => patch('enabled', e.target.checked)}
          />
          Enabled
        </label>
      </Field>

      {!imageAgent && (
        <PromptField
          label="System Prompt"
          value={form.systemPrompt}
          onChange={(v) => patch('systemPrompt', v)}
          promptKind="system"
          pipeline={pipeline}
          agent={agent}
          placeholder="You are a research assistant..."
        />
      )}

      <PromptField
        label={imageAgent ? 'Image Prompt' : 'User Prompt'}
        value={form.userPrompt}
        onChange={(v) => patch('userPrompt', v)}
        promptKind="user"
        pipeline={pipeline}
        agent={agent}
        placeholder={imageAgent ? 'A minimalist hero illustration of {subject}, flat vector style' : 'Research the topic: {subject}'}
      />

      {imageAgent && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Field label="Image source">
              <select
                value={form.imageMode}
                onChange={(e) => saveAgentPatch({ imageMode: e.target.value as typeof form.imageMode })}
                className="w-full h-9 rounded border border-input-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="selected">Use selected image</option>
                <option value="generate">Generate during run</option>
                <option value="none">Skip image</option>
              </select>
            </Field>
            <Button size="sm" loading={generateImage.isPending} onClick={handleGenerateImage}>
              Generate image
            </Button>
          </div>

          {imageAssets.length === 0 ? (
            <div className="border rounded p-4 text-sm text-muted-foreground">
              No generated images yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {imageAssets.map((asset) => {
                const selected = form.selectedImageAssetId === asset.id
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleSelectImage(asset)}
                    className={`text-left rounded border overflow-hidden transition-colors ${selected ? 'border-accent bg-accent/5' : 'border-input-border hover:bg-muted/30'}`}
                  >
                    <img
                      src={imageAssetUrl(asset.id)}
                      alt=""
                      className="w-full aspect-square object-cover bg-muted"
                    />
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-medium truncate">{selected ? 'Selected' : 'Image'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{asset.prompt}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDelete}>Delete</Button>
        <Button size="sm" loading={update.isPending} onClick={handleSave}>Save</Button>
      </div>
    </div>
  )
}

function imageAssetUrl(assetId: string) {
  return `${API_BASE_URL}/api/image-assets/${assetId}/file`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      {children}
    </div>
  )
}
