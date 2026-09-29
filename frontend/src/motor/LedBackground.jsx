import { useEffect, useRef } from 'react'
import styles from './LedBackground.module.css'

const DENSITY     = 3   // trazos nacen cada ~2s — bajar a 2 si el móvil va justo
const MAX_STROKES = 8   // hard cap simultáneo
const CORNER_R    = 4   // radio de la esquina en L (px) — suaviza el aliasing

const DIRS = [
  { dx:  1, dy:  0 },  // →
  { dx: -1, dy:  0 },  // ←
  { dx:  0, dy:  1 },  // ↓
  { dx:  0, dy: -1 },  // ↑
]

function createStroke(colors) {
  const isGreen = Math.random() < 0.55
  const dir = DIRS[Math.floor(Math.random() * 4)]
  const isL = Math.random() < 0.25

  const x0 = Math.random() * window.innerWidth
  const y0 = Math.random() * window.innerHeight

  let path, visibleLen, totalPathLen

  if (!isL) {
    // ── Trazo recto ─────────────────────────────────────────────
    visibleLen   = 60 + Math.random() * 140   // 60–200px
    totalPathLen = visibleLen + 60

    path = new Path2D()
    path.moveTo(x0, y0)
    path.lineTo(x0 + dir.dx * totalPathLen, y0 + dir.dy * totalPathLen)
  } else {
    // ── Trazo en L ───────────────────────────────────────────────
    const arcLen    = Math.PI * CORNER_R / 2   // longitud del arco de la esquina
    const totalVis  = 60 + Math.random() * 140  // total visible 60–200px
    const legsTotal = totalVis - arcLen
    const frac      = 0.3 + Math.random() * 0.4  // reparto 30/70%
    const leg1      = legsTotal * frac
    const leg2      = legsTotal * (1 - frac)

    visibleLen   = leg1 + arcLen + leg2
    totalPathLen = visibleLen + 60

    // Giro 90° horario o antihorario
    const turnCW = Math.random() < 0.5
    const dir2   = turnCW
      ? { dx:  dir.dy, dy: -dir.dx }
      : { dx: -dir.dy, dy:  dir.dx }

    const cornerX = x0 + dir.dx * leg1
    const cornerY = y0 + dir.dy * leg1

    path = new Path2D()
    path.moveTo(x0, y0)
    // arcTo traza la línea hasta la tangente de entrada, el arco, y deja el cursor
    // en la tangente de salida — la geometría de la esquina queda resuelta por canvas
    path.arcTo(
      cornerX, cornerY,
      cornerX + dir2.dx * (leg2 + 60),
      cornerY + dir2.dy * (leg2 + 60),
      CORNER_R
    )
    path.lineTo(
      cornerX + dir2.dx * (leg2 + 60),
      cornerY + dir2.dy * (leg2 + 60)
    )
  }

  return {
    path,
    visibleLen,
    totalPathLen,
    speed: 100 + Math.random() * 180,   // 100–280 px/s
    color: isGreen ? colors.green : colors.white,
    halo:  isGreen ? colors.greenGlow : colors.white,
    head:  0,
    alive: true,
  }
}

function drawStroke(ctx, s) {
  const tail   = Math.max(0, s.head - s.visibleLen)
  const segLen = s.head - tail  // min(head, visibleLen)

  // Fade-in primeros 30px, fade-out últimos 30px antes del totalPathLen
  let t
  if (s.head < 30) {
    t = s.head / 30
  } else if (s.head > s.totalPathLen - 30) {
    t = Math.max(0, (s.totalPathLen - s.head) / 30)
  } else {
    t = 1
  }
  const opacity = t * 0.55

  // Revelar solo la ventana [tail, head] del path cacheado
  ctx.setLineDash([segLen, s.totalPathLen + 1000])
  ctx.lineDashOffset = -tail
  ctx.lineCap = 'round'

  // Pasada 1: halo ancho y difuso
  ctx.lineWidth   = 7
  ctx.globalAlpha = opacity * 0.18
  ctx.strokeStyle = s.halo
  ctx.stroke(s.path)

  // Pasada 2: núcleo fino y brillante
  ctx.lineWidth   = 1.5
  ctx.globalAlpha = opacity
  ctx.strokeStyle = s.color
  ctx.stroke(s.path)

  ctx.setLineDash([])  // reset para el siguiente trazo
}

function StrokesCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Colores desde CSS — cacheados una sola vez al montar
    const cssVars = getComputedStyle(document.documentElement)
    const colors = {
      white:     cssVars.getPropertyValue('--glowWhite').trim(),
      green:     cssVars.getPropertyValue('--neon').trim(),
      greenGlow: cssVars.getPropertyValue('--glowGreen').trim(),
    }

    function setupCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    setupCanvas()

    let resizeTimer
    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(setupCanvas, 150)
    }
    window.addEventListener('resize', onResize)

    let paused = document.hidden
    function onVisibility() { paused = document.hidden }
    function onBlur()       { paused = true  }
    function onFocus()      { paused = false }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur',  onBlur)
    window.addEventListener('focus', onFocus)

    const strokes = []
    let spawnTimer = 0
    let lastTime   = null
    let rafId

    function loop(ts) {
      rafId = requestAnimationFrame(loop)
      if (paused) return

      const dt = lastTime == null ? 0 : (ts - lastTime) / 1000
      lastTime = ts

      spawnTimer += dt * 1000
      const spawnInterval = (2000 / DENSITY) * (0.8 + Math.random() * 0.4)
      if (spawnTimer >= spawnInterval && strokes.length < MAX_STROKES) {
        strokes.push(createStroke(colors))
        spawnTimer = 0
      }

      for (const s of strokes) {
        s.head += s.speed * dt
        if (s.head > s.totalPathLen) s.alive = false
      }
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (!strokes[i].alive) strokes.splice(i, 1)
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const s of strokes) drawStroke(ctx, s)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur',  onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
}

export default function LedBackground({ variant = 'strokes' }) {
  if (variant === 'fallback-static') {
    return <div className={styles.staticBg} aria-hidden="true" />
  }
  return <StrokesCanvas />
}
