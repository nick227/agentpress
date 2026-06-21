import { AuthService } from '../services/AuthService'

const authService = new AuthService()

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

export async function register(request: any, reply: any) {
  const { user, token } = await authService.register(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.status(201).send({ data: user })
}

export async function login(request: any, reply: any) {
  const { user, token } = await authService.login(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: user })
}

export async function logout(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (token) await authService.logout(token)
  reply.clearCookie('token', { path: '/' })
  return reply.send({ data: null })
}

export async function getCurrentUser(request: any, reply: any) {
  return reply.send({ data: request.user })
}

export async function updateCurrentUser(request: any, reply: any) {
  const { currentPassword, newPassword } = request.body ?? {}
  if (!currentPassword || !newPassword) {
    return reply.status(400).send({ error: 'currentPassword and newPassword are required' })
  }
  const updated = await authService.changePassword(request.user.id, currentPassword, newPassword)
  return reply.send({ data: updated })
}
