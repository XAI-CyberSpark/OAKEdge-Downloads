const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('OAKEdgeDesktop', Object.freeze({
  platform: process.platform,
  arch: process.arch,
  setExecutionActive(source, active) {
    if (['workflow', 'local-camera'].includes(source) && typeof active === 'boolean') ipcRenderer.send('oakedge:execution-active', source, active);
  },
}));
