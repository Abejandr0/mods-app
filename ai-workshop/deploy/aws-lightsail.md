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

Para publicar cambios de la interfaz y sus imágenes, compila en tu computador desde la raíz del repo. Sustituye la ruta de la llave SSH si está guardada en otro lugar:

```bash
cd ai-workshop/frontend
npm ci
npm run build
ssh -i /home/TU_USUARIO/Downloads/tu-llave.pem ubuntu@motomod.ddnsfree.com 'rm -rf /tmp/motomod-dist'
scp -i /home/TU_USUARIO/Downloads/tu-llave.pem -r dist ubuntu@motomod.ddnsfree.com:/tmp/motomod-dist
```

Luego entra a Lightsail y publica el build:

```bash
ssh -i /home/TU_USUARIO/Downloads/tu-llave.pem ubuntu@motomod.ddnsfree.com
sudo mkdir -p /var/www/motomod
sudo find /var/www/motomod -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo cp -a /tmp/motomod-dist/. /var/www/motomod/
sudo chown -R www-data:www-data /var/www/motomod
curl -fsS https://motomod.ddnsfree.com/healthz
curl -fsS https://motomod.ddnsfree.com/api/status
```

Este cambio solo modifica el frontend: no hace falta subir el backend ni reiniciar `motomod-api` o Caddy. La copia reemplaza los archivos estáticos publicados, incluidas las fotos. Verifica que la portada cargue y que `/api/status` responda. Para cambios futuros del backend, sube también `ai-workshop/backend`, instala sus dependencias en `/opt/motomod/.venv` si cambió `requirements.txt` y reinicia con `sudo systemctl restart motomod-api`.

La configuración de Caddy y systemd del repositorio puede servir como referencia para el proxy HTTPS y el proceso FastAPI. No sigas las instrucciones de Bedrock en [la guía EC2 anterior](aws-ec2-bedrock.md), pues corresponden al proveedor que se reemplazó.
