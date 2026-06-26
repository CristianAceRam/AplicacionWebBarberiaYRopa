# Estado del proyecto — Web Barbería + Tienda de Ropa ([CLIENTE])

> Documento de continuidad. Léelo junto a `CLAUDE.md` (y `BackendBarberia.md`) para retomar el proyecto en cualquier chat.

> **ESTADO ACTUAL: 🟡 RECIÉN ARRANCADO.** Nada construido todavía. Decisiones base tomadas; pendiente la Fase 0 de diseño y definir los detalles abiertos.

## Qué es

Web combinada para un **cliente concreto** con **barbería** + **marca de ropa**, en una sola app (cascarón compartido, una sola auth, una sola BD). Dos dominios:
- **Barbería**: gestión de citas, **backend idéntico a RM** (se reconstruye a partir de `BackendBarberia.md`).
- **Tienda de ropa — "Reserva sencilla"**: catálogo + el cliente reserva una prenda + aviso por Telegram al vendedor + cierre **en persona**. Sin pago online. Stock manual.

Stack: FastAPI + React (Vite, JS) + PostgreSQL, despliegue en Render. Mobile-first. Desarrollador único (AceitunoDev).

---

## Decisiones tomadas

- **Ropa = "Reserva sencilla"**: catálogo, reservar (lead), aviso Telegram, panel de catálogo autogestionado, **stock manual** (la reserva NO bloquea stock; varios pueden reservar la misma prenda; el vendedor cierra en persona).
- **Barbería = backend idéntico a RM**: reutilizar `BackendBarberia.md` (franjas 30 min, servicios múltiplos de 30 ≤300, ventana 30 días, días cerrados, zona horaria Europe/Madrid coherente, no-solape transaccional, etc.).
- **Auth/usuarios compartidos**: un solo `Usuario` con rol; el admin (dueño) gestiona ambos dominios; el cliente se registra una vez.
- **Diseño NUEVO**: nada de negro/oro de RM; identidad y **colores distintos**, mejor acabado. Se define en **Fase 0 con Claude Design**.
- **Para un cliente concreto** (no plantilla genérica).

---

## Decisiones abiertas (resolver al planificar)

1. **Imágenes de prendas**: URLs externas vs subida a almacenamiento de objetos (Cloudinary/S3/disco Render). Empezar simple.
2. **Tallas/variantes**: con tallas (elige al reservar) o sin tallas en V1.
3. **Stock manual**: `stock` (int) vs `disponible` (bool).
4. **Recordatorio diario de barbería**: ¿se incluye o no?
5. **Identidad de marca**: nombre, paleta, logo (Fase 0).

---

## Plan de fases (propuesto)

- **Fase 0 — Diseño (Claude Design)**: identidad nueva (paleta, tipografía, componentes, claro/oscuro, micro-interacciones) → tokens + capturas + `DESIGN.md`. Cascarón con las dos secciones (Barbería / Tienda) + panel admin unificado.
- **Fase 1 — Cimientos + auth**: estructura backend/frontend, BD, Alembic, FastAPI con seguridad, CORS, `/health`, slowapi. **Usuario + auth + seed** (reutilizar RM / `BackendBarberia.md` §5). Cliente HTTP centralizado, AuthContext, rutas por rol.
- **Fase 2 — Módulo Barbería**: reconstruir desde `BackendBarberia.md` (servicios, horario, disponibilidad, citas/no-solape, cancelación, inasistencias, días cerrados, ventana, Telegram). Tests.
- **Fase 3 — Módulo Tienda "Reserva sencilla"**: modelos `Prenda` + `ReservaPrenda`; CRUD de catálogo (admin, stock manual); endpoints de catálogo y de reserva (lead + aviso Telegram); "Mis reservas" (cliente) y gestión de reservas (admin). Tests.
- **Fase 4 — Frontend**: cascarón compartido (Barbería / Tienda), dashboard cliente de cada dominio, panel admin unificado, catálogo con fotos, implementación fiel del diseño de la Fase 0.
- **Fase 5 — Despliegue (Render)**: web + Postgres + static (+ cron si se incluye el recordatorio). Estrategia segura: `.onrender.com` primero, luego dominio propio + DNS.

(Las fases 2 y 3 son independientes; se pueden alternar. La barbería va "sobre seguro" porque ya está el plano.)

---

## Reutilización desde RM

- **`BackendBarberia.md`**: spec completo del backend de barbería (modelos, reglas, contratos de API, seguridad, despliegue, lecciones). Es la fuente de verdad del módulo de citas.
- **Lecciones ya pagadas** a tener presentes: zona horaria Europe/Madrid coherente en todos los endpoints (con test "para hoy"); migraciones que endurecen constraints fallan si hay datos que los incumplen; variables de entorno por servicio en Render (los `sync:false` no se heredan); centralizar constantes; el pre-deploy fallido no tumba la versión viva.

---

## Cómo se trabaja (metodología)

Ver `METODOLOGIA.md`. Resumen: **Fase 0 de diseño en Claude Design** → planificación/revisión en el chat web → ejecución en Claude Code (Plan Mode: propone plan → se revisa aquí → se aprueba → codifica, con tests). `CLAUDE.md` como constitución técnica (se actualiza tras cada decisión); este `ESTADO_PROYECTO.md` como memoria entre sesiones; `BackendBarberia.md` como plano del módulo de citas.

---

## Siguiente paso

1. Resolver las **decisiones abiertas** (sobre todo imágenes, tallas, stock e identidad de marca).
2. **Fase 0 de diseño** en Claude Design (nueva identidad, colores distintos).
3. Crear el repo con `CLAUDE.md`, este `ESTADO_PROYECTO.md`, `METODOLOGIA.md` y `BackendBarberia.md`, y empezar la **Fase 1**.
