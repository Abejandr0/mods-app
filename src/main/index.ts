import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { invokeCopilot } from './llm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajustar rutas para vite-plugin-electron
process.env.DIST = path.join(__dirname, '../');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'), // Vite-plugin-electron construye mjs
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f172a',
    title: 'ModSim'
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

app.on('ready', () => {
  createWindow();

  ipcMain.handle('ask-copilot', async (_event, prompt: string, currentConfig: any) => {
    try {
      const response = await invokeCopilot(prompt, currentConfig);
      return { success: true, data: response };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
