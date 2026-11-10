"""Prueba Amazon Titan Image Generator G1 v2 sin iniciar la interfaz web.

Ejemplo:
  python test_edit.py moto.jpg 0.63 0.48 "matte black five-spoke alloy wheel" --part rueda --model "Yamaha R15"

La llamada realiza una inferencia facturable en Amazon Bedrock. Usa credenciales
AWS configuradas localmente (por ejemplo, `aws configure` o AWS SSO); nunca añadas
claves de larga duración al repositorio.
"""

import argparse
import base64
import io
import json
import os
from pathlib import Path

import boto3
from botocore.config import Config
from PIL import Image

MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.titan-image-generator-v2:0")


def target_label(part: str) -> str:
    labels = {
        "rueda": "motorcycle wheel", "rin": "motorcycle wheel rims", "rines": "motorcycle wheel rims",
        "escape": "motorcycle exhaust pipe", "tanque": "motorcycle fuel tank",
        "manillar": "motorcycle handlebars", "farola": "motorcycle headlight",
        "faro": "motorcycle headlight", "asiento": "motorcycle seat",
        "carenado": "motorcycle side fairing", "espejo": "motorcycle mirror",
        "guardabarros": "motorcycle fender",
    }
    part = part.strip().lower()
    return labels.get(part, f"{part} on the motorcycle")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path, help="Foto JPG o PNG de la moto")
    parser.add_argument("x", type=float, help="Coordenada horizontal normalizada entre 0 y 1")
    parser.add_argument("y", type=float, help="Coordenada vertical normalizada entre 0 y 1")
    parser.add_argument("prompt", help="Descripción del cambio, preferiblemente en inglés")
    parser.add_argument("--part", default="rueda", help="Pieza que se cambiará (por ejemplo, rueda o escape)")
    parser.add_argument("--model", default="motorcycle", help="Modelo de moto para el prompt")
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "us-east-1"))
    parser.add_argument("--output", type=Path, default=Path("resultado.png"))
    args = parser.parse_args()

    if not args.photo.is_file():
        parser.error(f"No existe el archivo de foto: {args.photo}")
    if not (0 <= args.x <= 1 and 0 <= args.y <= 1):
        parser.error("x e y deben estar entre 0 y 1")
    if not args.prompt.strip() or len(args.prompt) > 512:
        parser.error("El prompt debe tener entre 1 y 512 caracteres")

    image = Image.open(args.photo).convert("RGB")
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    source = io.BytesIO()
    image.save(source, format="JPEG", quality=88, optimize=True)
    target = target_label(args.part)
    body = {
        "taskType": "INPAINTING",
        "inPaintingParams": {
            "image": base64.b64encode(source.getvalue()).decode("ascii"),
            "text": (
                f"Photorealistic edit of the same {args.model} motorcycle. Change only its {target}: {args.prompt}. "
                "Preserve the original camera angle, lighting, shadows, background, motorcycle geometry, "
                "and all other parts. Make the new part physically plausible and naturally integrated."
            )[:512],
            "maskPrompt": (
                f"The {target} near coordinates approximately {round(args.x * 100)}% from the left "
                f"and {round(args.y * 100)}% from the top. Mask only that motorcycle part."
            )[:512],
            "returnMask": True,
        },
        "imageGenerationConfig": {"numberOfImages": 1, "quality": "standard", "cfgScale": 8.0},
    }
    runtime = boto3.client(
        "bedrock-runtime", region_name=args.region,
        config=Config(connect_timeout=10, read_timeout=180, retries={"total_max_attempts": 1, "mode": "standard"}),
    )
    response = runtime.invoke_model(
        modelId=MODEL_ID, body=json.dumps(body), accept="application/json", contentType="application/json"
    )
    result = json.loads(response["body"].read())
    if result.get("error"):
        raise RuntimeError(f"Bedrock devolvió un error: {result['error']}")
    if not result.get("images"):
        raise RuntimeError("Bedrock no devolvió imágenes")
    edited = Image.open(io.BytesIO(base64.b64decode(result["images"][0], validate=True))).convert("RGB")
    if edited.size != image.size:
        edited = edited.resize(image.size, Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    edited.save(args.output, "PNG")
    print(f"Resultado guardado en: {args.output.resolve()}")
    if result.get("mask"):
        mask_path = args.output.with_name(f"{args.output.stem}-mascara.png")
        mask_path.write_bytes(base64.b64decode(result["mask"], validate=True))
        print(f"Máscara inferida guardada en: {mask_path.resolve()}")


if __name__ == "__main__":
    main()
