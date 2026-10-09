import { DualPSTelemetry, SinglePSTelemetry, AppMode, OperatingMode, SerialSettings, SequenceRecipe, TestSessionRecord, SystemLogEntry } from './powerSupply';

export interface ElectronAPI {
  // Connection & Serial Management
  getSerialPorts: () => Promise<string[]>;
  connectSerial: (settings: SerialSettings) => Promise<{ success: boolean; error?: string }>;
  disconnectSerial: () => Promise<boolean>;

  // System & Modbus Logs
  getRecentLogs: () => Promise<SystemLogEntry[]>;
  clearLogs: () => Promise<boolean>;

  // Power Supply Commands & Application Mode
  setAppMode: (mode: AppMode) => Promise<{ success: boolean; error?: string }>;
  setMode: (mode: OperatingMode) => Promise<boolean>;
  setOutputState: (enabled: boolean) => Promise<boolean>;
  setSetpoints: (params: {
    ch1Vset?: number;
    ch1Iset?: number;
    ch2Vset?: number;
    ch2Iset?: number;
    masterVset?: number;
    masterIset?: number;
  }) => Promise<boolean>;
  setSingleSetpoints: (params: { vSet?: number; iSet?: number }) => Promise<boolean>;

  // Register Map Loader
  loadRegisterMapCsv: (csvContent: string) => Promise<{ success: boolean; count: number; error?: string }>;

  // Automated Sequence Execution
  startSequence: (steps: any[], totalCycles: number) => Promise<{ success: boolean; error?: string }>;
  stopSequence: () => Promise<boolean>;
  getSequenceProgress: () => Promise<any>;

  // Streaming Telemetry & Event Listeners
  onTelemetry: (callback: (telemetry: DualPSTelemetry) => void) => () => void;
  onSingleTelemetry: (callback: (telemetry: SinglePSTelemetry) => void) => () => void;
  onStatusChange: (callback: (status: { connected: boolean; port?: string; error?: string; isSimulator?: boolean }) => void) => () => void;
  onSequenceProgress: (callback: (progress: any) => void) => () => void;
  onSystemLog: (callback: (log: SystemLogEntry) => void) => () => void;

  // Database API
  db: {
    getSessions: () => Promise<TestSessionRecord[]>;
    saveSession: (session: Omit<TestSessionRecord, 'id'>) => Promise<string>;
    exportSessionCsv: (sessionId: string, savePath?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    getRecipes: () => Promise<SequenceRecipe[]>;
    saveRecipe: (recipe: Omit<SequenceRecipe, 'id'>) => Promise<string>;
    deleteRecipe: (recipeId: string) => Promise<boolean>;
  };

  // Reports API
  reports: {
    savePdf: (params: { fileName: string; dataBase64: string; metadata: any }) => Promise<{ success: boolean; filePath?: string; record?: any; error?: string }>;
    getReports: () => Promise<any[]>;
    openPdf: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    deleteReport: (id: string) => Promise<boolean>;
  };

  // Settings API
  settings: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
