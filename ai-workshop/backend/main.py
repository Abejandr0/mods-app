import base64, binascii, hashlib, io, json, os, re, secrets, sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import contextmanager
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, Response as FastAPIResponse, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel

load_dotenv()
app = FastAPI()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image/edit/inpaint"
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

SYSTEM = """Eres el asistente de un simulador de modificaciones de motos. Habla en {language}, breve y amable.
La moto del usuario es: {model}. Usa la foto de referencia adjunta como fuente visual principal: identifica la configuración visible y propone cambios compatibles con esa moto. No supongas piezas o rasgos que no se vean. Si no puedes confirmar compatibilidad mecánica, aclara que es una propuesta visual.
Si no ha dicho qué quiere cambiar, pregúntalo y sugiere ideas (rines, escape, tanque, manillar, farola, asiento, color) que encajen con la foto y el modelo.
Cuando tengas UN cambio concreto, devuélvelo. Máximo un cambio por turno.
Responde SIEMPRE y SOLO con JSON: {"reply": "texto para el usuario en {language}", "edit": null o {"part": "nombre corto de la pieza en {language}", "prompt": "descripción en inglés de cómo debe verse la pieza nueva"}}.
Si hay edit, en reply pídele que pinte esa pieza en la foto para delimitar el área del cambio."""

CHAT_LANGUAGES = {"es": "español", "en": "English", "pt": "português", "fr": "français"}


class Chat(BaseModel):
    model: str
    messages: list[dict]
    language: str = "es"
    reference_image: str | None = None
    reference_mime_type: str = "image/jpeg"


class AccountInput(BaseModel):
    name: str
    email: str
    password: str


class LoginInput(BaseModel):
    email: str
    password: str


