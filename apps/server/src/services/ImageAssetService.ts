import { db } from '@project/db'
import { getImageModelLabel, getImageProvider } from './imageProviders'
import { OutputAssetService } from './OutputAssetService'

const assets = new OutputAssetService()

export class ImageAssetService {
  async list(pipelineId: string, agentId?: string) {
    const agent = agentId
      ? await db.pipelineAgent.findFirst({
        where: { id: agentId, pipelineId },
        select: { id: true, uid: true },
      })
      : null

    return db.imageAsset.findMany({
      where: {
        pipelineId,
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

  async generate(pipelineId: string, input: { agentId: string; prompt: string }) {
    const pipeline = await db.pipeline.findUniqueOrThrow({
      where: { id: pipelineId },
      select: { id: true, accountId: true },
    })
    const agent = await db.pipelineAgent.findFirstOrThrow({
      where: { id: input.agentId, pipelineId },
      select: { id: true, uid: true },
    })

    const provider = getImageProvider()
    const model = getImageModelLabel()
    const prompt = input.prompt.trim()
    if (!prompt) throw Object.assign(new Error('Prompt is required'), { statusCode: 400 })

    const generated = await provider.generate({ prompt })
    if (!generated?.url) throw Object.assign(new Error('Image generation failed'), { statusCode: 502 })

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
