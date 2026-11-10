# Despliegue low-cost en AWS EC2 + Amazon Bedrock

Esta guía usa **una sola instancia EC2** para servir el frontend, ejecutar FastAPI y guardar cuentas en SQLite. Bedrock genera las ediciones; Gemini API conserva el chat. Así se evita pagar por RDS, balanceador, NAT Gateway y servicios separados. La instancia llama a Bedrock con un **rol IAM**, sin claves AWS permanentes en el servidor.

## Arquitectura y costo orientativo

- Región `us-east-1` (Virginia): Titan Image Generator G1 v2 está disponible allí y es una región AWS cercana a Colombia.
- EC2 `t3a.small` (2 vCPU, 2 GiB RAM), Ubuntu 24.04. Compila el frontend en tu computador y sube el `dist`; no compiles en la instancia.
- Volumen EBS `gp3` de 20 GB. La base SQLite y sus archivos viven en `/var/lib/motomod`.
- Caddy ofrece HTTPS y sirve el frontend; el mismo dominio envía `/api/*` al backend FastAPI.
- Amazon Bedrock `amazon.titan-image-generator-v2:0` hace una llamada real de inpainting por cada edición aceptada.
- Gemini sigue siendo externo a AWS y necesita una clave API de Google AI Studio. Google AI Studio tiene cuota gratuita sujeta a sus límites actuales; Gemini Plus no incluye acceso a API.

Referencia mensual para funcionamiento continuo en us-east-1: `t3a.small` alrededor de US$13.72 (0.0188/h × 730 h), 20 GB gp3 alrededor de US$1.60 y una IPv4 pública alrededor de US$3.65: **aprox. US$19/mes**, antes de impuestos, transferencia, almacenamiento de snapshots, uso de Bedrock y otras tarifas. `t3a.micro` (1 GiB) baja el cómputo a aproximadamente US$6.86/mes y el total de servidor a US$12.11, pero puede quedarse corto de memoria; úsalo para una primera prueba y sube a `t3a.small` si hay reinicios o falta de memoria. Los precios cambian según región y fecha.

AWS publica como ejemplo de precio de Titan Image Generator base US$0.01 por imagen 1024×1024 estándar (1,000 imágenes = US$10). La tarifa exacta de tu región, versión, tarea de inpainting y tamaño se debe confirmar en la página/calculadora de precios de Bedrock antes de probar. Los créditos de US$100 dependen de su fecha de vencimiento y servicios elegibles: compruébalos en **Billing and Cost Management → Credits**. Una alarma de presupuesto avisa, pero no detiene automáticamente el gasto.

## 1. Revisa tu crédito y fija alertas

1. En la consola AWS abre **Billing and Cost Management → Credits**. Confirma saldo, vencimiento y servicios elegibles para ese crédito.
2. Abre **Billing → Budgets → Create budget**. Crea un presupuesto mensual pequeño para comenzar y alertas por correo al 50%, 80% y 100%. Agrega también una alerta de gasto absoluto, por ejemplo US$20.
3. Recuerda que una alarma de presupuesto es aviso, no límite duro. Cada edición llama una vez a Bedrock y puede generar un cargo. Prueba primero con una sola imagen.

## 2. Habilita y valida Titan en Bedrock

1. En el selector de región AWS elige **US East (N. Virginia), `us-east-1`**.
2. Abre **Amazon Bedrock → Model catalog**, busca **Amazon Titan Image Generator G1 v2** y ábrelo. Los modelos serverless comerciales suelen habilitarse en el primer uso; si la consola lo pide, acepta los términos/flujo de acceso correspondiente.
3. Antes de desplegar, usa el playground o la prueba local del paso 7 con una imagen que tengas permiso de procesar. Verifica el coste estimado en Bedrock Pricing.
4. El modelo usa entrada en inglés y recibe como base la imagen, `text` y una máscara: `maskPrompt` (estimada a partir de texto) o `maskImage` (máscara exacta). La interfaz actual envía el punto tocado como referencia aproximada junto al nombre de pieza; Bedrock infiere la región en esa misma llamada. No es un SAM de precisión por píxel, por eso el punto orienta al modelo y no garantiza un recorte perfecto.

## 3. Crea un rol de instancia de permisos mínimos

