import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { TestSessionRecord, SequenceRecipe, DualPSTelemetry } from '../src/types/powerSupply';

interface TelemetryLogEntry {
  id: number;
  sessionId: string;
  timestamp: number;
  mode: string;
  ch1_v: number;
  ch1_i: number;
  ch2_v: number;
  ch2_i: number;
  total_v: number;
  total_i: number;
  output_state: string;
}

export interface ReportRecord {
  id: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  mode: string;
  totalSamples: number;
  durationSeconds: number;
  loggingIntervalMs: number;
  vMax: number;
  iMax: number;
}

interface DatabaseSchema {
  sessions: TestSessionRecord[];
  telemetryLogs: TelemetryLogEntry[];
  recipes: SequenceRecipe[];
  reports: ReportRecord[];
  settings: Record<string, string>;
  telemetryCounter: number;
}

export class DatabaseService {
  private dbPath: string;
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.dbPath = path.join(userDataPath, 'joma_scada_store.json');
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          sessions: parsed.sessions || [],
          telemetryLogs: parsed.telemetryLogs || [],
          recipes: parsed.recipes || [],
          reports: parsed.reports || [],
          settings: parsed.settings || {},
          telemetryCounter: parsed.telemetryCounter || 1,
        };
      }
    } catch (err) {
      console.error('Error reading database file, initializing default store:', err);
    }
    return {
      sessions: [],
      telemetryLogs: [],
      recipes: [],
      reports: [],
      settings: {},
      telemetryCounter: 1,
    };
  }

  private persistAsync() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
      this.saveTimeout = null;
    }, 200);
  }

  private saveSync() {
    try {
      const tempPath = this.dbPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('Error persisting database file:', err);
    }
  }

  public getSessions(): TestSessionRecord[] {
    return [...this.data.sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 100);
  }

  public saveSession(session: Omit<TestSessionRecord, 'id'>): string {
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const record: TestSessionRecord = {
      id,
      startTime: session.startTime,
      endTime: session.endTime || undefined,
      recipeName: session.recipeName || undefined,
      initialMode: session.initialMode,
      totalSamples: session.totalSamples || 0,
      status: session.status,
    };
    this.data.sessions.unshift(record);
    this.saveSync();
    return id;
  }

  public logTelemetry(sessionId: string, telemetry: DualPSTelemetry) {
    const entry: TelemetryLogEntry = {
      id: this.data.telemetryCounter++,
      sessionId,
      timestamp: telemetry.timestamp,
      mode: telemetry.mode,
      ch1_v: telemetry.ch1.voltageActual,
      ch1_i: telemetry.ch1.currentActual,
      ch2_v: telemetry.ch2.voltageActual,
      ch2_i: telemetry.ch2.currentActual,
      total_v: telemetry.totalVoltage,
      total_i: telemetry.totalCurrent,
      output_state: telemetry.outputState,
    };
    this.data.telemetryLogs.push(entry);

    // Keep session sample count updated
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.totalSamples = (session.totalSamples || 0) + 1;
    }

    this.persistAsync();
  }

  public exportSessionCsv(sessionId: string, targetPath?: string): { success: boolean; filePath?: string; error?: string } {
    try {
      const logs = this.data.telemetryLogs
        .filter((l) => l.sessionId === sessionId)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (logs.length === 0) {
        return { success: false, error: 'No telemetry logs found for this session.' };
      }

      let csv = 'Timestamp,DateTime,Mode,CH1_Voltage(V),CH1_Current(A),CH2_Voltage(V),CH2_Current(A),Total_Voltage(V),Total_Current(A),Output_State\n';
      for (const row of logs) {
        const dateStr = new Date(row.timestamp).toISOString();
        csv += `${row.timestamp},${dateStr},${row.mode},${row.ch1_v},${row.ch1_i},${row.ch2_v},${row.ch2_i},${row.total_v},${row.total_i},${row.output_state}\n`;
      }

      const filePath = targetPath || path.join(app.getPath('downloads'), `Session_${sessionId}_export.csv`);
      fs.writeFileSync(filePath, csv, 'utf-8');

      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || 'CSV Export failed' };
    }
  }

  public getRecipes(): SequenceRecipe[] {
    return [...this.data.recipes].sort((a, b) => a.name.localeCompare(b.name));
  }

  public saveRecipe(recipe: Omit<SequenceRecipe, 'id'>): string {
    const id = 'recipe_' + Date.now();
    const newRecipe: SequenceRecipe = {
      id,
      name: recipe.name,
      description: recipe.description || '',
      cycles: recipe.cycles,
      steps: recipe.steps,
    };
    const index = this.data.recipes.findIndex((r) => r.name === recipe.name);
    if (index >= 0) {
      this.data.recipes[index] = newRecipe;
    } else {
      this.data.recipes.push(newRecipe);
    }
    this.saveSync();
    return id;
  }

  public deleteRecipe(recipeId: string): boolean {
    this.data.recipes = this.data.recipes.filter((r) => r.id !== recipeId);
    this.saveSync();
    return true;
  }

  public saveReport(report: ReportRecord): void {
    const existingIdx = this.data.reports.findIndex((r) => r.id === report.id);
    if (existingIdx >= 0) {
      this.data.reports[existingIdx] = report;
    } else {
      this.data.reports.unshift(report);
    }
    this.saveSync();
  }

  public getReports(): ReportRecord[] {
    return [...(this.data.reports || [])].sort((a, b) => b.timestamp - a.timestamp);
  }

  public deleteReport(reportId: string): boolean {
    this.data.reports = (this.data.reports || []).filter((r) => r.id !== reportId);
    this.saveSync();
    return true;
  }

  public getSetting(key: string, defaultValue?: string): string | undefined {
    return this.data.settings?.[key] ?? defaultValue;
  }

  public setSetting(key: string, value: string): void {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings[key] = value;
    this.saveSync();
  }
}
