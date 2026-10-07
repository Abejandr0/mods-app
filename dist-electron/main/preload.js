import { contextBridge as e, ipcRenderer as t } from "electron";
//#region src/main/preload.ts
e.exposeInMainWorld("electronAPI", { askCopilot: (e, n) => t.invoke("ask-copilot", e, n) });
//#endregion
export {};
