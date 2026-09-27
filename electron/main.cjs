const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createChatServer } = require('../server/chat-server.cjs');

const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'tour-time-data.json');
const docsDir = () => path.join(dataDir(), 'documents');

const SAFE_EXTERNAL = /^(https?|mailto|tel):/i;

let mainWindow = null;
let chatServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Tour Time',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links in the user's browser rather than inside the app. Only web, email and
  // phone links: openExternal on file:// or custom protocols can launch programs.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (SAFE_EXTERNAL.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The app window never navigates away from the app itself.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.split('#')[0] === mainWindow.webContents.getURL().split('#')[0]) return;
    e.preventDefault();
    if (SAFE_EXTERNAL.test(url)) shell.openExternal(url);
  });
}

ipcMain.handle('store:load', () => {
  if (!fs.existsSync(dataFile())) return null;
  return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
});

ipcMain.handle('store:save', (_e, data) => {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = `${dataFile()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dataFile());
  return true;
});

ipcMain.handle('docs:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  fs.mkdirSync(docsDir(), { recursive: true });
  return result.filePaths.map((src) => {
    const storedName = `${crypto.randomUUID()}${path.extname(src)}`;
    fs.copyFileSync(src, path.join(docsDir(), storedName));
    return { originalName: path.basename(src), storedName, size: fs.statSync(src).size };
  });
});

function storedPath(storedName) {
  // Only allow files inside the documents folder.
  const p = path.join(docsDir(), path.basename(storedName));
  return fs.existsSync(p) ? p : null;
}

ipcMain.handle('docs:open', (_e, storedName) => {
  const p = storedPath(storedName);
  return p ? shell.openPath(p) : 'File not found';
});

ipcMain.handle('docs:reveal', (_e, storedName) => {
  const p = storedPath(storedName);
  if (p) shell.showItemInFolder(p);
});

ipcMain.handle('docs:delete', (_e, storedName) => {
  const p = storedPath(storedName);
  if (p) fs.unlinkSync(p);
});

ipcMain.handle('report:pdf', async (_e, suggestedName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: suggestedName || 'day-sheet.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;
  const pdf = await mainWindow.webContents.printToPDF({ printBackground: true, pageSize: 'Letter' });
  fs.writeFileSync(filePath, pdf);
  return filePath;
});

ipcMain.handle('report:print', () => {
  mainWindow.webContents.print({ printBackground: true });
});

ipcMain.handle('chat:host', async (_e, { enabled, port }) => {
  if (chatServer) {
    await chatServer.close();
    chatServer = null;
  }
  if (enabled) {
    chatServer = createChatServer({ port: port || 4455, dataDir: dataDir() });
  }
  return { hosting: !!chatServer, port: chatServer?.port ?? null };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (chatServer) await chatServer.close();
  if (process.platform !== 'darwin') app.quit();
});
