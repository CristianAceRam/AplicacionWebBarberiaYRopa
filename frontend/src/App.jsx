import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import RequireAuth, { RequireAdmin } from './components/RequireAuth/RequireAuth.jsx'
import LedBackground from './motor/LedBackground.jsx'
import Hub from './pages/Hub/Hub.jsx'
import Login from './pages/Login/Login.jsx'
import Registro from './pages/Registro/Registro.jsx'
import Perfil from './pages/Perfil/Perfil.jsx'
import BarberiaShell from './pages/Barberia/BarberiaShell.jsx'
import TiendaShell from './pages/Tienda/TiendaShell.jsx'
import AdminShell from './pages/Admin/AdminShell.jsx'

export default function App() {
  return (
    <BrowserRouter>
      {/* Canvas fijo z-index 0 — persiste entre navegaciones sin remontarse */}
      <LedBackground variant="strokes" />
      <AuthProvider>
        <Routes>
          <Route path="/"           element={<Hub />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/registro"   element={<Registro />} />
          <Route path="/perfil"     element={<RequireAuth><Perfil /></RequireAuth>} />
          <Route path="/barberia/*" element={<BarberiaShell />} />
          <Route path="/tienda/*"   element={<TiendaShell />} />
          <Route path="/admin/*"    element={<RequireAdmin><AdminShell /></RequireAdmin>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
