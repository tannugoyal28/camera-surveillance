import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { Camera } from '../components/CameraTile'

interface FormState { name: string; rtsp_url: string; location: string; enabled: boolean }
const EMPTY: FormState = { name: '', rtsp_url: 'rtsp://mediamtx:8554/cam1', location: '', enabled: true }

export default function Cameras() {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState<Camera | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY)
    const [error, setError] = useState('')

    const load = () => api.get('/api/cameras').then(setCameras).catch(console.error)
    useEffect(() => { load() }, [])

    function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setOpen(true) }
    function openEdit(cam: Camera) {
        setEditing(cam)
        setForm({ name: cam.name, rtsp_url: cam.rtsp_url, location: cam.location ?? '', enabled: cam.enabled })
        setError(''); setOpen(true)
    }

    async function save() {
        if (!form.name || !form.rtsp_url) { setError('Name and RTSP URL are required'); return }
        try {
            if (editing) await api.patch(`/api/cameras/${editing.id}`, form)
            else await api.post('/api/cameras', form)
            setOpen(false); load()
        } catch (e: any) { setError(e.message) }
    }

    async function remove(cam: Camera) {
        if (!confirm(`Delete "${cam.name}"?`)) return
        await api.del(`/api/cameras/${cam.id}`); load()
    }

    return (
        <div className="page">
            <div className="page__head">
                <h1>Cameras</h1>
                <button className="btn btn--primary" onClick={openAdd}>Add camera</button>
            </div>

            {cameras.length === 0
                ? <div className="empty">No cameras yet. Add your first one.</div>
                : <div className="card table">
                    <div className="table__row table__row--head">
                        <span>Name</span><span>Location</span><span>RTSP URL</span><span>Enabled</span><span></span>
                    </div>
                    {cameras.map(cam => (
                        <div className="table__row" key={cam.id}>
                            <span>{cam.name}</span>
                            <span className="muted-ink">{cam.location || '—'}</span>
                            <span className="mono ellipsis">{cam.rtsp_url}</span>
                            <span>{cam.enabled ? 'Yes' : 'No'}</span>
                            <span className="table__actions">
                                <button className="btn btn--ghost" onClick={() => openEdit(cam)}>Edit</button>
                                <button className="btn btn--ghost danger-text" onClick={() => remove(cam)}>Delete</button>
                            </span>
                        </div>
                    ))}
                </div>}

            {open && (
                <Modal title={editing ? 'Edit camera' : 'Add camera'} onClose={() => setOpen(false)}>
                    <label>Name</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
                    <label>RTSP URL</label>
                    <input value={form.rtsp_url} onChange={e => setForm({ ...form, rtsp_url: e.target.value })} />
                    <label>Location</label>
                    <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    <label className="checkbox">
                        <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                        <span>Enabled</span>
                    </label>
                    {error && <div className="login__error">{error}</div>}
                    <div className="modal__foot">
                        <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
                        <button className="btn btn--primary" onClick={save}>{editing ? 'Save' : 'Add'}</button>
                    </div>
                </Modal>
            )}
        </div>
    )
}