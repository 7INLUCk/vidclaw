/**
 * Test entry point for Playwright E2E
 * Loads from dist/renderer without needing Vite dev server
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU for CI/test environments
app.disableHardwareAcceleration();

let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'VidClaw',
    backgroundColor: '#030712',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load from built renderer
  const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
  console.log('[test] Loading renderer:', rendererPath, 'exists:', fs.existsSync(rendererPath));
  
  try {
    await mainWindow.loadFile(rendererPath);
    console.log('[test] Renderer loaded successfully');
  } catch (err) {
    console.error('[test] Renderer load failed:', err.message);
    mainWindow.loadURL(`data:text/html,
      <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
        <div style="text-align:center"><h2>Load Failed</h2><p>${err.message}</p></div>
      </body></html>
    `);
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Stub IPC handlers for settings/getStatus that the app calls on init
ipcMain.handle('get-settings', () => ({
  downloadDir: '',
  autoDownload: false,
  apiKey: '',
  model: 'xiaomi/mimo-v2-pro',
}));
ipcMain.handle('save-settings', (_, settings) => ({ success: true, settings }));
ipcMain.handle('get-status', () => ({
  browserReady: false,
  isLoggedIn: null,
  version: '0.1.0',
  resultsCount: 0,
  queueStatus: null,
}));
ipcMain.handle('select-download-dir', () => ({ dir: '' }));
ipcMain.handle('select-files', () => ({ files: [] }));
// Stub all other handlers to prevent errors
const stubs = [
  'launch-browser', 'check-login', 'click-login', 'relaunch-browser',
  'open-jimeng', 'submit-task', 'submit-task-with-files', 'prepare-task',
  'execute-task', 'prepare-task-for-seedance', 'prepare-batch-tasks',
  'download-task', 'download-all', 'get-results', 'enqueue-task',
  'process-queue', 'get-queue-status', 'open-download-dir', 'open-file',
  'navigate-to-generate', 'switch-to-seedance-mode', 'select-model',
  'set-duration', 'set-aspect-ratio', 'upload-materials', 'submit-structured',
  'run-structured-task', 'get-models', 'init-mode', 'create-batch',
  'start-batch', 'stop-batch', 'get-batch-status', 'update-batch-task',
  'delete-batch-task', 'send-task-notify',
];
stubs.forEach(ch => {
  try {
    ipcMain.handle(ch, () => ({ success: true }));
  } catch {}
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
