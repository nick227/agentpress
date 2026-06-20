import { readFileSync } from 'fs'
import { basename, join } from 'path'
import { LibraryAgentService } from './LibraryAgentService'
import type { PublishProgressReporter } from './publishProgress'
import { db, Prisma } from '@project/db'
import { OpenAIService } from './OpenAIService'
import { getImageProvider, getImageModelLabel } from './imageProviders'
import { PromptRenderService } from './PromptRenderService'
import { OutputAssetService } from './OutputAssetService'
import {
  WordPressService,
  resolveCategoryIds,
  sanitizeMediaFilename,
  type InlineImageUploadInput,
  type InlineImageUploadResult,
  type WordPressCredentials,
} from './WordPressService'
import { resolveExistingPath } from './runImagePaths'
import { ResearchContextService } from './ResearchContextService'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ai = new OpenAIService()
const imageProvider = getImageProvider()
const renderer = new PromptRenderService()
const assets = new OutputAssetService()
const wp = new WordPressService()
const researchContext = new ResearchContextService()

const ENC_KEY = (process.env.SESSION_SECRET ?? 'change-me-in-production-32chars!!').padEnd(32, '0').slice(0, 32)

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', ENC_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid encrypted value')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', ENC_KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8')
}

interface StartRunOptions {
  dryRun?: boolean
  title?: string
  forceRegenerate?: boolean
  forceRegenerateAgentUids?: string[]
  schedulePipelineExecutionId?: string
  researchItemOverrides?: Record<string, string>
}

interface InlineImageMeta {
  agentUid: string
  prompt: string
  url?: string
  path?: string
  relativePath?: string
  alt: string
  caption?: string
}

interface GeneratedPost {
  title: string
  excerpt: string
  body: string
  inlineImages?: InlineImageMeta[]
  thumbnailPrompt?: string
  thumbnailUrl?: string
  thumbnailStatus?: string
  thumbnailLocalPath?: string
  publishedUrl?: string
  wordpressMedia?: InlineImageUploadResult[]
}

interface AgentPromptRecord {
  uid: string
  name: string
  outputTarget: string
  cacheStatus: string
  systemPrompt: string
  userPrompt: string
}

interface AgentOutputRecord {
  text: string
  target: string
  image?: InlineImageMeta
}

interface AgentExecutionResult {
  output: string
  outputJson: InlineImageMeta | null
  cacheStatus: string
  renderedSystemPrompt: string
  renderedUserPrompt: string
  directImageOutput: boolean
}

interface PublishToWordPressResult {
  postId: string
  postUrl: string
  inlineUploads: InlineImageUploadResult[]
  featuredImageUploaded: boolean
}

