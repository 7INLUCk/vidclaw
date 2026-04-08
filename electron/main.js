const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// 即梦 CLI 路径
const DREAMINA_BIN = path.join(process.env.HOME, '.local', 'bin', 'dreamina');

// CLI 调用辅助函数
async function callDreamina(args, timeout = 30000) {
  try {
    const { stdout, stderr } = await execFileAsync(DREAMINA_BIN, args, { timeout });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const msg = err.stderr || err.message || '';
    return { success: false, error: msg, code: err.code };
  }
}

// JSON 解析辅助
function parseCliJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

// 🔴 禁用 GPU 加速（解决 macOS 黑屏问题）
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow = null;
let aiService = null;

const isDev = !app.isPackaged;

// ===== 热重载配置（开发模式下自动重载主进程代码）=====
if (isDev) {
  try {
    require('electron-reload')(
      [
        path.join(__dirname, 'main.js'),
        path.join(__dirname, 'services'),
        path.join(__dirname, '../dist/renderer'),
      ],
      {
        electron: require.resolve('electron'),
        hardResetMethod: 'exit',
        awaitWriteFinish: true,
      }
    );
    console.log('[热重载] ✅ 已启用主进程热重载');
  } catch (e) {
    console.warn('[热重载] ⚠️ 加载失败:', e.message);
  }
}

// ===== 用户设置持久化 =====
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return {
    downloadDir: path.join(app.getPath('downloads'), '即梦'),
    autoDownload: false,
    apiKey: 'sk-4b2f09aa14204571b1b33a5d97839a63',
    model: 'deepseek-chat',
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.warn('保存设置失败:', e.message);
  }
}

let settings = loadSettings();

