import { readFileSync } from 'fs'
import { db } from '@project/db'
import { OpenAIService } from './OpenAIService'
import { PromptRenderService } from './PromptRenderService'
import { OutputAssetService } from './OutputAssetService'
import { WordPressService } from './WordPressService'
import { LibraryAgentService } from './LibraryAgentService'
import { ResearchContextService } from './ResearchContextService'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ai = new OpenAIService()
const renderer = new PromptRenderService()
const assets = new OutputAssetService()
const wp = new WordPressService()
const researchContext = new ResearchContextService()

const ENC_KEY = (process.env.SESSION_SECRET ?? 'change-me-in-production-32chars!!').padEnd(32, '0').slice(0, 32)

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', ENC_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid encrypted value')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', ENC_KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8')
}

export { encrypt, decrypt }

export class PipelineRunService {
  async startRun(idOrSlug: string, variables: Record<string, unknown>, dryRunOverride?: boolean) {
    const pipeline = await db.pipeline.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        account: true,
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' }, where: { enabled: true } },
      },
    })

    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })

    const dryRun = dryRunOverride !== undefined ? dryRunOverride : pipeline.dryRun
    const resolvedResearch = await researchContext.resolveForPipeline(pipeline)
    const runVariables = { ...variables, ...resolvedResearch }

    // Create the run record first
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

    // Execute asynchronously — return run immediately so the client can poll
    this._executeRun(run.id, pipeline, runVariables, dryRun).catch(async (err) => {
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
  ) {
    const agentOutputs: Record<string, string> = {}
    const generatedPost: any = { title: '', excerpt: '', body: '' }
    const bodyParts: string[] = []

    for (const agent of pipeline.agents) {
      const agentRun = await db.agentRun.create({
        data: {
          pipelineRunId: runId,
          agentUid: agent.uid,
          agentName: agent.name,
          outputTarget: agent.outputTarget,
          renderedSystemPrompt: renderer.render(agent.systemPrompt, variables, agentOutputs),
          renderedUserPrompt: renderer.render(agent.userPrompt, variables, agentOutputs),
          status: 'running',
          sortOrder: agent.sortOrder,
          startedAt: new Date(),
        },
      })

      try {
        const output = await ai.generateText(agentRun.renderedSystemPrompt, agentRun.renderedUserPrompt)

        agentOutputs[agent.uid] = output

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
          case 'body':
            bodyParts.push(output)
            break
          case 'scratch':
            break // stored in agentOutputs only — not published
        }

        await db.agentRun.update({
          where: { id: agentRun.id },
          data: { outputText: output, status: 'completed', completedAt: new Date() },
        })
      } catch (err: any) {
        await db.agentRun.update({
          where: { id: agentRun.id },
          data: { status: 'failed', error: err.message, completedAt: new Date() },
        })
        throw err
      }
    }

    generatedPost.body = bodyParts.join('\n\n')

    // Signal to UI poller that image generation is starting
    if (generatedPost.thumbnailPrompt) {
      generatedPost.thumbnailStatus = 'generating'
      await db.pipelineRun.update({ where: { id: runId }, data: { generatedPost } })

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

    // Save output assets — also downloads thumbnail.png from DALL-E URL if available
    const { thumbnailLocalPath } = await assets.saveRunAssets(
      runId,
      pipeline.account.slug,
      pipeline.slug,
      generatedPost,
      agentOutputs,
    )

    if (thumbnailLocalPath) {
      generatedPost.thumbnailLocalPath = thumbnailLocalPath
    }

    let finalStatus = 'completed'

    // Publish to WordPress if live run and destination is configured
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
          const secret = decrypt(destination.encryptedSecret)
          const thumbnailBuffer = generatedPost.thumbnailLocalPath
            ? readFileSync(generatedPost.thumbnailLocalPath as string)
            : undefined
          const result = await wp.publish(
            destination.siteUrl,
            destination.username ?? '',
            secret,
            {
              title: generatedPost.title,
              excerpt: generatedPost.excerpt,
              content: generatedPost.body,
              status: destination.defaultStatus as 'draft' | 'publish',
            },
            thumbnailBuffer,
          )

          await db.publishAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'success',
              remotePostId: result.postId,
              remoteUrl: result.postUrl,
            },
          })

          generatedPost.publishedUrl = result.postUrl
          finalStatus = 'posted'
        } catch (err: any) {
          await db.publishAttempt.update({
            where: { id: attempt.id },
            data: { status: 'failed', error: err.message },
          })
          // publish failure does not fail the run
        }
      }
    }

    await db.pipelineRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        generatedPost,
        completedAt: new Date(),
      },
    })

    // Silently promote agent prompts to the shared library for reuse
    new LibraryAgentService().promoteFromRun(pipeline).catch(() => {})
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
      const secret = decrypt(destination.encryptedSecret)
      const post = run.generatedPost as any
      const thumbnailBuffer = post.thumbnailLocalPath
        ? readFileSync(post.thumbnailLocalPath as string)
        : undefined
      const result = await wp.publish(
        destination.siteUrl,
        destination.username ?? '',
        secret,
        {
          title: post.title,
          excerpt: post.excerpt,
          content: post.body,
          status: destination.defaultStatus as 'draft' | 'publish',
        },
        thumbnailBuffer,
      )

      await db.publishAttempt.update({
        where: { id: attempt.id },
        data: { status: 'success', remotePostId: result.postId, remoteUrl: result.postUrl },
      })

      await db.pipelineRun.update({
        where: { id: runId },
        data: { status: 'posted' },
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
