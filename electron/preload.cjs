const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tourTime', {
  loadData: () => ipcRenderer.invoke('store:load'),
  saveData: (data) => ipcRenderer.invoke('store:save', data),
  importDocuments: () => ipcRenderer.invoke('docs:import'),
  openDocument: (storedName) => ipcRenderer.invoke('docs:open', storedName),
  revealDocument: (storedName) => ipcRenderer.invoke('docs:reveal', storedName),
  deleteDocument: (storedName) => ipcRenderer.invoke('docs:delete', storedName),
  saveReportPdf: (name) => ipcRenderer.invoke('report:pdf', name),
  printReport: () => ipcRenderer.invoke('report:print'),
  hostChat: (opts) => ipcRenderer.invoke('chat:host', opts),
});
