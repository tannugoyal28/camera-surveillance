import { Hono } from 'hono'
import Redis from 'ioredis'
import { sql } from './db'

const pub = new Redis(process.env.REDIS_URL || 'redis://redis:6379')

export const control = new Hono()
const uid = (c: any) => (c.get('jwtPayload') as { sub: string }).sub

async function ownedCamera(userId: string, cameraId: string) {
    const [cam] = await sql`
    SELECT id, rtsp_url FROM cameras WHERE id = ${cameraId} AND user_id = ${userId}
  `
    return cam ?? null
}

control.post('/:id/start', async (c) => {
    const cam = await ownedCamera(uid(c), c.req.param('id'))
    if (!cam) return c.json({ error: 'not found' }, 404)
    await pub.publish('camera:commands', JSON.stringify({
        action: 'start', camera_id: cam.id, rtsp_url: cam.rtsp_url,
    }))
    return c.json({ status: 'starting', camera_id: cam.id })
})

control.post('/:id/stop', async (c) => {
    const cam = await ownedCamera(uid(c), c.req.param('id'))
    if (!cam) return c.json({ error: 'not found' }, 404)
    await pub.publish('camera:commands', JSON.stringify({
        action: 'stop', camera_id: cam.id,
    }))
    return c.json({ status: 'stopping', camera_id: cam.id })
})