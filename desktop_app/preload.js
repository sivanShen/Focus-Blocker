const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getWaitTime: () => ipcRenderer.invoke('get-wait-time'),
    unlockDomain: (duration) => ipcRenderer.invoke('unlock-domain', duration),
    checkAccess: () => ipcRenderer.invoke('check-access')
});
