import { Link, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import Nav from '../../components/Nav/Nav.jsx'
import SesionChip from '../../components/SesionChip/SesionChip.jsx'
import RequireAuth from '../../components/RequireAuth/RequireAuth.jsx'
import ReservarCita from './ReservarCita.jsx'
import MisCitas from './MisCitas.jsx'
import {
  IconCalendar,
  IconScissors,
  IconMessageCircle,
} from '../../components/Nav/NavIcons.jsx'
import Contacto from '../Contacto/Contacto.jsx'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './BarberiaShell.module.css'

const NAV_ITEMS = [
  { id: 'citas',     label: 'Mis citas', icon: <IconCalendar />,      subpath: 'citas'    },
  { id: 'reservar',  label: 'Reservar',  icon: <IconScissors />,      subpath: ''         },
  { id: 'contacto',  label: 'Contacto',  icon: <IconMessageCircle />, subpath: 'contacto' },
]

function getActiveId(pathname) {
  const seg = pathname.replace(/\/$/, '').split('/').pop()
  const found = NAV_ITEMS.find(it => it.subpath === seg)
  return found?.id ?? 'reservar'
}

export default function BarberiaShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeId  = getActiveId(location.pathname)

  function handleSelect(id) {
    const item = NAV_ITEMS.find(it => it.id === id)
    if (!item) return
    navigate(item.subpath ? `/barberia/${item.subpath}` : '/barberia')
  }

  return (
    <div className={styles.shell}>
      {/* Cabecera con logo → hub + chip de sesión */}
      <header className={styles.shellHeader}>
        <Link to="/" aria-label="Volver al inicio" className={styles.logoLink}>
          <Logo variant="symbol" size="md" />
        </Link>
        <SesionChip />
      </header>

      {/* Contenido de la pantalla activa */}
      <main className={styles.content}>
        <AnimatedContent key={location.pathname}>
          <Routes>
            <Route index           element={<RequireAuth><ReservarCita /></RequireAuth>} />
            <Route path="citas"    element={<RequireAuth><MisCitas /></RequireAuth>} />
            <Route path="contacto" element={<Contacto />} />
            <Route path="*"        element={<Navigate to="/barberia" replace />} />
          </Routes>
        </AnimatedContent>
      </main>

      {/* Nav contextual de Barbería */}
      <Nav
        items={NAV_ITEMS}
        activeId={activeId}
        onSelect={handleSelect}
      />
    </div>
  )
}
