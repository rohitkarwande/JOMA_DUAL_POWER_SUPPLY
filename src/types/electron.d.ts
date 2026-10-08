import { DualPSTelemetry, OperatingMode, SerialSettings, SequenceRecipe, TestSessionRecord } from './powerSupply';

export interface ElectronAPI {
  // Connection & Serial Management
  getSerialPorts: () => Promise<string[]>;
  connectSerial: (settings: SerialSettings) => Promise<{ success: boolean; error?: string }>;
  disconnectSerial: () => Promise<boolean>;

  // Power Supply Commands
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

  // Register Map Loader
  loadRegisterMapCsv: (csvContent: string) => Promise<{ success: boolean; count: number; error?: string }>;

  // Automated Sequence Execution
  startSequence: (steps: any[], totalCycles: number) => Promise<{ success: boolean; error?: string }>;
  stopSequence: () => Promise<boolean>;
  getSequenceProgress: () => Promise<any>;

  // Streaming Telemetry & Event Listeners
  onTelemetry: (callback: (telemetry: DualPSTelemetry) => void) => () => void;
  onStatusChange: (callback: (status: { connected: boolean; port?: string; error?: string }) => void) => () => void;
  onSequenceProgress: (callback: (progress: any) => void) => () => void;

  // Database API
  db: {
    getSessions: () => Promise<TestSessionRecord[]>;
    saveSession: (session: Omit<TestSessionRecord, 'id'>) => Promise<string>;
    exportSessionCsv: (sessionId: string, savePath?: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    getRecipes: () => Promise<SequenceRecipe[]>;
    saveRecipe: (recipe: Omit<SequenceRecipe, 'id'>) => Promise<string>;
    deleteRecipe: (recipeId: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
