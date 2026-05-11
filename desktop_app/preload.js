const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getWaitTime: () => ipcRenderer.invoke('get-wait-time'),
    unlockDomain: (duration) => ipcRenderer.invoke('unlock-domain', duration),
    checkAccess: () => ipcRenderer.invoke('check-access'),
    cancelUnlock: () => ipcRenderer.invoke('cancel-unlock'),
    pauseExtension: (minutes) => ipcRenderer.invoke('pause-extension', minutes),
    onHostageTick: (callback) => ipcRenderer.on('hostage-tick', callback)
});
