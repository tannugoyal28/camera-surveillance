import { Hono } from 'hono'
import { sql } from './db'

export const alerts = new Hono()
const uid = (c: any) => (c.get('jwtPayload') as { sub: string }).sub

alerts.get('/', async (c) => {
    const cameraId = c.req.query('camera_id')
    const from = c.req.query('from')               // ISO timestamp
    const to = c.req.query('to')
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
    const offset = parseInt(c.req.query('offset') ?? '0')

    const rows = await sql`
    SELECT a.id, a.camera_id, c.name AS camera_name, a.label,
           a.count, a.confidence, a.bbox, a.ts
    FROM alerts a
    JOIN cameras c ON c.id = a.camera_id
    WHERE c.user_id = ${uid(c)}
      ${cameraId ? sql`AND a.camera_id = ${cameraId}` : sql``}
      ${from ? sql`AND a.ts >= ${from}` : sql``}
      ${to ? sql`AND a.ts <= ${to}` : sql``}
    ORDER BY a.ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `
    return c.json({ alerts: rows, limit, offset })
})