1. Abre **IAM → Roles → Create role**.
2. Tipo de entidad confiable: **AWS service**; caso de uso: **EC2**.
3. Crea el rol `MotoModEC2BedrockRole`.
4. En permisos, agrega una política en línea con este JSON. Cambia `us-east-1` solo si usas la región permitida para el modelo:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v2:0"
  }]
}
```

5. Guarda el rol. No crees access keys IAM para la aplicación. EC2 entrega credenciales temporales al SDK mediante el rol.

## 4. Lanza EC2

1. Abre **EC2 → Launch instance**. Nombre: `motomod`; AMI: Ubuntu Server 24.04 LTS; arquitectura x86_64; tipo recomendado `t3a.small` (si no aparece en tu zona, usa `t3.small`).
2. En **Key pair**, crea/elige una llave para administrar por SSH y descarga la privada de forma segura. Nunca la subas a GitHub.
3. En **Network settings**, permite SSH TCP 22 solo desde **My IP**; HTTP 80 y HTTPS 443 desde cualquier dirección. No abras el puerto 8000.
4. En **Advanced details → IAM instance profile**, selecciona `MotoModEC2BedrockRole`.
5. En almacenamiento deja EBS gp3, al menos 20 GiB. Conserva **Delete on termination** activo si quieres que al terminar la instancia también se borre ese volumen; toma respaldos antes de terminar.
6. Lanza la instancia y copia su IPv4 pública. Para que la IP no cambie al detener/reiniciar, asigna una **Elastic IP** y asóciala; la IPv4 pública tiene cobro por hora, incluso algunas IPs sin usar.

## 5. Asigna dominio y HTTPS

Para HTTPS automático, necesitas un dominio propio o uno que controles. Crea un registro DNS `A` (por ejemplo `taller.tudominio.com`) que apunte a la Elastic IP. Espera a que resuelva antes de continuar. Sin dominio puedes comprobar temporalmente por IP con HTTP, pero no uses registro/inicio de sesión con cookies seguras hasta tener HTTPS.

## 6. Prepara y publica el código

Desde tu computador, en la raíz del repo, compila el sitio:

```bash
cd ai-workshop/frontend
npm ci
npm run build
```

Conéctate por SSH a la instancia (sustituye el usuario/IP/ruta a tu llave):

```bash
ssh -i ~/Downloads/tu-llave.pem ubuntu@IP_PUBLICA
```

En Ubuntu instala utilidades y Caddy:

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip python3-pil curl
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo adduser --system --group --home /opt/motomod motomod
sudo mkdir -p /opt/motomod /var/www/motomod /var/lib/motomod
sudo chown -R motomod:motomod /opt/motomod /var/lib/motomod
```

Clona el repositorio público y copia el build hecho en tu computador. Si el repositorio es privado, usa un método de despliegue SSH/token de solo lectura, nunca pegues un token en la URL guardada en historial:

```bash
sudo -u motomod git clone https://github.com/Abejandr0/mods-app.git /opt/motomod/repo
sudo cp -a /opt/motomod/repo/ai-workshop/. /opt/motomod/
```

Para subir `dist` desde tu computador, en otra terminal ejecuta desde `ai-workshop/frontend`:

```bash
scp -i ~/Downloads/tu-llave.pem -r dist ubuntu@IP_PUBLICA:/tmp/motomod-dist
```

Y en la sesión SSH:

```bash
sudo rm -rf /var/www/motomod/*
sudo cp -a /tmp/motomod-dist/. /var/www/motomod/
sudo chown -R www-data:www-data /var/www/motomod
sudo -u motomod python3 -m venv /opt/motomod/.venv
sudo -u motomod /opt/motomod/.venv/bin/pip install --upgrade pip
sudo -u motomod /opt/motomod/.venv/bin/pip install -r /opt/motomod/backend/requirements.txt
```

## 7. Configura Gemini y Bedrock

