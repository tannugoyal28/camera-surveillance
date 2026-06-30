import { useState } from 'react'
import { api } from '../api/client'
import { CameraState } from '../hooks/useRealtime'

export interface Camera {
    id: string; name: string; location: string | null
    rtsp_url: string; enabled: boolean
}

const STATE_LABEL: Record<string, string> = {
    idle: 'stopped', stopped: 'stopped', connecting: 'connecting',
    live: 'live', error: 'error',
}

function ago(ts: string) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
}

export function CameraTile({ camera, live }: { camera: Camera; live?: CameraState }) {
    const [busy, setBusy] = useState(false)
    const state = live?.state ?? 'idle'
    const running = state === 'live' || state === 'connecting'
    const label = STATE_LABEL[state] ?? 'stopped'

    async function toggle() {
        setBusy(true)
        try {
            await api.post(`/api/cameras/${camera.id}/${running ? 'stop' : 'start'}`)
        } catch (e) { console.error(e) } finally { setBusy(false) }
    }

    return (
        <div className="tile">
            <div className="tile__video">
                <span className={`badge badge--${label}`}>
                    <span className="badge__dot" />{label}
                </span>
                {state === 'live'
                    ? <img className="tile__feed" src={`/stream/${camera.id}`} alt={camera.name} />
                    : <div className="tile__placeholder tile__placeholder--off">{label === 'connecting' ? 'connecting…' : 'offline'}</div>}
            </div>

            <div className="tile__body">
                <div className="tile__name">{camera.name}</div>
                <div className="tile__loc">{camera.location || '—'}</div>

                <div className="tile__stats">
                    <div className="stat"><span className="stat__k">fps</span><span className="stat__v mono">{state === 'live' ? live!.fps.toFixed(0) : '—'}</span></div>
                    <div className="stat"><span className="stat__k">det/min</span><span className="stat__v mono">{state === 'live' ? live!.detPerMin : '—'}</span></div>
                </div>

                <button className={`btn ${running ? 'btn--danger' : 'btn--start'} tile__btn`} onClick={toggle} disabled={busy}>
                    {running ? 'Stop' : 'Start'}
                </button>

                <div className="tile__alert">
                    {live?.lastAlert
                        ? <span>{live.lastAlert.count} {live.lastAlert.count === 1 ? 'person' : 'people'} <span className="tile__alert-ago">· {ago(live.lastAlert.ts)}</span></span>
                        : <span className="tile__alert--none">No recent alerts</span>}
                </div>
            </div>
        </div>
    )
}