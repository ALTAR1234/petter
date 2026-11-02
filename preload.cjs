// Petter's links to the PC: pass clicks through except over the pet, save and load the pet,
// open its menu, ask how long you've been idle, and hear what you're doing.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petter', {
  hit: (over) => ipcRenderer.send('hit', over),
  save: (data) => ipcRenderer.send('save', data),
  load: () => ipcRenderer.invoke('load'),
  menu: () => ipcRenderer.send('menu'),
  typing: (on) => ipcRenderer.send('typing', on),
  idle: () => ipcRenderer.invoke('idle'),
  onEvent: (cb) => ipcRenderer.on('event', (_e, ev) => cb(ev)),
});
