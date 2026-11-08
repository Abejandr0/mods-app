"""Prueba el pipeline de SAM 2 + Flux Fill sin iniciar la interfaz web."""

import argparse
import io
import os
from pathlib import Path

import fal_client
from PIL import Image, ImageFilter

from main import download, prepare_image, segment, upload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path, help="Foto JPG o PNG de la moto")
    parser.add_argument("x", type=float, help="Coordenada horizontal normalizada entre 0 y 1")
    parser.add_argument("y", type=float, help="Coordenada vertical normalizada entre 0 y 1")
    parser.add_argument("prompt", help="Descripción del cambio, preferiblemente en inglés")
    parser.add_argument("--model", default="motorcycle", help="Modelo de moto para el prompt")
    parser.add_argument("--output", type=Path, default=Path("resultado.png"))
    parser.add_argument("--mask-output", type=Path, default=Path("mascara.png"))
    args = parser.parse_args()

    if not os.getenv("FAL_KEY"):
        parser.error("FAL_KEY no está configurada. Añádela a backend/.env o al entorno.")
    image = prepare_image(Image.open(args.photo))
    mask = segment(image, args.x, args.y)
    args.mask_output.parent.mkdir(parents=True, exist_ok=True)
    mask.save(args.mask_output)

    result = fal_client.subscribe(
        "fal-ai/flux-pro/v1/fill",
        arguments={
            "image_url": upload(image),
            "mask_url": upload(mask.filter(ImageFilter.MaxFilter(15))),
            "prompt": (
                f"Photorealistic product photo of the same {args.model} motorcycle. "
                f"Change only the selected part: {args.prompt}. Preserve camera angle, "
                "lighting, shadows, background, and all unselected parts."
            ),
            "output_format": "png",
            "num_images": 1,
            "enhance_prompt": True,
        },
        client_timeout=240,
    )
    images = result.get("images", [])
    if not images or not images[0].get("url"):
        raise RuntimeError("Flux Fill no devolvió una imagen")
    edited = prepare_image(Image.open(io.BytesIO(download(images[0]["url"]))))
    if edited.size != image.size:
        edited = edited.resize(image.size, Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    edited.save(args.output, "PNG")
    print(f"Resultado: {args.output.resolve()}")
    print(f"Máscara:   {args.mask_output.resolve()}")


if __name__ == "__main__":
    main()