Genera una clave de chat en [Google AI Studio API keys](https://aistudio.google.com/api-keys). En la instancia crea el archivo privado de entorno:

```bash
sudo nano /etc/motomod.env
```

Contenido (reemplaza dominio y clave):

```env
GEMINI_API_KEY=tu_clave_de_google_ai_studio
GEMINI_MODEL=gemini-3.5-flash-lite
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.titan-image-generator-v2:0
BEDROCK_ENABLED=true
WORKSHOP_DATA_DIR=/var/lib/motomod
SECURE_COOKIES=true
FRONTEND_URL=https://taller.tudominio.com
```

Protege el archivo: `sudo chown root:motomod /etc/motomod.env && sudo chmod 640 /etc/motomod.env`. No pongas `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`; boto3 toma el rol de instancia automáticamente. La clave Gemini sí es secreta, va en este archivo y solo en el servidor.

## 8. Configura el servicio y Caddy

Copia las plantillas del repo y actualiza el dominio en Caddy:

```bash
sudo cp /opt/motomod/deploy/motomod-api.service /etc/systemd/system/motomod-api.service
sudo cp /opt/motomod/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Reemplaza `tudominio.com` por el nombre DNS completo. Activa servicios:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now motomod-api
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

El servicio usa un solo worker para no duplicar memoria; Caddy escucha 80/443 y FastAPI solo en localhost.

## 9. Comprueba el despliegue

1. Ejecuta `sudo systemctl status motomod-api caddy` y `sudo journalctl -u motomod-api -n 100 --no-pager` si algo falla.
2. Abre `https://taller.tudominio.com/healthz`; debe devolver `{"status":"ok"}`.
3. En `/api/status` revisa que `chat_ready` sea `true`, `image_ready` sea `true` y `ai_is_simulated` sea `false`.
4. Prueba alta de cuenta y cierre/inicio de sesión. SQLite persiste localmente en `/var/lib/motomod`; no es multi-servidor y hay que hacer backups.
5. Ejecuta una sola edición de imagen. Si recibes AccessDenied, revisa el perfil/permiso IAM y la región; si recibes ValidationException, revisa nombre del modelo, tamaño JPEG y formato del cuerpo.

### Prueba del pipeline sin web

En EC2 (o en tu computador con credenciales AWS de desarrollo configuradas de manera segura), activa el venv y ejecuta:

```bash
cd /opt/motomod/backend
/opt/motomod/.venv/bin/python test_edit.py /ruta/a/moto.jpg 0.63 0.48 "matte black five-spoke alloy wheel" --part rueda --model "Yamaha R15" --output /tmp/resultado.png --region us-east-1
```

**Esta prueba hace una llamada real facturable a Bedrock**. La respuesta guarda el resultado y, si el servicio la devuelve, la máscara inferida. Usa una foto lateral clara, coordenadas aproximadas (0–1) y una descripción específica.

## Actualizaciones y mantenimiento

Para publicar cambios: actualiza el repo; compila localmente `npm run build`; sube de nuevo el contenido de `dist`; actualiza el checkout del backend; si cambió `requirements.txt`, reinstala paquetes; reinicia con `sudo systemctl restart motomod-api` y `sudo systemctl reload caddy`. Antes de reemplazar, conserva una copia de `/var/lib/motomod`.

Para revisar logs: `sudo journalctl -u motomod-api -f` y `sudo journalctl -u caddy -f`. Para respaldar SQLite: detén el backend, copia `/var/lib/motomod/workshop.sqlite3` a un lugar seguro y vuelve a iniciarlo. También puedes crear snapshots EBS; estos tienen costo.

Para dejar de incurrir en cómputo, termina la instancia y revisa/elimina por separado volúmenes EBS, snapshots y Elastic IP que ya no necesites. **Detener EC2 no elimina los cargos del disco, snapshots ni algunas direcciones IP**.

## Referencias oficiales

- [Titan Image Generator G1 request/response, inpainting y máscaras](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html)
- [Regiones/modelos Titan disponibles](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-models.html)
- [Acceso a modelos Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Roles IAM para aplicaciones en EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)
- [Precios de EC2 T3/T3a](https://aws.amazon.com/ec2/instance-types/t3/), [IPv4 pública](https://aws.amazon.com/vpc/pricing/) y [EBS gp3](https://aws.amazon.com/ebs/general-purpose/)
- [Precios de Amazon Bedrock](https://aws.amazon.com/bedrock/pricing/)
- [Modelo Gemini 3.5 Flash-Lite y precios/cuota gratuita](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)
- [Ver créditos y productos elegibles](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html)
