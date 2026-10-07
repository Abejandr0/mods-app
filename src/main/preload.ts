import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  askCopilot: (prompt: string, currentConfig: any) => ipcRenderer.invoke('ask-copilot', prompt, currentConfig)
});
