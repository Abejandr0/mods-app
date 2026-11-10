import hashlib, io, json, os, re, secrets, sqlite3
import base64
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import contextmanager
import httpx
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, Response as FastAPIResponse, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel

load_dotenv()
app = FastAPI()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.titan-image-generator-v2:0")
BEDROCK_ENABLED = os.getenv("BEDROCK_ENABLED", "true").lower() in ("1", "true", "yes")
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
        db_execute(db, f"""
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
        "chat_ready": bool(os.getenv("GEMINI_API_KEY")),
        "image_ready": BEDROCK_ENABLED,
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
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(503, "Configura GEMINI_API_KEY en el backend para activar el chat con Gemini.")
        # Gemini usa "model" para respuestas de IA y no acepta turnos seguidos del mismo rol.
        normalized = []
        for message in body.messages:
            role = message.get("role")
            content = message.get("content")
            if role not in ("user", "assistant") or not isinstance(content, str):
                continue
            api_role = "model" if role == "assistant" else "user"
            if normalized and normalized[-1]["role"] == api_role:
                normalized[-1]["content"] += "\n" + content
            else:
                normalized.append({"role": api_role, "content": content})
        while normalized and normalized[0]["role"] == "model":
            normalized.pop(0)
        if not normalized:
            raise HTTPException(422, "Escribe una idea antes de consultar al copiloto.")
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            headers={"x-goog-api-key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": SYSTEM.replace("{model}", body.model)}]},
                "contents": [
                    {"role": item["role"], "parts": [{"text": item["content"]}]}
                    for item in normalized
                ],
                "generationConfig": {"maxOutputTokens": 500},
            },
            timeout=httpx.Timeout(90, connect=15),
        )
        response.raise_for_status()
        parts = response.json()["candidates"][0]["content"]["parts"]
        txt = "".join(part.get("text", "") for part in parts)
        m = re.search(r"\{.*\}", txt, re.S)
        if not m:
            return {"reply": txt, "edit": None}
        return json.loads(m.group(0))
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "Gemini tardó demasiado en responder. Espera un momento e inténtalo otra vez.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Gemini respondió con un error ({exc.response.status_code}). Revisa la clave o la cuota gratuita en AI Studio.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(502, "No pude conectar con Gemini. Revisa la conexión e inténtalo otra vez.") from exc
    except (ValueError, IndexError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "La respuesta de la IA no llegó en el formato esperado. Inténtalo de nuevo.") from exc


def prepare_image(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    return image


def image_bytes(image: Image.Image, fmt: str = "PNG") -> bytes:
    output = io.BytesIO()
    image.save(output, format=fmt, quality=90, optimize=True)
    return output.getvalue()


def bedrock_runtime():
    return boto3.client(
        "bedrock-runtime",
        region_name=AWS_REGION,
        config=Config(connect_timeout=10, read_timeout=180, retries={"total_max_attempts": 1, "mode": "standard"}),
    )


def mask_label(part: str) -> str:
    labels = {
        "rin": "motorcycle wheel rims", "rueda": "motorcycle wheel", "rines": "motorcycle wheel rims",
        "escape": "motorcycle exhaust pipe", "tanque": "motorcycle fuel tank",
        "manillar": "motorcycle handlebars", "farola": "motorcycle headlight",
        "faro": "motorcycle headlight", "asiento": "motorcycle seat",
        "carenado": "motorcycle side fairing", "color": "motorcycle body panels",
        "espejo": "motorcycle mirror", "guardabarros": "motorcycle fender",
    }
    normalized = part.strip().lower()
    return labels.get(normalized, f"{normalized} on the motorcycle")


@app.post("/api/edit")
def edit(
    image: UploadFile = File(...),
    x: float = Form(...),
    y: float = Form(...),
    prompt: str = Form(...),
    part: str = Form("pieza"),
    model: str = Form("moto"),
):
    try:
        if not BEDROCK_ENABLED:
            raise HTTPException(503, "Amazon Bedrock está desactivado en la configuración del servidor.")
        if not 0 <= x <= 1 or not 0 <= y <= 1:
            raise HTTPException(422, "El punto seleccionado quedó fuera de la foto. Vuelve a tocar la pieza.")
        if not prompt.strip() or len(prompt) > 512:
            raise HTTPException(422, "La descripción del cambio debe tener entre 1 y 512 caracteres.")
        img = prepare_image(Image.open(image.file))
        width, height = img.size
        target = mask_label(part)
        params = {
            "image": base64.b64encode(image_bytes(img, "JPEG")).decode("ascii"),
            "text": (
                f"Photorealistic edit of the same {model} motorcycle. Change only its {target}: {prompt}. "
                "Preserve the original camera angle, lighting, shadows, background, motorcycle geometry, "
                "and every other part. Make the replacement physically plausible and naturally integrated."
            )[:512],
            "maskPrompt": (
                f"The {target} near coordinates approximately {round(x * 100)}% from the left "
                f"and {round(y * 100)}% from the top of the image. Mask only that motorcycle part."
            )[:512],
        }
        body = json.dumps({
            "taskType": "INPAINTING",
            "inPaintingParams": params,
            "imageGenerationConfig": {"numberOfImages": 1, "quality": "standard", "cfgScale": 8.0},
        })
        result = bedrock_runtime().invoke_model(
            modelId=BEDROCK_MODEL_ID, body=body, accept="application/json", contentType="application/json"
        )
        model_result = json.loads(result["body"].read())
        if model_result.get("error") or not model_result.get("images"):
            raise ValueError(model_result.get("error") or "Titan Image Generator no devolvió una imagen")
        generated = base64.b64decode(model_result["images"][0], validate=True)
        edited = Image.open(io.BytesIO(generated)).convert("RGB")
        if edited.size != (width, height):
            edited = edited.resize((width, height), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        edited.save(output, "PNG")
        return Response(output.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(422, "No pude procesar la foto. Sube un JPG o PNG válido e inténtalo de nuevo.") from exc
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "BedrockError")
        if code in ("AccessDeniedException", "UnrecognizedClientException"):
            raise HTTPException(503, "Bedrock no autorizó la solicitud. Revisa el rol IAM y el permiso bedrock:InvokeModel.") from exc
        if code in ("ThrottlingException", "ServiceQuotaExceededException"):
            raise HTTPException(429, "Bedrock alcanzó el límite de solicitudes. Espera un momento e inténtalo de nuevo.") from exc
        if code in ("ValidationException", "ResourceNotFoundException"):
            raise HTTPException(502, f"Bedrock rechazó el formato o modelo ({code}). Revisa la región y el modelo configurados.") from exc
        raise HTTPException(502, f"Bedrock no pudo editar la imagen ({code}). Revisa el modelo y la región configurados.") from exc
    except BotoCoreError as exc:
        raise HTTPException(502, "No pude conectar con Bedrock. Revisa la región y la conexión del servidor.") from exc
    except Exception as exc:
        raise HTTPException(502, "No pude aplicar el cambio. Bedrock tardó o respondió con un error; inténtalo de nuevo.") from exc
