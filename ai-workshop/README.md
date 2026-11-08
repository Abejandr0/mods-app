# Taller virtual de motos

Aplicación web React + TypeScript con un backend FastAPI. Permite escoger un modelo, cargar una foto, describir una modificación en español, seleccionar la pieza en la foto y revisar la máscara antes de aplicar el inpainting.

## Requisitos

- Python 3.10 o superior
- Node.js 20.19 o superior (o 22.12+)
- Claves de fal.ai (`FAL_KEY`) y Anthropic (`ANTHROPIC_API_KEY`)

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

## Probar la edición sin la interfaz

Desde `ai-workshop/backend` con el entorno virtual activo y `FAL_KEY` configurada:

```bash
python test_edit.py foto-moto.jpg 0.63 0.48 "matte black five-spoke alloy wheel" --model "Yamaha R15" --output resultado.png
```

Las coordenadas `x` e `y` son proporciones de la foto entre 0 y 1. El script también guarda la máscara en `mascara.png`.

El frontend usa el proxy de Vite para `/api` hacia `localhost:8000`; el backend conserva las claves en el servidor y no las expone al navegador.
