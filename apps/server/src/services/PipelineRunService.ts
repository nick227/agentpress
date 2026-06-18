import { readFileSync } from 'fs'
import { basename } from 'path'
import { db, Prisma } from '@project/db'
import { OpenAIService } from './OpenAIService'
import { PromptRenderService } from './PromptRenderService'
import { OutputAssetService } from './OutputAssetService'
import {
  WordPressService,
  resolveCategoryIds,
  type InlineImageUploadInput,
  type InlineImageUploadResult,
  type WordPressCredentials,
} from './WordPressService'
import { LibraryAgentService } from './LibraryAgentService'
import { ResearchContextService } from './ResearchContextService'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ai = new OpenAIService()
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
  forceRegenerate?: boolean
  forceRegenerateAgentUids?: string[]
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

interface PublishToWordPressResult {
  postId: string
  postUrl: string
  inlineUploads: InlineImageUploadResult[]
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
}): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex')
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

function toInlineUploadInputs(images: InlineImageMeta[]): InlineImageUploadInput[] {
  return images
    .filter((image) => image.path && image.relativePath)
    .map((image) => ({
      localPath: image.path as string,
      relativePath: image.relativePath as string,
      filename: basename(image.relativePath as string),
      alt: image.alt,
      caption: image.caption,
    }))
}

