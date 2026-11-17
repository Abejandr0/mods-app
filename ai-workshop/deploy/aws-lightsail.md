# MotoMod en Amazon Lightsail

Lightsail aloja la aplicación; las ediciones se ejecutan en Stability AI. Esta versión **no necesita Amazon Bedrock, permisos `bedrock:InvokeModel` ni claves AWS en el backend**. La instancia puede seguir en Ohio (`us-east-2`); la ubicación de Lightsail no cambia el proveedor de imágenes.

## Configuración del backend

En el archivo privado de variables de entorno que use el servicio `motomod-api`, configura:

```env
GEMINI_API_KEY=tu_clave_de_google_ai_studio
GEMINI_MODEL=gemini-3.5-flash-lite
STABILITY_API_KEY=tu_clave_de_stability_ai
WORKSHOP_DATA_DIR=/var/lib/motomod
SECURE_COOKIES=true
FRONTEND_URL=https://tu-dominio.com
```

Guarda `STABILITY_API_KEY` solo en el servidor, limita los permisos del archivo y no la subas al repositorio ni al frontend. La clave se obtiene en la cuenta de Stability AI. Cada edición exitosa consume créditos de ese proveedor.

## Publicar cambios

1. En tu computador, dentro de `ai-workshop/frontend`, ejecuta `npm ci` y `npm run build`.
2. Sube el contenido de `ai-workshop/frontend/dist` al directorio web de Lightsail.
3. Sube el backend actualizado y ejecuta `pip install -r backend/requirements.txt` en su entorno virtual.
4. Reinicia el servicio `motomod-api` y verifica `/healthz` y `/api/status`. Debe mostrar `chat_ready: true`, `image_ready: true` y `ai_is_simulated: false`.
5. Haz una edición de prueba: pinta una región pequeña de una foto, confirma la selección y envía el cambio.

La configuración de Caddy y systemd del repositorio puede servir como referencia para el proxy HTTPS y el proceso FastAPI. No sigas las instrucciones de Bedrock en [la guía EC2 anterior](aws-ec2-bedrock.md), pues corresponden al proveedor que se reemplazó.
