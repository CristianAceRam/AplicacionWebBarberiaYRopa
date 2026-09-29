import logging

import cloudinary.uploader

logger = logging.getLogger(__name__)


def borrar_imagen(public_id: str) -> None:
    # TODO: purga_prendas — las imágenes de prendas con activo=False nunca se borran aquí;
    # pueden acumularse como huérfanas en Cloudinary. Resolver con un cron futuro (Fase 5).
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        logger.warning(
            "Fallo al borrar imagen en Cloudinary (public_id=%s) — la operación principal no se ve afectada.",
            public_id,
        )
