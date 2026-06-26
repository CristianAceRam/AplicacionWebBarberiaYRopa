# BackendBarberia.md — Plano del backend de citas (reutilizable)

> Documento de transferencia. Describe el backend de gestión de citas de la peluquería RM para **reutilizarlo en otro proyecto** (web combinada barbería + marca de ropa, mismo stack). Pásalo a Claude Code junto con un `CLAUDE.md` del nuevo proyecto para reconstruir/adaptar este módulo sin recodificar desde cero.
>
> El módulo de barbería es un **contexto acotado**: auth + servicios + horario + disponibilidad + reservas + notificaciones. La parte de "ropa" es un dominio aparte que comparte el cascarón (shell), la auth y la BD. Ver la sección final "Encaje en el proyecto barbería + ropa".

---

## 1. Stack y convenciones

- **Backend**: FastAPI (Python). **BD**: PostgreSQL. **ORM**: SQLAlchemy + Alembic. **Validación**: Pydantic. **Auth**: JWT (cabecera `Authorization: Bearer`). **Rate limiting**: slowapi. **Tests**: pytest.
- **Local**: PostgreSQL en Docker (docker-compose).
- **Convenciones**: dominio en español (`Usuario`, `Cita`, `Servicio`…). Secretos solo en variables de entorno. Cada endpoint con su test pytest. Esquemas de entrada y salida separados. En FastAPI, **rutas literales antes que rutas con parámetro**.

---

## 2. Constantes de negocio (centralizar SIEMPRE)

En `app/constants.py`. **No hardcodear estos valores por el código** — toda la lógica los importa de aquí. Esto fue clave: el cliente cambió el tamaño de franja varias veces y centralizar lo hizo trivial.

```
FRANJA_MINUTOS      = 30    # unidad atómica de tiempo (una franja)
DURACION_MAX_MINUTOS = 300  # duración máxima de un servicio (5 h)
DIAS_MAX_RESERVA    = 30    # horizonte de reserva (días desde hoy)
```

Zona horaria de referencia: **Europe/Madrid** (ver sección 9, es crítica).

---

## 3. Modelo de datos

- **Usuario**: `id`, `email` (único), `password_hash` (bcrypt/passlib), `telefono`, `nombre_completo`, `rol` ('admin' | 'cliente'), `bloqueado` (bool, def. false), `inasistencias` (int, contador almacenado, def. 0).
- **Servicio**: `id`, `nombre`, `duracion_minutos` (**múltiplo de `FRANJA_MINUTOS` y ≤ `DURACION_MAX_MINUTOS`**), `precio` (Decimal), `activo` (bool — borrado lógico).
- **HorarioPeluquero**: `id`, `dia_semana` (0=lunes … 6=domingo), `hora_apertura`, `hora_cierre`. **Admite varios tramos por día** (jornada partida, p. ej. 9:00–14:00 y 17:00–21:00); NO hay unique en `dia_semana`. Validación de solape entre tramos en el router.
- **Cita**: `id`, `cliente_id` (FK), `servicio_id` (FK), `fecha`, `hora_inicio`, `hora_fin`, `estado` ('activa' | 'cancelada' | 'no_asistida').
- **FranjaOcupada**: `id`, `cita_id` (FK), `fecha`, `hora`. **`UNIQUE (fecha, hora)`**. Es la **fuente de verdad de la ocupación**. Los valores de `hora` caen en múltiplos de `FRANJA_MINUTOS` (:00/:30).
- **ExcepcionFecha** (días cerrados): `id`, `fecha` (único), `tipo` (enum, de momento solo `"cerrado"`). **Diseñado para extenderse** a "horarios especiales por fecha" añadiendo valores al enum y tramos asociados, sin rediseñar.

Nº de franjas que ocupa un servicio = `duracion_minutos / FRANJA_MINUTOS`. Ejemplos: 30 min = 1 franja, 60 = 2, 90 = 3, …, 300 (5 h) = 10.

---

## 4. Reglas de negocio

### 4.1 No reservas solapadas (REGLA CRÍTICA)
La concurrencia se resuelve **a nivel de BD** con el `UNIQUE(fecha, hora)` de `FranjaOcupada`. Crear una cita = insertar la `Cita` **+ sus N franjas en UNA sola transacción**. Si una franja ya existe → `IntegrityError` → rollback → **409 Conflict** (el frontend pide recargar). Patrón ilustrativo:

