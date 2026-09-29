/**
 * Iconos SVG de trazo para el nav — estilo Lucide (MIT).
 * Pegados inline: sin librería instalada, sin petición de red.
 *
 * stroke="currentColor" → heredan el color del elemento padre (.item / .item--active).
 * fill="none" + strokeWidth="1.5" uniforme en todos.
 */

const SVG_PROPS = {
  xmlns:           'http://www.w3.org/2000/svg',
  width:           '20',
  height:          '20',
  viewBox:         '0 0 24 24',
  fill:            'none',
  stroke:          'currentColor',
  strokeWidth:     '1.5',
  strokeLinecap:   'round',
  strokeLinejoin:  'round',
  'aria-hidden':   'true',
}

export function IconCalendar() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

export function IconScissors() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/>
      <line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  )
}

export function IconShirt() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  )
}

export function IconShoppingBag() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )
}

export function IconMessageCircle() {
  return (
    <svg {...SVG_PROPS}>
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
    </svg>
  )
}

export function IconUser() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export function IconMenu() {
  return (
    <svg {...SVG_PROPS}>
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
