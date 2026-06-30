import { Hono } from 'hono'
import { jwt, verify } from 'hono/jwt'
import { initDb } from './db'
import { auth } from './auth'
import { cameras } from './cameras'
import { alerts } from './alerts'
import { upgradeWebSocket, websocket, addClient, removeClient } from './realtime'
import { startEventConsumer } from './events'
import { control } from './control'

const JWT_SECRET = process.env.JWT_SECRET!

await initDb()
startEventConsumer()

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/auth', auth)

// WebSocket — authenticates via ?token=... (browsers can't set headers on a WS handshake)
app.get('/ws', upgradeWebSocket(async (c) => {
    const token = c.req.query('token') || ''
    let userId: string | null = null
    try {
        const payload = await verify(token, JWT_SECRET, 'HS256')
        userId = payload.sub as string
    } catch { }
    return {
        onOpen(_e, ws) {
            if (!userId) { ws.close(1008, 'unauthorized'); return }
            addClient(ws, userId)
        },
        onClose(_e, ws) { removeClient(ws) },
    }
}))

app.use('/api/*', jwt({ secret: JWT_SECRET, alg: 'HS256' }))
app.get('/api/me', (c) => c.json({ you: c.get('jwtPayload') }))
app.route('/api/cameras', cameras)
app.route('/api/alerts', alerts)
app.route('/api/cameras', control)

console.log('Backend listening on port 3000')

export default { port: 3000, fetch: app.fetch, websocket }