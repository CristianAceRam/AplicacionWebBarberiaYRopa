import enum
from datetime import date, datetime, time
from decimal import Decimal

from app.constants import DURACION_MAX_MINUTOS, FRANJA_MINUTOS
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums de dominio
# ---------------------------------------------------------------------------

class Rol(str, enum.Enum):
    admin   = "admin"
    cliente = "cliente"


class EstadoCita(str, enum.Enum):
    activa      = "activa"
    cancelada   = "cancelada"
    no_asistida = "no_asistida"


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("rol IN ('admin','cliente')", name="ck_usuario_rol"),
    )

    id              : Mapped[int]  = mapped_column(primary_key=True)
    email           : Mapped[str]  = mapped_column(String(255), unique=True)
    password_hash   : Mapped[str]  = mapped_column(String(255))
    telefono        : Mapped[str]  = mapped_column(String(20))
    nombre_completo : Mapped[str]  = mapped_column(String(100))
    rol             : Mapped[Rol]  = mapped_column(
                          SAEnum(Rol, native_enum=False, length=10)
                      )
    bloqueado       : Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    inasistencias   : Mapped[int]  = mapped_column(Integer, default=0, nullable=False)

    citas: Mapped[list["Cita"]] = relationship(back_populates="cliente")


class Servicio(Base):
    __tablename__ = "servicios"
    __table_args__ = (
        CheckConstraint(
            f"duracion_minutos > 0 AND duracion_minutos <= {DURACION_MAX_MINUTOS} AND mod(duracion_minutos, {FRANJA_MINUTOS}) = 0",
            name="ck_servicio_duracion",
        ),
    )

    id               : Mapped[int]     = mapped_column(primary_key=True)
    nombre           : Mapped[str]     = mapped_column(String(100))
    duracion_minutos : Mapped[int]     = mapped_column(Integer)
    precio           : Mapped[Decimal] = mapped_column(Numeric(8, 2))
    activo           : Mapped[bool]    = mapped_column(Boolean, default=True, nullable=False)

    citas: Mapped[list["Cita"]] = relationship(back_populates="servicio")


class HorarioPeluquero(Base):
    __tablename__ = "horario_peluquero"
    __table_args__ = (
        CheckConstraint("hora_apertura < hora_cierre", name="ck_horario_rango"),
    )

    id            : Mapped[int]  = mapped_column(primary_key=True)
    # 0 = lunes … 6 = domingo  (convención date.weekday())
    dia_semana    : Mapped[int]  = mapped_column(SmallInteger)
    hora_apertura : Mapped[time] = mapped_column(Time)
    hora_cierre   : Mapped[time] = mapped_column(Time)


class Cita(Base):
    __tablename__ = "citas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('activa','cancelada','no_asistida')", name="ck_cita_estado"
        ),
    )

    id          : Mapped[int]        = mapped_column(primary_key=True)
    cliente_id  : Mapped[int]        = mapped_column(ForeignKey("usuarios.id"))
    servicio_id : Mapped[int]        = mapped_column(ForeignKey("servicios.id"))
    fecha       : Mapped[date]       = mapped_column(Date)
    hora_inicio : Mapped[time]       = mapped_column(Time)
    hora_fin    : Mapped[time]       = mapped_column(Time)
    # hora_fin = hora_inicio + servicio.duracion_minutos; calculado en capa de servicio
    estado      : Mapped[EstadoCita] = mapped_column(
                      SAEnum(EstadoCita, native_enum=False, length=15),
                      default=EstadoCita.activa,
                  )

    cliente  : Mapped["Usuario"]             = relationship(back_populates="citas")
    servicio : Mapped["Servicio"]            = relationship(back_populates="citas")
    franjas  : Mapped[list["FranjaOcupada"]] = relationship(back_populates="cita")


class FranjaOcupada(Base):
    __tablename__ = "franja_ocupada"
    __table_args__ = (
        UniqueConstraint("fecha", "hora", name="uq_franja_fecha_hora"),
    )

    id      : Mapped[int]  = mapped_column(primary_key=True)
    # ondelete CASCADE: red de seguridad si alguna cita se borrara por error
    cita_id : Mapped[int]  = mapped_column(ForeignKey("citas.id", ondelete="CASCADE"))
    fecha   : Mapped[date] = mapped_column(Date)
    hora    : Mapped[time] = mapped_column(Time)

    cita: Mapped["Cita"] = relationship(back_populates="franjas")


class TipoExcepcion(str, enum.Enum):
    cerrado = "cerrado"
    abierto = "abierto"


