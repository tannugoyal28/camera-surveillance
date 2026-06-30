import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { sql } from './db'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set')

export const auth = new Hono()

function makeToken(user: { id: string; username: string }) {
    return sign(
        {
            sub: user.id,
            username: user.username,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // expires in 24h
        },
        JWT_SECRET!,
        'HS256'
    )
}

auth.post('/signup', async (c) => {
    const { username, password } = await c.req.json()
    if (!username || !password) {
        return c.json({ error: 'username and password are required' }, 400)
    }

    const existing = await sql`SELECT id FROM users WHERE username = ${username}`
    if (existing.length > 0) {
        return c.json({ error: 'username already taken' }, 409)
    }

    const passwordHash = await Bun.password.hash(password)
    const [user] = await sql<{ id: string; username: string }[]>`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username
  `

    const token = await makeToken(user)
    return c.json({ token, user })
})

auth.post('/login', async (c) => {
    const { username, password } = await c.req.json()
    if (!username || !password) {
        return c.json({ error: 'username and password are required' }, 400)
    }

    const [user] = await sql`
    SELECT id, username, password_hash FROM users WHERE username = ${username}
  `
    if (!user) {
        return c.json({ error: 'invalid credentials' }, 401)
    }

    const valid = await Bun.password.verify(password, user.password_hash)
    if (!valid) {
        return c.json({ error: 'invalid credentials' }, 401)
    }

    const token = await makeToken({ id: user.id, username: user.username })
    return c.json({ token, user: { id: user.id, username: user.username } })
})