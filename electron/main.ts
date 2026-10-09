import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { ModbusRtuService } from './modbusRtuService';
import { DatabaseService } from './databaseService';
import { RegisterMapLoader } from './registerMapLoader';

let mainWindow: BrowserWindow | null = null;
let modbusService: ModbusRtuService | null = null;
let dbService: DatabaseService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'JOMA Dual Channel Power Supply',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error('Failed to load dev URL, attempting fallback:', err);
      const prodPath = path.join(__dirname, '../../dist/index.html');
      const fallbackPath = path.join(__dirname, '../dist/index.html');
      if (fs.existsSync(prodPath)) {
        mainWindow?.loadFile(prodPath);
      } else if (fs.existsSync(fallbackPath)) {
        mainWindow?.loadFile(fallbackPath);
      }
    });
  } else {
    const prodPath = path.join(__dirname, '../../dist/index.html');
    const fallbackPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(prodPath)) {
      mainWindow.loadFile(prodPath);
    } else {
      mainWindow.loadFile(fallbackPath);
    }
  }


  // Safety Interlock: Window Close Prevention if Output is Active
  mainWindow.on('close', async (e) => {
    if (modbusService && modbusService.getOutputState()) {
      e.preventDefault();
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        buttons: ['Cancel Close', 'Force Stop Output & Exit'],
        defaultId: 0,
        cancelId: 0,
        title: 'Safety Interlock Warning',
        message: 'Power Supply output is currently active!',
        detail: 'Closing the application while outputs are energized may cause hardware damage or unsaved data loss. Do you want to safely disable output and exit?',
      });

      if (response === 1) {
        await modbusService.setOutputState(false);
        await modbusService.disconnect();
        mainWindow?.destroy();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  modbusService = new ModbusRtuService(() => mainWindow);
  dbService = new DatabaseService();

  // Serial Port & Connection Handlers
  ipcMain.handle('modbus:getPorts', async () => {
    return await modbusService!.getAvailablePorts();
  });

  ipcMain.handle('modbus:connect', async (_event, settings) => {
    console.log(`[IPC Main] modbus:connect received:`, JSON.stringify(settings));
    const result = await modbusService!.connect(settings);
    console.log(`[IPC Main] modbus:connect result:`, JSON.stringify(result));
    return result;
  });

  ipcMain.handle('modbus:disconnect', async () => {
    console.log(`[IPC Main] modbus:disconnect received`);
    return await modbusService!.disconnect();
  });

  // System & Diagnostics Logs Handlers
  ipcMain.handle('system:getLogs', async () => {
    return modbusService!.getRecentLogs();
  });

  ipcMain.handle('system:clearLogs', async () => {
    return modbusService!.clearLogs();
  });

  // Power Supply Hardware Control Handlers
  ipcMain.handle('modbus:setAppMode', async (_event, mode) => {
    console.log(`[IPC Main] modbus:setAppMode received: ${mode}`);
    return await modbusService!.setAppMode(mode);
  });

  ipcMain.handle('modbus:setMode', async (_event, mode) => {
    return await modbusService!.setMode(mode);
  });

  ipcMain.handle('modbus:setOutputState', async (_event, enabled) => {
    return await modbusService!.setOutputState(enabled);
  });

  ipcMain.handle('modbus:setSetpoints', async (_event, params) => {
    return await modbusService!.setSetpoints(params);
  });

  ipcMain.handle('modbus:setSingleSetpoints', async (_event, params) => {
    return await modbusService!.setSingleSetpoints(params);
  });

  ipcMain.handle('modbus:loadRegisterMapCsv', async (_event, csvContent) => {
    try {
      const regMap = RegisterMapLoader.parseCsv(csvContent);
      return { success: true, count: regMap.registers.size };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message };
    }
  });

  // SQLite Database Handlers
  ipcMain.handle('db:getSessions', async () => {
    return dbService!.getSessions();
  });

  ipcMain.handle('db:saveSession', async (_event, session) => {
    return dbService!.saveSession(session);
  });

  ipcMain.handle('db:exportSessionCsv', async (_event, sessionId, savePath) => {
    return dbService!.exportSessionCsv(sessionId, savePath);
  });

  ipcMain.handle('db:getRecipes', async () => {
    return dbService!.getRecipes();
  });

  ipcMain.handle('db:saveRecipe', async (_event, recipe) => {
    return dbService!.saveRecipe(recipe);
  });

  ipcMain.handle('db:deleteRecipe', async (_event, recipeId) => {
    return dbService!.deleteRecipe(recipeId);
  });

  // Automated Sequence Execution Engine Handlers
  ipcMain.handle('sequence:start', async (_event, { steps, totalCycles }) => {
    return await modbusService!.startSequence(steps, totalCycles);
  });

  ipcMain.handle('sequence:stop', async () => {
    return await modbusService!.stopSequence();
  });

  ipcMain.handle('sequence:getProgress', async () => {
    return modbusService!.getSequenceProgress();
  });

  // Reports & PDF Handling
  ipcMain.handle('reports:savePdf', async (_event, { fileName, dataBase64, metadata }) => {
    try {
      let reportsDir = path.join(app.getPath('documents'), 'JOMA_Reports');
      if (!fs.existsSync(reportsDir)) {
        try {
          fs.mkdirSync(reportsDir, { recursive: true });
        } catch (_) {
          reportsDir = app.getPath('downloads');
        }
      }

      const filePath = path.join(reportsDir, fileName);
      const buffer = Buffer.from(dataBase64, 'base64');
      fs.writeFileSync(filePath, buffer);

      const record = {
        id: metadata?.id || 'rep_' + Date.now(),
        fileName,
        filePath,
        timestamp: metadata?.timestamp || Date.now(),
        mode: metadata?.mode || 'ISOLATED',
        totalSamples: metadata?.totalSamples || 0,
        durationSeconds: metadata?.durationSeconds || 0,
        loggingIntervalMs: metadata?.loggingIntervalMs || 1000,
        vMax: metadata?.vMax || 60,
        iMax: metadata?.iMax || 10,
      };

      dbService!.saveReport(record);
      return { success: true, filePath, record };
    } catch (err: any) {
      console.error('Failed to save PDF report:', err);
      return { success: false, error: err?.message || 'Failed to save PDF report' };
    }
  });

  ipcMain.handle('reports:getReports', async () => {
    return dbService!.getReports();
  });

  ipcMain.handle('reports:openPdf', async (_event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
      }
      return { success: false, error: 'File does not exist: ' + filePath };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('reports:showInFolder', async (_event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        shell.openPath(dir);
        return { success: true };
      }
      return { success: false, error: 'Path not found' };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('reports:deleteReport', async (_event, id) => {
    try {
      const reports = dbService!.getReports();
      const target = reports.find((r) => r.id === id);
      if (target && fs.existsSync(target.filePath)) {
        try { fs.unlinkSync(target.filePath); } catch (_) {}
      }
      return dbService!.deleteReport(id);
    } catch (err: any) {
      return false;
    }
  });

  ipcMain.handle('settings:get', async (_event, key) => {
    return dbService!.getSetting(key);
  });

  ipcMain.handle('settings:set', async (_event, key, val) => {
    dbService!.setSetting(key, val);
    return true;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
