# ModSim - Simulador de Modificaciones de Motocicletas con IA

ModSim es una aplicación de escritorio nativa construida con **Electron, Vite, React y TypeScript**. Su objetivo es permitir a los motociclistas simular modificaciones mecánicas (cambio de kit de arrastre, cambio de medidas de llanta) y visualizar matemáticamente su impacto en tiempo real. 

La aplicación cuenta con un entorno físico puro determinista, una interfaz interactiva fluida (framer-motion) y un asistente Copiloto IA (Gemini) integrado de manera segura en el proceso principal de Electron.

## 🚀 Requisitos previos

- **Node.js** (v18 o superior recomendado)
- **Clave API de Gemini** (Opcional, requerida únicamente si deseas usar la IA conectada a la red; la aplicación también funciona offline con sugerencias pre-calculadas).

## 🛠️ Instalación y ejecución

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Ejecutar en entorno de desarrollo**:
   Levanta el servidor de React (Vite) y abre automáticamente la ventana de Electron con Hot Module Replacement (HMR).
   ```bash
   export GEMINI_API_KEY="tu_api_key_gemini" # Opcional
   npm run dev
   ```

3. **Ejecutar en entorno de producción**:
   Construye la aplicación y la abre usando los archivos transpilados (modo `start`).
   ```bash
   npm run build
   npm start
   ```

## 🧪 Pruebas y Linter

- **Pruebas unitarias** del motor físico (Vitest):
  ```bash
  npm test
  ```
- **Linter** (Oxlint para chequeos súper rápidos):
  ```bash
  npm run lint
  ```

## 🏗️ Arquitectura de Software

El proyecto se divide estrictamente en 3 capas:
1. `/src/engine`: El cerebro matemático. Funciones puras, sin estado y sin dependencias de UI ni de Node/Electron.
2. `/src/renderer`: La capa visual con React y Zustand para gestión de estado.
3. `/src/main`: El proceso privilegiado de Electron (Main process) que tiene acceso al sistema y se comunica con el Renderer mediante IPC seguro (`contextBridge`).
