import { db } from '@project/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

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
      },
    })
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
