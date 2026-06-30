import { createContext, useContext, useState, ReactNode } from 'react'
import { getToken, setToken, clearToken } from '../api/client'

interface User { id: string; username: string }
interface AuthState {
    token: string | null
    user: User | null
    login: (u: string, p: string) => Promise<void>
    signup: (u: string, p: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function decodeUser(token: string): User | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return { id: payload.sub, username: payload.username }
    } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTok] = useState<string | null>(getToken())
    const [user, setUser] = useState<User | null>(token ? decodeUser(token) : null)

    async function authRequest(path: string, username: string, password: string) {
        const res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'authentication failed')
        setToken(data.token); setTok(data.token); setUser(decodeUser(data.token))
    }

    return (
        <AuthContext.Provider value={{
            token, user,
            login: (u, p) => authRequest('/auth/login', u, p),
            signup: (u, p) => authRequest('/auth/signup', u, p),
            logout: () => { clearToken(); setTok(null); setUser(null) },
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}