function publishProgressReporter(attemptId: string): PublishProgressReporter {
  return async (message: string) => {
    await db.publishAttempt.update({
      where: { id: attemptId },
      data: { progressMessage: message },
    })
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`
}

function computeAgentInputHash(input: {
  agentUid: string
  model: string
  imageModel?: string
  outputTarget: string
  outputFormat: string
  renderedSystemPrompt: string
  renderedUserPrompt: string
  selectedImageAssetId?: string
}): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex')
}

function isImageAgent(agent: { outputFormat: string }): boolean {
  return agent.outputFormat === 'image'
}

function isStaticAgent(agent: { outputFormat: string }): boolean {
  return agent.outputFormat === 'static'
}

function isImageOutputTarget(target: string): boolean {
  return target === 'thumbnail' || target === 'image'
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wordpressCredentials(destination: {
  siteUrl: string
  username: string | null
  encryptedSecret: string
}): WordPressCredentials {
  return {
    siteUrl: destination.siteUrl,
    username: destination.username ?? '',
    appPassword: decrypt(destination.encryptedSecret),
  }
}

interface PublishRunContext {
  outputFolder?: string | null
  assets: Array<{ filename: string; path: string }>
}

async function resolveInlineUploadInputs(
  run: PublishRunContext,
  images: InlineImageMeta[],
): Promise<InlineImageUploadInput[]> {
  const inputs: InlineImageUploadInput[] = []
  for (const image of images) {
    if (!image.relativePath) continue
    const buffer = await assets.readImageBytes({
      path: image.path,
      relativePath: image.relativePath,
      url: image.url,
      outputFolder: run.outputFolder ?? undefined,
      runAssets: run.assets,
    })
    if (!buffer) {
      throw Object.assign(
        new Error(`Inline image file not found: ${image.relativePath}`),
        { statusCode: 500 },
      )
    }
    inputs.push({
      buffer,
      relativePath: image.relativePath,
      filename: sanitizeMediaFilename(basename(image.relativePath)),
      alt: image.alt,
      caption: image.caption,
    })
  }
  return inputs
}

function resolveThumbnailLocalPath(post: GeneratedPost, outputFolder?: string | null): string | undefined {
  return resolveExistingPath(
    post.thumbnailLocalPath,
    outputFolder ? join(outputFolder, 'thumbnail.png') : undefined,
  )
}

export class PipelineRunService {
  async startRun(idOrSlug: string, variables: Record<string, unknown>, dryRunOverrideOrOptions?: boolean | StartRunOptions) {
    const pipeline = await db.pipeline.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' }, where: { enabled: true }, include: { selectedImageAsset: true } },
      },
    })

    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })

    const options: StartRunOptions = typeof dryRunOverrideOrOptions === 'object'
      ? dryRunOverrideOrOptions
      : { dryRun: dryRunOverrideOrOptions }

    if (options.schedulePipelineExecutionId) {
      const existing = await db.pipelineRun.findUnique({
        where: { schedulePipelineExecutionId: options.schedulePipelineExecutionId },
      })
      if (existing) return existing
    }

    const dryRun = options.dryRun !== undefined ? options.dryRun : pipeline.dryRun
    const runVariables = variables ?? {}
    const title = options.title?.trim() || pipeline.name

    let run
    try {
      run = await db.pipelineRun.create({
        data: {
          pipelineId: pipeline.id,
          title,
          status: 'running',
          dryRun,
          variables: runVariables as any,
          destinationId: dryRun ? null : (pipeline.destinationId ?? null),
          schedulePipelineExecutionId: options.schedulePipelineExecutionId,
        },
      })
    } catch (error: any) {
      if (error.code !== 'P2002' || !options.schedulePipelineExecutionId) throw error
      const existing = await db.pipelineRun.findUnique({
        where: { schedulePipelineExecutionId: options.schedulePipelineExecutionId },
      })
      if (!existing) throw error
      return existing
    }

    this._executeRun(run.id, pipeline, runVariables, dryRun, options).catch(async (err) => {
      await db.pipelineRun.update({
        where: { id: run.id },
        data: { status: 'failed', error: String(err.message), completedAt: new Date() },
      })
    })

    return run
  }

  private async _executeRun(
    runId: string,
    pipeline: any,
    variables: Record<string, unknown>,
    dryRun: boolean,
    options: StartRunOptions = {},
  ) {
    const resolvedResearch = await researchContext.resolveForPipeline(pipeline, options.researchItemOverrides)
    const runVariables = { ...variables, ...resolvedResearch }

    await db.pipelineRun.update({
      where: { id: runId },
      data: { variables: runVariables as any },
    })

    const agentOutputs: Record<string, string> = {}
    const agentPrompts: AgentPromptRecord[] = []
    const generatedPost: GeneratedPost = { title: '', excerpt: '', body: '' }
    const outputByUid: Record<string, AgentOutputRecord> = {}

    await this.executeAgents({
      runId,
      pipeline,
      runVariables,
      options,
      agentOutputs,
      agentPrompts,
      generatedPost,
      outputByUid,
    })

    const composed = this.composeBody(pipeline, outputByUid)
    generatedPost.body = composed.body
    generatedPost.inlineImages = composed.inlineImages

    await this.generateFallbackThumbnail(runId, generatedPost)

    const { folder, thumbnailLocalPath } = await assets.saveRunAssets(
      runId,
      pipeline.slug,
      generatedPost,
      agentPrompts,
    )

    if (thumbnailLocalPath) {
      generatedPost.thumbnailLocalPath = thumbnailLocalPath
    }

    const runImageAssets = await db.runAsset.findMany({
      where: { pipelineRunId: runId, type: 'image' },
      select: { filename: true, path: true },
    })

    const finalStatus = await this.publishGeneratedPost({
      runId,
      pipeline,
      generatedPost,
      dryRun,
      outputFolder: folder,
      runImageAssets,
    })

    await db.pipelineRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        generatedPost: generatedPost as any,
        completedAt: new Date(),
      },
    })

    new LibraryAgentService().promoteFromRun(pipeline).catch(() => {})
  }

  private async executeAgents(input: {
    runId: string
    pipeline: any
    runVariables: Record<string, unknown>
    options: StartRunOptions
    agentOutputs: Record<string, string>
    agentPrompts: AgentPromptRecord[]
    generatedPost: GeneratedPost
    outputByUid: Record<string, AgentOutputRecord>
  }) {
    const forceRegenerateAgents = new Set(input.options.forceRegenerateAgentUids ?? [])
    const textModel = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o'
    const imageModel = getImageModelLabel()

    for (const agent of input.pipeline.agents) {
      const result = await this.executeAgent({
        runId: input.runId,
        pipeline: input.pipeline,
        agent,
        runVariables: input.runVariables,
        agentOutputs: input.agentOutputs,
        bypassCache: Boolean(input.options.forceRegenerate || forceRegenerateAgents.has(agent.uid)),
        textModel,
        imageModel,
      })

      this.recordAgentOutput(agent, result, input.agentOutputs, input.outputByUid, input.generatedPost)
      input.agentPrompts.push({
        uid: agent.uid,
        name: agent.name,
        outputTarget: agent.outputTarget,
        cacheStatus: result.cacheStatus,
        systemPrompt: result.renderedSystemPrompt,
        userPrompt: result.renderedUserPrompt,
      })
    }
  }

  private async executeAgent(input: {
    runId: string
    pipeline: any
    agent: any
    runVariables: Record<string, unknown>
    agentOutputs: Record<string, string>
    bypassCache: boolean
    textModel: string
    imageModel: string
  }): Promise<AgentExecutionResult> {
    const { agent } = input
    const imageAgent = isImageAgent(agent)
    const staticAgent = isStaticAgent(agent)
    const renderedSystemPrompt = imageAgent || staticAgent
      ? ''
      : renderer.render(agent.systemPrompt, input.runVariables, input.agentOutputs)
    const renderedUserPrompt = renderer.render(agent.userPrompt, input.runVariables, input.agentOutputs)
    const inputHash = computeAgentInputHash({
      agentUid: agent.uid,
      model: staticAgent ? 'static' : imageAgent ? imageProvider.id : input.textModel,
      imageModel: imageAgent || isImageOutputTarget(agent.outputTarget) ? input.imageModel : undefined,
      outputTarget: agent.outputTarget,
      outputFormat: agent.outputFormat,
      renderedSystemPrompt,
      renderedUserPrompt,
      selectedImageAssetId: isImageOutputTarget(agent.outputTarget)
        ? (agent.selectedImageAssetId ?? '')
        : undefined,
    })
    const agentRun = await db.agentRun.create({
      data: {
        pipelineRunId: input.runId,
        agentUid: agent.uid,
        agentName: agent.name,
        outputTarget: agent.outputTarget,
        renderedSystemPrompt,
        renderedUserPrompt,
        inputHash,
        status: 'running',
        sortOrder: agent.sortOrder,
        startedAt: new Date(),
      },
    })

    try {
      const reusable = input.bypassCache
        ? null
        : await this.findReusableAgentRun(input.pipeline.id, agent.uid, inputHash, agentRun.id)
      const generated = await this.generateAgentOutput({
        runId: input.runId,
        pipeline: input.pipeline,
        agent,
        renderedSystemPrompt,
        renderedUserPrompt,
        reusable,
      })
      await db.agentRun.update({
        where: { id: agentRun.id },
        data: {
          outputText: generated.output,
          outputJson: generated.outputJson as any,
          status: 'completed',
          cacheStatus: generated.cacheStatus,
          reusedFromAgentRunId: reusable?.id ?? null,
          completedAt: new Date(),
        },
      })
      return {
        ...generated,
        renderedSystemPrompt,
        renderedUserPrompt,
      }
    } catch (err: any) {
      await db.agentRun.update({
        where: { id: agentRun.id },
        data: { status: 'failed', cacheStatus: 'failed', error: err.message, completedAt: new Date() },
      })
      throw err
    }
  }

  private async generateAgentOutput(input: {
    runId: string
    pipeline: any
    agent: any
    renderedSystemPrompt: string
    renderedUserPrompt: string
    reusable: any
  }): Promise<Pick<AgentExecutionResult, 'output' | 'outputJson' | 'cacheStatus' | 'directImageOutput'>> {
    const directImageOutput = isStaticAgent(input.agent) || isImageAgent(input.agent)
    const output = directImageOutput
      ? input.renderedUserPrompt
      : (input.reusable?.outputText ?? await ai.generateText(input.renderedSystemPrompt, input.renderedUserPrompt))
    const cacheStatus = input.reusable ? 'reused' : 'generated'
    let outputJson = (input.reusable?.outputJson as InlineImageMeta | null) ?? null

    if (input.agent.outputTarget === 'image' || (directImageOutput && input.agent.outputTarget === 'thumbnail')) {
      const thumbnail = input.agent.outputTarget === 'thumbnail'
      outputJson = await this.resolveImageForAgent({
        runId: input.runId,
        pipeline: input.pipeline,
        agent: input.agent,
        prompt: output,
        reusableJson: input.reusable?.outputJson,
        cacheStatus,
        relativePath: thumbnail ? 'thumbnail.png' : `images/${slugify(input.agent.uid)}.png`,
        label: `${thumbnail ? 'Thumbnail' : 'Inline Image'}: ${input.agent.name}`,
        ...(isStaticAgent(input.agent) ? { staticOnly: true } : {}),
      })
    }

    return { output, outputJson, cacheStatus, directImageOutput }
  }

  private recordAgentOutput(
    agent: any,
    result: AgentExecutionResult,
    agentOutputs: Record<string, string>,
    outputByUid: Record<string, AgentOutputRecord>,
    generatedPost: GeneratedPost,
  ) {
    agentOutputs[agent.uid] = result.output
    outputByUid[agent.uid] = {
      text: result.output,
      target: agent.outputTarget,
      image: result.outputJson ?? undefined,
    }

    if (agent.outputTarget === 'title') generatedPost.title = result.output.trim()
    if (agent.outputTarget === 'excerpt') generatedPost.excerpt = result.output.trim()
    if (agent.outputTarget === 'thumbnail_prompt') generatedPost.thumbnailPrompt = result.output.trim()
    if (agent.outputTarget === 'thumbnail' && result.directImageOutput) {
      generatedPost.thumbnailUrl = result.outputJson?.url
      generatedPost.thumbnailLocalPath = result.outputJson?.path
      generatedPost.thumbnailPrompt = result.output
      generatedPost.thumbnailStatus = result.outputJson?.url || result.outputJson?.path ? 'done' : 'failed'
    }
  }

  private async generateFallbackThumbnail(runId: string, generatedPost: GeneratedPost) {
    if (!generatedPost.thumbnailPrompt || generatedPost.thumbnailUrl) return

    generatedPost.thumbnailStatus = 'generating'
    await db.pipelineRun.update({ where: { id: runId }, data: { generatedPost: generatedPost as any } })

    try {
      const imageUrl = await ai.generateImage(generatedPost.thumbnailPrompt)
      if (imageUrl) {
        generatedPost.thumbnailUrl = imageUrl
        generatedPost.thumbnailStatus = 'done'
      } else {
        generatedPost.thumbnailStatus = 'failed'
      }
    } catch {
      generatedPost.thumbnailStatus = 'failed'
    }
  }

  private async publishGeneratedPost(input: {
    runId: string
    pipeline: any
    generatedPost: GeneratedPost
    dryRun: boolean
    outputFolder: string
    runImageAssets: Array<{ filename: string; path: string }>
  }): Promise<string> {
    if (input.dryRun || !input.pipeline.destinationId) return 'completed'

    const destination = await db.destination.findUnique({ where: { id: input.pipeline.destinationId } })
    if (!destination) return 'completed'

    const attempt = await db.publishAttempt.create({
      data: {
        pipelineRunId: input.runId,
        destinationId: destination.id,
        status: 'pending',
        progressMessage: 'Starting WordPress publish…',
      },
    })

    try {
      const result = await this.publishToWordPress(
        input.generatedPost,
        { outputFolder: input.outputFolder, assets: input.runImageAssets },
        input.pipeline,
        destination,
        publishProgressReporter(attempt.id),
      )
      input.generatedPost.publishedUrl = result.postUrl
      input.generatedPost.wordpressMedia = result.inlineUploads
      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'success',
          remotePostId: result.postId,
          remoteUrl: result.postUrl,
          progressMessage: `Published to ${result.postUrl}`,
        },
      })
      return 'posted'
    } catch (err: any) {
      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: { status: 'failed', error: err.message, progressMessage: err.message },
      })
      return 'completed'
    }
  }

  private async findReusableAgentRun(pipelineId: string, agentUid: string, inputHash: string, currentAgentRunId: string) {
    return db.agentRun.findFirst({
      where: {
        id: { not: currentAgentRunId },
        agentUid,
        inputHash,
        status: 'completed',
        outputText: { not: null },
        pipelineRun: { pipelineId },
      },
      orderBy: { completedAt: 'desc' },
    })
  }

  private async resolveImageForAgent(input: {
    runId: string
    pipeline: any
    agent: any
    prompt: string
    reusableJson: any
    cacheStatus: string
    relativePath: string
    label: string
    staticOnly?: boolean
  }): Promise<InlineImageMeta> {
    const alt = input.agent.name

    if (input.staticOnly && input.agent.imageMode === 'none') {
      throw Object.assign(
        new Error(`Static agent "${input.agent.name}" requires an uploaded image`),
        { statusCode: 400 },
      )
    }

    if (input.agent.imageMode === 'none') {
      return {
        agentUid: input.agent.uid,
        prompt: input.prompt,
        alt,
        caption: '',
      }
    }

    if (input.agent.imageMode === 'selected' && input.agent.selectedImageAsset?.path) {
      const copied = await assets.copyImageAsset({
        runId: input.runId,
        pipelineSlug: input.pipeline.slug,
        sourcePath: input.agent.selectedImageAsset.path,
        relativePath: input.relativePath,
        label: input.label,
      })

      return {
        agentUid: input.agent.uid,
        prompt: input.agent.selectedImageAsset.prompt ?? input.prompt,
        url: `/api/image-assets/${input.agent.selectedImageAsset.id}/file`,
        path: copied?.path ?? input.agent.selectedImageAsset.path,
        relativePath: copied?.relativePath ?? input.relativePath,
        alt,
        caption: '',
      }
    }

    if (input.staticOnly) {
      throw Object.assign(
        new Error(`Static agent "${input.agent.name}" requires a selected image`),
        { statusCode: 400 },
      )
    }

    if (input.cacheStatus === 'reused' && input.reusableJson?.path) {
      const copied = await assets.copyImageAsset({
        runId: input.runId,
        pipelineSlug: input.pipeline.slug,
        sourcePath: input.reusableJson.path,
        relativePath: input.relativePath,
        label: input.label,
      })
      return {
        ...input.reusableJson,
        agentUid: input.agent.uid,
        prompt: input.prompt,
        alt: input.reusableJson.alt ?? alt,
        relativePath: copied?.relativePath ?? input.reusableJson.relativePath,
        path: copied?.path ?? input.reusableJson.path,
      }
    }

    const generated = await imageProvider.generate({ prompt: input.prompt })
    const imageUrl = generated?.url ?? null
    const saved = imageUrl ? await assets.saveImageFromUrl({
      runId: input.runId,
      pipelineSlug: input.pipeline.slug,
      imageUrl,
      relativePath: input.relativePath,
      label: input.label,
    }) : null

    return {
      agentUid: input.agent.uid,
      prompt: input.prompt,
      url: imageUrl ?? undefined,
      path: saved?.path,
      relativePath: saved?.relativePath ?? input.relativePath,
      alt,
      caption: '',
    }
  }

  private composeBody(pipeline: any, outputByUid: Record<string, { text: string; target: string; image?: InlineImageMeta }>): { body: string; inlineImages: InlineImageMeta[] } {
    const composerRows = Array.isArray(pipeline.bodyComposer) && pipeline.bodyComposer.length > 0
      ? pipeline.bodyComposer
      : pipeline.agents
        .filter((agent: any) => agent.outputTarget === 'body' || agent.outputTarget === 'image')
        .map((agent: any) => ({ id: agent.uid, type: 'agent_output', agentUid: agent.uid, include: true }))

    const parts: string[] = []
    const inlineImages: InlineImageMeta[] = []
    for (const row of composerRows) {
      if (row.include === false) continue
      const entry = outputByUid[row.agentUid]
      if (!entry) continue
      if (entry.target === 'image' && entry.image?.relativePath) {
        parts.push(this.renderImageFigure(entry.image))
        inlineImages.push(entry.image)
      } else if (entry.target === 'body') {
        parts.push(entry.text)
      }
    }
    return { body: parts.join('\n\n'), inlineImages }
  }

  private renderImageFigure(image: InlineImageMeta): string {
    const src = image.relativePath ?? image.path ?? image.url ?? ''
    const caption = image.caption?.trim()
    return `<figure>\n<img data-ap-src="${escapeHtml(src)}" src="./${escapeHtml(src)}" alt="${escapeHtml(image.alt)}" />${caption ? `\n<figcaption>${escapeHtml(caption)}</figcaption>` : ''}\n</figure>`
  }

  private async publishToWordPress(
    generatedPost: GeneratedPost,
    run: PublishRunContext,
    pipeline: { wpCategoryIds?: unknown },
    destination: {
      siteUrl: string
      username: string | null
      encryptedSecret: string
      defaultStatus: string
      defaultCategoryIds?: unknown
    },
    reportProgress: PublishProgressReporter,
  ): Promise<PublishToWordPressResult> {
    const credentials = wordpressCredentials(destination)
    const siteHost = destination.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

    await reportProgress(`Connecting to ${siteHost}…`)
    await reportProgress('Preparing images for upload…')

    const inlineInputs = await resolveInlineUploadInputs(run, generatedPost.inlineImages ?? [])

    if (inlineInputs.length > 0) {
      await reportProgress(`Uploading ${inlineInputs.length} inline image${inlineInputs.length === 1 ? '' : 's'}…`)
    }

    const { body, uploaded, failed } = await wp.uploadInlineImages(
      credentials,
      generatedPost.body,
      inlineInputs,
      (message) => reportProgress(message),
    )

    if (failed.length > 0) {
      throw new Error(`Failed to upload inline image(s): ${failed.join('; ')}`)
    }

    const thumbnailPath = resolveThumbnailLocalPath(generatedPost, run.outputFolder)
    const thumbnailBuffer = thumbnailPath ? readFileSync(thumbnailPath) : undefined

    const result = await wp.publish(
      credentials,
      {
        title: generatedPost.title,
        excerpt: generatedPost.excerpt,
        content: body,
        status: destination.defaultStatus as 'draft' | 'publish',
        categoryIds: resolveCategoryIds(pipeline, destination),
      },
      thumbnailBuffer,
      (message) => reportProgress(message),
    )

    await reportProgress(`Published to ${result.postUrl}`)

    return {
      postId: result.postId,
      postUrl: result.postUrl,
      inlineUploads: uploaded,
      featuredImageUploaded: result.featuredImageUploaded,
    }
  }

  async publishRun(runId: string) {
    const run = await db.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        pipeline: true,
        assets: { where: { type: 'image' }, select: { filename: true, path: true } },
      },
    })
    if (!run) throw Object.assign(new Error('Run not found'), { statusCode: 404 })
    if (!run.generatedPost) throw Object.assign(new Error('Run has no generated content'), { statusCode: 400 })

    const destinationId = run.pipeline.destinationId
    if (!destinationId) throw Object.assign(new Error('No destination configured on pipeline'), { statusCode: 400 })

    const destination = await db.destination.findUnique({ where: { id: destinationId } })
    if (!destination) throw Object.assign(new Error('Destination not found'), { statusCode: 404 })

    const attempt = await db.publishAttempt.create({
      data: {
        pipelineRunId: runId,
        destinationId: destination.id,
        status: 'pending',
        progressMessage: 'Starting WordPress publish…',
      },
    })

    const reportProgress = publishProgressReporter(attempt.id)

    try {
      const post = run.generatedPost as unknown as GeneratedPost
      const result = await this.publishToWordPress(
        post,
        { outputFolder: run.outputFolder, assets: run.assets },
        run.pipeline,
        destination,
        reportProgress,
      )

      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'success',
          remotePostId: result.postId,
          remoteUrl: result.postUrl,
          progressMessage: `Published to ${result.postUrl}`,
        },
      })

      await db.pipelineRun.update({
        where: { id: runId },
        data: {
          status: 'posted',
          generatedPost: {
            ...post,
            publishedUrl: result.postUrl,
            wordpressMedia: result.inlineUploads,
          } as any,
        },
      })

      return {
        ok: true,
        remoteUrl: result.postUrl,
        remotePostId: result.postId,
        inlineImagesUploaded: result.inlineUploads.length,
        featuredImageUploaded: result.featuredImageUploaded,
      }
    } catch (err: any) {
      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
          error: err.message,
          progressMessage: err.message,
        },
      })
      throw err
    }
  }
}
