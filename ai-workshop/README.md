# Taller virtual de motos

Aplicación web React + TypeScript con un backend FastAPI. La homepage permite entrar al taller al instante con una moto de muestra por categoría o subir una foto propia. El chat usa Claude; SAM 2 segmenta la pieza y Flux Fill aplica el cambio. No hay simulación de respuestas de IA: sin credenciales, el producto informa qué configuración falta.

Las fotos de muestra son visuales generados para probar la interfaz; representan una categoría y no son imágenes exactas de los modelos anunciados.

## Requisitos

- Python 3.10 o superior
- Node.js 20.19 o superior (o 22.12+)
- Claves de fal.ai (`FAL_KEY`) y Anthropic (`ANTHROPIC_API_KEY`)

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

Desde `ai-workshop/backend` con el entorno virtual activo y `FAL_KEY` configurada:

```bash
python test_edit.py foto-moto.jpg 0.63 0.48 "matte black five-spoke alloy wheel" --model "Yamaha R15" --output resultado.png
```

Las coordenadas `x` e `y` son proporciones de la foto entre 0 y 1. El script también guarda la máscara en `mascara.png`.

En desarrollo el frontend usa el proxy de Vite para `/api`; en producción `VITE_API_URL` apunta al backend. Las claves permanecen en el servidor.

## Despliegue en Render

El archivo `render.yaml` crea tres servicios en Oregon: sitio estático, API FastAPI y PostgreSQL. En Render, crea un **Blueprint** desde este repositorio y selecciona `ai-workshop/render.yaml`. Para cambiar región o plan, edita ese archivo antes de crear los servicios.

Render pedirá los valores secretos `ANTHROPIC_API_KEY` y `FAL_KEY`; introdúcelos en el panel de Render, nunca en el repositorio. El frontend usa `VITE_API_URL` y el backend usa `FRONTEND_URL` para comunicarse entre dominios.

### Claves de servicios externos

- Anthropic: crea una clave en [Claude Console → API keys](https://platform.claude.com/settings/keys). La API tiene facturación separada del plan de Claude.ai.
- fal.ai: crea una clave en [fal.ai → API keys](https://fal.ai/dashboard/keys). Se factura según el uso de los modelos.

### Persistencia y límites

La cuenta guarda usuarios y sesiones en PostgreSQL. Fotos y resultados de edición se procesan en la solicitud y no se guardan como galería permanente. El plan gratuito de Render es para pruebas: su API se suspende tras 15 minutos sin tráfico y la base gratuita vence a los 30 días. Migra a una base de pago antes de depender de los datos o invitar usuarios por más tiempo.

Para despliegue manual, configura el backend con `pip install -r requirements.txt` y `uvicorn main:app --host 0.0.0.0 --port $PORT`; configura el frontend con `npm ci && npm run build` y publica `dist`. Ambos servicios deben tener la misma región que PostgreSQL.
