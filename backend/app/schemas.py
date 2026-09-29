import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.constants import DURACION_MAX_MINUTOS, FRANJA_MINUTOS
from app.models import EstadoCita, EstadoReservaPrenda

# Letras latinas con tildes/acentos, ñ y caracteres europeos comunes, más espacio, guión y apóstrofo
_NOMBRE_RE = re.compile(
    r"^[a-zA-ZáéíóúàèìòùäëïöüÿâêîôûãõñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑÇ '\-]+$"
)


def _validar_nombre(v: str) -> str:
    """Normaliza y valida nombre_completo. Mínimo 2 palabras con ≥2 letras cada una."""
    v = " ".join(str(v).split())
    if not v:
        raise ValueError("El nombre completo no puede estar vacío")
    if not _NOMBRE_RE.match(v):
        raise ValueError("El nombre solo puede contener letras, espacios, guiones y apóstrofos")
    palabras = v.split()
    if len(palabras) < 2:
        raise ValueError("Introduce al menos nombre y apellido (mínimo dos palabras)")
    for palabra in palabras:
        if sum(1 for c in palabra if c.isalpha()) < 2:
            raise ValueError("Cada parte del nombre debe tener al menos 2 letras")
    return v


def _validar_telefono(v: str) -> str:
    """Normaliza y valida teléfono español. Devuelve 9 dígitos sin prefijo."""
    cleaned = re.sub(r"[\s\-\.\(\)]", "", str(v))
    m = re.match(r"^(?:\+34|0034)?([6-9]\d{8})$", cleaned)
    if not m:
        raise ValueError(
            "Teléfono inválido. Introduce un número español de 9 dígitos "
            "(p. ej. 612345678 o +34 612 345 678)"
        )
    return m.group(1)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UsuarioCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    telefono: str  # validado y normalizado por _validar_telefono
    nombre_completo: str = Field(min_length=1, max_length=100)
    # Sin campo `rol`: el endpoint lo fuerza siempre a 'cliente'

    model_config = {"extra": "forbid"}  # 422 ante cualquier campo extra (anti mass-assignment)

    @field_validator("nombre_completo", mode="before")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        return _validar_nombre(v)

    @field_validator("telefono", mode="before")
    @classmethod
    def validar_telefono(cls, v: str) -> str:
        return _validar_telefono(v)


class UsuarioRead(BaseModel):
    id: int
    email: str
    telefono: str
    nombre_completo: str
    rol: str

    model_config = {"from_attributes": True}


class ActualizarPerfilIn(BaseModel):
    nombre_completo: str | None = Field(default=None, min_length=1, max_length=100)
    telefono: str | None = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def al_menos_un_campo(self) -> "ActualizarPerfilIn":
        if self.nombre_completo is None and self.telefono is None:
            raise ValueError("Indica al menos nombre_completo o telefono")
        return self

    @field_validator("nombre_completo", mode="before")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return None if v is None else _validar_nombre(v)

    @field_validator("telefono", mode="before")
    @classmethod
    def validar_telefono(cls, v: str | None) -> str | None:
        return None if v is None else _validar_telefono(v)


class CambiarPasswordIn(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8, max_length=100)

    model_config = {"extra": "forbid"}


class UsuarioAdminRead(BaseModel):
    id: int
    email: str
    telefono: str
    nombre_completo: str
    rol: str
    bloqueado: bool
    inasistencias: int  # calculado dinámicamente; no existe como columna en Usuario


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Servicios
# ---------------------------------------------------------------------------

class ServicioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    duracion_minutos: int = Field(gt=0)
    precio: Decimal = Field(ge=0)

    model_config = {"extra": "forbid"}

    @field_validator("duracion_minutos")
    @classmethod
    def multiplo_de_franja(cls, v: int) -> int:
        if v % FRANJA_MINUTOS != 0 or v > DURACION_MAX_MINUTOS:
            raise ValueError(
                f"duracion_minutos debe ser múltiplo de {FRANJA_MINUTOS} "
                f"y como máximo {DURACION_MAX_MINUTOS} min"
            )
        return v


class ServicioUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    duracion_minutos: int | None = Field(default=None, gt=0)
    precio: Decimal | None = Field(default=None, ge=0)
    activo: bool | None = None

    model_config = {"extra": "forbid"}

    @field_validator("duracion_minutos")
    @classmethod
    def multiplo_de_franja(cls, v: int | None) -> int | None:
        if v is not None and (v % FRANJA_MINUTOS != 0 or v > DURACION_MAX_MINUTOS):
            raise ValueError(
                f"duracion_minutos debe ser múltiplo de {FRANJA_MINUTOS} "
                f"y como máximo {DURACION_MAX_MINUTOS} min"
            )
        return v


