# DESIGN.md — Dirección de diseño · πίστη

> **Fuente de verdad del diseño.** Sustituye a la fase de Claude Design: la dirección se decidió en el chat web (arquitecto/revisor) y aquí queda consolidada para que **Claude Code la implemente fiel**. No es la implementación: cuando se construya el frontend (Fase 4), de los tokens de §4–§6 sale el `theme.css`, que pasa a ser la fuente de verdad *del código*.
>
> **Cómo usar este documento (Claude Code):** impлеméntalo en **React + Vite (JS) + CSS Modules**, sin Tailwind ni librerías de UI. Mobile-first y responsive **siempre**. Cualquier código de referencia (p. ej. de React Bits) es **referencia, no copy-paste**: se reimplementa en este stack. Construir en **trozos pequeños y verificables** (primero el sistema de luz + componentes-firma), revisando en preview sobre un móvil real antes de seguir. No inventes diseño: si algo no está aquí, pregunta.

---

## 1. Concepto

**πίστη** (griego: *fe / lealtad*). El concepto es el **ritual** —cortarse el pelo, vestir la marca— como acto de lealtad. Lema: **"Loyal to the ritual"**. Mundo visual ya existente (merch + local + lettering): negro dominante, blanco/blanco roto, **verde flúor (neón)**, lettering graffiti, símbolo **π**, estética nocturna y premium con carácter de calle.

**Regla de mesura:** la identidad se nota en **uno o dos gestos potentes**, no repitiendo el lema y los símbolos por todas partes. El lema NO se usa como bienvenida ni se mete con calzador en cada pantalla. Restricción, no saturación.

**El riesgo a evitar:** "fondo negro + acento verde ácido" es un cliché del diseño por defecto. La paleta de πίστη coincide con él, así que **la distinción NO viene del color** sino de la **ejecución propia**: el sistema de luz LED (§3), el lettering graffiti real, el π, la textura del neón del local. Si una pantalla se puede describir como "dark mode con verde", está mal.

---

## 2. La pieza-firma: la luz

La firma de πίστη es **la luz de neón LED del local** (tubos de neón blanco + tiras LED verdes sobre negro), llevada al producto como **un solo sistema coherente**, no como un `box-shadow` verde repetido. Es lo que hace la web inconfundible y, a la vez, lo que la mantiene barata en rendimiento (una técnica reutilizada en vez de cinco efectos distintos).

---

## 3. Sistema de luz LED (motor único)

Un **único "motor de luz"**: las mismas variables CSS y los mismos `@keyframes` alimentan TODOS los usos de luz. **No** dos sistemas de glow corriendo en paralelo (eso calienta el móvil). Dos colores de luz con roles distintos:

- **Neón BLANCO = luz de marca.** El logo, el wordmark, los momentos "escaparate". Es la luz protagonista (como los tubos blancos del local).
- **LED VERDE = línea-acento.** Bordes activos, foco, el indicador de navegación, separadores, el pulso del fondo. Es la línea que se enciende (como las tiras del local).

Aplicaciones del mismo motor:
- **Fondo:** pulsos de luz neón ocasionales y aleatorios (blanco + verde) imitando una tira LED. CSS/SVG barato (no shader a pantalla completa), **pulsos ocasionales, no churn continuo** → puede vivir persistente en toda la app sin matar batería. Es el fondo elegido (descartados Aurora/Threads/Strands como fondo persistente).
- **Navegación:** el indicador del apartado activo es una **luz que viaja** al destino (no un subrayado estático). Este es el nav propio; no es Card Nav ni Gooey Nav.
- **Foco / activo:** el borde **se enciende** en verde (anillo de foco visible incluido).
- **CTA principal:** en reposo, una luz tenue recorre el borde (solo el CTA principal; los demás botones quietos hasta hover).
- **Logo:** el mismo neón que "enciende" (ver §6 Metallic Paint / §10).

**Regla de implementación:** un solo motor de luz pintando fondo + bordes; nunca capas independientes de glows animados.

---

## 4. Color — tokens con roles (dark-only)

**Modo:** dark-first y **único** para el cliente. Sin modo claro (decisión tomada: duplicaría diseño, implementación y verificación de contraste, y traiciona la identidad). El admin podría replantearlo en su día; para el piloto, dark-only.