```
# dentro de una transacción
cita = Cita(cliente_id=..., servicio_id=..., fecha=..., hora_inicio=..., hora_fin=...)
db.add(cita); db.flush()  # obtener cita.id
n = servicio.duracion_minutos // FRANJA_MINUTOS
for i in range(n):
    hora = (datetime.combine(fecha, hora_inicio) + timedelta(minutes=FRANJA_MINUTOS * i)).time()
    db.add(FranjaOcupada(cita_id=cita.id, fecha=fecha, hora=hora))
try:
    db.commit()
except IntegrityError:
    db.rollback()
    raise HTTPException(409, "Ese hueco se acaba de ocupar, recarga")
```

### 4.2 Disponibilidad
`GET /disponibilidad?fecha=&servicio_id=` devuelve **solo las horas de inicio válidas** para ese servicio: las **N franjas consecutivas libres dentro de un mismo tramo de apertura**. Itera todos los tramos del día (jornada partida) en pasos de `FRANJA_MINUTOS`. Orden de filtros (todos devuelven lista vacía, sin error):
1. Fecha **fuera de ventana** (ver 4.3) → vacío.
2. Fecha **cerrada** (`ExcepcionFecha`) → vacío.
3. Sin horario ese día → vacío.
4. Si la fecha es **hoy**, descarta horas pasadas (hora actual en Europe/Madrid).
5. Para cada tramo, ofrece inicios donde caben las N franjas seguidas y todas libres.

### 4.3 Ventana de reserva (horizonte rodante)
Solo se reserva en **[hoy, hoy + `DIAS_MAX_RESERVA`]** (ambos inclusive), con "hoy" en Europe/Madrid. Se calcula en cada petición → se desliza sola, sin cron. `/disponibilidad` vacío fuera de ventana; `POST /citas` → **422**. El frontend deshabilita en el calendario los días fuera de ventana.

### 4.4 Días cerrados
El admin marca fechas concretas como cerradas (`ExcepcionFecha`, tipo `cerrado`) **sin tocar el horario semanal** — los demás días de esa semana siguen abiertos. Tiene **prioridad** sobre el horario. Al **añadir** un cierre, si esa fecha ya tiene citas activas → **409 con el conteo** (no se cierra por encima de citas vivas; el admin las cancela antes). Fecha cerrada → `/disponibilidad` vacío y `POST /citas` 422.

### 4.5 Cancelación
`PATCH /citas/{id}/cancelar`: estado → 'cancelada' **y borra sus franjas** (libera huecos), en una transacción. Solo dueño o admin. No se cancela una pasada ni una ya cancelada.

### 4.6 Inasistencias (no-show) y veto
`PATCH /citas/{id}/no-asistida` (solo admin): marca una cita **pasada y activa** como 'no_asistida' (manual; la app no sabe quién asistió). El **contador** vive en `Usuario.inasistencias`. **Veto**: `Usuario.bloqueado` → si está bloqueado, `POST /citas` devuelve **403**.

### 4.7 Estados derivados (NO hay "confirmar")
La etiqueta visible se DERIVA de `estado` + fecha: activa+futura → "Reservada"; activa+pasada → "Realizada" (se asume que vino si no se marcó no-show); 'no_asistida' → "No asistió"; 'cancelada' → "Cancelada". **Nunca** existe "Confirmada".

---

## 5. Autenticación y roles

- **Roles**: `admin` (peluquero + desarrollador; **2 cuentas fijas creadas por seed**, sin registro público) y `cliente` (se registra él mismo).
- **Registro** (`POST /registro`): solo crea rol cliente (el rol NUNCA se acepta del body). Valida `nombre_completo` (mín. dos palabras, solo letras/espacios/guiones/acentos), `telefono` (formato España), `email` (único), `password` (≥ 8, bcrypt). 409 si email duplicado.
- **Login** (`POST /login`): devuelve **solo el token**; el frontend obtiene rol/datos vía `GET /usuarios/me` (no decodifica el JWT). JWT claims: `sub` (user_id), `rol`, `exp`.
- **Dependencias**: `get_usuario_actual`, `solo_admin`.
- **Seed CREATE-IF-MISSING**: si el admin no existe → lo crea con todos los datos (incluida contraseña, desde env vars). Si ya existe → solo garantiza `rol=admin` y `bloqueado=False`; **nunca toca** `password_hash`/`nombre`/`telefono`. ⚠️ Implicación: cambiar la contraseña en las env vars NO la actualiza si el admin ya existe → para resetear, borrar la fila y re-sembrar.

---

## 6. Contrato de API (endpoints)

