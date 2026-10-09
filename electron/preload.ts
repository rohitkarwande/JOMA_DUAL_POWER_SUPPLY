import { contextBridge, ipcRenderer } from 'electron';
import { SerialSettings, OperatingMode, TestSessionRecord, SequenceRecipe, SequenceStep } from '../src/types/powerSupply';

contextBridge.exposeInMainWorld('electronAPI', {
  // Serial Connection Controls
  getSerialPorts: () => ipcRenderer.invoke('modbus:getPorts'),
  connectSerial: (settings: SerialSettings) => ipcRenderer.invoke('modbus:connect', settings),
  disconnectSerial: () => ipcRenderer.invoke('modbus:disconnect'),

  // System & Modbus Logs
  getRecentLogs: () => ipcRenderer.invoke('system:getLogs'),
  clearLogs: () => ipcRenderer.invoke('system:clearLogs'),

  // Power Supply Commands & Application Mode
  setAppMode: (mode: any) => ipcRenderer.invoke('modbus:setAppMode', mode),
  setMode: (mode: OperatingMode) => ipcRenderer.invoke('modbus:setMode', mode),
  setOutputState: (enabled: boolean) => ipcRenderer.invoke('modbus:setOutputState', enabled),
  setSetpoints: (params: {
    ch1Vset?: number;
    ch1Iset?: number;
    ch2Vset?: number;
    ch2Iset?: number;
    masterVset?: number;
    masterIset?: number;
  }) => ipcRenderer.invoke('modbus:setSetpoints', params),
  setSingleSetpoints: (params: { vSet?: number; iSet?: number }) => ipcRenderer.invoke('modbus:setSingleSetpoints', params),

  // Register Map CSV
  loadRegisterMapCsv: (csvContent: string) => ipcRenderer.invoke('modbus:loadRegisterMapCsv', csvContent),

  // Event Listeners (Push Telemetry & Status)
  onTelemetry: (callback: (telemetry: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('modbus:telemetry', subscription);
    return () => {
      ipcRenderer.removeListener('modbus:telemetry', subscription);
    };
  },
  onSingleTelemetry: (callback: (telemetry: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('modbus:singleTelemetry', subscription);
    return () => {
      ipcRenderer.removeListener('modbus:singleTelemetry', subscription);
    };
  },
  onStatusChange: (callback: (status: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('modbus:statusChange', subscription);
    return () => {
      ipcRenderer.removeListener('modbus:statusChange', subscription);
    };
  },
  // Sequence Execution Controls
  startSequence: (steps: SequenceStep[], totalCycles: number) =>
    ipcRenderer.invoke('sequence:start', { steps, totalCycles }),
  stopSequence: () => ipcRenderer.invoke('sequence:stop'),
  getSequenceProgress: () => ipcRenderer.invoke('sequence:getProgress'),

  onSequenceProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('sequence:progress', subscription);
    return () => {
      ipcRenderer.removeListener('sequence:progress', subscription);
    };
  },
  onSystemLog: (callback: (log: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('system:log', subscription);
    return () => {
      ipcRenderer.removeListener('system:log', subscription);
    };
  },

  // Database API
  db: {
    getSessions: () => ipcRenderer.invoke('db:getSessions'),
    saveSession: (session: Omit<TestSessionRecord, 'id'>) => ipcRenderer.invoke('db:saveSession', session),
    exportSessionCsv: (sessionId: string, savePath?: string) => ipcRenderer.invoke('db:exportSessionCsv', sessionId, savePath),
    getRecipes: () => ipcRenderer.invoke('db:getRecipes'),
    saveRecipe: (recipe: Omit<SequenceRecipe, 'id'>) => ipcRenderer.invoke('db:saveRecipe', recipe),
    deleteRecipe: (recipeId: string) => ipcRenderer.invoke('db:deleteRecipe', recipeId),
  },

  // Reports API
  reports: {
    savePdf: (params: { fileName: string; dataBase64: string; metadata: any }) =>
      ipcRenderer.invoke('reports:savePdf', params),
    getReports: () => ipcRenderer.invoke('reports:getReports'),
    openPdf: (filePath: string) => ipcRenderer.invoke('reports:openPdf', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('reports:showInFolder', filePath),
    deleteReport: (id: string) => ipcRenderer.invoke('reports:deleteReport', id),
  },

  // Persistent Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
});
