import time as time_module

import cloudinary.utils
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.dependencies import solo_admin
from app.models import Usuario
from app.schemas import FirmaRequest, FirmaResponse

router = APIRouter(tags=["cloudinary"])

_ALLOWED_FORMATS = "jpg,png,webp"
_MAX_FILE_SIZE   = 5_000_000  # 5 MB


@router.post("/cloudinary/firma", response_model=FirmaResponse)
def generar_firma(
    body: FirmaRequest,
    _: Usuario = Depends(solo_admin),
) -> FirmaResponse:
    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary no configurado en este entorno",
        )
    timestamp = int(time_module.time())
    params = {
        "timestamp":       timestamp,
        "folder":          body.folder,
        "allowed_formats": _ALLOWED_FORMATS,
        # max_file_size excluido: no es param documentado de la Upload API directa;
        # Cloudinary podría excluirlo de su verificación → Invalid Signature.
        # La restricción de tamaño la aplica el cliente.
    }
    signature = cloudinary.utils.api_sign_request(params, settings.cloudinary_api_secret)
    return FirmaResponse(
        signature=signature,
        timestamp=timestamp,
        api_key=settings.cloudinary_api_key,
        cloud_name=settings.cloudinary_cloud_name,
        folder=body.folder,
        allowed_formats=_ALLOWED_FORMATS,
        max_file_size=_MAX_FILE_SIZE,
    )
