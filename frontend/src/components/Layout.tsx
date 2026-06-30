import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    return (
        <div className="app">
            <nav className="navbar">
                <div className="navbar__brand">Sentinel</div>
                <div className="navbar__links">
                    <NavLink to="/" end>Dashboard</NavLink>
                    <NavLink to="/cameras">Cameras</NavLink>
                    <NavLink to="/alerts">Alerts</NavLink>
                </div>
                <div className="navbar__user">
                    <span className="avatar">{user?.username?.slice(0, 2).toUpperCase()}</span>
                    <button className="btn btn--ghost" onClick={() => { logout(); navigate('/login') }}>Logout</button>
                </div>
            </nav>
            <main className="content"><Outlet /></main>
        </div>
    )
}