# Taller virtual de motos

Aplicación web React + TypeScript con un backend FastAPI. La homepage permite entrar al taller al instante con una moto de muestra por categoría o subir una foto propia. El chat usa Claude; SAM 2 segmenta la pieza y Flux Fill aplica el cambio. No hay simulación de respuestas de IA: sin credenciales, el producto informa qué configuración falta.

Las fotos de muestra son visuales generados para probar la interfaz; representan una categoría y no son imágenes exactas de los modelos anunciados.

## Requisitos

- Python 3.10 o superior
- Node.js 20.19 o superior (o 22.12+)
- Claves de fal.ai (`FAL_KEY`) y Anthropic (`ANTHROPIC_API_KEY`)

El registro es opcional. Las cuentas se guardan en SQLite local (`backend/data/workshop.sqlite3`), con contraseñas derivadas mediante PBKDF2 y sesión en cookie HttpOnly. El historial de imágenes no se sincroniza con la cuenta ni se guarda en nube.

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

El frontend usa el proxy de Vite para `/api` hacia `localhost:8000`; el backend conserva las claves en el servidor y no las expone al navegador.
