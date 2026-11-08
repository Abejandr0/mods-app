import io, json, os, re
import fal_client, httpx
from anthropic import Anthropic, APIConnectionError, APITimeoutError, APIStatusError
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageFilter
from pydantic import BaseModel

load_dotenv()
app = FastAPI()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")

CATALOG = [
    {"id": "gixxer-sf-250", "name": "Suzuki Gixxer SF 250", "type": "Deportiva"},
    {"id": "r15", "name": "Yamaha R15", "type": "Deportiva"},
    {"id": "ninja-400", "name": "Kawasaki Ninja 400", "type": "Deportiva"},
    {"id": "ns200", "name": "Bajaj Pulsar NS200", "type": "Naked"},
    {"id": "duke-200", "name": "KTM Duke 200", "type": "Naked"},
    {"id": "fz-20", "name": "Yamaha FZ 2.0", "type": "Naked"},
    {"id": "cb190r", "name": "Honda CB190R", "type": "Naked"},
    {"id": "classic-350", "name": "Royal Enfield Classic 350", "type": "Clásica"},
]

SYSTEM = """Eres el asistente de un simulador de modificaciones de motos. Habla en español, breve y amable.
La moto del usuario es: {model}. Si no ha dicho qué quiere cambiar, pregúntalo y sugiere ideas (rines, escape, tanque, manillar, farola, asiento, color).
Cuando tengas UN cambio concreto, devuélvelo. Máximo un cambio por turno.
Responde SIEMPRE y SOLO con JSON: {"reply": "texto para el usuario", "edit": null o {"part": "pieza en español, corta", "prompt": "descripción en inglés de cómo debe verse la pieza nueva"}}.
Si hay edit, en reply pídele que toque esa pieza en la foto."""


class Chat(BaseModel):
    model: str
    messages: list[dict]


@app.get("/api/catalog")
def catalog():
    return CATALOG


@app.post("/api/chat")
def chat(body: Chat):
    try:
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(503, "Configura ANTHROPIC_API_KEY en backend/.env para activar el chat.")
        # La API de Messages no acepta dos mensajes consecutivos del mismo rol.
        normalized = []
        for message in body.messages:
            role = message.get("role")
            content = message.get("content")
            if role not in ("user", "assistant") or not isinstance(content, str):
                continue
            if normalized and normalized[-1]["role"] == role:
                normalized[-1]["content"] += "\n" + content
            else:
                normalized.append({"role": role, "content": content})
        r = Anthropic().messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=500,
            system=SYSTEM.replace("{model}", body.model),
            messages=normalized,
        )
        txt = r.content[0].text
        m = re.search(r"\{.*\}", txt, re.S)
        if not m:
            return {"reply": txt, "edit": None}
        return json.loads(m.group(0))
    except HTTPException:
        raise
    except (APIConnectionError, APITimeoutError) as exc:
        raise HTTPException(502, "No pude conectar con Anthropic. Revisa tu conexión e inténtalo otra vez.") from exc
    except APIStatusError as exc:
        raise HTTPException(502, f"Anthropic respondió con un error ({exc.status_code}). Revisa la clave y el modelo configurado.") from exc
    except (ValueError, IndexError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "La respuesta de la IA no llegó en el formato esperado. Inténtalo de nuevo.") from exc


def upload(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return fal_client.upload(buf.getvalue(), "image/png")


def download(url: str) -> bytes:
    response = httpx.get(url, timeout=httpx.Timeout(90, connect=15), follow_redirects=True)
    response.raise_for_status()
    return response.content


def prepare_image(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    return image


def segment(image: Image.Image, x: float, y: float) -> Image.Image:
    if not os.getenv("FAL_KEY"):
        raise HTTPException(503, "Configura FAL_KEY en backend/.env para activar las modificaciones.")
    w, h = image.size
    if not 0 <= x <= 1 or not 0 <= y <= 1:
        raise HTTPException(422, "El punto seleccionado quedó fuera de la foto. Vuelve a tocar la pieza.")
    try:
        result = fal_client.subscribe(
            "fal-ai/sam2/image",
            arguments={"image_url": upload(image), "prompts": [{"x": round(x * (w - 1)), "y": round(y * (h - 1)), "label": 1}], "output_format": "png"},
            client_timeout=180,
        )
        item = result.get("image")
        if not item or not item.get("url"):
            raise ValueError("SAM 2 no devolvió una imagen de máscara")
        mask = Image.open(io.BytesIO(download(item["url"]))).convert("L").resize((w, h))
        mask = mask.point(lambda value: 255 if value > 127 else 0)
        white = mask.histogram()[255]
        if white == 0 or white > w * h * 0.6:
            raise HTTPException(422, "No pude aislar esa pieza. Toca más cerca de su centro y con la moto bien visible.")
        return mask
    except HTTPException:
        raise
    except (httpx.HTTPError, OSError, ValueError, KeyError) as exc:
        raise HTTPException(502, "No pude detectar la pieza. Revisa tu conexión e inténtalo otra vez.") from exc
    except Exception as exc:
        raise HTTPException(502, "El servicio de segmentación falló o tardó demasiado. Inténtalo de nuevo.") from exc


@app.post("/api/edit")
def edit(
    image: UploadFile = File(...),
    mask_file: UploadFile | None = File(None),
    x: float = Form(...),
    y: float = Form(...),
    prompt: str = Form(...),
    model: str = Form(""),
):
    try:
        img = prepare_image(Image.open(image.file))
        w, h = img.size
        if mask_file:
            mask = Image.open(mask_file.file).convert("L").resize((w, h))
            mask = mask.point(lambda value: 255 if value > 127 else 0)
        else:
            mask = segment(img, x, y)
        mask = mask.filter(ImageFilter.MaxFilter(15))
        url = upload(img)
        res = fal_client.subscribe(
            "fal-ai/flux-pro/v1/fill",
            arguments={
                "image_url": url,
                "mask_url": upload(mask),
                "prompt": f"Photorealistic product photo of the same {model} motorcycle. Change only the selected part: {prompt}. Preserve the original camera angle, lighting, shadows, background, and all unselected parts. The replacement must fit naturally and be mechanically plausible.",
                "output_format": "png",
                "num_images": 1,
                "enhance_prompt": True,
            },
            client_timeout=240,
        )
        images = res.get("images", [])
        if not images or not images[0].get("url"):
            raise ValueError("Flux Fill no devolvió una imagen")
        edited = prepare_image(Image.open(io.BytesIO(download(images[0]["url"]))))
        if edited.size != (w, h):
            edited = edited.resize((w, h), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        edited.save(output, "PNG")
        return Response(output.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except (OSError, ValueError) as exc:
        raise HTTPException(422, "No pude procesar la foto. Sube un JPG o PNG válido e inténtalo de nuevo.") from exc
    except Exception as exc:
        raise HTTPException(502, "No pude aplicar el cambio. El servicio tardó o respondió con un error; inténtalo de nuevo.") from exc


@app.post("/api/segment")
def preview_segment(image: UploadFile = File(...), x: float = Form(...), y: float = Form(...)):
    try:
        img = prepare_image(Image.open(image.file))
        mask = segment(img, x, y)
        output = io.BytesIO()
        mask.save(output, "PNG")
        return Response(output.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(422, "No pude leer la foto. Sube un JPG o PNG válido.") from exc
