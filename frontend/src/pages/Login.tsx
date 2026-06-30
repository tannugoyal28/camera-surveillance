import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
    const { login, signup } = useAuth()
    const navigate = useNavigate()
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(''); setBusy(true)
        try {
            mode === 'login' ? await login(username, password) : await signup(username, password)
            navigate('/')
        } catch (err: any) {
            setError(err.message || 'something went wrong')
        } finally { setBusy(false) }
    }

    return (
        <div className="login">
            <form className="login__card" onSubmit={submit}>
                <h1 className="login__title">Sentinel</h1>
                <p className="login__sub">{mode === 'login' ? 'Sign in to your dashboard' : 'Create an account'}</p>
                <label>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} autoFocus />
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                {error && <div className="login__error">{error}</div>}
                <button className="btn btn--primary" type="submit" disabled={busy}>
                    {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
                </button>
                <div className="login__switch">
                    {mode === 'login' ? 'No account? ' : 'Have an account? '}
                    <a onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </a>
                </div>
            </form>
        </div>
    )
}