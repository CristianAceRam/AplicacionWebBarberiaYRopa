import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import SesionChip from '../../components/SesionChip/SesionChip.jsx'
import { IconMenu } from '../../components/Nav/NavIcons.jsx'
import AdminPrendas from './Prendas/AdminPrendas.jsx'
import FormPrenda   from './Prendas/FormPrenda.jsx'
import AdminGaleria from './Galeria/AdminGaleria.jsx'
import AdminReservas from './Reservas/AdminReservas.jsx'
import AdminServicios from './Servicios/AdminServicios.jsx'
import FormServicio   from './Servicios/FormServicio.jsx'
import AdminHorario   from './Horario/AdminHorario.jsx'
import AdminExcepciones from './Excepciones/AdminExcepciones.jsx'
import AdminClientes   from './Clientes/AdminClientes.jsx'
import AdminCitas      from './Citas/AdminCitas.jsx'
import AdminResumen    from './Resumen/AdminResumen.jsx'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './AdminShell.module.css'

const SECCIONES = [
  { grupo: 'Inicio', items: [
    { id: 'resumen',         label: 'Resumen',                subpath: 'resumen'         },
  ]},
  { grupo: 'Barbería', items: [
    { id: 'citas',           label: 'Agenda / citas',         subpath: 'citas'           },
    { id: 'servicios',       label: 'Servicios',              subpath: 'servicios'       },
    { id: 'horario',         label: 'Horario',                subpath: 'horario'         },
    { id: 'excepciones',     label: 'Días cerrados y apert.', subpath: 'excepciones'     },
    { id: 'clientes',        label: 'Clientes',               subpath: 'clientes'        },
  ]},
  { grupo: 'Tienda', items: [
    { id: 'prendas',         label: 'Prendas',                subpath: 'prendas'         },
    { id: 'reservas-tienda', label: 'Reservas',               subpath: 'reservas-tienda' },
  ]},
  { grupo: 'Sitio', items: [
    { id: 'galeria',         label: 'Galería',                subpath: 'galeria'         },
    { id: 'contacto',        label: 'Contacto',               subpath: 'contacto'        },
  ]},
]

function PlaceholderAdmin({ titulo }) {
  return (
    <div className={styles.placeholder}>
      <p className={styles.placeholderTitulo}>{titulo}</p>
      <p className={styles.placeholderSub}>Próximamente</p>
    </div>
  )
}

export default function AdminShell() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const menuBtnRef = useRef(null)
  const drawerRef  = useRef(null)

  const seccionActiva = location.pathname.replace(/^\/admin\/?/, '').split('/')[0] || 'resumen'
  const tituloActivo  = SECCIONES.flatMap(g => g.items).find(i => i.id === seccionActiva)?.label ?? 'Admin'

  // Foco al abrir/cerrar — skips primera render
  const esPrimeraRender = useRef(true)
  useEffect(() => {
    if (esPrimeraRender.current) { esPrimeraRender.current = false; return }
    if (drawerAbierto) {
      drawerRef.current?.querySelector('button:not([disabled])')?.focus()
    } else {
      menuBtnRef.current?.focus()
    }
  }, [drawerAbierto])

  // Cerrar con Escape
  useEffect(() => {
    if (!drawerAbierto) return
    const onEsc = (e) => { if (e.key === 'Escape') setDrawerAbierto(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [drawerAbierto])

  function seleccionarSeccion(subpath) {
    navigate(`/admin/${subpath}`)
    setDrawerAbierto(false)
  }

  return (
    <div className={styles.adminWrap}>

      {/* Overlay — solo visible en móvil (CSS lo oculta en ≥768px) */}
      {drawerAbierto && (
        <div
          className={styles.overlay}
          onClick={() => setDrawerAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Cajón lateral */}
      <nav
        id="admin-drawer"
        ref={drawerRef}
        className={`${styles.drawer} ${drawerAbierto ? styles.drawerAbierto : ''}`}
        aria-label="Navegación del panel de administración"
      >
        <div className={styles.drawerHeader}>
          <Link to="/" aria-label="Volver al inicio">
            <Logo variant="symbol" size="sm" />
          </Link>
          <span className={styles.adminLabel}>Admin</span>
        </div>

        <ul className={styles.drawerNav}>
          {SECCIONES.map(grupo => (
            <li key={grupo.grupo} className={styles.grupoWrap}>
              <p className={styles.grupoLabel}>{grupo.grupo}</p>
              <ul className={styles.grupoItems}>
                {grupo.items.map(item => (
                  <li key={item.id}>
                    <button
                      className={`${styles.navItem} ${seccionActiva === item.id ? styles.navItemActivo : ''}`}
                      onClick={() => seleccionarSeccion(item.subpath)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Área de trabajo */}
      <div className={styles.workArea}>
        <header className={styles.workHeader}>
          <button
            ref={menuBtnRef}
            className={styles.menuBtn}
            onClick={() => setDrawerAbierto(v => !v)}
            aria-expanded={drawerAbierto}
            aria-controls="admin-drawer"
            aria-label={drawerAbierto ? 'Cerrar menú de administración' : 'Abrir menú de administración'}
          >
            <IconMenu />
          </button>
          <h1 className={styles.workTitulo}>{tituloActivo}</h1>
          <SesionChip />
        </header>

        <main className={styles.workContent}>
          <AnimatedContent key={location.pathname}>
            <Routes>
              <Route index element={<Navigate to="resumen" replace />} />
              <Route path="prendas"           element={<AdminPrendas />} />
              <Route path="prendas/nueva"     element={<FormPrenda />} />
              <Route path="prendas/:prendaId" element={<FormPrenda />} />
              <Route path="galeria"           element={<AdminGaleria />} />
              <Route path="reservas-tienda"   element={<AdminReservas />} />
              <Route path="servicios"            element={<AdminServicios />} />
              <Route path="servicios/nuevo"      element={<FormServicio />} />
              <Route path="servicios/:servicioId" element={<FormServicio />} />
              <Route path="horario"              element={<AdminHorario />} />
              <Route path="excepciones"          element={<AdminExcepciones />} />
              <Route path="clientes"             element={<AdminClientes />} />
              <Route path="citas"               element={<AdminCitas />} />
              <Route path="resumen"             element={<AdminResumen />} />
              {SECCIONES.flatMap(g => g.items)
                .filter(item =>
                  item.subpath !== 'prendas' &&
                  item.subpath !== 'galeria' &&
                  item.subpath !== 'reservas-tienda' &&
                  item.subpath !== 'servicios' &&
                  item.subpath !== 'horario' &&
                  item.subpath !== 'excepciones' &&
                  item.subpath !== 'clientes' &&
                  item.subpath !== 'citas' &&
                  item.subpath !== 'resumen'
                )
                .map(item => (
                  <Route
                    key={item.id}
                    path={item.subpath}
                    element={<PlaceholderAdmin titulo={item.label} />}
                  />
                ))}
              <Route path="*" element={<Navigate to="resumen" replace />} />
            </Routes>
          </AnimatedContent>
        </main>
      </div>

    </div>
  )
}
