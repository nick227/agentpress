import { db } from '@project/db'

const COMMUNITY_SLUG = 'community'
const COMMUNITY_PIPELINE_SLUGS = ['seo-blog-post', 'political-commentary']
const COMMUNITY_FEED_SLUGS = [
  'vaush', 'destiny', 'ziptrader', 'spencer-invests', 'stock-moe', 'tom-nash-tv',
  'meet-kevin', 'fireship', 'theo', 'theprimeagen', 'mr-e-flow', 'github-awesome',
  'the-ai-search', 'ai-labs', 'ai-code-king', 'prompt-engineer', 'i-am-ai-master',
  'kittl-design', 'dr-roy-casagranda', 'channel-5', 'heresy-financial',
  'wallstreetzen', 'wallstreetbets', 'r-stocks', 'yahoo-finance', 'marketwatch',
  'npr-politics', 'hacker-news', 'techcrunch',
]

function personalSlug(userId: string) {
  return `personal-${userId}`
}

async function ensureTransitionalSchema() {
  // This project historically used `prisma db push` rather than checked-in
  // migrations. Add the ownership tables/columns as nullable first so an
  // existing populated database can be backfilled before the final schema
  // makes workspaceId required. Every statement is safe to rerun.
  const statements = [
    `CREATE TABLE IF NOT EXISTS Workspace (
      id VARCHAR(191) NOT NULL,
      type ENUM('PERSONAL','TEAM','COMMUNITY') NOT NULL,
      name VARCHAR(191) NOT NULL,
      slug VARCHAR(191) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE KEY Workspace_slug_key (slug)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS WorkspaceMember (
      workspaceId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      role ENUM('OWNER','ADMIN','EDITOR','VIEWER') NOT NULL,
      joinedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (workspaceId, userId), KEY WorkspaceMember_userId_idx (userId)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  ]
  for (const statement of statements) await db.$executeRawUnsafe(statement)

  async function ensureColumn(table: string, column: string, definition: string) {
    const existing = await db.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      table,
      column,
    )
    if (existing.length === 0) await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  }

  await ensureColumn('Pipeline', 'workspaceId', 'VARCHAR(191) NULL')
  await ensureColumn('Pipeline', 'visibility', "ENUM('PRIVATE','PUBLIC') NOT NULL DEFAULT 'PRIVATE'")
  await ensureColumn('Pipeline', 'createdByUserId', 'VARCHAR(191) NULL')
  await ensureColumn('ResearchSource', 'workspaceId', 'VARCHAR(191) NULL')
  await ensureColumn('ResearchSource', 'visibility', "ENUM('PRIVATE','PUBLIC') NOT NULL DEFAULT 'PRIVATE'")
  await ensureColumn('ResearchSource', 'createdByUserId', 'VARCHAR(191) NULL')
  await ensureColumn('Destination', 'workspaceId', 'VARCHAR(191) NULL')
  await ensureColumn('Destination', 'createdByUserId', 'VARCHAR(191) NULL')
  await ensureColumn('PipelineRun', 'workspaceId', 'VARCHAR(191) NULL')
  await ensureColumn('PipelineRun', 'createdByUserId', 'VARCHAR(191) NULL')
  await ensureColumn('Schedule', 'workspaceId', 'VARCHAR(191) NULL')
  await ensureColumn('Schedule', 'createdByUserId', 'VARCHAR(191) NULL')
}

async function main() {
  await ensureTransitionalSchema()
  const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } })
  if (users.length === 0) throw new Error('Cannot backfill workspaces without at least one user')

  const community = await db.workspace.upsert({
    where: { slug: COMMUNITY_SLUG },
    update: { type: 'COMMUNITY', name: 'Community' },
    create: { slug: COMMUNITY_SLUG, type: 'COMMUNITY', name: 'Community' },
  })

  const personalByUser = new Map<string, string>()
  for (const user of users) {
    const workspace = await db.workspace.upsert({
      where: { slug: personalSlug(user.id) },
      update: { type: 'PERSONAL' },
      create: {
        slug: personalSlug(user.id),
        type: 'PERSONAL',
        name: user.email.split('@')[0] || 'Personal',
      },
    })
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role: 'OWNER' },
      create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
    })
    personalByUser.set(user.id, workspace.id)
  }

  const legacyOwner = users.find((user) => user.role === 'OWNER') ?? users[0]!
  const personalWorkspaceId = personalByUser.get(legacyOwner.id)!

  const placeholders = (values: string[]) => values.map(() => '?').join(',')
  await db.$executeRawUnsafe(
    `UPDATE Pipeline SET workspaceId = ?, visibility = 'PUBLIC', createdByUserId = NULL, destinationId = NULL WHERE workspaceId IS NULL AND slug IN (${placeholders(COMMUNITY_PIPELINE_SLUGS)})`,
    community.id,
    ...COMMUNITY_PIPELINE_SLUGS,
  )
  await db.$executeRawUnsafe(
    `UPDATE Pipeline SET workspaceId = ?, visibility = 'PRIVATE', createdByUserId = ? WHERE workspaceId IS NULL`,
    personalWorkspaceId,
    legacyOwner.id,
  )
  await db.$executeRawUnsafe(
    `UPDATE ResearchSource SET workspaceId = ?, visibility = 'PUBLIC', createdByUserId = NULL WHERE workspaceId IS NULL AND slug IN (${placeholders(COMMUNITY_FEED_SLUGS)})`,
    community.id,
    ...COMMUNITY_FEED_SLUGS,
  )
  await db.$executeRawUnsafe(
    `UPDATE ResearchSource SET workspaceId = ?, visibility = 'PRIVATE', createdByUserId = ? WHERE workspaceId IS NULL`,
    personalWorkspaceId,
    legacyOwner.id,
  )
  for (const table of ['Destination', 'Schedule', 'PipelineRun']) {
    await db.$executeRawUnsafe(
      `UPDATE \`${table}\` SET workspaceId = ?, createdByUserId = ? WHERE workspaceId IS NULL`,
      personalWorkspaceId,
      legacyOwner.id,
    )
  }

  async function missingCount(table: string) {
    const rows = await db.$queryRawUnsafe<Array<{ total: bigint }>>(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE workspaceId IS NULL`)
    return Number(rows[0]?.total ?? 0)
  }
  const missing = {
    pipelines: await missingCount('Pipeline'),
    feeds: await missingCount('ResearchSource'),
    destinations: await missingCount('Destination'),
    runs: await missingCount('PipelineRun'),
    schedules: await missingCount('Schedule'),
  }
  if (Object.values(missing).some(Boolean)) {
    throw new Error(`Workspace backfill incomplete: ${JSON.stringify(missing)}`)
  }

  async function ensureScopedSlugIndex(table: 'Pipeline' | 'ResearchSource') {
    const globalIndex = `${table}_slug_key`
    const scopedIndex = `${table}_workspaceId_slug_key`
    const indexes = await db.$queryRawUnsafe<Array<{ INDEX_NAME: string }>>(
      `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      table,
    )
    const names = new Set(indexes.map((index) => index.INDEX_NAME))
    if (names.has(globalIndex)) await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` DROP INDEX \`${globalIndex}\``)
    if (!names.has(scopedIndex)) {
      await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${scopedIndex}\` (\`workspaceId\`, \`slug\`)`)
    }
  }
  await ensureScopedSlugIndex('Pipeline')
  await ensureScopedSlugIndex('ResearchSource')

  console.log(JSON.stringify({ communityWorkspaceId: community.id, legacyPersonalWorkspaceId: personalWorkspaceId, missing }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