export class PipelineRunService {
  async startRun(idOrSlug: string, variables: Record<string, unknown>, dryRunOverrideOrOptions?: boolean | StartRunOptions) {
    const pipeline = await db.pipeline.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        account: true,
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' }, where: { enabled: true } },
      },
    })

    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })

    const options: StartRunOptions = typeof dryRunOverrideOrOptions === 'object'
      ? dryRunOverrideOrOptions
      : { dryRun: dryRunOverrideOrOptions }

    const dryRun = options.dryRun !== undefined ? options.dryRun : pipeline.dryRun
    const runVariables = variables ?? {}

    const run = await db.pipelineRun.create({
      data: {
        accountId: pipeline.accountId,
        pipelineId: pipeline.id,
        status: 'running',
        dryRun,
        variables: runVariables as any,
        destinationId: dryRun ? null : (pipeline.destinationId ?? null),
      },
    })

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
    const resolvedResearch = await researchContext.resolveForPipeline(pipeline)
    const runVariables = { ...variables, ...resolvedResearch }

    await db.pipelineRun.update({
      where: { id: runId },
      data: { variables: runVariables as any },
    })

    const agentOutputs: Record<string, string> = {}
    const agentPrompts: Array<{
      uid: string
      name: string
      outputTarget: string
      cacheStatus: string
      systemPrompt: string
      userPrompt: string
    }> = []
    const generatedPost: GeneratedPost = { title: '', excerpt: '', body: '' }
    const outputByUid: Record<string, { text: string; target: string; image?: InlineImageMeta }> = {}
    const forceRegenerateAgents = new Set(options.forceRegenerateAgentUids ?? [])
    const model = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o'
    const imageModel = process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3'

    for (const agent of pipeline.agents) {
      const renderedSystemPrompt = renderer.render(agent.systemPrompt, runVariables, agentOutputs)
      const renderedUserPrompt = renderer.render(agent.userPrompt, runVariables, agentOutputs)
      const inputHash = computeAgentInputHash({
        agentUid: agent.uid,
        model,
        imageModel: agent.outputTarget === 'image' ? imageModel : undefined,
        outputTarget: agent.outputTarget,
        outputFormat: agent.outputFormat,
        renderedSystemPrompt,
        renderedUserPrompt,
      })

      const agentRun = await db.agentRun.create({
        data: {
          pipelineRunId: runId,
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
        const shouldBypassCache = options.forceRegenerate || forceRegenerateAgents.has(agent.uid)
        const reusable = shouldBypassCache ? null : await this.findReusableAgentRun(pipeline.id, agent.uid, inputHash, agentRun.id)
        const output = reusable?.outputText ?? await ai.generateText(renderedSystemPrompt, renderedUserPrompt)
        const cacheStatus = reusable ? 'reused' : 'generated'
        let outputJson: InlineImageMeta | null = (reusable?.outputJson as InlineImageMeta | null) ?? null

        agentOutputs[agent.uid] = output

        if (agent.outputTarget === 'image') {
          outputJson = await this.resolveImageOutput({
            runId,
            pipeline,
            agent,
            prompt: output,
            reusableJson: reusable?.outputJson,
            cacheStatus,
          })
        }

        outputByUid[agent.uid] = {
          text: output,
          target: agent.outputTarget,
          image: outputJson ?? undefined,
        }

        switch (agent.outputTarget) {
          case 'title':
            generatedPost.title = output.trim()
            break
          case 'excerpt':
            generatedPost.excerpt = output.trim()
            break
          case 'thumbnail_prompt':
            generatedPost.thumbnailPrompt = output.trim()
            break
          case 'none':
          case 'scratch':
          case 'body':
          case 'image':
            break
        }

        await db.agentRun.update({
          where: { id: agentRun.id },
          data: {
            outputText: output,
            outputJson: outputJson as any,
            status: 'completed',
            cacheStatus,
            reusedFromAgentRunId: reusable?.id ?? null,
            completedAt: new Date(),
          },
        })

        agentPrompts.push({
          uid: agent.uid,
          name: agent.name,
          outputTarget: agent.outputTarget,
          cacheStatus,
          systemPrompt: renderedSystemPrompt,
          userPrompt: renderedUserPrompt,
        })
      } catch (err: any) {
        await db.agentRun.update({
          where: { id: agentRun.id },
          data: { status: 'failed', cacheStatus: 'failed', error: err.message, completedAt: new Date() },
        })
        throw err
      }
    }

    const composed = this.composeBody(pipeline, outputByUid)
    generatedPost.body = composed.body
    generatedPost.inlineImages = composed.inlineImages

    if (generatedPost.thumbnailPrompt) {
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

    const { thumbnailLocalPath } = await assets.saveRunAssets(
      runId,
      pipeline.account.slug,
      pipeline.slug,
      generatedPost,
      agentPrompts,
    )

    if (thumbnailLocalPath) {
      generatedPost.thumbnailLocalPath = thumbnailLocalPath
    }

    let finalStatus = 'completed'

    if (!dryRun && pipeline.destinationId) {
      const destination = await db.destination.findUnique({ where: { id: pipeline.destinationId } })
      if (destination) {
        const attempt = await db.publishAttempt.create({
          data: {
            pipelineRunId: runId,
            destinationId: destination.id,
            status: 'pending',
          },
        })

        try {
          const result = await this.publishToWordPress(generatedPost, pipeline, destination)
          generatedPost.publishedUrl = result.postUrl
          generatedPost.wordpressMedia = result.inlineUploads
          finalStatus = 'posted'

          await db.publishAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'success',
              remotePostId: result.postId,
              remoteUrl: result.postUrl,
            },
          })
        } catch (err: any) {
          await db.publishAttempt.update({
            where: { id: attempt.id },
            data: { status: 'failed', error: err.message },
          })
        }
      }
    }

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

  private async resolveImageOutput(input: {
    runId: string
    pipeline: any
    agent: any
    prompt: string
    reusableJson: any
    cacheStatus: string
  }): Promise<InlineImageMeta> {
    const alt = input.agent.name
    const relativePath = `images/${slugify(input.agent.uid)}.png`

    if (input.cacheStatus === 'reused' && input.reusableJson?.path) {
      const copied = await assets.copyImageAsset({
        runId: input.runId,
        accountSlug: input.pipeline.account.slug,
        pipelineSlug: input.pipeline.slug,
        sourcePath: input.reusableJson.path,
        relativePath,
        label: `Inline Image: ${input.agent.name}`,
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

    const imageUrl = await ai.generateImage(input.prompt)
    const saved = imageUrl ? await assets.saveImageFromUrl({
      runId: input.runId,
      accountSlug: input.pipeline.account.slug,
      pipelineSlug: input.pipeline.slug,
      imageUrl,
      relativePath,
      label: `Inline Image: ${input.agent.name}`,
    }) : null

    return {
      agentUid: input.agent.uid,
      prompt: input.prompt,
      url: imageUrl ?? undefined,
      path: saved?.path,
      relativePath: saved?.relativePath ?? relativePath,
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
    pipeline: { wpCategoryIds?: unknown },
    destination: {
      siteUrl: string
      username: string | null
      encryptedSecret: string
      defaultStatus: string
      defaultCategoryIds?: unknown
    },
  ): Promise<PublishToWordPressResult> {
    const credentials = wordpressCredentials(destination)
    const inlineInputs = toInlineUploadInputs(generatedPost.inlineImages ?? [])
    const { body, uploaded, failed } = await wp.uploadInlineImages(
      credentials,
      generatedPost.body,
      inlineInputs,
    )

    if (failed.length > 0) {
      throw new Error(`Failed to upload inline image(s): ${failed.join('; ')}`)
    }

    const thumbnailBuffer = generatedPost.thumbnailLocalPath
      ? readFileSync(generatedPost.thumbnailLocalPath)
      : undefined

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
    )

    return { ...result, inlineUploads: uploaded }
  }

  async publishRun(runId: string) {
    const run = await db.pipelineRun.findUnique({
      where: { id: runId },
      include: { pipeline: true },
    })
    if (!run) throw Object.assign(new Error('Run not found'), { statusCode: 404 })
    if (!run.generatedPost) throw Object.assign(new Error('Run has no generated content'), { statusCode: 400 })

    const destinationId = run.pipeline.destinationId
    if (!destinationId) throw Object.assign(new Error('No destination configured on pipeline'), { statusCode: 400 })

    const destination = await db.destination.findUnique({ where: { id: destinationId } })
    if (!destination) throw Object.assign(new Error('Destination not found'), { statusCode: 404 })

    const attempt = await db.publishAttempt.create({
      data: { pipelineRunId: runId, destinationId: destination.id, status: 'pending' },
    })

    try {
      const post = run.generatedPost as unknown as GeneratedPost
      const result = await this.publishToWordPress(post, run.pipeline, destination)

      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: { status: 'success', remotePostId: result.postId, remoteUrl: result.postUrl },
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

      return { ok: true, remoteUrl: result.postUrl }
    } catch (err: any) {
      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: { status: 'failed', error: err.message },
      })
      throw err
    }
  }
}