class ExcepcionFecha(Base):
    __tablename__ = "excepcion_fecha"
    __table_args__ = (
        UniqueConstraint("fecha", name="uq_excepcion_fecha"),
    )

    id    : Mapped[int]           = mapped_column(primary_key=True)
    fecha : Mapped[date]          = mapped_column(Date)
    tipo  : Mapped[TipoExcepcion] = mapped_column(
                SAEnum(TipoExcepcion, native_enum=False, length=20),
                default=TipoExcepcion.cerrado,
            )

    tramos: Mapped[list["TramoApertura"]] = relationship(
        back_populates="excepcion",
        cascade="all, delete-orphan",
        order_by="TramoApertura.hora_apertura",
    )


class TramoApertura(Base):
    __tablename__ = "tramos_apertura"
    __table_args__ = (
        CheckConstraint("hora_apertura < hora_cierre", name="ck_tramo_apertura_rango"),
    )

    id           : Mapped[int]  = mapped_column(primary_key=True)
    excepcion_id : Mapped[int]  = mapped_column(
                       ForeignKey("excepcion_fecha.id", ondelete="CASCADE")
                   )
    hora_apertura: Mapped[time] = mapped_column(Time)
    hora_cierre  : Mapped[time] = mapped_column(Time)

    excepcion: Mapped["ExcepcionFecha"] = relationship(back_populates="tramos")


# ---------------------------------------------------------------------------
# Tienda — "reserva sencilla"
# ---------------------------------------------------------------------------

class Prenda(Base):
    __tablename__ = "prendas"

    id          : Mapped[int]        = mapped_column(primary_key=True)
    nombre      : Mapped[str]        = mapped_column(String(200))
    descripcion : Mapped[str]        = mapped_column(String(2000))
    precio      : Mapped[Decimal]    = mapped_column(Numeric(8, 2))
    categoria   : Mapped[str | None] = mapped_column(String(100), nullable=True)
    activo      : Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)

    tallas   : Mapped[list["TallaPrenda"]]   = relationship(back_populates="prenda", cascade="all, delete-orphan")
    imagenes : Mapped[list["ImagenPrenda"]]  = relationship(
                   back_populates="prenda", cascade="all, delete-orphan",
                   order_by="ImagenPrenda.posicion",
               )
    reservas : Mapped[list["ReservaPrenda"]] = relationship(back_populates="prenda")


class TallaPrenda(Base):
    __tablename__ = "tallas_prenda"
    __table_args__ = (UniqueConstraint("prenda_id", "talla", name="uq_talla_prenda"),)

    id         : Mapped[int]  = mapped_column(primary_key=True)
    prenda_id  : Mapped[int]  = mapped_column(ForeignKey("prendas.id", ondelete="CASCADE"))
    talla      : Mapped[str]  = mapped_column(String(20))
    disponible : Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    prenda: Mapped["Prenda"] = relationship(back_populates="tallas")


class ImagenPrenda(Base):
    __tablename__ = "imagenes_prenda"

    id        : Mapped[int] = mapped_column(primary_key=True)
    prenda_id : Mapped[int] = mapped_column(ForeignKey("prendas.id", ondelete="CASCADE"))
    url       : Mapped[str] = mapped_column(String(512))
    public_id : Mapped[str] = mapped_column(String(200))
    posicion  : Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    prenda: Mapped["Prenda"] = relationship(back_populates="imagenes")


class EstadoReservaPrenda(str, enum.Enum):
    pendiente = "pendiente"
    atendida  = "atendida"
    cancelada = "cancelada"


class ReservaPrenda(Base):
    __tablename__ = "reservas_prenda"

    id         : Mapped[int]                    = mapped_column(primary_key=True)
    cliente_id : Mapped[int]                    = mapped_column(ForeignKey("usuarios.id"))
    prenda_id  : Mapped[int]                    = mapped_column(ForeignKey("prendas.id"))
    talla      : Mapped[str]                    = mapped_column(String(20))
    estado     : Mapped[EstadoReservaPrenda]    = mapped_column(
                     SAEnum(EstadoReservaPrenda, native_enum=False, length=15),
                     default=EstadoReservaPrenda.pendiente,
                 )
    creada_en  : Mapped[datetime]               = mapped_column(
                     DateTime(timezone=True), server_default=func.now()
                 )

    cliente : Mapped["Usuario"] = relationship()
    prenda  : Mapped["Prenda"]  = relationship(back_populates="reservas")


# ---------------------------------------------------------------------------
# Galería del banner
# ---------------------------------------------------------------------------

class GaleriaFoto(Base):
    __tablename__ = "galeria_fotos"

    id        : Mapped[int]      = mapped_column(primary_key=True)
    url       : Mapped[str]      = mapped_column(String(512))
    public_id : Mapped[str]      = mapped_column(String(200))
    posicion  : Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    titulo    : Mapped[str|None] = mapped_column(String(200), nullable=True)
