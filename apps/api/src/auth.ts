import { createMiddleware } from 'hono/factory'
import { sign, verify } from 'hono/jwt'
import { z } from 'zod'

import { getHumanActor, getHumanActorRole, getLastName } from './store'

export type AuthRole = 'student' | 'instructor' | 'admin'

export type AuthUser = {
  id: string
  role: AuthRole
  name: string
}

export type AppVariables = {
  user: AuthUser
}

export const authJwtSecret = 'dev-secret-key-2026'

const authUserSchema = z.object({
  id: z.string(),
  role: z.enum(['student', 'instructor', 'admin']),
  name: z.string(),
}).passthrough()

export async function createAuthToken(user: AuthUser) {
  return sign(
    {
      ...user,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    },
    authJwtSecret,
  )
}

export function authenticateActor(username: string, password: string) {
  const actor = getHumanActor(username)

  if (!actor) {
    return undefined
  }

  if (getLastName(actor.name).toLowerCase() !== password.trim().toLowerCase()) {
    return undefined
  }

  const role = getHumanActorRole(actor.id)

  if (!role) {
    return undefined
  }

  return {
    id: actor.id,
    role,
    name: actor.name,
  } satisfies AuthUser
}

export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    return c.json({ success: false, error: 'Unauthorized', field: 'auth' }, 401)
  }

  try {
    const decoded = await verify(match[1], authJwtSecret, 'HS256')
    const parsed = authUserSchema.safeParse(decoded)

    if (!parsed.success) {
      return c.json({ success: false, error: 'Unauthorized', field: 'auth' }, 401)
    }

    c.set('user', parsed.data)
    await next()
  } catch {
    return c.json({ success: false, error: 'Unauthorized', field: 'auth' }, 401)
  }
})