**Auth/cuenta**
- `POST /login` → `{access_token, token_type:"bearer"}`.
- `GET /usuarios/me` → `{id, email, telefono, nombre_completo, rol}`.
- `POST /registro` → 201 UsuarioRead (sin token); 409 duplicado.
- `PATCH /usuarios/me` (nombre + teléfono, whitelist estricta).
- `PATCH /usuarios/me/password` (verifica actual, bcrypt, rate limit).

**Servicios** (`precio` Decimal como string "25.50")
- `GET /servicios` → solo activos; `?incluir_inactivos=true` solo admin.
- `POST/PUT/DELETE /servicios` (admin; `DELETE` = borrado lógico; `PUT {activo:true}` reactiva).

**Horario**
- `GET /horario` → clientes autenticados; `[{id, dia_semana, hora_apertura, hora_cierre}]`.
- `POST/PUT/DELETE /horario` (admin; valida solape de tramos → 409).

**Disponibilidad y citas**
- `GET /disponibilidad?fecha=YYYY-MM-DD&servicio_id=int` → `{fecha, servicio_id, horas_disponibles:["HH:MM",…]}`.
- `POST /citas` body `{servicio_id, fecha, hora_inicio}` (NO enviar cliente_id/estado/hora_fin → 422). 201 con `hora_fin` calculado. Errores: 403 (bloqueado), 409 (hueco ocupado), 422 (pasada / fuera de ventana / día cerrado / fuera de horario / inválida).
- `GET /citas/mias` → del cliente (solo `servicio_id`, cruzar con `/servicios`; orden cronológico).
- `GET /citas` (admin; `?fecha=YYYY-MM-DD` filtra por día).
- `PATCH /citas/{id}/cancelar` (dueño o admin); `PATCH /citas/{id}/no-asistida` (admin).

**Clientes (admin)**
- `GET /usuarios` (lista) + endpoints de bloquear/desbloquear.

**Días cerrados**
- `GET /excepciones` (admin), `GET /excepciones/proximas` (cliente; dentro de [hoy, hoy+DIAS_MAX_RESERVA]).
- `POST /excepciones` (admin; 409 si ya cerrada o con citas activas), `DELETE /excepciones/{id}` (admin; 404 si no existe).

**Salud**
- `GET /health` → `{"status":"ok"}` (para monitorización).

---

## 7. Seguridad (OWASP Top 10)

- Control de acceso por objeto en cada endpoint (anti-IDOR). Panel admin con `solo_admin` en el backend.
- `cliente_id` de una cita se toma **del token**, nunca del body (anti mass-assignment).
- Validación Pydantic estricta (422 si inválido). SQLAlchemy ORM parametrizado (anti SQLi).
- HTTPS forzado, HSTS y cabeceras de seguridad. JWT en cabecera (mitiga CSRF). Frontend escapa por defecto (anti XSS).
- Rate limiting: `/login` y `/registro` estricto por IP (~5/min); `POST /citas` por usuario (~5–10/min + tope diario).
- No filtrar stack traces (500 genérico). No registrar datos personales ni contraseñas. RGPD: minimización y derecho de borrado/anonimización.

---

## 8. Zona horaria (CRÍTICO — aquí ya nos quemamos)

**Toda** la lógica de fecha/hora (“hoy”, hora actual, día de la semana, filtros de ventana y de horas pasadas) usa **Europe/Madrid** y de forma **IDÉNTICA en todos los endpoints**. Helper recomendado:

```
from datetime import datetime
from zoneinfo import ZoneInfo
_MADRID = ZoneInfo("Europe/Madrid")
def hoy_madrid(): return datetime.now(_MADRID).date()
```

**Bug real que sufrimos**: `/disponibilidad` y `POST /citas` calculaban "hoy" con zonas distintas (uno en UTC) → una hora válida del tramo para HOY se ofrecía como disponible pero al reservar daba **422 "fuera de horario"**. Lección: nunca `date.today()`/`datetime.now()` sin tz; centralizar el cálculo. **Test obligatorio**: reservar a una hora válida **para HOY** (los tests que solo usan días futuros no cazan este bug).

---

## 9. Notificaciones (Telegram)