// ===== 单实例锁定（开发模式下禁用，避免热重载冲突）=====
let gotTheLock = true;
if (!isDev) {
  gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('已有实例在运行，退出当前实例');
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

// ===== Vite 就绪检测 =====
function waitForVite(port, maxWait = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const req = http.get(`http://localhost:${port}`, () => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > maxWait) {
          console.log(`Vite 在 ${maxWait}ms 内未就绪`);
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    }
    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'VidClaw',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    const viteReady = await waitForVite(5173);
    if (viteReady) {
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadURL(`data:text/html,
        <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>⏳ 等待前端服务启动...</h2>
            <p style="color:#888">请先运行: npx vite</p>
          </div>
        </body></html>
      `);
    }
  } else {
    const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
    try {
      await mainWindow.loadFile(rendererPath);
    } catch (err) {
      mainWindow.loadURL(`data:text/html,
        <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>❌ 加载失败</h2>
            <p style="color:#888">${err.message}</p>
          </div>
        </body></html>
      `);
    }
  }

  mainWindow.webContents.openDevTools();
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ 页面加载完成');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== 推送事件到渲染进程 =====
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ===== Mac 原生通知 =====
function sendTaskNotification(task) {
  if (!Notification.isSupported()) return;
  const notif = new Notification({
    title: 'VidClaw',
    body: `✅ 「${(task.prompt || '').slice(0, 20)}」已生成完成`,
    silent: false,
  });
  notif.show();
}

// ===== AI 服务（DeepSeek 改写，保留） =====
const { AIService } = require('./services/ai');
function ensureAIService() {
  if (!aiService) {
    const apiKey = settings.apiKey || 'sk-4b2f09aa14204571b1b33a5d97839a63';
    const model = settings.model || 'deepseek-chat';
    aiService = new AIService(apiKey, model);
  }
  return aiService;
}

// ===== 任务状态轮询（后台定时器） =====
const pollingTasks = new Map(); // submit_id -> { timer, task }

function startPolling(submitId, task) {
  if (pollingTasks.has(submitId)) return;
  
  console.log(`[轮询] 开始轮询 submit_id=${submitId}`);
  
  const timer = setInterval(async () => {
    const result = await callDreamina(['query_result', '--submit_id=' + submitId], 30000);
    
    if (!result.success) {
      console.warn(`[轮询] 查询失败: ${result.error}`);
      return;
    }
    
    const data = parseCliJson(result.stdout);
    if (!data) {
      console.warn(`[轮询] JSON 解析失败: ${result.stdout.slice(0, 100)}`);
      return;
    }
    
    const status = data.gen_status || data.status || 'unknown';
    console.log(`[轮询] submit_id=${submitId} status=${status}`);
    
    sendToRenderer('task:progress', {
      event: 'progress',
      data: {
        submitId,
        status,
        progress: status === 'success' ? 100 : (status === 'failed' ? 0 : 50),
        message: status === 'generating' ? '生成中...' : (status === 'success' ? '已完成' : '失败'),
      },
    });
    
    // 完成或失败时停止轮询
    if (status === 'success' || status === 'failed') {
      stopPolling(submitId);
      
      if (status === 'success') {
        // 触发下载
        const downloadDir = task.downloadDir || settings.downloadDir;
        const downloadResult = await callDreamina([
          'query_result',
          '--submit_id=' + submitId,
          '--download_dir=' + downloadDir,
        ], 60000);
        
        if (downloadResult.success) {
          const downloadData = parseCliJson(downloadResult.stdout);
          const filePath = downloadData?.download_path || downloadData?.file_path || '';
          
          sendToRenderer('task:progress', {
            event: 'result',
            data: {
              submitId,
              prompt: task.prompt,
              status: 'completed',
              filePath,
              downloadDir,
            },
          });
          
          sendTaskNotification(task);
        } else {
          console.warn(`[下载] 失败: ${downloadResult.error}`);
        }
      } else {
        sendToRenderer('task:progress', {
          event: 'failed',
          data: { submitId, error: data.error || '生成失败' },
        });
      }
    }
  }, 5000); // 每 5 秒轮询一次
  
  pollingTasks.set(submitId, { timer, task });
}

function stopPolling(submitId) {
  const entry = pollingTasks.get(submitId);
  if (entry) {
    clearInterval(entry.timer);
    pollingTasks.delete(submitId);
    console.log(`[轮询] 停止轮询 submit_id=${submitId}`);
  }
}

// ===== IPC Handlers =====
function registerIpcHandlers() {

  // ---- 登录（CLI 方式）----
  ipcMain.handle('auth:login', async () => {
    console.log('[登录] 开始 headless 登录...');
    sendToRenderer('task:progress', { event: 'login-start', data: { message: '正在登录...' } });
    
    const result = await callDreamina(['login', '--headless'], 60000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      if (data && data.login_success) {
        console.log('[登录] ✅ 登录成功');
        sendToRenderer('task:progress', { event: 'login-success', data: { message: '登录成功' } });
        return { success: true };
      }
    }
    
    console.warn('[登录] ❌ 登录失败:', result.error || result.stdout);
    sendToRenderer('task:progress', { event: 'login-failed', data: { error: result.error || '登录失败' } });
    return { success: false, error: result.error || '登录失败' };
  });

  ipcMain.handle('auth:relogin', async () => {
    console.log('[登录] 开始重新登录...');
    const result = await callDreamina(['relogin', '--headless'], 60000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: data?.login_success || false };
    }
    return { success: false, error: result.error };
  });

  // ---- 积分查询（CLI 方式，已实现）----
  ipcMain.handle('account:credits', async () => {
    const result = await callDreamina(['user_credit'], 15000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      if (data) {
        return {
          success: true,
          data: {
            vipCredit: data.vip_credit || 0,
            giftCredit: data.gift_credit || 0,
            purchaseCredit: data.purchase_credit || 0,
            totalCredit: data.total_credit || 0,
          },
        };
      }
    }
    return { success: false, error: result.error || '积分查询失败' };
  });

  // ---- 新：两步任务提交 —— Step 1: AI 改写（不执行） ----
  ipcMain.handle('task:prepare', async (_event, input) => {
    console.log('[准备任务] 输入:', input?.slice?.(0, 80));

    try {
      const ai = ensureAIService();
      const task = await ai.rewritePrompt(input);
      console.log('[准备任务] AI 改写结果:', JSON.stringify(task).slice(0, 200));
      return { success: true, task };
    } catch (err) {
      console.error('[准备任务] 失败:', err.message);
      return {
        success: true,
        task: { prompt: input, duration: 5, aspectRatio: '16:9', type: 'video' },
      };
    }
  });

  // ---- Seedance 模式任务准备（带素材） ----
  ipcMain.handle('task:prepare-seedance', async (_event, { input, materials }) => {
    console.log('[Seedance准备] 输入:', input?.slice?.(0, 80));
    console.log('[Seedance准备] 素材:', materials ? `${materials.images?.length || 0}图 ${materials.videos?.length || 0}视频` : '无');

    try {
      const ai = ensureAIService();
      const task = await ai.rewritePromptForSeedance(input, materials);
      return { success: true, task, materials };
    } catch (err) {
      console.error('[Seedance准备] 失败:', err.message);
      return {
        success: true,
        task: { prompt: input, duration: 5, aspectRatio: '16:9' },
        materials,
      };
    }
  });

  // ---- 批量任务生成 ----
  ipcMain.handle('task:prepare-batch', async (_event, input) => {
    console.log('[批量准备] 输入:', input?.slice?.(0, 100));

    try {
      const ai = ensureAIService();
      const result = await ai.generateBatchTasks(input);
      return { success: true, ...result };
    } catch (err) {
      console.error('[批量准备] 失败:', err.message);
      return { 
        success: false, 
        error: err.message,
        questions: ['请告诉我这次批量测试的目标是什么？', '你想生成多少个视频？']
      };
    }
  });

  // ---- 任务执行（无素材，CLI text2video）----
  ipcMain.handle('task:execute', async (_event, task) => {
    console.log('[执行任务] 任务:', JSON.stringify(task).slice(0, 200));

    const prompt = task.prompt || '';
    const duration = task.duration || 5;
    const ratio = task.aspectRatio || task.ratio || '9:16';
    const model = task.model || 'seedance2.0fast';

    sendToRenderer('task:progress', { event: 'progress', data: { progressType: 'submitting', message: '正在提交任务...' } });

    const args = [
      'text2video',
      '--prompt=' + prompt,
      '--duration=' + duration,
      '--ratio=' + ratio,
      '--model_version=' + model,
    ];

    console.log('[CLI] 执行:', args.join(' '));
    const result = await callDreamina(args, 30000);

    if (!result.success) {
      console.error('[执行任务] CLI 失败:', result.error);
      return { success: false, error: result.error };
    }

    const data = parseCliJson(result.stdout);
    if (!data || !data.submit_id) {
      console.error('[执行任务] 无 submit_id:', result.stdout.slice(0, 200));
      return { success: false, error: 'CLI 未返回 submit_id' };
    }

    const submitId = data.submit_id;
    console.log('[执行任务] ✅ submit_id:', submitId);

    // 开始轮询
    startPolling(submitId, { prompt, downloadDir: settings.downloadDir });

    return {
      success: true,
      submitId,
      prompt,
      message: '任务已提交',
    };
  });

  // ---- 任务执行（有素材，CLI multimodal2video）----
  ipcMain.handle('task:execute-with-materials', async (_event, { task, materials }) => {
    console.log('[执行任务(有素材)] 任务:', JSON.stringify(task).slice(0, 100));
    console.log('[执行任务(有素材)] 素材:', materials?.length || 0, '个');

    const prompt = task.prompt || '';
    const duration = task.duration || 5;
    const ratio = task.aspectRatio || task.ratio || '9:16';
    const model = task.model || 'seedance2.0fast';

    sendToRenderer('task:progress', { event: 'progress', data: { progressType: 'submitting', message: '正在提交任务...' } });

    // 构造素材参数
    const args = ['multimodal2video', '--prompt=' + prompt, '--duration=' + duration, '--ratio=' + ratio, '--model_version=' + model];

    // 添加素材文件路径（image≤9, video≤3）
    if (materials && materials.length > 0) {
      const images = materials.filter(m => m.type === 'image').slice(0, 9);
      const videos = materials.filter(m => m.type === 'video').slice(0, 3);
      
      images.forEach(img => args.push('--image=' + img.path));
      videos.forEach(vid => args.push('--video=' + vid.path));
    }

    console.log('[CLI] 执行:', args.join(' '));
    const result = await callDreamina(args, 60000); // 有素材上传可能更慢

    if (!result.success) {
      console.error('[执行任务(有素材)] CLI 失败:', result.error);
      return { success: false, error: result.error };
    }

    const data = parseCliJson(result.stdout);
    if (!data || !data.submit_id) {
      console.error('[执行任务(有素材)] 无 submit_id:', result.stdout.slice(0, 200));
      return { success: false, error: 'CLI 未返回 submit_id' };
    }

    const submitId = data.submit_id;
    console.log('[执行任务(有素材)] ✅ submit_id:', submitId);

    // 开始轮询
    startPolling(submitId, { prompt, downloadDir: settings.downloadDir, materials });

    return {
      success: true,
      submitId,
      prompt,
      message: '任务已提交',
    };
  });

  // ---- 历史列表查询 ----
  ipcMain.handle('task:list', async (_event, { limit, status } = {}) => {
    const args = ['list_task'];
    if (limit) args.push('--limit=' + limit);
    if (status) args.push('--gen_status=' + status);

    const result = await callDreamina(args, 30000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: true, tasks: data?.tasks || data || [] };
    }
    return { success: false, error: result.error };
  });

  // ---- 单个任务状态查询 ----
  ipcMain.handle('task:query', async (_event, submitId) => {
    const result = await callDreamina(['query_result', '--submit_id=' + submitId], 30000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: true, data };
    }
    return { success: false, error: result.error };
  });

  // ---- 手动下载 ----
  ipcMain.handle('task:download', async (_event, { submitId, downloadDir }) => {
    const dir = downloadDir || settings.downloadDir;
    const result = await callDreamina(['query_result', '--submit_id=' + submitId, '--download_dir=' + dir], 60000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: true, filePath: data?.download_path || '', downloadDir: dir };
    }
    return { success: false, error: result.error };
  });

  // ---- 选择文件 ----
  ipcMain.handle('file:select', async () => {
    if (!mainWindow) return { files: [] };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择素材文件',
      filters: [
        { name: '所有支持格式', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'webm'] },
        { name: '仅图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: '仅视频', extensions: ['mp4', 'mov', 'avi', 'webm'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return { files: [] };
    return { files: result.filePaths };
  });

  // ---- 选择下载目录 ----
  ipcMain.handle('file:select-download-dir', async () => {
    if (!mainWindow) return { dir: '' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择下载目录',
      defaultPath: settings.downloadDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return { dir: '' };
    return { dir: result.filePaths[0] };
  });

  // ---- 设置管理 ----
  ipcMain.handle('settings:get', async () => {
    return { ...settings };
  });

  ipcMain.handle('settings:save', async (_event, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettings(settings);

    if (newSettings.apiKey !== undefined) {
      aiService = null;
    }

    return { success: true, settings: { ...settings } };
  });

  // ---- 应用状态 ----
  ipcMain.handle('app:status', async () => {
    return {
      version: app.getVersion(),
      downloadDir: settings.downloadDir,
      cliPath: DREAMINA_BIN,
      pollingTasks: pollingTasks.size,
    };
  });

  // ---- 打开下载目录 ----
  ipcMain.handle('app:open-download-dir', async () => {
    const dir = settings.downloadDir;
    if (fs.existsSync(dir)) {
      const { shell } = require('electron');
      await shell.openPath(dir);
      return { success: true };
    }
    return { success: false, error: '目录不存在' };
  });

  // ---- 打开单个文件 ----
  ipcMain.handle('app:open-file', async (_event, filePath) => {
    try {
      const { shell } = require('electron');
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
      }
      return { success: false, error: '文件不存在' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ---- 任务完成通知 ----
  ipcMain.handle('task:notify', async (_event, task) => {
    sendTaskNotification(task);
    return { success: true };
  });

  // ═══════════════════════════════════════════
  // 批量任务 API（改用 CLI）
  // ═══════════════════════════════════════════

  const { BatchTaskManager } = require('./services/batch-task-manager');
  let batchTaskManager = null;

  function ensureBatchTaskManager() {
    if (!batchTaskManager) {
      batchTaskManager = new BatchTaskManager(DREAMINA_BIN, settings.downloadDir);
      batchTaskManager.setOnCompleteCallback((summary) => {
        sendToRenderer('task:progress', {
          event: 'batch-complete',
          data: summary,
        });
      });
    }
    return batchTaskManager;
  }

  ipcMain.handle('batch:create', async (_event, { batch, tasks }) => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.createBatch(batch, tasks);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:start', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.start();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:stop', async () => {
    try {
      const manager = ensureBatchTaskManager();
      manager.stop();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:status', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return { success: true, ...manager.getStatus() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ===== 启动 =====
if (gotTheLock) {
  app.whenReady().then(async () => {
    registerIpcHandlers();
    await createWindow();
  });

  app.on('window-all-closed', async () => {
    // 停止所有轮询
    for (const [submitId, entry] of pollingTasks) {
      clearInterval(entry.timer);
    }
    pollingTasks.clear();
    
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}