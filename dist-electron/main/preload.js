import { contextBridge, ipcRenderer } from "electron";
//#region src/main/preload.ts
contextBridge.exposeInMainWorld("electronAPI", { askCopilot: (prompt, currentConfig) => ipcRenderer.invoke("ask-copilot", prompt, currentConfig) });
//#endregion
export {};
