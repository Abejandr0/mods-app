export {};

declare global {
  interface Window {
    electronAPI: {
      askCopilot: (prompt: string, currentConfig: any) => Promise<{success: boolean, data?: any, error?: string}>
    }
  }
}
