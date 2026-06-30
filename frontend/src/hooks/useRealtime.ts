import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api/client'

export interface CameraState {
    state: 'connecting' | 'live' | 'stopped' | 'error' | 'idle'
    fps: number
    detPerMin: number
    lastAlert?: { count: number; confidence: number; ts: string }
    error?: string
}

type StateMap = Record<string, CameraState>

export function useRealtime() {
    const [states, setStates] = useState<StateMap>({})
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        const token = getToken()
        if (!token) return

        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        const ws = new WebSocket(`${proto}://${location.host}/ws?token=${token}`)
        wsRef.current = ws

        ws.onmessage = (e) => {
            let msg: any
            try { msg = JSON.parse(e.data) } catch { return }
            const id = msg.camera_id
            if (!id) return

            setStates(prev => {
                const cur: CameraState = prev[id] ?? { state: 'idle', fps: 0, detPerMin: 0 }
                if (msg.type === 'status') {
                    return { ...prev, [id]: { ...cur, state: msg.state, error: msg.message } }
                }
                if (msg.type === 'stats') {
                    return { ...prev, [id]: { ...cur, state: msg.state ?? cur.state, fps: msg.fps, detPerMin: msg.detections_per_min } }
                }
                if (msg.type === 'detection') {
                    return { ...prev, [id]: { ...cur, lastAlert: { count: msg.count, confidence: msg.confidence, ts: msg.ts } } }
                }
                return prev
            })
        }

        ws.onclose = () => { wsRef.current = null }
        return () => ws.close()
    }, [])

    return states
}