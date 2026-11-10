# Taller virtual de motos

Aplicación web React + TypeScript con un backend FastAPI. La homepage permite entrar al taller al instante con una moto de muestra por categoría o subir una foto propia. El chat usa Gemini API; el editor de imágenes usa SAM 2 y Flux Fill cuando se configura una clave de fal.ai. No hay simulación: si un proveedor no está habilitado, la app explica qué función falta.

Las fotos de muestra son visuales generados para probar la interfaz; representan una categoría y no son imágenes exactas de los modelos anunciados.

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
cp .env.example .env       # agrega las claves al archivo .env
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

Desde `ai-workshop/backend` con el entorno virtual activo y `FAL_KEY` configurada (opcional y con cobro por uso):

```bash
python test_edit.py foto-moto.jpg 0.63 0.48 "matte black five-spoke alloy wheel" --model "Yamaha R15" --output resultado.png
```

Las coordenadas `x` e `y` son proporciones de la foto entre 0 y 1. El script también guarda la máscara en `mascara.png`.

En desarrollo el frontend usa el proxy de Vite para `/api`; en producción `VITE_API_URL` apunta al backend. Las claves permanecen en el servidor.

## Alternativa: Render y Neon en niveles gratuitos

El Blueprint `render.yaml` despliega el sitio estático y FastAPI en planes gratuitos de Render. Render no crea la base de datos del Blueprint: crea una en [Neon](https://neon.com/) usando su plan gratuito y pega la connection string como `DATABASE_URL` en Render. Neon ofrece PostgreSQL persistente con cuota mensual, mientras que la base gratuita de Render vence después de 30 días.

Render pedirá `GEMINI_API_KEY` y `DATABASE_URL`; introdúcelas en el panel de Render, nunca en el repositorio. El frontend usa `VITE_API_URL` y el backend usa `FRONTEND_URL` para comunicarse entre dominios.

### IA y límites del nivel gratuito

- Gemini: crea una clave en [Google AI Studio → API keys](https://aistudio.google.com/api-keys). El chat usa `gemini-3.1-flash-lite`, con cuota gratuita sujeta a límites por proyecto.
- La edición de fotos con IA permanece desactivada si no configuras `FAL_KEY`. Los modelos de generación de imágenes de Gemini API actualmente no incluyen cuota gratuita; Gemini Plus tampoco incluye API. No se sustituye el resultado por una imagen falsa.

### Persistencia y disponibilidad

La cuenta guarda usuarios y sesiones en Neon PostgreSQL. Fotos y resultados de edición se procesan en la solicitud y no se guardan como galería permanente. El backend gratuito de Render se suspende tras 15 minutos sin tráfico y puede tardar cerca de un minuto en despertar. Revisa las cuotas vigentes de Neon, Render y Google AI Studio antes de compartir el sitio.

Para despliegue manual, configura el backend con `pip install -r requirements.txt` y `uvicorn main:app --host 0.0.0.0 --port $PORT`; configura el frontend con `npm ci && npm run build` y publica `dist`.

## AWS Lightsail

Para alojarlo en AWS con un solo servidor y bajo costo, sigue la [guía de Lightsail](deploy/aws-lightsail.md) y usa las plantillas de [Caddy](deploy/Caddyfile) y [systemd](deploy/motomod-api.service).
