import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cameras from './pages/Cameras'
import Alerts from './pages/Alerts'

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cameras" element={<Cameras />} />
                <Route path="/alerts" element={<Alerts />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}