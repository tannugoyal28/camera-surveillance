import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Camera } from '../components/CameraTile'

interface Alert {
    id: string; camera_id: string; camera_name: string
    label: string; count: number; confidence: number | null; ts: string
}
const PAGE = 25

export default function Alerts() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [cameraId, setCameraId] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => { api.get('/api/cameras').then(setCameras).catch(console.error) }, [])

    function load(off: number) {
        setLoading(true)
        const p = new URLSearchParams({ limit: String(PAGE), offset: String(off) })
        if (cameraId) p.set('camera_id', cameraId)
        if (from) p.set('from', new Date(from).toISOString())
        if (to) p.set('to', new Date(to).toISOString())
        api.get(`/api/alerts?${p.toString()}`)
            .then(d => { setAlerts(d.alerts); setOffset(off) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { load(0) }, [])

    return (
        <div className="page">
            <h1>Alerts</h1>

            <div className="filters card">
                <div>
                    <label>Camera</label>
                    <select value={cameraId} onChange={e => setCameraId(e.target.value)}>
                        <option value="">All cameras</option>
                        {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div><label>From</label><input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div><label>To</label><input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></div>
                <button className="btn btn--primary" onClick={() => load(0)}>Apply</button>
            </div>

            <div className="card table">
                <div className="table__row table__row--head alerts-row">
                    <span>Camera</span><span>People</span><span>Confidence</span><span>Time</span>
                </div>
                {loading
                    ? <div className="table__empty">Loading…</div>
                    : alerts.length === 0
                        ? <div className="table__empty">No alerts match these filters.</div>
                        : alerts.map(a => (
                            <div className="table__row alerts-row" key={a.id}>
                                <span>{a.camera_name}</span>
                                <span className="mono">{a.count}</span>
                                <span className="mono">{a.confidence != null ? Number(a.confidence).toFixed(2) : '—'}</span>
                                <span className="muted-ink">{new Date(a.ts).toLocaleString()}</span>
                            </div>
                        ))}
            </div>

            <div className="pager">
                <button className="btn" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>Previous</button>
                <span className="muted">Showing {alerts.length ? offset + 1 : 0}–{offset + alerts.length}</span>
                <button className="btn" disabled={alerts.length < PAGE} onClick={() => load(offset + PAGE)}>Next</button>
            </div>
        </div>
    )
}