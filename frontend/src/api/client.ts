const TOKEN_KEY = 'sentinel_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function request(path: string, options: RequestInit = {}) {
    const token = getToken()
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(path, { ...options, headers })
    if (res.status === 401) {
        clearToken()
        window.location.href = '/login'
        throw new Error('unauthorized')
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `request failed: ${res.status}`)
    }
    return res.json()
}

export const api = {
    get: (p: string) => request(p),
    post: (p: string, body?: unknown) => request(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    patch: (p: string, body: unknown) => request(p, { method: 'PATCH', body: JSON.stringify(body) }),
    del: (p: string) => request(p, { method: 'DELETE' }),
}