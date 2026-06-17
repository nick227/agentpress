import { db } from '@project/db'
import { OpenAIService } from './OpenAIService'
import { PromptRenderService } from './PromptRenderService'
import { OutputAssetService } from './OutputAssetService'
import { WordPressService } from './WordPressService'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ai = new OpenAIService()
const renderer = new PromptRenderService()
const assets = new OutputAssetService()
const wp = new WordPressService()

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
  async startRun(pipelineId: string, variables: Record<string, unknown>, dryRunOverride?: boolean) {
    const pipeline = await db.pipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      include: {
        account: true,
        variables: { orderBy: { sortOrder: 'asc' } },
        agents: { orderBy: { sortOrder: 'asc' }, where: { enabled: true } },
      },
    })

    const dryRun = dryRunOverride !== undefined ? dryRunOverride : pipeline.dryRun

    // Create the run record first
    const run = await db.pipelineRun.create({
      data: {
        accountId: pipeline.accountId,
        pipelineId,
        status: 'running',
        dryRun,
        variables: variables as any,
        destinationId: dryRun ? null : (pipeline.destinationId ?? null),
      },
    })

    // Execute asynchronously — return run immediately so the client can poll
    this._executeRun(run.id, pipeline, variables, dryRun).catch(async (err) => {
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

    // Generate thumbnail image if a prompt was produced
    if (generatedPost.thumbnailPrompt) {
      try {
        const imageUrl = await ai.generateImage(generatedPost.thumbnailPrompt)
        if (imageUrl) generatedPost.thumbnailUrl = imageUrl
      } catch {
        // image generation failure is non-fatal
      }
    }

    // Save output assets
    await assets.saveRunAssets(
      runId,
      pipeline.account.slug,
      pipeline.slug,
      generatedPost,
      agentOutputs,
    )

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
  }
}
