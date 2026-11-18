# Taller virtual de motos

Aplicación web React + TypeScript con un backend FastAPI. La homepage permite entrar al taller al instante con una foto de referencia para cada moto del catálogo o subir una foto propia. El chat usa Gemini API; las modificaciones reales usan Stability AI Inpaint. El usuario pinta el área que quiere editar y el backend envía la foto y la máscara a Stability AI. No hay simulación: si falta una clave, la app explica qué función falta.

Las fotos del catálogo son fotografías reales, descargadas localmente y acreditadas con sus licencias en [`frontend/public/samples/PHOTO_CREDITS.md`](frontend/public/samples/PHOTO_CREDITS.md). El año, el color o los accesorios pueden variar; la foto usada para Yamaha FZ 2.0 corresponde a una FZ-S cuya versión no está confirmada.

## Requisitos

- Python 3.10 o superior
- Node.js 20.19 o superior (o 22.12+)
- Una clave gratuita de Google AI Studio (`GEMINI_API_KEY`) para el chat. La generación de imágenes por API tiene facturación separada y no está incluida en Gemini Plus.

El registro es opcional. En desarrollo, las cuentas se guardan en SQLite local (`backend/data/workshop.sqlite3`); en producción, configura PostgreSQL mediante `DATABASE_URL`. Las contraseñas se derivan mediante PBKDF2 y la sesión usa una cookie HttpOnly. El historial de imágenes no se sincroniza con la cuenta ni se guarda en nube.

## Ejecutar en desarrollo

En una terminal:

```bash
cd ai-workshop/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env       # agrega GEMINI_API_KEY y STABILITY_API_KEY
uvicorn main:app --reload --port 8000
```

En otra terminal:

```bash
cd ai-workshop/frontend
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente http://localhost:5173).

## Cuentas

En la barra superior puedes crear una cuenta o iniciar sesión. El acceso no bloquea la prueba del taller. Las cuentas son locales a la instalación; para una aplicación pública se debe configurar una base de datos central y HTTPS (`SECURE_COOKIES=true`).

## Probar la edición sin la interfaz

Desde `ai-workshop/backend` con el entorno virtual activo y `STABILITY_API_KEY` en `.env`. La máscara debe ser un PNG blanco/negro: blanco es la zona que se reemplaza; negro se conserva.

```bash
python test_edit.py foto-moto.jpg seleccion.png "matte black five-spoke alloy wheel" --part rueda --model "Yamaha R15" --output resultado.png
```

Cada solicitud exitosa consume créditos de Stability AI. El usuario pinta la máscara directamente en el taller; la interfaz permite ajustar el tamaño del pincel y reiniciar la selección.

En desarrollo el frontend usa el proxy de Vite para `/api`; en producción `VITE_API_URL` apunta al backend. Las claves permanecen en el servidor.

## Alternativa: Render y Neon en niveles gratuitos

El Blueprint `render.yaml` despliega el sitio estático y FastAPI en planes gratuitos de Render. Render no crea la base de datos del Blueprint: crea una en [Neon](https://neon.com/) usando su plan gratuito y pega la connection string como `DATABASE_URL` en Render. Neon ofrece PostgreSQL persistente con cuota mensual, mientras que la base gratuita de Render vence después de 30 días.

Render pedirá `GEMINI_API_KEY` y `DATABASE_URL`; introdúcelas en el panel de Render, nunca en el repositorio. El frontend usa `VITE_API_URL` y el backend usa `FRONTEND_URL` para comunicarse entre dominios.

### IA y límites del nivel gratuito

- Gemini: crea una clave en [Google AI Studio → API keys](https://aistudio.google.com/api-keys). El chat usa `gemini-3.5-flash-lite`, con cuota gratuita sujeta a límites por proyecto.
- La edición de fotos usa Stability AI Inpaint y consume créditos por edición. La clave `STABILITY_API_KEY` va solo en el backend, nunca en el frontend ni en Git.

### Persistencia y disponibilidad

La cuenta guarda usuarios y sesiones en Neon PostgreSQL. Fotos y resultados de edición se procesan en la solicitud y no se guardan como galería permanente. El backend gratuito de Render se suspende tras 15 minutos sin tráfico y puede tardar cerca de un minuto en despertar. Revisa las cuotas vigentes de Neon, Render y Google AI Studio antes de compartir el sitio.

Para despliegue manual, configura el backend con `pip install -r requirements.txt` y `uvicorn main:app --host 0.0.0.0 --port $PORT`; configura el frontend con `npm ci && npm run build` y publica `dist`.

## Despliegue en AWS

Puedes alojar el frontend y FastAPI en una instancia Lightsail o EC2. La edición de imágenes se conecta a Stability AI, así que no hace falta habilitar Bedrock ni asignar un rol IAM de Bedrock al servidor. Configura `STABILITY_API_KEY` como secreto del backend. Las guías de infraestructura anteriores aún contienen pasos específicos de Bedrock y deben adaptarse antes de seguirlas.
