from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import solo_admin
from app.models import GaleriaFoto, Usuario
from app.notificaciones.cloudinary import borrar_imagen
from app.schemas import GaleriaFotoCreate, GaleriaFotoRead, GaleriaFotoUpdate, GaleriaOrdenItem

router = APIRouter(tags=["galeria"])


# ---------------------------------------------------------------------------
# Rutas — literales antes que parámetros
# ---------------------------------------------------------------------------

@router.get("/galeria", response_model=list[GaleriaFotoRead])
def listar_galeria(db: Session = Depends(get_db)):
    return db.query(GaleriaFoto).order_by(GaleriaFoto.posicion).all()


@router.put("/galeria/orden", status_code=status.HTTP_200_OK)
def reordenar_galeria(
    items: list[GaleriaOrdenItem],
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    ids = [i.id for i in items]
    fotos = db.query(GaleriaFoto).filter(GaleriaFoto.id.in_(ids)).all()
    foto_map = {f.id: f for f in fotos}
    for item in items:
        if item.id not in foto_map:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Foto con id {item.id} no encontrada",
            )
        foto_map[item.id].posicion = item.posicion
    db.commit()
    return {"updated": len(items)}


@router.post("/galeria", response_model=GaleriaFotoRead, status_code=status.HTTP_201_CREATED)
def añadir_foto(
    body: GaleriaFotoCreate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    if body.posicion is None:
        count = db.query(GaleriaFoto).count()
        posicion = count * 10
    else:
        posicion = body.posicion
    foto = GaleriaFoto(
        url=body.url, public_id=body.public_id, posicion=posicion, titulo=body.titulo
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return foto


@router.patch("/galeria/{foto_id}", response_model=GaleriaFotoRead)
def actualizar_foto(
    foto_id: int,
    body: GaleriaFotoUpdate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    foto = db.get(GaleriaFoto, foto_id)
    if not foto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(foto, campo, valor)
    db.commit()
    db.refresh(foto)
    return foto


@router.delete("/galeria/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_foto(
    foto_id: int,
    background_tasks: BackgroundTasks,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    foto = db.get(GaleriaFoto, foto_id)
    if not foto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    public_id = foto.public_id
    db.delete(foto)
    db.commit()
    background_tasks.add_task(borrar_imagen, public_id)
