import { Hono } from 'hono'
import { sql } from './db'

export const cameras = new Hono()

const uid = (c: any) => (c.get('jwtPayload') as { sub: string }).sub

cameras.get('/', async (c) => {
  const rows = await sql`
    SELECT id, name, rtsp_url, location, enabled, created_at
    FROM cameras WHERE user_id = ${uid(c)}
    ORDER BY created_at DESC
  `
  return c.json(rows)
})

cameras.post('/', async (c) => {
  const { name, rtsp_url, location, enabled } = await c.req.json()
  if (!name || !rtsp_url) {
    return c.json({ error: 'name and rtsp_url are required' }, 400)
  }
  const [cam] = await sql`
    INSERT INTO cameras (user_id, name, rtsp_url, location, enabled)
    VALUES (${uid(c)}, ${name}, ${rtsp_url}, ${location ?? null}, ${enabled ?? true})
    RETURNING id, name, rtsp_url, location, enabled, created_at
  `
  return c.json(cam, 201)
})

cameras.get('/:id', async (c) => {
  const [cam] = await sql`
    SELECT id, name, rtsp_url, location, enabled, created_at
    FROM cameras WHERE id = ${c.req.param('id')} AND user_id = ${uid(c)}
  `
  if (!cam) return c.json({ error: 'not found' }, 404)
  return c.json(cam)
})

cameras.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json()
  const [existing] = await sql`SELECT id FROM cameras WHERE id = ${id} AND user_id = ${uid(c)}`
  if (!existing) return c.json({ error: 'not found' }, 404)
  const [cam] = await sql`
    UPDATE cameras SET
      name     = COALESCE(${b.name ?? null}, name),
      rtsp_url = COALESCE(${b.rtsp_url ?? null}, rtsp_url),
      location = COALESCE(${b.location ?? null}, location),
      enabled  = COALESCE(${b.enabled ?? null}, enabled)
    WHERE id = ${id} AND user_id = ${uid(c)}
    RETURNING id, name, rtsp_url, location, enabled, created_at
  `
  return c.json(cam)
})

cameras.delete('/:id', async (c) => {
  const result = await sql`
    DELETE FROM cameras WHERE id = ${c.req.param('id')} AND user_id = ${uid(c)} RETURNING id
  `
  if (result.length === 0) return c.json({ error: 'not found' }, 404)
  return c.json({ deleted: c.req.param('id') })
})