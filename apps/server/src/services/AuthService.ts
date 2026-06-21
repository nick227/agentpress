import { createHash } from 'crypto'
import { db } from '@project/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const STARTER_FEED_SLUGS = [
  'ziptrader', 'vaush', 'fireship', 'wes-roth',
  'hacker-news', 'techcrunch', 'npr-politics', 'wallstreetbets',
]

async function forkStarterPack(workspaceId: string, userId: string) {
  const [communityFeeds, communityPrompts] = await Promise.all([
    db.researchSource.findMany({
      where: { visibility: 'PUBLIC', slug: { in: STARTER_FEED_SLUGS } },
    }),
    db.prompt.findMany({
      where: { visibility: 'PUBLIC', kind: 'CONTENT' },
    }),
  ])

  await Promise.all([
    ...communityFeeds.map((source) =>
      db.researchSource.create({
        data: {
          name: source.name,
          slug: source.slug,
          category: source.category,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          externalId: source.externalId,
          workspaceId,
          createdByUserId: userId,
          visibility: 'PRIVATE',
        },
      }).catch(() => {})
    ),
    ...communityPrompts.map((prompt) => {
      const promptHash = createHash('sha256').update(`fork:${workspaceId}:${prompt.id}`).digest('hex')
      return db.prompt.create({
        data: {
          name: prompt.name,
          slug: `${prompt.slug}-${workspaceId.slice(0, 8)}`,
          description: prompt.description,
          kind: prompt.kind,
          category: prompt.category,
          tags: prompt.tags ?? [],
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
          uid: prompt.uid,
          outputTarget: prompt.outputTarget,
          outputFormat: prompt.outputFormat,
          promptHash,
          workspaceId,
          visibility: 'PRIVATE',
        },
      }).catch(() => {})
    }),
  ])
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class AuthService {
  async register(data: { email: string; password: string }) {
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) throw { statusCode: 409, message: 'Email already registered' }

    const hash = await bcrypt.hash(data.password, 12)
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash: hash,
        workspaceMemberships: {
          create: {
            role: 'OWNER',
            workspace: {
              create: {
                name: data.email.split('@')[0] || 'Personal',
                slug: `personal-${randomUUID()}`,
                type: 'PERSONAL',
              },
            },
          },
        },
      },
    })
    const membership = await db.workspaceMember.findFirst({ where: { userId: user.id } })
    if (membership) {
      forkStarterPack(membership.workspaceId, user.id).catch(() => {})
    }
    const session = await this._createSession(user.id)
    return { user, token: session.token }
  }

  async login(data: { email: string; password: string }) {
    const user = await db.user.findUnique({ where: { email: data.email } })
    if (!user) throw { statusCode: 401, message: 'Invalid credentials' }

    const valid = await bcrypt.compare(data.password, user.passwordHash)
    if (!valid) throw { statusCode: 401, message: 'Invalid credentials' }

    const session = await this._createSession(user.id)
    return { user, token: session.token }
  }

  async logout(token: string) {
    await db.session.deleteMany({ where: { token } })
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw { statusCode: 401, message: 'Current password is incorrect' }
    if (newPassword.length < 8) throw { statusCode: 400, message: 'New password must be at least 8 characters' }
    const hash = await bcrypt.hash(newPassword, 12)
    return db.user.update({ where: { id: userId }, data: { passwordHash: hash } })
  }

  private async _createSession(userId: string) {
    return db.session.create({
      data: {
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
  }
}
