import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useRealtime } from '../hooks/useRealtime'
import { CameraTile, Camera } from '../components/CameraTile'

export default function Dashboard() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [loading, setLoading] = useState(true)
    const live = useRealtime()

    useEffect(() => {
        api.get('/api/cameras')
            .then(setCameras)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="page"><p className="muted">Loading cameras…</p></div>

    return (
        <div className="page">
            <h1>Dashboard</h1>
            {cameras.length === 0
                ? <div className="empty">No cameras yet. Add one on the <a href="/cameras">Cameras</a> page.</div>
                : <div className="grid">
                    {cameras.map(cam => <CameraTile key={cam.id} camera={cam} live={live[cam.id]} />)}
                </div>}
        </div>
    )
}