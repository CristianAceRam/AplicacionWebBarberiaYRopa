import { Link, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import Nav from '../../components/Nav/Nav.jsx'
import SesionChip from '../../components/SesionChip/SesionChip.jsx'
import RequireAuth from '../../components/RequireAuth/RequireAuth.jsx'
import {
  IconShirt,
  IconShoppingBag,
  IconMessageCircle,
} from '../../components/Nav/NavIcons.jsx'
import Catalogo from './Catalogo.jsx'
import PrendaDetalle from './PrendaDetalle.jsx'
import MisReservas from './MisReservas.jsx'
import Contacto from '../Contacto/Contacto.jsx'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './TiendaShell.module.css'

const NAV_ITEMS = [
  { id: 'catalogo',  label: 'Catálogo',     icon: <IconShirt />,         subpath: ''         },
  { id: 'reservas',  label: 'Mis reservas', icon: <IconShoppingBag />,   subpath: 'reservas' },
  { id: 'contacto',  label: 'Contacto',     icon: <IconMessageCircle />, subpath: 'contacto' },
]

function getActiveId(pathname) {
  const seg = pathname.replace(/\/$/, '').split('/').pop()
  const found = NAV_ITEMS.find(it => it.subpath === seg)
  return found?.id ?? 'catalogo'
}

export default function TiendaShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeId  = getActiveId(location.pathname)

  function handleSelect(id) {
    const item = NAV_ITEMS.find(it => it.id === id)
    if (!item) return
    navigate(item.subpath ? `/tienda/${item.subpath}` : '/tienda')
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
            <Route index              element={<Catalogo />} />
            <Route path="prenda/:id"  element={<PrendaDetalle />} />
            <Route path="reservas"    element={<RequireAuth><MisReservas /></RequireAuth>} />
            <Route path="contacto"    element={<Contacto />} />
            <Route path="*"           element={<Navigate to="/tienda" replace />} />
          </Routes>
        </AnimatedContent>
      </main>

      {/* Nav contextual de Tienda */}
      <Nav
        items={NAV_ITEMS}
        activeId={activeId}
        onSelect={handleSelect}
      />
    </div>
  )
}