class GarageProjectInput(BaseModel):
    bike_id: str
    bike_name: str
    bike_type: str


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
        db_execute(db, f"""
            CREATE TABLE IF NOT EXISTS garage_projects (
                id TEXT PRIMARY KEY,
                user_id {session_user_id_type} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                bike_id TEXT NOT NULL,
                bike_name TEXT NOT NULL,
                bike_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        db_execute(db, f"""
            CREATE TABLE IF NOT EXISTS garage_versions (
                project_id TEXT NOT NULL REFERENCES garage_projects(id) ON DELETE CASCADE,
                id TEXT NOT NULL,
                position INTEGER NOT NULL,
                label TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                image_data {blob_type} NOT NULL,
                PRIMARY KEY (project_id, id)
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


def require_session_user(request: Request):
    user = session_user(request)
    if not user:
        raise HTTPException(401, "Inicia sesión para usar Mi garaje.")
    return user


@app.get("/api/garage")
def list_garage(request: Request):
    user = require_session_user(request)
    with db_connect() as db:
        projects = db_execute(db, """
            SELECT id, bike_id, bike_name, bike_type, created_at, updated_at
            FROM garage_projects
            WHERE user_id = ? AND EXISTS (SELECT 1 FROM garage_versions WHERE project_id = garage_projects.id)
            ORDER BY updated_at DESC
        """, (user["id"],)).fetchall()
        result = []
        for project in projects:
            versions = db_execute(db, """
                SELECT id, position, label, mime_type
                FROM garage_versions WHERE project_id = ? ORDER BY position ASC
            """, (project["id"],)).fetchall()
            result.append({
                "id": project["id"], "bikeId": project["bike_id"],
                "bikeName": project["bike_name"], "bikeType": project["bike_type"],
                "createdAt": project["created_at"], "updatedAt": project["updated_at"],
                "versions": [{
                    "id": version["id"], "position": version["position"],
                    "label": version["label"], "mimeType": version["mime_type"],
                } for version in versions],
            })
    return result


@app.put("/api/garage/{project_id}")
def save_garage_project(project_id: str, body: GarageProjectInput, request: Request):
    user = require_session_user(request)
    if not project_id or len(project_id) > 80 or any(len(value.strip()) > 120 for value in (body.bike_id, body.bike_name, body.bike_type)):
        raise HTTPException(422, "Los datos de la moto no son válidos.")
    now = datetime.now(timezone.utc).isoformat()
    with db_connect() as db:
        owner = db_execute(db, "SELECT user_id FROM garage_projects WHERE id = ?", (project_id,)).fetchone()
        if owner and owner["user_id"] != user["id"]:
            raise HTTPException(404, "No se encontró este proyecto en tu garaje.")
        if owner:
            db_execute(db, """
                UPDATE garage_projects SET bike_id = ?, bike_name = ?, bike_type = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            """, (body.bike_id, body.bike_name, body.bike_type, now, project_id, user["id"]))
        else:
            db_execute(db, """
                INSERT INTO garage_projects(id, user_id, bike_id, bike_name, bike_type, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (project_id, user["id"], body.bike_id, body.bike_name, body.bike_type, now, now))
    return {"ok": True}


@app.put("/api/garage/{project_id}/versions/{version_id}")
async def save_garage_version(
    project_id: str,
    version_id: str,
    request: Request,
    image: UploadFile = File(...),
    label: str = Form(...),
    position: int = Form(...),
):
    user = require_session_user(request)
    if not project_id or len(project_id) > 80 or not version_id or len(version_id) > 80 or len(label) > 120 or not 0 <= position < 100:
        raise HTTPException(422, "Los datos de la versión no son válidos.")
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(422, "Guarda una imagen JPG, PNG o WebP.")
    image_data = await image.read(12 * 1024 * 1024 + 1)
    if len(image_data) > 12 * 1024 * 1024:
        raise HTTPException(413, "Cada imagen del garaje debe pesar menos de 12 MB.")
    try:
        with Image.open(io.BytesIO(image_data)) as stored_image:
            stored_image.verify()
    except Exception as exc:
        raise HTTPException(422, "El archivo guardado no es una imagen válida.") from exc

    now = datetime.now(timezone.utc).isoformat()
    with db_connect() as db:
        project = db_execute(db, "SELECT user_id FROM garage_projects WHERE id = ?", (project_id,)).fetchone()
        if not project or project["user_id"] != user["id"]:
            raise HTTPException(404, "No se encontró este proyecto en tu garaje.")
        version = db_execute(db, """
            SELECT id FROM garage_versions WHERE project_id = ? AND id = ?
        """, (project_id, version_id)).fetchone()
        if not version:
            count = db_execute(db, "SELECT COUNT(*) AS total FROM garage_versions WHERE project_id = ?", (project_id,)).fetchone()["total"]
            if count >= 40:
                raise HTTPException(413, "Este proyecto alcanzó el máximo de 40 imágenes guardadas. Borra una moto antigua para continuar.")
        if version:
            db_execute(db, """
                UPDATE garage_versions SET position = ?, label = ?, mime_type = ?, image_data = ?
                WHERE project_id = ? AND id = ?
            """, (position, label, image.content_type, image_data, project_id, version_id))
        else:
            db_execute(db, """
                INSERT INTO garage_versions(project_id, id, position, label, mime_type, image_data)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (project_id, version_id, position, label, image.content_type, image_data))
        db_execute(db, "UPDATE garage_projects SET updated_at = ? WHERE id = ? AND user_id = ?", (now, project_id, user["id"]))
    return {"ok": True}


@app.put("/api/garage/{project_id}/versions")
def sync_garage_version_list(project_id: str, body: dict, request: Request):
    user = require_session_user(request)
    version_ids = body.get("version_ids") if isinstance(body, dict) else None
    if not isinstance(version_ids, list) or len(version_ids) > 40 or any(not isinstance(value, str) or len(value) > 80 for value in version_ids):
        raise HTTPException(422, "El historial de versiones no es válido.")
    keep_ids = set(version_ids)
    if len(keep_ids) != len(version_ids):
        raise HTTPException(422, "El historial contiene imágenes repetidas.")
    with db_connect() as db:
        project = db_execute(db, "SELECT user_id FROM garage_projects WHERE id = ?", (project_id,)).fetchone()
        if not project or project["user_id"] != user["id"]:
            raise HTTPException(404, "No se encontró este proyecto en tu garaje.")
        current = db_execute(db, "SELECT id FROM garage_versions WHERE project_id = ?", (project_id,)).fetchall()
        for version in current:
            if version["id"] not in keep_ids:
                db_execute(db, "DELETE FROM garage_versions WHERE project_id = ? AND id = ?", (project_id, version["id"]))
    return {"ok": True}


@app.get("/api/garage/{project_id}/versions/{version_id}")
def get_garage_version(project_id: str, version_id: str, request: Request):
    user = require_session_user(request)
    with db_connect() as db:
        version = db_execute(db, """
            SELECT versions.image_data, versions.mime_type
            FROM garage_versions AS versions
            JOIN garage_projects AS projects ON projects.id = versions.project_id
            WHERE projects.id = ? AND versions.id = ? AND projects.user_id = ?
        """, (project_id, version_id, user["id"])).fetchone()
    if not version:
        raise HTTPException(404, "No se encontró la imagen de este proyecto.")
    return Response(bytes(version["image_data"]), media_type=version["mime_type"], headers={"Cache-Control": "private, no-store"})


@app.delete("/api/garage/{project_id}")
def remove_garage_project(project_id: str, request: Request):
    user = require_session_user(request)
    with db_connect() as db:
        exists = db_execute(db, "SELECT id FROM garage_projects WHERE id = ? AND user_id = ?", (project_id, user["id"])).fetchone()
        if exists:
            db_execute(db, "DELETE FROM garage_projects WHERE id = ? AND user_id = ?", (project_id, user["id"]))
    if not exists:
        raise HTTPException(404, "No se encontró este proyecto en tu garaje.")
    return {"ok": True}


@app.get("/api/catalog")
def catalog():
    return CATALOG


@app.get("/api/status")
def service_status():
    return {
        "chat_ready": bool(os.getenv("GEMINI_API_KEY")),
        "image_ready": bool(os.getenv("STABILITY_API_KEY")),
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
        contents = [
            {"role": item["role"], "parts": [{"text": item["content"]}]}
            for item in normalized
        ]
        if body.reference_image:
            if body.reference_mime_type not in ("image/jpeg", "image/png", "image/webp") or len(body.reference_image) > 2_000_000:
                raise HTTPException(413, "La foto de referencia debe ser JPG, PNG o WebP y pesar menos de 1.5 MB tras optimizarla.")
            try:
                image_data = base64.b64decode(body.reference_image, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(422, "No pude leer la foto de referencia. Vuelve a subirla.") from exc
            last_user = next((item for item in reversed(contents) if item["role"] == "user"), None)
            if last_user:
                last_user["parts"].append({"inlineData": {"mimeType": body.reference_mime_type, "data": body.reference_image}})
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            headers={"x-goog-api-key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": SYSTEM.replace("{model}", body.model).replace("{language}", CHAT_LANGUAGES.get(body.language, "español"))}]},
                "contents": contents,
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
    mask_file: UploadFile = File(...),
    prompt: str = Form(...),
    part: str = Form("pieza"),
    model: str = Form("moto"),
):
    try:
        api_key = os.getenv("STABILITY_API_KEY")
        if not api_key:
            raise HTTPException(503, "Falta STABILITY_API_KEY en la configuración del backend para editar fotos.")
        if not prompt.strip() or len(prompt) > 512:
            raise HTTPException(422, "La descripción del cambio debe tener entre 1 y 512 caracteres.")
        img = prepare_image(Image.open(image.file))
        width, height = img.size
        mask = Image.open(mask_file.file).convert("L").resize((width, height), Image.Resampling.LANCZOS)
        mask = mask.point(lambda value: 255 if value > 127 else 0)
        selected_pixels = mask.histogram()[255]
        if selected_pixels == 0:
            raise HTTPException(422, "Pinta sobre la pieza que quieres modificar antes de aplicar el cambio.")
        if selected_pixels > width * height * 0.65:
            raise HTTPException(422, "La selección cubre casi toda la imagen. Limpia la zona y pinta solo la pieza.")

        target = mask_label(part)
        response = httpx.post(
            STABILITY_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "image/*"},
            files={
                "image": ("moto.jpg", image_bytes(img, "JPEG"), "image/jpeg"),
                "mask": ("seleccion.png", image_bytes(mask), "image/png"),
            },
            data={
                "prompt": (
                    f"Photorealistically edit the uploaded motorcycle photo as the exact visual reference. Keep the same {model} motorcycle, "
                    f"including its visible design, proportions, frame, and identifying details. Change only the selected "
                    f"area, which is the {target}: {prompt}. Preserve the original camera angle, lighting, "
                    "shadows, background, motorcycle geometry, and every unselected part. Make the replacement "
                    "mechanically plausible and naturally integrated."
                )[:10000],
                "negative_prompt": "different motorcycle, changed background, extra parts, distorted geometry, blurry details",
                "grow_mask": "8",
                "output_format": "png",
                "style_preset": "photographic",
            },
            timeout=httpx.Timeout(180, connect=15),
        )
        if not response.is_success:
            if response.status_code == 401:
                raise HTTPException(503, "Stability AI no aceptó la clave. Revisa STABILITY_API_KEY en el backend.")
            if response.status_code == 402:
                raise HTTPException(402, "Se agotaron los créditos de Stability AI. Revisa el saldo de tu cuenta.")
            if response.status_code == 403:
                raise HTTPException(422, "Stability AI bloqueó esta solicitud por sus filtros de contenido. Ajusta el cambio e inténtalo otra vez.")
            if response.status_code == 422:
                raise HTTPException(422, "Stability AI no pudo procesar la foto o la máscara. Pinta una zona más clara y vuelve a probar.")
            if response.status_code == 429:
                raise HTTPException(429, "Stability AI recibió demasiadas solicitudes. Espera un momento y vuelve a probar.")
            raise HTTPException(502, f"Stability AI respondió con un error ({response.status_code}). Inténtalo de nuevo más tarde.")
        edited = Image.open(io.BytesIO(response.content)).convert("RGB")
        if edited.size != (width, height):
            edited = edited.resize((width, height), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        edited.save(output, "PNG")
        return Response(output.getvalue(), media_type="image/png")
    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "Stability AI tardó demasiado en editar la foto. Espera un momento e inténtalo otra vez.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(502, "No pude conectar con Stability AI. Revisa la conexión del servidor e inténtalo otra vez.") from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(422, "No pude procesar la foto. Sube un JPG o PNG válido e inténtalo de nuevo.") from exc
    except Exception as exc:
        raise HTTPException(502, "No pude aplicar el cambio. Stability AI tardó o respondió con un error; inténtalo de nuevo.") from exc
