import { createBunWebSocket } from 'hono/bun'
import type { WSContext } from 'hono/ws'

export const { upgradeWebSocket, websocket } = createBunWebSocket()

const clients = new Map<WSContext, string>()   // socket -> userId

export function addClient(ws: WSContext, userId: string) {
  clients.set(ws, userId)
}
export function removeClient(ws: WSContext) {
  clients.delete(ws)
}
export function broadcastToUser(userId: string, payload: unknown) {
  const msg = JSON.stringify(payload)
  for (const [ws, uid] of clients) {
    if (uid === userId) {
      try { ws.send(msg) } catch {}
    }
  }
}