| Rol | Token | Valor |
|---|---|---|
| Fondo | `--bg` | `#0A0B0A` |
| Superficie | `--surface` | `#121412` |
| Tarjeta / input | `--surface2` | `#191C19` |
| Borde / divisor | `--line` | `#262B26` |
| Borde fuerte | `--lineStrong` | `#39403A` |
| Texto primario | `--text` | `#F4F6F3` |
| Texto secundario | `--dim` | `#A8AFA6` |
| Texto tenue (deshab./decor.) | `--faint` | `#787F76` |
| **Acento neón (verde)** | `--neon` | `#0bb329` |
| Neón claro (loaders/barras) | `--neonDim` | `#1ad13c` |
| Tinta sobre neón (CTA) | `--onNeon` | `#0A0B0A` |
| Glow blanco (luz de marca) | `--glowWhite` | `rgba(255,255,255,.9)` halo |
| Glow verde (línea-acento) | `--glowGreen` | `rgba(11,179,41,.5)` halo |

**Semánticos** (hue distinto del verde de marca para no confundirse): Éxito `#6FD08C`, Error `#FF6B6B`, Aviso `#FFC24B`, Info `#79A9FF`.

### Regla de oro del verde
`--neon` es **solo acento**: rellenos de CTA (con tinta negra `--onNeon`), bordes activos, glow, iconos, puntos de estado, líneas, el pulso del fondo. **Nunca** cuerpo de texto, etiquetas largas ni navegación con texto pequeño. El cuerpo siempre blanco roto sobre negro. (`#0bb329` técnicamente pasa AA como texto sobre negro a 7.0:1, pero se reserva a acento por **disciplina de marca y lectura de textos largos**.) Si en algún momento se necesita verde sobre fondo claro como relleno, el verde no tiene contraste suficiente → usar tinta/relleno alternativo.

### Contraste — WCAG AA verificado (≥4.5:1 texto / ≥3:1 grande y UI)
Texto `#F4F6F3` / fondo `#0A0B0A`: 18.1:1 (AAA). Secundario `#A8AFA6` / fondo: 8.8:1. Tinta `#0A0B0A` / neón `#0bb329`: 7.0:1. Éxito/Error/Aviso/Info sobre fondo: 10.4 / 7.1 / 12.3 / 8.4. `--faint` (4.2:1) queda **por debajo de AA para texto normal** → solo deshabilitados, tachados, decoración (exentos) o texto grande.

---

## 5. Tipografía

Cuatro roles; los dos de marca van como **imagen/SVG, no como fuente**:
- **Display · wordmark graffiti πίστη** — asset SVG extraído del merch. Solo hero / marca. NO una Google Font "parecida": es activo de marca, debe ser idéntico al del merch y el local.
- **Script · lema "Loyal to the ritual"** — asset SVG. Decorativo, uso muy puntual (mesura, §1).
- **Sans UI / cuerpo · Hanken Grotesk** (400/500/600/700/800) — el 90% del texto y la navegación. Sostiene toda la legibilidad.
- **Mono · Space Mono** (400/700) — cifras, horas, fechas, precios, IDs, etiquetas en versalitas con tracking.

Escala (móvil): H1 32/800 · H2 24/700 · H3 20/700 · cuerpo 16/400 · small 14 · etiqueta mono 11–12 MAYÚS tracking `.14em`. Mínimo de cuerpo en móvil: 16px. El lettering graffiti es poco legible a tamaño pequeño → wordmark/hero, jamás navegación, botones ni cuerpo.

---

## 6. Forma y elevación

- **Esquinas angulares**, casi rectas (`--r: ~2–4px`; `--rlg: ~6–9px` para tarjetas mayores; `999px` solo para pills deliberadas). Nada de tarjetas blandas con radio grande: lo angular es coherente con graffiti/calle y aleja de la plantilla.
- **Contención por luz, no por caja.** Muchas "tarjetas" no son cajas con relieve, sino **superficies definidas por una línea de luz** (un borde que se enciende, una hairline verde en un lado). Rompe la sensación de rejilla de cajas. (Aviso: borde de un solo lado → sin radio en ese lado.)
- **Elevación = glow + hairline**, no sombra blanda. Lo activo se eleva encendiéndose, no con drop-shadow difusa.

---

