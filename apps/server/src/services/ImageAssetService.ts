import { db } from '@project/db'
import { getImageModelLabel, getImageProvider } from './imageProviders'
import { OutputAssetService } from './OutputAssetService'

const assets = new OutputAssetService()

export class ImageAssetService {
  private async resolvePipeline(idOrSlug: string) {
    const pipeline = await db.pipeline.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, accountId: true },
    })
    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { statusCode: 404 })
    return pipeline
  }

  async list(idOrSlug: string, agentId?: string) {
    const pipeline = await this.resolvePipeline(idOrSlug)
    const agent = agentId
      ? await db.pipelineAgent.findFirst({
        where: { id: agentId, pipelineId: pipeline.id },
        select: { id: true, uid: true },
      })
      : null

    return db.imageAsset.findMany({
      where: {
        pipelineId: pipeline.id,
        ...(agent
          ? {
            OR: [
              { agentId: agent.id },
              { agentUid: agent.uid },
            ],
          }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async generate(idOrSlug: string, input: { agentId: string; prompt: string }) {
    const pipeline = await this.resolvePipeline(idOrSlug)
    const agent = await db.pipelineAgent.findFirstOrThrow({
      where: { id: input.agentId, pipelineId: pipeline.id },
      select: { id: true, uid: true },
    })

    const provider = getImageProvider()
    const model = getImageModelLabel()
    const prompt = input.prompt.trim()
    if (!prompt) throw Object.assign(new Error('Prompt is required'), { statusCode: 400 })

    let generated
    try {
      generated = await provider.generate({ prompt })
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string }; message?: string }
      const message = apiErr.error?.message ?? apiErr.message ?? 'Image generation failed'
      throw Object.assign(new Error(message), { statusCode: 502 })
    }
    if (!generated?.url) throw Object.assign(new Error('Image generation returned no image'), { statusCode: 502 })

    const draft = await db.imageAsset.create({
      data: {
        accountId: pipeline.accountId,
        pipelineId: pipeline.id,
        agentId: agent.id,
        agentUid: agent.uid,
        prompt,
        provider: provider.id,
        model,
        size: process.env.OPENAI_IMAGE_SIZE,
        path: '',
        url: generated.url.startsWith('data:') ? null : generated.url,
        status: 'ready',
      },
    })

    const saved = await assets.saveImageAssetFromUrl({
      accountId: pipeline.accountId,
      assetId: draft.id,
      imageUrl: generated.url,
    })

    if (!saved) {
      await db.imageAsset.update({
        where: { id: draft.id },
        data: { status: 'failed', error: 'Could not save generated image' },
      })
      throw Object.assign(new Error('Could not save generated image'), { statusCode: 500 })
    }

    return db.imageAsset.update({
      where: { id: draft.id },
      data: { path: saved.path },
    })
  }
}
