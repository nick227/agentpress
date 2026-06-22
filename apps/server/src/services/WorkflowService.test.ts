import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
const create = vi.fn()
const update = vi.fn()
const deleteMany = vi.fn()
const createMany = vi.fn()
const updateMany = vi.fn()
const $transaction = vi.fn()
const pipelineFindFirst = vi.fn()
const pipelineFindUnique = vi.fn()

vi.mock('@project/db', () => ({
  db: {
    workflow: {
      findMany: (...args: unknown[]) => findMany(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      delete: vi.fn(),
    },
    workflowNode: {
      deleteMany: (...args: unknown[]) => deleteMany(...args),
      createMany: (...args: unknown[]) => createMany(...args),
    },
    pipelineAgent: {
      updateMany: (...args: unknown[]) => updateMany(...args),
      createMany: (...args: unknown[]) => createMany(...args),
    },
    pipeline: {
      findFirst: (...args: unknown[]) => pipelineFindFirst(...args),
      findUnique: (...args: unknown[]) => pipelineFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => $transaction(fn),
  },
}))
vi.mock('./communityWorkspace', () => ({
  getCommunityWorkspaceId: vi.fn().mockResolvedValue('community'),
}))

import { WorkflowService } from './WorkflowService'

const context = { userId: 'user', workspaceId: 'workspace', workspaceType: 'PERSONAL' as const, role: 'OWNER' as const }

const baseNode = {
  id: 'node1', workflowId: 'wf1', uid: 'writer', kind: 'AI_TEXT', name: 'Writer',
  description: null, systemPrompt: 'System', userPrompt: 'User',
  outputTarget: 'body', outputFormat: 'markdown', imageMode: 'generate',
  enabled: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
}

const base = {
  id: 'wf1', workspaceId: 'workspace', visibility: 'PRIVATE', key: 'seo-writing',
  slug: 'seo-writing', name: 'SEO Writing', description: null, category: 'writing',
  tags: [], sortOrder: 0, sourceWorkflowId: null, usageCount: 0,
  forkedAt: null, sourceVersionAt: null, createdAt: new Date(), updatedAt: new Date(),
  nodes: [baseNode], _count: { nodes: 1 },
}

const basePipeline = {
  id: 'pipeline1', workspaceId: 'workspace',
  agents: [{ uid: 'existing', sortOrder: 0 }],
}

describe('WorkflowService resource contract', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Catalog resolution ────────────────────────────────────────────────

  it('lists only workspace-owned Workflows by default', async () => {
    findMany.mockResolvedValue([{ ...base }])
    const result = await new WorkflowService().list(context)
    expect(result).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ workspaceId: 'workspace' }]) },
    }))
  })

  it('shadows Community Workflows by key when resolved=true', async () => {
    findMany.mockResolvedValue([
      { ...base, id: 'community-seo', workspaceId: 'community', visibility: 'PUBLIC' },
      { ...base, id: 'owned-seo' },
      { ...base, id: 'community-news', workspaceId: 'community', visibility: 'PUBLIC', key: 'newsletter', slug: 'newsletter', name: 'Newsletter' },
    ])
    const result = await new WorkflowService().list(context, { resolved: true })
    expect(result.map(w => w.id)).toEqual(['owned-seo', 'community-news'])
  })

  it('orders owned Workflows before community when resolved=true', async () => {
    findMany.mockResolvedValue([
      { ...base, id: 'community-alpha', workspaceId: 'community', visibility: 'PUBLIC', key: 'alpha', slug: 'alpha', name: 'Alpha' },
      { ...base, id: 'owned-beta', key: 'beta', slug: 'beta', name: 'Beta' },
    ])
    const result = await new WorkflowService().list(context, { resolved: true })
    expect(result[0]?.workspaceId).toBe('workspace')
  })

  // ── Mutation boundary: community resources are immutable ──────────────

  it('does not allow Community Workflows to be edited (PATCH)', async () => {
    findFirst.mockResolvedValue(null) // not found in workspace scope
    await expect(new WorkflowService().update(context, 'community-wf', { name: 'Changed' }))
      .rejects.toThrow('Workflow not found')
  })

  it('does not allow Community Workflows to be deleted (DELETE)', async () => {
    findFirst.mockResolvedValue(null) // not found in workspace scope
    await expect(new WorkflowService().delete(context, 'community-wf'))
      .rejects.toThrow('Workflow not found')
  })

  // ── Key collision ─────────────────────────────────────────────────────

  it('rejects create when key already exists in workspace', async () => {
    // No sourceWorkflowId → source check skipped; first findFirst = key collision check
    findFirst.mockResolvedValueOnce({ ...base })
    await expect(new WorkflowService().create(context, {
      name: 'SEO Writing', nodes: [],
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  // ── Fork / provenance ─────────────────────────────────────────────────

  it('fork returns existing workspace Workflow when key already owned (idempotent)', async () => {
    const source = { ...base, id: 'community-seo', workspaceId: 'community', visibility: 'PUBLIC' }
    findFirst
      .mockResolvedValueOnce(source)           // community lookup
      .mockResolvedValueOnce({ ...base, id: 'owned-seo' }) // existing workspace key check
    const result = await new WorkflowService().fork(context, 'community-seo')
    expect(result.id).toBe('owned-seo')
    expect(create).not.toHaveBeenCalled()
  })

  it('fork creates workspace copy with provenance when key is not owned', async () => {
    const source = {
      ...base, id: 'community-seo', workspaceId: 'community', visibility: 'PUBLIC',
      nodes: [{ ...baseNode }],
    }
    findFirst
      .mockResolvedValueOnce(source) // community lookup
      .mockResolvedValueOnce(null)   // no existing workspace key
      .mockResolvedValueOnce(source) // source check in create
      .mockResolvedValueOnce(null)   // key collision in create
      .mockResolvedValueOnce(null)   // slug uniqueness check
    create.mockImplementation(async ({ data }: any) => ({
      ...base, ...data, id: 'new-fork',
      nodes: [{ ...baseNode }],
      createdAt: new Date(), updatedAt: new Date(),
    }))
    const result = await new WorkflowService().fork(context, 'community-seo')
    expect(result.sourceWorkflowId).toBe('community-seo')
    expect(result.visibility).toBe('PRIVATE')
  })

  // ── insertIntoPipeline ────────────────────────────────────────────────

  it('insertIntoPipeline rejects when Workflow is not found (wrong workspace or private other)', async () => {
    findFirst.mockResolvedValueOnce(null) // workflow not found in scope
    await expect(new WorkflowService().insertIntoPipeline(context, 'private-other-wf', 'pipeline1'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(pipelineFindFirst).not.toHaveBeenCalled()
  })

  it('insertIntoPipeline rejects when Pipeline is not workspace-owned', async () => {
    findFirst.mockResolvedValueOnce({ ...base, nodes: [baseNode] }) // workflow found
    pipelineFindFirst.mockResolvedValueOnce(null)                   // pipeline not in workspace
    await expect(new WorkflowService().insertIntoPipeline(context, 'wf1', 'pipeline1'))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(createMany).not.toHaveBeenCalled()
  })

  it('insertIntoPipeline snapshots all execution-critical fields into PipelineAgent', async () => {
    const node = {
      ...baseNode,
      uid: 'analyst', kind: 'AI_TEXT', name: 'Analyst',
      systemPrompt: 'SYS', userPrompt: 'USR',
      outputTarget: 'body', outputFormat: 'markdown', imageMode: 'generate',
      enabled: true, sortOrder: 0,
    }
    findFirst.mockResolvedValueOnce({ ...base, id: 'wf1', nodes: [node] })
    pipelineFindFirst.mockResolvedValueOnce({ ...basePipeline, agents: [] })
    pipelineFindUnique.mockResolvedValueOnce({ id: 'pipeline1', variables: [], agents: [node], loop: null })
    update.mockResolvedValue({ id: 'wf1', usageCount: 1 })

    await new WorkflowService().insertIntoPipeline(context, 'wf1', 'pipeline1')

    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          pipelineId: 'pipeline1',
          uid: 'analyst',
          kind: 'AI_TEXT',
          name: 'Analyst',
          systemPrompt: 'SYS',
          userPrompt: 'USR',
          outputTarget: 'body',
          outputFormat: 'markdown',
          imageMode: 'generate',
          enabled: true,
          sourceWorkflowNodeId: node.id,
        }),
      ]),
    }))
  })

  it('insertIntoPipeline deduplicates UIDs deterministically (_2, _3, ...)', async () => {
    const nodeA = { ...baseNode, id: 'n1', uid: 'writer', sortOrder: 0 }
    const nodeB = { ...baseNode, id: 'n2', uid: 'writer', sortOrder: 1 }
    const nodeC = { ...baseNode, id: 'n3', uid: 'writer', sortOrder: 2 }
    findFirst.mockResolvedValueOnce({ ...base, nodes: [nodeA, nodeB, nodeC] })
    // Pipeline already has a 'writer' agent
    pipelineFindFirst.mockResolvedValueOnce({
      ...basePipeline,
      agents: [{ uid: 'writer', sortOrder: 0 }],
    })
    pipelineFindUnique.mockResolvedValueOnce({ id: 'pipeline1', variables: [], agents: [], loop: null })
    update.mockResolvedValue({ id: 'wf1', usageCount: 1 })

    await new WorkflowService().insertIntoPipeline(context, 'wf1', 'pipeline1')

    const calls = (createMany.mock.calls[0]?.[0] as { data: Array<{ uid: string }> }).data
    expect(calls.map((c: { uid: string }) => c.uid)).toEqual(['writer_2', 'writer_3', 'writer_4'])
  })
})