Avisos al peluquero (nunca al cliente en V1). `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en env vars; si faltan, no envía. Los fallos de Telegram se **silencian/registran** y **nunca rompen** la operación. Helper: `enviar_aviso_peluquero(mensaje: str)`.

1. **Instantáneos** (en `BackgroundTasks`, tras confirmar la transacción): al **reservar** (`POST /citas`) y al **cancelar** (solo si cancela el cliente).
2. **Recordatorio diario** (proceso programado, `scripts/recordatorio_diario.py`): cada día a las **22:00 Europe/Madrid** envía un **resumen de las citas del día siguiente**; se envía **SIEMPRE** (si no hay, lo indica; si hay, lista cada una con hora y nombre). "Mañana" se calcula en Europe/Madrid **dentro del script** (el cron corre en UTC). Idempotencia por horario fijo (no usa campo en BD).

---

## 10. Migraciones (Alembic) y seed

- Cada cambio de esquema = una migración encadenada. Pre-deploy: `alembic upgrade head && python seed.py`.
- **`Settings` (pydantic) sin valores por defecto**: cualquier servicio (web, cron) que importe `app.config` debe tener TODAS las env vars obligatorias (`SECRET_KEY`, `DATABASE_URL`, etc.), o peta al arrancar.
- Normaliza `DATABASE_URL`: Render inyecta `postgres://`, psycopg3 necesita `postgresql+psycopg://` → `field_validator` en `config.py`.

---

## 11. Despliegue (patrón Render)

Tres/cuatro piezas vía Blueprint (`render.yaml`): **Web Service** (backend, plan de pago always-on), **PostgreSQL gestionada** (con backups, `ipAllowList: []` solo interno), **Static Site** (frontend) y, opcional, **Cron Job** (recordatorio diario). Notas:

- **Health check** en `/health`. Región única para todo (latencia + RGPD).
- **Env vars son por servicio**: los `sync:false` (secretos) NO se comparten entre servicios — el cron necesita los suyos. Considera un **Environment Group** para compartir.
- **Cron en UTC**: calcula fechas locales dentro del script. `schedule "0 20 * * *"` = 22:00 Madrid en verano.
- Nombres de servicio pueden colisionar globalmente → Render añade sufijo → actualizar las URLs (`VITE_API_URL`, `ALLOWED_ORIGINS`) a las reales.
- Estrategia segura: desplegar primero en URLs `.onrender.com`, verificar de punta a punta, y solo luego dominio propio + DNS.

---

## 12. Tests

pytest por endpoint, BD de test. Cubrir: no-solape (409), disponibilidad por tipo de servicio, ventana (límite hoy+30 OK / hoy+31 rechazado), día cerrado (disponibilidad vacía + cita 422 + 409 al cerrar con citas activas), cancelación libera franjas, validaciones de servicio (múltiplo y tope), recordatorio (mockear Telegram), y **el caso "para HOY"** de zona horaria.

---

## 13. Errores que ya cometimos (no repetir)

- **Migración que endurece un constraint** (p. ej. añadir `≤ máximo`) **falla en producción si hay filas que lo incumplen**. Corregir/limpiar los datos ANTES de migrar. (Nos pasó con el tope de duración.)
- **Zona horaria inconsistente entre endpoints** → reservas válidas rechazadas. Centralizar "hoy" en Europe/Madrid (sección 8).
- **Secretos `sync:false` no se heredan entre servicios** de Render (el cron arrancaba sin tokens / sin `SECRET_KEY`).
- **No centralizar el tamaño de franja** habría hecho un infierno el flip-flop 30→15→30 del cliente. Constantes + modelos con discriminador (`ExcepcionFecha.tipo`) = barato adaptarse.
- El pre-deploy fallido **no tumba** la versión viva (Render mantiene la anterior): seguro para iterar.

---

## 14. Encaje en el proyecto barbería + ropa

- Este backend es el **dominio "barbería"**. Reutilizable **casi tal cual**: modelos, reglas, endpoints, seguridad, notificaciones, despliegue.
- **Compartido** con el dominio "ropa": la **auth/usuarios** (un solo `Usuario` con rol), la **BD**, el **cascarón** del frontend y el patrón de despliegue. Plantéate prefijar rutas por dominio (`/barberia/...`, `/tienda/...`) o separar routers por módulo para que convivan limpios.
- **NO** mezclar la lógica de reservas de barbería con el catálogo/stock de ropa: son contextos distintos. La ropa (reserva→avisar→cerrar en persona, o tienda online) tiene su propio modelo; no fuerces el de citas.
- Lo único realmente acoplado a "peluquería" es el vocabulario (`Servicio`, `Cita`, `peluquero`) y las notificaciones al peluquero. Si el negocio combinado tiene un solo dueño, el `TELEGRAM_CHAT_ID` y los avisos sirven igual.
- Al arrancar el nuevo proyecto: crea su propio `CLAUDE.md` tomando de aquí las secciones 2–10, y deja que Claude Code reconstruya el módulo en Plan Mode, fase a fase, con tests.

---

*Generado a partir del proyecto RM (rmolinastyle.com) para reutilización en AceitunoDev.*
