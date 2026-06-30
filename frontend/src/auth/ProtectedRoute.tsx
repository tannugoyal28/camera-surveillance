import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { token } = useAuth()
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}