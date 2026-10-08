export type OperatingMode = 'ISOLATED' | 'SERIES' | 'PARALLEL';

export type OutputState = 'OFF' | 'ON' | 'FAULT';

export interface ChannelData {
  voltageActual: number;   // Vmon
  currentActual: number;   // Imon
  voltageSetpoint: number; // Vset
  currentSetpoint: number; // Iset
  powerActual: number;     // calculated V * I
  outputEnabled: boolean;
}

export interface DualPSTelemetry {
  timestamp: number;
  mode: OperatingMode;
  outputState: OutputState;
  ch1: ChannelData;
  ch2: ChannelData;
  totalVoltage: number;    // In Series: V1 + V2; In Isolated: V1 (or N/A)
  totalCurrent: number;    // In Parallel: I1 + I2; In Isolated: I1 (or N/A)
  masterVoltageSetpoint: number; // For Parallel mode
  masterCurrentSetpoint: number; // For Series mode
  alarms: {
    ch1OverVoltage: boolean;
    ch1OverCurrent: boolean;
    ch2OverVoltage: boolean;
    ch2OverCurrent: boolean;
    commFault: boolean;
    emergencyStop: boolean;
  };
  isStale?: boolean;
  maxVoltage?: number; // V_max hardware register limit
  maxCurrent?: number; // I_max hardware register limit
}

export interface SerialSettings {
  port: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  slaveId: number;
  pollingIntervalMs: number;
  autoReconnect: boolean;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  durationSeconds: number;
  mode: OperatingMode;
  ch1Vset: number;
  ch1Iset: number;
  ch2Vset: number;
  ch2Iset: number;
  masterVset?: number;
  masterIset?: number;
}

export interface SequenceRecipe {
  id: string;
  name: string;
  description: string;
  cycles: number;
  steps: SequenceStep[];
}

export interface TestSessionRecord {
  id: string;
  startTime: string;
  endTime?: string;
  recipeName?: string;
  initialMode: OperatingMode;
  totalSamples: number;
  status: 'COMPLETED' | 'STOPPED' | 'FAULT';
}
