import { useState, useEffect, useRef } from 'react'
import { BASE_URL } from '../../api/api.js'
import styles from './Banner.module.css'

/* ── Iconos SVG inline para las redes sociales (exclusivos del banner) ── */
function IconInstagram() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5
        2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28
        6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34
        0 0 0 6.33-6.34V8.75a8.18 8.18 0 0 0 4.78 1.52V6.82a4.85 4.85 0 0 1-1.01-.13z"/>
    </svg>
  )
}

function IconWhatsApp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
}

/* ── Datos estáticos de redes — URLs reales pendientes de confirmar con Alex ── */
const REDES = [
  { id: 'instagram', label: 'Instagram', href: '#', icon: <IconInstagram /> },
  { id: 'tiktok',   label: 'TikTok',    href: '#', icon: <IconTikTok />    },
  { id: 'whatsapp', label: 'WhatsApp',  href: '#', icon: <IconWhatsApp />  },
]

/* ── Helpers de marquee ── */

// Viewport máximo objetivo (4K) para dimensionar el track
const MAX_VP_PX = 3840
// Velocidad objetivo en px/s — igual que el diseño original de 6 items / 22s
const PX_PER_S  = 24

// Genera suficientes repeticiones para que una mitad del track ≥ MAX_VP_PX.
// Con translateX(-50%) el loop es invisible: primera mitad = segunda mitad.
function buildMarqueeItems(baseItems, itemWidthPx) {
  if (!baseItems || baseItems.length === 0) return []
  const blockPx    = baseItems.length * itemWidthPx
  const repsPerHalf = Math.ceil(MAX_VP_PX / blockPx) + 1
  return Array.from(
    { length: repsPerHalf * 2 * baseItems.length },
    (_, i) => baseItems[i % baseItems.length]
  )
}

// Duración en segundos para mantener PX_PER_S con el track generado
function durationS(items, itemWidthPx) {
  return Math.round(items.length * itemWidthPx / 2 / PX_PER_S)
}

/* ── Cinta de redes sociales (→) ── */
function SocialStrip() {
  const [paused, setPaused] = useState(false)
  const timerRef  = useRef(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  function handlePointerDown() {
    clearTimeout(timerRef.current)
    pausedRef.current = true
    setPaused(true)
    timerRef.current = setTimeout(() => {
      pausedRef.current = false
      setPaused(false)
    }, 3000)
  }

  const REDES_W = 160 // estimado px/ítem (incluye inter-gap)
  const items   = buildMarqueeItems(REDES, REDES_W)
  const dur     = durationS(items, REDES_W)

  return (
    <div
      className={styles.stripWrapper}
      onPointerDown={handlePointerDown}
      aria-label="Redes sociales"
    >
      <div
        className={`${styles.track} ${paused ? styles['track--paused'] : ''}`}
        style={{ animationDuration: `${dur}s` }}
      >
        {items.map((red, i) => (
          <a
            key={`${red.id}-${i}`}
            href={red.href}
            className={styles.redItem}
            aria-label={red.label}
            rel="noopener noreferrer"
            target="_blank"
            onClick={e => { if (!pausedRef.current) e.preventDefault() }}
          >
            {red.icon}
            <span className={styles.redLabel}>{red.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

/* ── Cinta de galería (←) ── */
// Anchos estimados por ítem (incluye el gap: 2rem del track)
const GALERIA_W     = 192 // img 160px + gap 32px
const PI_W          = 90  // char + padding + gap (conservador → más ítems)
const BASE_PI_COUNT = 10  // tamaño del bloque base de placeholders

function GaleriaStrip() {
  const [fotos, setFotos] = useState([])

  useEffect(() => {
    fetch(`${BASE_URL}/galeria`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setFotos(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const fotosValidas = fotos.filter(f => f?.url)
  const hasFotos     = fotosValidas.length > 0

  const baseItems = hasFotos
    ? fotosValidas
    : Array.from({ length: BASE_PI_COUNT }, (_, i) => i)
  const itemW = hasFotos ? GALERIA_W : PI_W
  const items = buildMarqueeItems(baseItems, itemW)
  const dur   = durationS(items, itemW)

  return (
    <div className={styles.stripWrapper} aria-hidden="true">
      <div
        className={`${styles.track} ${styles['track--reverse']}`}
        style={{ animationDuration: `${dur}s` }}
      >
        {hasFotos
          ? items.map((foto, i) => (
              <img
                key={`f-${i}`}
                src={foto.url}
                alt={foto.titulo ?? ''}
                className={styles.galeriaImg}
                loading="lazy"
              />
            ))
          : items.map((_, i) => (
              <span key={i} className={styles.piPlaceholder}>π</span>
            ))
        }
      </div>
    </div>
  )
}

/* ── Banner completo ── */
export default function Banner() {
  return (
    <section className={styles.banner} aria-label="Banner de Alex">
      <SocialStrip />
      <GaleriaStrip />
    </section>
  )
}