## 7. Arquitectura de navegación — Cliente

Dos niveles. **No** hay atajo directo Barbería↔Tienda: se cruza volviendo al hub (decisión tomada: dos negocios bien separados).

- **Nivel 0 · Portada (hub):** marca arriba; **dos secciones grandes — Barbería · Tienda**; debajo, el **banner de Alex** (§8). Es la bifurcación a cada mundo.
- **Nivel 1 · Mundos:**
  - **Barbería → modelo A (ritmo vertical):** reservar es el elemento que domina; debajo, próxima cita y servicios como filas con ritmo (no tarjetas clónicas). Reveal on scroll (cada bloque se enciende al entrar).
  - **Tienda → modelo B (carriles horizontales):** secciones como rieles horizontales (catálogo, drops, accesorios); sensación de app, escaparate.
  - **Nav contextual por mundo** (no una sola barra para los dos):
    - Barbería: *Mis citas · Reservar · Perfil*.
    - Tienda: *Catálogo · Mis reservas · Contacto · Perfil*.

**El nav (panel translúcido):** mismo elemento que es **barra inferior en móvil** y **menú lateral en desktop** (responsive). Panel oscuro semitransparente (cristal esmerilado, `backdrop-filter: blur`) con borde que se enciende en verde LED. **Plan B:** `backdrop-filter` es caro en móvil → es candidato a calibrar (§10). Solo luce cuando pasa contenido con textura/color por debajo (scroll); sobre negro plano no se nota. Si no rinde o no luce, se sustituye por una alternativa sólida con línea LED. No nos casamos con el cristal.

---

## 8. Banner de Alex (en el hub)

Dos cintas con movimiento tipo marquee (Logo Loop, transform puro, barato), **en direcciones opuestas**:

- **Cinta de redes sociales:** logos de sus RRSS en bucle; **al pulsar se detiene** para poder clicar la red. **Estática (en código), sin backend** — son estables; los cambios puntuales los hace el desarrollador a mano. Funcional (enlaces).
- **Cinta de galería:** fotos de la peluquería y de prendas en bucle. Decorativa, **sin función**. **Gestionable por Alex** — esta es una mini-feature con backend:
  - Modelo con **orden** (cada foto guarda su posición); Alex **añade, quita y reordena**.
  - Endpoints CRUD (Alex) + lectura pública; sección propia en el panel admin con reordenación (arrastrar o subir/bajar).
  - **Subida de imágenes compartida con el catálogo de tienda** → depende de la misma decisión de imágenes de Alex (URLs vs. Cloudinary; ver §13). Por eso encaja **junto a la Fase 3 (tienda)**, no antes.
  - **Estado vacío** diseñado (qué muestra el banner si Alex aún no ha subido nada; puede arrancar con 4-5 fotos de origen que él pueda quitar/reordenar).

Accesibilidad de ambas cintas: deben **detenerse sin ratón** y respetar `prefers-reduced-motion` (sin movimiento → estáticas).

---

## 9. Admin (aparcado)

Disposición **pendiente** de saber si Alex usará el admin en **móvil o en ordenador**. Tres opciones sobre la mesa, mismo lenguaje de luz:
- **A · Bento mosaico** (celdas de tamaños mixtos, todo a la vista). Depende de cursor para sus animaciones (hover) → solo brilla en desktop.
- **B · Eje** (la agenda del día como columna que organiza; menú lateral + raíl de módulos). Favorita para barbería.
- **C · Foco + cajón** (área de trabajo limpia + cajón lateral plegable). La que mejor aguanta en móvil.
Decidir cuando Alex confirme el dispositivo.

---

## 10. Mapa de efectos por zona + presupuesto de rendimiento

Principio: **no se instala React Bits.** Los efectos de CSS puro se reimplementan en CSS Modules (cero dependencias). El coste real solo muerde en WebGL (Three.js/OGL) o GSAP.

**Baratos — van donde sea, incluido el flujo de reserva y móvil** (CSS, sin dependencias):
- **Blur Text** (login; el blur→nítido = "entrar en foco", es el tema). Preferido sobre Split Text (que arrastra GSAP).
- **Gradient Text** (títulos, con cuentagotas: uno por pantalla).
- **Count Up** (dashboard admin, anima una vez).
- **Logo Loop** (banner de Alex, las dos cintas en direcciones opuestas).
- **Stepper** (registro y embudo de reserva; además mejora usabilidad).
- **Carousel** (fotos de cada prenda).
- **Máscara-fundido del scroll** (`mask-image` gradiente) — **en lugar de Gradual Blur** (`backdrop-filter`, caro en móvil). Da el 90% del efecto por el 5% del coste.
- **Pulsos LED del fondo** (§3).