class ServicioRead(BaseModel):
    id: int
    nombre: str
    duracion_minutos: int
    precio: Decimal
    activo: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Horario
# ---------------------------------------------------------------------------

class HorarioCreate(BaseModel):
    dia_semana: int = Field(ge=0, le=6)  # 0=lunes … 6=domingo
    hora_apertura: time
    hora_cierre: time

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def apertura_antes_cierre(self) -> "HorarioCreate":
        if self.hora_cierre <= self.hora_apertura:
            raise ValueError("hora_cierre debe ser posterior a hora_apertura")
        return self


class HorarioUpdate(BaseModel):
    hora_apertura: time | None = None
    hora_cierre: time | None = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def apertura_antes_cierre(self) -> "HorarioUpdate":
        if (
            self.hora_apertura is not None
            and self.hora_cierre is not None
            and self.hora_cierre <= self.hora_apertura
        ):
            raise ValueError("hora_cierre debe ser posterior a hora_apertura")
        return self


class HorarioRead(BaseModel):
    id: int
    dia_semana: int
    hora_apertura: time
    hora_cierre: time

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Citas
# ---------------------------------------------------------------------------

class CitaCreate(BaseModel):
    servicio_id: int = Field(gt=0)
    fecha: date
    hora_inicio: time

    model_config = {"extra": "forbid"}  # rechaza cliente_id, estado, hora_fin del body

    @field_validator("hora_inicio")
    @classmethod
    def hora_en_franja(cls, v: time) -> time:
        _minutos_validos = {i * FRANJA_MINUTOS for i in range(60 // FRANJA_MINUTOS)}
        if v.minute not in _minutos_validos or v.second != 0 or v.microsecond != 0:
            raise ValueError(
                f"hora_inicio debe estar en múltiplo de {FRANJA_MINUTOS} min "
                f"({', '.join(f':{m:02d}' for m in sorted(_minutos_validos))}), sin segundos"
            )
        return v


class CitaRead(BaseModel):
    id: int
    cliente_id: int
    servicio_id: int
    fecha: date
    hora_inicio: time
    hora_fin: time
    estado: EstadoCita

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Disponibilidad
# ---------------------------------------------------------------------------

class DisponibilidadRead(BaseModel):
    fecha: date
    servicio_id: int
    horas_disponibles: list[time]


# ---------------------------------------------------------------------------
# Excepciones de fecha
# ---------------------------------------------------------------------------

class TramoAperturaIn(BaseModel):
    hora_apertura: time
    hora_cierre:   time
    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validar_rango(self) -> "TramoAperturaIn":
        if self.hora_cierre <= self.hora_apertura:
            raise ValueError("hora_cierre debe ser posterior a hora_apertura")
        for h in (self.hora_apertura, self.hora_cierre):
            if h.minute % FRANJA_MINUTOS != 0 or h.second != 0:
                raise ValueError(
                    f"Las horas de los tramos deben ser múltiplos de {FRANJA_MINUTOS} min "
                    f"(p. ej. 09:00, 09:30, 20:00)"
                )
        return self


class TramoAperturaRead(BaseModel):
    id:            int
    hora_apertura: time
    hora_cierre:   time
    model_config = {"from_attributes": True}


class ExcepcionFechaCreate(BaseModel):
    fecha:  date
    tipo:   Literal["cerrado", "abierto"] = "cerrado"
    tramos: list[TramoAperturaIn] = []
    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validar_tramos_segun_tipo(self) -> "ExcepcionFechaCreate":
        if self.tipo == "abierto":
            if not self.tramos:
                raise ValueError("Una apertura excepcional debe tener al menos un tramo horario")
            sorted_t = sorted(self.tramos, key=lambda t: t.hora_apertura)
            for i in range(len(sorted_t) - 1):
                if sorted_t[i].hora_cierre > sorted_t[i + 1].hora_apertura:
                    raise ValueError("Los tramos de apertura no pueden solaparse")
        elif self.tramos:
            raise ValueError("Un cierre no puede llevar tramos horarios")
        return self


class ExcepcionFechaRead(BaseModel):
    id:     int
    fecha:  date
    tipo:   str
    tramos: list[TramoAperturaRead] = []
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Cloudinary — firma de subida
# ---------------------------------------------------------------------------

class FirmaRequest(BaseModel):
    folder: str = Field(min_length=1, max_length=100)
    model_config = {"extra": "forbid"}


class FirmaResponse(BaseModel):
    signature:       str
    timestamp:       int
    api_key:         str
    cloud_name:      str
    folder:          str
    allowed_formats: str
    max_file_size:   int


# ---------------------------------------------------------------------------
# Tienda — catálogo
# ---------------------------------------------------------------------------

class TallaRead(BaseModel):
    id:         int
    talla:      str
    disponible: bool
    model_config = {"from_attributes": True}


class TallaCreate(BaseModel):
    talla:      str = Field(min_length=1, max_length=20)
    disponible: bool = True
    model_config = {"extra": "forbid"}


class TallaUpdate(BaseModel):
    disponible: bool
    model_config = {"extra": "forbid"}


class ImagenRead(BaseModel):
    id:       int
    url:      str
    posicion: int
    model_config = {"from_attributes": True}


class ImagenCreate(BaseModel):
    url:       str = Field(min_length=1, max_length=512)
    public_id: str = Field(min_length=1, max_length=200)
    posicion:  int | None = None
    model_config = {"extra": "forbid"}


class ImagenUpdate(BaseModel):
    posicion: int
    model_config = {"extra": "forbid"}


class ImagenOrdenItem(BaseModel):
    id:       int
    posicion: int


class PrendaCreate(BaseModel):
    nombre:      str = Field(min_length=1, max_length=200)
    descripcion: str = Field(min_length=1, max_length=2000)
    precio:      Decimal = Field(ge=0)
    categoria:   str | None = Field(default=None, max_length=100)
    model_config = {"extra": "forbid"}


class PrendaUpdate(BaseModel):
    nombre:      str | None = Field(default=None, min_length=1, max_length=200)
    descripcion: str | None = Field(default=None, min_length=1, max_length=2000)
    precio:      Decimal | None = Field(default=None, ge=0)
    categoria:   str | None = Field(default=None, max_length=100)
    activo:      bool | None = None
    model_config = {"extra": "forbid"}


class _PrendaBase(BaseModel):
    id:             int
    nombre:         str
    precio:         Decimal
    categoria:      str | None
    activo:         bool
    primera_imagen: ImagenRead | None
    tallas:         list[TallaRead]
    model_config = {"from_attributes": True}


class PrendaListaRead(_PrendaBase):
    pass


class PrendaDetalleRead(_PrendaBase):
    descripcion: str
    imagenes:    list[ImagenRead]


# ---------------------------------------------------------------------------
# Tienda — reservas
# ---------------------------------------------------------------------------

class ReservaCreate(BaseModel):
    prenda_id: int = Field(gt=0)
    talla:     str = Field(min_length=1, max_length=20)
    model_config = {"extra": "forbid"}


class _PrendaResumen(BaseModel):
    id:     int
    nombre: str
    precio: Decimal
    model_config = {"from_attributes": True}


class ReservaReadCliente(BaseModel):
    id:        int
    prenda_id: int
    talla:     str
    estado:    EstadoReservaPrenda
    creada_en: datetime
    prenda:    _PrendaResumen
    model_config = {"from_attributes": True}


class _ClienteResumen(BaseModel):
    nombre_completo: str
    telefono:        str
    model_config = {"from_attributes": True}


class ReservaReadAdmin(BaseModel):
    id:        int
    prenda_id: int
    talla:     str
    estado:    EstadoReservaPrenda
    creada_en: datetime
    prenda:    _PrendaResumen
    cliente:   _ClienteResumen
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Galería del banner
# ---------------------------------------------------------------------------

class GaleriaFotoCreate(BaseModel):
    url:       str = Field(min_length=1, max_length=512)
    public_id: str = Field(min_length=1, max_length=200)
    posicion:  int | None = None
    titulo:    str | None = Field(default=None, max_length=200)
    model_config = {"extra": "forbid"}


class GaleriaFotoUpdate(BaseModel):
    posicion: int | None = None
    titulo:   str | None = Field(default=None, max_length=200)
    model_config = {"extra": "forbid"}


class GaleriaFotoRead(BaseModel):
    id:       int
    url:      str
    posicion: int
    titulo:   str | None
    model_config = {"from_attributes": True}


class GaleriaOrdenItem(BaseModel):
    id:       int
    posicion: int


# ---------------------------------------------------------------------------
# Admin — estadísticas del dashboard
# ---------------------------------------------------------------------------

class AdminStats(BaseModel):
    citas_hoy:           int
    citas_semana:        int
    clientes_atencion:   int
    reservas_pendientes: int
    reservas_semana:     int
    pendientes_atencion: int
