# Desplegar MotoMod en AWS Lightsail

## Arquitectura de bajo costo

Para una demo de clase con poco tráfico, usa una sola instancia **Lightsail Linux/Unix con IPv4 pública**:

- Recomendado: plan de 1 GB de RAM, alrededor de US$7/mes, SSD de 40 GB y transferencia incluida según la región.
- Ahorro máximo: 512 MB, alrededor de US$5/mes; puede quedarse corto durante instalaciones o compilaciones.
- Caddy sirve el frontend compilado, termina HTTPS y envía `/api/*` a FastAPI.
- SQLite guarda las cuentas en el disco persistente de la instancia; no hace falta contratar una base administrada mientras sea una sola instancia.
- Gemini API sigue siendo externa a AWS para el chat gratuito. La edición de imágenes no queda habilitada sin un proveedor con cuota disponible.

No se requiere crear Access Keys de AWS para este procedimiento. Usa la terminal SSH de Lightsail. Nunca guardes secretos en GitHub.

## Crear la instancia

1. Abre [Lightsail](https://lightsail.aws.amazon.com/) y crea una instancia Linux/Unix de Ubuntu 24.04 en una región cercana a tus usuarios (por ejemplo, `us-east-1`).
2. Selecciona el bundle con IPv4 pública. El de 1 GB es la opción recomendada para reducir problemas de memoria; revisa el precio final que muestra tu consola y los créditos disponibles en **Billing** antes de crearla.
3. Crea y conecta una IPv4 estática. Lightsail no cobra por la IP estática mientras esté conectada a una instancia.
4. En la sección de red, permite TCP 22 solo desde tu IP y TCP 80/443 desde Internet.
5. Para HTTPS automático y registro seguro, apunta un dominio que ya tengas a la IPv4 estática (registro DNS tipo A). El dominio puede tener costo adicional. Sin dominio puedes hacer una prueba temporal por IP, pero no es recomendable para cuentas reales.

Lightsail factura la instancia incluso cuando está detenida; para dejar de pagar, elimina la instancia y los recursos que ya no uses. Al eliminarla se pierde el SQLite de esa instancia si no tienes una copia.

## Publicar la aplicación

Esta app usa el mismo dominio para frontend y backend. Caddy entrega los archivos estáticos y hace proxy de `/api/*` a FastAPI en `127.0.0.1:8000`. Así no hay que configurar CORS entre dos dominios.

En la instancia instala Git, Python con `venv`, Node.js 22 y Caddy. Clona `https://github.com/Abejandr0/mods-app.git` en `/opt/motomod`. Compila el frontend desde `ai-workshop/frontend` con `npm ci && npm run build` y copia el contenido de `dist` a `/var/www/motomod`. Instala los paquetes del backend en `/opt/motomod/.venv` ejecutando `pip install -r requirements.txt` desde `ai-workshop/backend`.

Configura el backend como servicio `systemd` para que reinicie al arrancar. Usa estas variables en un archivo privado del servidor, por ejemplo `/etc/motomod.env` con permisos `600`:

```env
GEMINI_API_KEY=tu_clave_de_google_ai_studio
GEMINI_MODEL=gemini-3.1-flash-lite
WORKSHOP_DATA_DIR=/var/lib/motomod
SECURE_COOKIES=true
```

Crea un usuario Linux `motomod` y dale permisos de escritura sobre `/var/lib/motomod`. No configures `DATABASE_URL`: en Lightsail, al no definirla, la app usa SQLite en `WORKSHOP_DATA_DIR`. Copia [la plantilla de systemd](motomod-api.service) a `/etc/systemd/system/motomod-api.service` y [la plantilla de Caddy](Caddyfile) a `/etc/caddy/Caddyfile`; reemplaza `tudominio.com` por el dominio que apunta a la IP estática. Después habilita el backend (`sudo systemctl daemon-reload && sudo systemctl enable --now motomod-api`) y recarga Caddy (`sudo systemctl reload caddy`). Caddy solicita y renueva HTTPS automáticamente para un dominio público correctamente configurado.

## Verificación

- Abre `https://tu-dominio/healthz`; debe responder `{"status":"ok"}`.
- Abre la web, crea una cuenta y recarga para comprobar que la sesión y la cuenta persisten.
- Envía un mensaje al copiloto para verificar la clave y cuota de Gemini. La cuota y los modelos disponibles se revisan en [Google AI Studio](https://aistudio.google.com/usage).
- La selección de pieza y la interfaz funcionan, pero aplicar una edición debe indicar que falta un proveedor de imágenes. No se genera una imagen falsa.

## Cuenta AWS existente

Verifica el plan y créditos de la cuenta en Billing: la prueba gratuita nueva de AWS está destinada a clientes nuevos y no hay que asumir que aplica a una cuenta existente. La instancia de US$5–7/mes es un costo de referencia antes de impuestos y de cualquier cargo por superar la transferencia incluida; usa el precio que muestre Lightsail para la región elegida.