**Moderados — solo desktop / zonas no críticas** (hover/cursor): **Magic Bento**, **Border Glow**. Fuera del embudo de reserva. Magic Bento además bloqueado a "Alex usa ordenador".

**Caros (WebGL render continuo) — solo escaparate, de uno en uno, con fallback estático en móvil/`reduced-motion`:**
- **Metallic Paint** en el logo/wordmark. Idea: en movimiento constante. **Es el primer candidato a calibrar** (shader en bucle, y el logo vive en el header de todas las vistas). Construirlo con interruptor desde el principio: **pausar cuando no está en viewport**, o animar solo en la vista de entrada y estático (ya renderizado) en el resto. Si en un Android real va fluido, queda; si no, al fallback.

**Trampa a evitar:** `backdrop-filter` blur en superficies grandes y/o animadas (scroll del catálogo). En el nav (elemento pequeño, fijo) es asumible pero es el **segundo candidato a vigilar**.

**Cómo se calibra (medir desde el primer componente, no antes de producción):**
- Local y gratis: Chrome DevTools con **CPU throttling 4×–6×** (simula gama media) + Lighthouse.
- La prueba reina: `npm run build` → `npm run preview` (sirve el build real, no el dev) → `cloudflared tunnel --url http://localhost:4173` → abrir en un **Android de gama media real**. El túnel mide bien la **suavidad de efectos en el móvil**; NO mide la velocidad de carga "como producción" (eso es el preview real de Render/Cloudflare Pages).
- Flujo: presupuesto → construir el wow → medir con throttling → recortar/cambiar técnica lo que se salga → confirmar en móvil real.

---

## 11. Reglas transversales / accesibilidad

- **Un solo fondo**; un solo motor de luz; **nada de render continuo en las pantallas de reservar** (camino crítico = rápido).
- **`prefers-reduced-motion`** respetado en TODO (neón incluido): sin parpadeo ni giro, el neón aparece encendido y fijo, los loaders no rotan, las cintas se detienen. Versión estática siempre.
- **Contraste AA** verificado (§4). Verde nunca para cuerpo de texto.
- **Toque ≥ 44px**, foco de teclado visible (anillo verde).
- Un momento orquestado, no muchos: el wordmark/logo que enciende es el gesto principal; el resto, micro-transiciones de 120–200 ms.
- El acabado premium debe sostenerse **también en el panel admin** (tablas, formularios), no solo en el hero.

---

## 12. Coherencia con el backend ya decidido

El diseño no debe maquetar flujos que el backend no tiene:
- **No hay stock entero.** Disponibilidad **por talla** (booleano disponible/agotado). El selector de talla y la tarjeta de catálogo del admin muestran **tallas disponibles + nº de reservas**, nunca un número de stock.
- **Login = email + contraseña** (devuelve token); el **registro** añade nombre + teléfono. No diseñar un login con teléfono y sin contraseña.
- Estados de cita derivados: **Reservada / Realizada / Cancelada / No asistió** (nunca "Confirmada").
- La reserva de prenda es un **lead** (no bloquea stock; varios pueden reservar la misma talla).

---

## 13. Decisiones abiertas (no bloquean el diseño; a confirmar con Alex)

1. **Imágenes de Alex** (URLs pegadas vs. subida a Cloudinary). Afecta a **dos sitios**: el **catálogo de tienda** (Fase 3) y la **galería del banner** (§8). Si Alex sube fotos él mismo en ambos (galería con orden + catálogo), la respuesta apunta a **Cloudinary con subida directa**, pero lo confirma él. Bloquea el modelo `Prenda` y la galería.
2. **Dispositivo del admin** (móvil vs. ordenador). Decide la disposición del admin (§9: A/B/C).

Cerradas: sin atajo Barbería↔Tienda; redes del banner estáticas, galería gestionable; dark-only; fondo = pulsos LED (no Aurora/Threads/Strands).
