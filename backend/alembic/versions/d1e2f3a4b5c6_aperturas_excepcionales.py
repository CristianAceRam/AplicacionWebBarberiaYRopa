"""aperturas_excepcionales

Revision ID: d1e2f3a4b5c6
Revises: b43d572938c8
Create Date: 2026-07-03 00:00:00.000000

Extiende ExcepcionFecha para soportar tipo='abierto' (apertura excepcional) con tramos
horarios propios. TipoExcepcion usa native_enum=False (VARCHAR(20)), por lo que NO se
requiere ALTER TYPE en Postgres — solo se crea la tabla tramos_apertura.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "b43d572938c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tramos_apertura",
        sa.Column("id",            sa.Integer(),  nullable=False),
        sa.Column("excepcion_id",  sa.Integer(),  nullable=False),
        sa.Column("hora_apertura", sa.Time(),     nullable=False),
        sa.Column("hora_cierre",   sa.Time(),     nullable=False),
        sa.CheckConstraint("hora_apertura < hora_cierre", name="ck_tramo_apertura_rango"),
        sa.ForeignKeyConstraint(
            ["excepcion_id"], ["excepcion_fecha.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tramos_apertura_excepcion", "tramos_apertura", ["excepcion_id"])


def downgrade() -> None:
    op.drop_index("ix_tramos_apertura_excepcion", table_name="tramos_apertura")
    op.drop_table("tramos_apertura")
