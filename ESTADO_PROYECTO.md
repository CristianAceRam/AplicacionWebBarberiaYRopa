# Estado del proyecto — Web Barbería + Tienda de Ropa ([CLIENTE])

> Documento de continuidad. Léelo junto a `CLAUDE.md` (y `BackendBarberia.md`) para retomar el proyecto en cualquier chat.

> **ESTADO ACTUAL: 🟢 FASE 1 COMPLETADA.** Backend RM integrado en el repo combinado. 127/127 tests en verde. Primer commit limpio creado.

## Qué es

Web combinada para un **cliente concreto** con **barbería** + **marca de ropa**, en una sola app (cascarón compartido, una sola auth, una sola BD). Dos dominios:
- **Barbería**: gestión de citas, **backend integrado desde RM** (127 tests, en verde).
- **Tienda de ropa — "Reserva sencilla"**: catálogo + el cliente reserva una prenda + aviso por Telegram al vendedor + cierre **en persona**. Sin pago online. Stock manual. **Pendiente: Fase 3.**

Stack: FastAPI + React (Vite, JS) + PostgreSQL, despliegue en Render. Mobile-first. Desarrollador único (AceitunoDev).

---

## Decisiones tomadas

- **Ropa = "Reserva sencilla"**: catálogo, reservar (lead), aviso Telegram, panel de catálogo autogestionado, **stock manual** (la reserva NO bloquea stock; varios pueden reservar la misma prenda; el vendedor cierra en persona).
- **Barbería = backend integrado desde RM**: no se reconstruyó desde el plano, se integró el código en producción directamente. `BackendBarberia.md` sigue siendo el contrato de verificación.
- **Auth/usuarios compartidos**: un solo `Usuario` con rol; el admin (dueño) gestiona ambos dominios; el cliente se registra una vez.
- **Diseño NUEVO**: nada de negro/oro de RM; identidad y **colores distintos**, mejor acabado. Se define en **Fase 0 con Claude Design** (pendiente).
- **Para un cliente concreto** (no plantilla genérica).
- **Estructura de carpetas**: `backend/` + `frontend/` como hermanos bajo la raíz. Razón: dependencias, entornos y herramientas independientes; raíz limpia con solo docs y `docker-compose.yml`.

---

## Decisiones abiertas (resolver al planificar)

1. **Imágenes de prendas**: URLs externas vs subida a almacenamiento de objetos (Cloudinary/S3/disco Render). Empezar simple.
2. **Tallas/variantes**: con tallas (elige al reservar) o sin tallas en V1.
3. **Stock manual**: `stock` (int) vs `disponible` (bool).
4. **Recordatorio diario de barbería**: ¿se incluye o no?
5. **Identidad de marca**: nombre, paleta, logo (Fase 0).

---

## Plan de fases (actualizado)

> **Nota**: Esta Fase 1 absorbió la Fase 1 (cimientos + auth) y la Fase 2 (módulo barbería) del plan original — fue integración del backend RM existente, no reconstrucción. El siguiente paso real es **Fase 3** (tienda). No existe una "Fase 2 barbería" pendiente.

- **Fase 0 — Diseño (Claude Design)**: identidad nueva (paleta, tipografía, componentes, claro/oscuro, micro-interacciones) → tokens + capturas + `DESIGN.md`. **Pendiente.**
- **Fase 1 — Cimientos + integración backend** ✅ **COMPLETADA**: estructura `backend/` + `frontend/`, backend RM integrado y verificado, `.gitignore`, `docker-compose.yml`, `config.py` con validator de producción, hueco Fase 3 en routers. 127/127 tests.
- **Fase 3 — Módulo Tienda "Reserva sencilla"**: modelos `Prenda` + `ReservaPrenda`; CRUD de catálogo (admin, stock manual); endpoints `/prendas` y `/reservas` (lead + aviso Telegram); "Mis reservas" (cliente) y gestión de reservas (admin). Tests.
- **Fase 4 — Frontend**: cascarón compartido (Barbería / Tienda), dashboard cliente, panel admin unificado, catálogo con fotos, implementación del diseño de Fase 0.
- **Fase 5 — Despliegue (Render)**: web + Postgres + static (+ crons si se incluyen). Render Blueprint combinado. Estrategia: `.onrender.com` primero, luego dominio propio.

---

## Reutilización desde RM

- **`BackendBarberia.md`**: spec completo del backend de barbería (contrato de verificación).
- **Lecciones ya pagadas**: zona horaria Europe/Madrid coherente; migraciones que endurecen constraints fallan si hay datos; variables de entorno por servicio en Render; centralizar constantes; pre-deploy fallido no tumba versión viva.

---

## Comandos clave

### Desarrollo local

```bash
# Levantar PostgreSQL
docker compose up -d                       # desde la raíz del proyecto

# Arrancar backend
cd backend
.venv\Scripts\activate                     # Windows
uvicorn app.main:app --reload

# Tests (siempre desde backend/)
cd backend && pytest tests/ -v

# Migraciones
cd backend && alembic upgrade head

# Seed de admins (idempotente)
cd backend && python seed.py
```

### Recrear venv (tras clonar o borrar)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                     # Windows
pip install -r requirements.txt
```

---

## Pendientes para Fase 5 (anotar ahora, ejecutar en Fase 5)

- `scripts/recordatorio_diario.py` — Cron Job en Render (22:00 Madrid); necesita Environment Group propio con sus secretos.
- `scripts/purga_citas.py` — script RGPD de retención (24 meses, `RETENCION_MESES`), 5 tests. Puede ejecutarse manualmente o como Cron Job. Si se incluye como Cron, necesita su propio Environment Group.

---

## Verificación pendiente (necesita Docker Desktop corriendo)

```bash
# Desde la raíz del proyecto:
docker compose up -d
cd backend && alembic upgrade head   # 7 migraciones sobre BD vacía
python seed.py                       # 2 admins idempotentes
alembic current                      # muestra revisión HEAD
```

Docker Desktop no estaba activo en la sesión de integración. El test de migraciones sobre PostgreSQL real está pendiente de ejecución con Docker corriendo.

---

## Cómo se trabaja (metodología)

Ver `METODOLOGIA.md`. Resumen: **Fase 0 de diseño en Claude Design** → planificación/revisión en el chat web → ejecución en Claude Code (Plan Mode: propone plan → se revisa → se aprueba → codifica, con tests). `CLAUDE.md` como constitución técnica; este `ESTADO_PROYECTO.md` como memoria entre sesiones; `BackendBarberia.md` como contrato de verificación del módulo de citas.

---

## Siguiente paso

1. Arrancar Docker Desktop y ejecutar la **verificación de Alembic + seed** (ver sección "Verificación pendiente").
2. Decidir si arrancar **Fase 0 (diseño visual)** o **Fase 3 (módulo tienda)** directamente.
3. Resolver las **decisiones abiertas** (imágenes, tallas, stock, recordatorio, identidad de marca).
