"""Prueba el inpainting de Stability AI con una foto y una máscara pintada.

Ejemplo:
  STABILITY_API_KEY=... python test_edit.py moto.jpg seleccion.png \
    "matte black five-spoke alloy wheel" --part rueda --model "Yamaha R15"

La máscara debe tener en blanco la zona que se quiere cambiar y en negro el resto.
Cada solicitud exitosa consume créditos de Stability AI.
"""

import argparse
import io
import os
from pathlib import Path

import httpx
from PIL import Image

API_URL = "https://api.stability.ai/v2beta/stable-image/edit/inpaint"


def image_bytes(image: Image.Image, format: str) -> bytes:
    output = io.BytesIO()
    image.save(output, format=format)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path, help="Foto JPG o PNG de la moto")
    parser.add_argument("mask", type=Path, help="PNG blanco/negro: blanco indica el área a editar")
    parser.add_argument("prompt", help="Descripción del cambio, preferiblemente en inglés")
    parser.add_argument("--part", default="pieza", help="Pieza que se cambiará")
    parser.add_argument("--model", default="motorcycle", help="Modelo de moto para el prompt")
    parser.add_argument("--output", type=Path, default=Path("resultado.png"))
    args = parser.parse_args()

    api_key = os.getenv("STABILITY_API_KEY")
    if not api_key:
        parser.error("Configura STABILITY_API_KEY en el entorno o en backend/.env")
    if not args.photo.is_file():
        parser.error(f"No existe la foto: {args.photo}")
    if not args.mask.is_file():
        parser.error(f"No existe la máscara: {args.mask}")
    if not args.prompt.strip() or len(args.prompt) > 512:
        parser.error("El prompt debe tener entre 1 y 512 caracteres")

    photo = Image.open(args.photo).convert("RGB")
    photo.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    mask = Image.open(args.mask).convert("L").resize(photo.size, Image.Resampling.LANCZOS)
    mask = mask.point(lambda value: 255 if value > 127 else 0)
    if not mask.histogram()[255]:
        parser.error("La máscara no contiene una zona blanca seleccionada")

    response = httpx.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Accept": "image/*"},
        files={
            "image": ("moto.jpg", image_bytes(photo, "JPEG"), "image/jpeg"),
            "mask": ("seleccion.png", image_bytes(mask, "PNG"), "image/png"),
        },
        data={
            "prompt": (
                f"Photorealistic product photo of the same {args.model} motorcycle. Change only the selected "
                f"area, which is the {args.part}: {args.prompt}. Preserve camera angle, lighting, shadows, "
                "background, motorcycle geometry, and all unselected parts."
            ),
            "negative_prompt": "different motorcycle, changed background, distorted geometry, blurry details",
            "grow_mask": "8",
            "output_format": "png",
            "style_preset": "photographic",
        },
        timeout=httpx.Timeout(180, connect=15),
    )
    if not response.is_success:
        raise RuntimeError(f"Stability AI respondió {response.status_code}: {response.text[:500]}")
    result = Image.open(io.BytesIO(response.content)).convert("RGB")
    if result.size != photo.size:
        result = result.resize(photo.size, Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, "PNG")
    print(f"Resultado guardado en: {args.output.resolve()}")


if __name__ == "__main__":
    main()
