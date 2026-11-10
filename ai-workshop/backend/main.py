import hashlib, io, json, os, re, secrets, sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import contextmanager
import fal_client, httpx
from anthropic import Anthropic, APIConnectionError, APITimeoutError, APIStatusError
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, Response as FastAPIResponse, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageFilter
from pydantic import BaseModel

load_dotenv()
app = FastAPI()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
DATA_DIR = Path(os.getenv("WORKSHOP_DATA_DIR", Path(__file__).parent / "data"))
DB_PATH = DATA_DIR / "workshop.sqlite3"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
SESSION_COOKIE = "motomod_session"
SESSION_DAYS = 14

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_URL", "").split(",")
    if origin.strip()
]
allowed_origins.extend(["http://localhost:5173", "http://127.0.0.1:5173"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

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


class AccountInput(BaseModel):
    name: str
    email: str
    password: str


class LoginInput(BaseModel):
    email: str
    password: str


@contextmanager
def db_connect():
    if USE_POSTGRES:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError("Instala psycopg para conectar DATABASE_URL.") from exc
        db = psycopg.connect(DATABASE_URL.replace("postgres://", "postgresql://", 1), row_factory=dict_row)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def db_execute(db, query: str, params=()):
    if USE_POSTGRES:
        query = query.replace("?", "%s")
    return db.execute(query, params)


def init_auth_db():
    with db_connect() as db:
        user_id_type = "BIGSERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY"
        session_user_id_type = "BIGINT" if USE_POSTGRES else "INTEGER"
        blob_type = "BYTEA" if USE_POSTGRES else "BLOB"
        db_execute(db, f"""
            CREATE TABLE IF NOT EXISTS users (
                id {user_id_type},
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                salt {blob_type} NOT NULL,
                password_hash {blob_type} NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        db_execute(db, """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id {session_user_id_type} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL
            )
        """)


init_auth_db()


def password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)


def session_user(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db_connect() as db:
        row = db_execute(db, """
            SELECT users.id, users.name, users.email
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
        """, (token_hash, datetime.now(timezone.utc).isoformat())).fetchone()
    return dict(row) if row else None


def issue_session(user_id: int, response: FastAPIResponse):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    with db_connect() as db:
        db_execute(db, "DELETE FROM sessions WHERE expires_at <= ?", (datetime.now(timezone.utc).isoformat(),))
        db_execute(db, "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                   (hashlib.sha256(token.encode()).hexdigest(), user_id, expires.isoformat()))
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_DAYS * 24 * 3600, httponly=True,
        secure=os.getenv("SECURE_COOKIES", "0").lower() in ("1", "true", "yes"),
        samesite="none" if os.getenv("SECURE_COOKIES", "0").lower() in ("1", "true", "yes") else "lax",
        path="/",
    )


def public_user(user):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


@app.post("/api/auth/signup")
def signup(body: AccountInput, response: FastAPIResponse):
    name, email, password = body.name.strip(), body.email.strip().lower(), body.password
    if len(name) < 2 or len(name) > 60:
        raise HTTPException(422, "Escribe un nombre de entre 2 y 60 caracteres.")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Escribe un correo electrónico válido.")
    if len(password) < 10:
        raise HTTPException(422, "Usa una contraseña de al menos 10 caracteres.")
    salt = secrets.token_bytes(16)
    try:
        with db_connect() as db:
            cursor = db_execute(db,
                "INSERT INTO users(name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
                (name, email, salt, password_hash(password, salt), datetime.now(timezone.utc).isoformat()),
            )
            user_id = cursor.fetchone()["id"]
    except sqlite3.IntegrityError as exc:
        raise HTTPException(409, "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.") from exc
    except Exception as exc:
        if exc.__class__.__name__ != "UniqueViolation":
            raise
        raise HTTPException(409, "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.") from exc
    issue_session(user_id, response)
    return {"user": {"id": user_id, "name": name, "email": email}}


@app.post("/api/auth/login")
def login(body: LoginInput, response: FastAPIResponse):
    email = body.email.strip().lower()
    with db_connect() as db:
        row = db_execute(db, "SELECT id, name, email, salt, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not secrets.compare_digest(password_hash(body.password, row["salt"]), row["password_hash"]):
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    issue_session(row["id"], response)
    return {"user": public_user(row)}


@app.get("/api/auth/me")
def me(request: Request):
    user = session_user(request)
    return {"user": public_user(user) if user else None}


@app.post("/api/auth/logout")
def logout(request: Request, response: FastAPIResponse):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with db_connect() as db:
            db_execute(db, "DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return {"ok": True}


@app.get("/api/catalog")
def catalog():
    return CATALOG


@app.get("/api/status")
def service_status():
    return {
        "chat_ready": bool(os.getenv("ANTHROPIC_API_KEY")),
        "image_ready": bool(os.getenv("FAL_KEY")),
        "ai_is_simulated": False,
    }


@app.get("/healthz")
def healthz():
    try:
        with db_connect() as db:
            db_execute(db, "SELECT 1")
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(503, "La base de datos no está disponible.") from exc


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
        r = Anthropic(timeout=90).messages.create(
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
