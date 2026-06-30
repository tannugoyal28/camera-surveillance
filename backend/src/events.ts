import Redis from 'ioredis'
import { sql } from './db'
import { broadcastToUser } from './realtime'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'
const ownerCache = new Map<string, string>()   // camera_id -> user_id

async function ownerOf(cameraId: string): Promise<string | null> {
  if (ownerCache.has(cameraId)) return ownerCache.get(cameraId)!
  try {
    const [row] = await sql`SELECT user_id FROM cameras WHERE id = ${cameraId}`
    if (row) { ownerCache.set(cameraId, row.user_id); return row.user_id }
  } catch {}
  return null
}

export function startEventConsumer() {
  const sub = new Redis(REDIS_URL)
  sub.subscribe('camera:events')
  sub.on('message', async (_channel, raw) => {
    let event: any
    try { event = JSON.parse(raw) } catch { return }

    const userId = await ownerOf(event.camera_id)
    if (!userId) return                          // unknown camera -> ignore

    if (event.type === 'detection') {            // store only detections
      try {
        await sql`
          INSERT INTO alerts (camera_id, label, count, confidence, bbox, ts)
          VALUES (${event.camera_id}, ${event.label}, ${event.count ?? 1},
                  ${event.confidence ?? null}, ${sql.json(event.bbox ?? null)}, ${event.ts})
        `
      } catch (e) { console.error('store alert failed:', e) }
    }

    broadcastToUser(userId, event)               // push everything live
  })
  console.log('Subscribed to camera:events')
}