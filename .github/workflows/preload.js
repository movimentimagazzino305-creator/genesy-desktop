const { contextBridge, ipcRenderer } = require('electron');

let appVersion = '';
try {
  appVersion = ipcRenderer.sendSync('get-app-version') || '';
} catch (e) {
  console.warn('[Preload] Error getting version from main:', e);
}

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: appVersion,
  downloadAndInstallUpdate: (data) => ipcRenderer.send('download-and-install-update', data),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (event, val) => callback(val)),
  onUpdateComplete: (callback) => ipcRenderer.on('update-download-complete', (event, val) => callback(val)),
  onUpdateError: (callback) => ipcRenderer.on('update-download-error', (event, val) => callback(val))
});

console.log('[Genesy Desktop] Preload script inizializzato con successo.');
