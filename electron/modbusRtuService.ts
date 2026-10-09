import ModbusRTU from 'modbus-serial';
import { BrowserWindow } from 'electron';
import { SerialSettings, OperatingMode, AppMode, DualPSTelemetry, SinglePSTelemetry, SequenceStep } from '../src/types/powerSupply';

export interface SequenceProgress {
  status: 'IDLE' | 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR' | 'COMPLETED';
  currentCycle: number;
  totalCycles: number;
  currentStepIndex: number;
  totalSteps: number;
  stepRemainingSeconds: number;
  activeStep: SequenceStep | null;
  errorMsg?: string;
  writeStartTime?: number;
  writeCompletionTime?: number;
  stepStartTime?: number;
  stepDeadlineTime?: number;
}

// Single-Threaded Mutex Queue for RS485 Half-Duplex Traffic
class SerialBusLock {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  public clearQueue() {
    this.queue = [];
  }

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (_) {}
        // Inter-frame delay between Modbus packets
        await new Promise((res) => setTimeout(res, 20));
      }
    }
    this.isProcessing = false;
  }
}

export class ModbusRtuService {
  private client: ModbusRTU;
  private busLock = new SerialBusLock();
  private isConnected = false;
  private settings: SerialSettings = {
    port: 'COM1',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    slaveId: 1,
    pollingIntervalMs: 500,
    autoReconnect: true,
  };

  private appMode: AppMode = 'DUAL_PS';
  private activeMode: OperatingMode = 'ISOLATED';
  private isOutputEnabled = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private windowGetter: () => BrowserWindow | null;

  // Session & Polling Queue Guards
  private sessionId = 0;
  private isPollInFlight = false;

  // Sequence Runner Engine State
  private sequenceStatus: 'IDLE' | 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR' | 'COMPLETED' = 'IDLE';
  private sequenceSteps: SequenceStep[] = [];
  private sequenceTotalCycles = 1;
  private sequenceCurrentCycle = 1;
  private sequenceCurrentStepIdx = 0;
  private sequenceStepDeadlineTimer: NodeJS.Timeout | null = null;
  private sequenceUiTimer: NodeJS.Timeout | null = null;
  private sequenceStepStartTime = 0;
  private sequenceStepDeadlineTime = 0;

  // Cached Dual PS Telemetry State
  private lastTelemetry: DualPSTelemetry = {
    timestamp: Date.now(),
    mode: 'ISOLATED',
    outputState: 'OFF',
    ch1: { voltageActual: 0, currentActual: 0, voltageSetpoint: 0, currentSetpoint: 0, powerActual: 0, outputEnabled: false },
    ch2: { voltageActual: 0, currentActual: 0, voltageSetpoint: 0, currentSetpoint: 0, powerActual: 0, outputEnabled: false },
    totalVoltage: 0,
    totalCurrent: 0,
    masterVoltageSetpoint: 0,
    masterCurrentSetpoint: 0,
    alarms: {
      ch1OverVoltage: false,
      ch1OverCurrent: false,
      ch2OverVoltage: false,
      ch2OverCurrent: false,
      commFault: false,
      emergencyStop: false,
    },
  };

  // Cached Single PS Telemetry State
  private lastSingleTelemetry: SinglePSTelemetry = {
    timestamp: Date.now(),
    outputState: 'OFF',
    vMon: 0,
    iMon: 0,
    vSet: 0,
    iSet: 0,
    powerActual: 0,
    alarms: {
      commFault: false,
      emergencyStop: false,
    },
    maxVoltage: 60.0,
    maxCurrent: 10.0,
  };

  constructor(windowGetter: () => BrowserWindow | null) {
    this.client = new ModbusRTU();
    this.windowGetter = windowGetter;
  }

  public async getAvailablePorts(): Promise<string[]> {
    try {
      const ports = await ModbusRTU.getPorts();
      return ports.map((p) => p.path);
    } catch (err) {
      console.error('Error listing serial ports:', err);
      return [];
    }
  }

  public async connect(settings: SerialSettings): Promise<{ success: boolean; error?: string }> {
    this.settings = { ...settings };
    try {
      if (this.isConnected) {
        await this.disconnect();
      }

      // Invalidate old session ID & clear queued tasks from previous session
      this.sessionId++;
      this.busLock.clearQueue();
      this.isPollInFlight = false;

      await this.client.connectRTUBuffered(this.settings.port, {
        baudRate: this.settings.baudRate,
        dataBits: this.settings.dataBits,
        stopBits: this.settings.stopBits,
        parity: this.settings.parity,
      });

      this.client.setID(this.settings.slaveId);
      this.client.setTimeout(1000);
      this.isConnected = true;
      this.consecutiveErrors = 0;

      this.notifyStatus(true);
      await this.pollTelemetry();
      this.startPolling();

      return { success: true };
    } catch (err: any) {
      this.isConnected = false;
      this.notifyStatus(false, err?.message || 'Failed to open serial port');
      return { success: false, error: err?.message || 'Connection failed' };
    }
  }

  public async disconnect(): Promise<boolean> {
    this.stopPolling();
    this.stopSequence();
    this.sessionId++;
    this.busLock.clearQueue();
    this.isPollInFlight = false;
    this.isConnected = false;
    try {
      if (this.client.isOpen) {
        await this.client.close(() => {});
      }
    } catch (_) {}
    this.notifyStatus(false);
    return true;
  }

  public async setAppMode(mode: AppMode): Promise<{ success: boolean; error?: string }> {
    if (this.isOutputEnabled) {
      return {
        success: false,
        error: 'Safety Interlock: Cannot switch application mode while hardware output is ON. Please turn output OFF first.',
      };
    }
    this.stopSequence();
    this.sessionId++;
    this.busLock.clearQueue();
    this.isPollInFlight = false;
    this.appMode = mode;
    console.log(`[App Mode Switch] Active Application Mode changed to: ${mode}`);
    if (this.isConnected) {
      this.pollTelemetry();
    }
    return { success: true };
  }

  public getAppMode(): AppMode {
    return this.appMode;
  }

  // NOTE: Mode is read-only from HMI register 4X 29 (POP_WINDOW) per specification
  public async setMode(mode: OperatingMode): Promise<boolean> {
    this.activeMode = mode;
    this.lastTelemetry.mode = mode;
    return true;
  }

  public async setOutputState(enabled: boolean): Promise<boolean> {
    this.isOutputEnabled = enabled;
    this.lastTelemetry.outputState = enabled ? 'ON' : 'OFF';
    this.lastTelemetry.ch1.outputEnabled = enabled;
    this.lastTelemetry.ch2.outputEnabled = enabled;
    this.lastSingleTelemetry.outputState = enabled ? 'ON' : 'OFF';

    if (!this.isConnected) return true;
    const currentSession = this.sessionId;

    return this.busLock.runExclusive(async () => {
      if (!this.isConnected || this.sessionId !== currentSession) {
        return false;
      }
      try {
        // Coil START_STOP: Address 0X 1 (PDU Wire Address 0)
        await this.client.writeCoil(0, enabled);
        return true;
      } catch (err) {
        console.error('Failed to write START_STOP Coil:', err);
        return false;
      }
    });
  }

  public async setSetpoints(params: {
    ch1Vset?: number;
    ch1Iset?: number;
    ch2Vset?: number;
    ch2Iset?: number;
    masterVset?: number;
    masterIset?: number;
  }): Promise<boolean> {
    const vMax = this.lastTelemetry.maxVoltage || 60.0;
    const iMax = this.lastTelemetry.maxCurrent || 10.0;

    if (
      (params.ch1Vset !== undefined && params.ch1Vset > vMax) ||
      (params.ch2Vset !== undefined && params.ch2Vset > vMax) ||
      (params.masterVset !== undefined && params.masterVset > vMax) ||
      (params.ch1Iset !== undefined && params.ch1Iset > iMax) ||
      (params.ch2Iset !== undefined && params.ch2Iset > iMax) ||
      (params.masterIset !== undefined && params.masterIset > iMax)
    ) {
      console.error(`[Safety Interlock] Setpoint write rejected: Exceeds V_max (${vMax}V) or I_max (${iMax}A)`);
      return false;
    }

    if (params.ch1Vset !== undefined) this.lastTelemetry.ch1.voltageSetpoint = params.ch1Vset;
    if (params.ch1Iset !== undefined) this.lastTelemetry.ch1.currentSetpoint = params.ch1Iset;
    if (params.ch2Vset !== undefined) this.lastTelemetry.ch2.voltageSetpoint = params.ch2Vset;
    if (params.ch2Iset !== undefined) this.lastTelemetry.ch2.currentSetpoint = params.ch2Iset;
    if (params.masterVset !== undefined) this.lastTelemetry.masterVoltageSetpoint = params.masterVset;
    if (params.masterIset !== undefined) this.lastTelemetry.masterCurrentSetpoint = params.masterIset;

    if (!this.isConnected) return true;
    const currentSession = this.sessionId;

    return this.busLock.runExclusive(async () => {
      if (!this.isConnected || this.sessionId !== currentSession) {
        return false;
      }
      try {
        // MainAddress Base-1 -> PDU Wire Address = MainAddress - 1
        // V_SET_ID1: Reg 9 (PDU 8)
        if (params.ch1Vset !== undefined) {
          await this.writeFloat32(8, params.ch1Vset);
        }
        // I_SET_ID1: Reg 11 (PDU 10)
        if (params.ch1Iset !== undefined) {
          await this.writeFloat32(10, params.ch1Iset);
        }
        // V_SET_ID2: Reg 13 (PDU 12)
        if (params.ch2Vset !== undefined) {
          await this.writeFloat32(12, params.ch2Vset);
        }
        // I_SET_ID2: Reg 15 (PDU 14)
        if (params.ch2Iset !== undefined) {
          await this.writeFloat32(14, params.ch2Iset);
        }
        // PAR_VOLT_SET: Reg 21 (PDU 20)
        if (params.masterVset !== undefined) {
          await this.writeFloat32(20, params.masterVset);
        }
        // SER_CUR_SET: Reg 27 (PDU 26)
        if (params.masterIset !== undefined) {
          await this.writeFloat32(26, params.masterIset);
        }
        return true;
      } catch (err) {
        console.error('Failed to write setpoints over Modbus:', err);
        return false;
      }
    });
  }

  public async setSingleSetpoints(params: { vSet?: number; iSet?: number }): Promise<boolean> {
    const vMax = this.lastSingleTelemetry.maxVoltage || 60.0;
    const iMax = this.lastSingleTelemetry.maxCurrent || 10.0;

    if (
      (params.vSet !== undefined && params.vSet > vMax) ||
      (params.iSet !== undefined && params.iSet > iMax)
    ) {
      console.error(`[Safety Interlock] Single PS Setpoint write rejected: Exceeds V_max (${vMax}V) or I_max (${iMax}A)`);
      return false;
    }

    if (params.vSet !== undefined) this.lastSingleTelemetry.vSet = params.vSet;
    if (params.iSet !== undefined) this.lastSingleTelemetry.iSet = params.iSet;

    if (!this.isConnected) return true;
    const currentSession = this.sessionId;

    return this.busLock.runExclusive(async () => {
      if (!this.isConnected || this.sessionId !== currentSession) {
        return false;
      }
      try {
        // Base-1 Reg 4X 1 -> PDU Wire Address 0 (Float32 LE)
        if (params.vSet !== undefined) {
          await this.writeFloat32(0, params.vSet);
        }
        // Base-1 Reg 4X 3 -> PDU Wire Address 2 (Float32 LE)
        if (params.iSet !== undefined) {
          await this.writeFloat32(2, params.iSet);
        }
        return true;
      } catch (err) {
        console.error('Failed to write Single PS setpoints over Modbus:', err);
        return false;
      }
    });
  }

  private startPolling() {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      this.pollTelemetry();
    }, this.settings.pollingIntervalMs);
  }

  private stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async pollTelemetry() {
    if (!this.isConnected || this.isPollInFlight) return;

    this.isPollInFlight = true;
    const currentSession = this.sessionId;

    if (this.appMode === 'SINGLE_PS') {
      await this.pollSingleTelemetry(currentSession);
      return;
    }

    await this.busLock.runExclusive(async () => {
      try {
        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        try {
          const coilRes = await this.client.readCoils(0, 1);
          if (coilRes && coilRes.data && coilRes.data.length > 0) {
            this.isOutputEnabled = Boolean(coilRes.data[0]);
          }
        } catch (_) {}

        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        const res = await this.client.readHoldingRegisters(0, 34);

        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        const buf = res.buffer;

        const ch1Vmon = buf.readFloatLE(0);
        const ch1Imon = buf.readFloatLE(4);
        const ch2Vmon = buf.readFloatLE(8);
        const ch2Imon = buf.readFloatLE(12);

        const ch1Vset = buf.readFloatLE(16);
        const ch1Iset = buf.readFloatLE(20);
        const ch2Vset = buf.readFloatLE(24);
        const ch2Iset = buf.readFloatLE(28);

        const parVoltMon = buf.readFloatLE(32);
        const parCurMon = buf.readFloatLE(36);
        const parVoltSet = buf.readFloatLE(40);
        const serVoltMon = buf.readFloatLE(44);
        const serCurMon = buf.readFloatLE(48);
        const serCurSet = buf.readFloatLE(52);

        // POP_WINDOW INT at Reg 29 (PDU offset 28 -> byte offset 56)
        const modeCode = buf.readUInt16BE(56);
        let parsedMode: OperatingMode = 'ISOLATED';
        if (modeCode === 12) parsedMode = 'PARALLEL';
        else if (modeCode === 13) parsedMode = 'SERIES';
        else parsedMode = 'ISOLATED';

        this.activeMode = parsedMode;

        // Calculate active total voltage and current based on parsed HMI mode
        let activeTotalV = ch1Vmon;
        let activeTotalI = ch1Imon;

        if (parsedMode === 'SERIES') {
          activeTotalV = serVoltMon > 0 ? serVoltMon : ch1Vmon + ch2Vmon;
          activeTotalI = serCurMon > 0 ? serCurMon : ch1Imon;
        } else if (parsedMode === 'PARALLEL') {
          activeTotalV = parVoltMon > 0 ? parVoltMon : ch1Vmon;
          activeTotalI = parCurMon > 0 ? parCurMon : ch1Imon + ch2Imon;
        }

        // Read V_MAX & I_MAX registers at Reg 30 (PDU 29 -> byte 58) & Reg 32 (PDU 31 -> byte 62)
        let vMax = 60.0;
        let iMax = 10.0;
        if (buf.length >= 66) {
          const parsedVmax = buf.readFloatLE(58);
          const parsedImax = buf.readFloatLE(62);
          if (!isNaN(parsedVmax) && parsedVmax > 0) vMax = Number(parsedVmax.toFixed(3));
          if (!isNaN(parsedImax) && parsedImax > 0) iMax = Number(parsedImax.toFixed(4));
        }

        this.lastTelemetry = {
          timestamp: Date.now(),
          mode: parsedMode,
          outputState: this.isOutputEnabled ? 'ON' : 'OFF',
          maxVoltage: vMax,
          maxCurrent: iMax,
          ch1: {
            voltageActual: Number(ch1Vmon.toFixed(3)),
            currentActual: Number(ch1Imon.toFixed(4)),
            voltageSetpoint: Number((!isNaN(ch1Vset) && ch1Vset >= 0 ? ch1Vset : this.lastTelemetry.ch1.voltageSetpoint).toFixed(3)),
            currentSetpoint: Number((!isNaN(ch1Iset) && ch1Iset >= 0 ? ch1Iset : this.lastTelemetry.ch1.currentSetpoint).toFixed(4)),
            powerActual: Number((ch1Vmon * ch1Imon).toFixed(2)),
            outputEnabled: this.isOutputEnabled,
          },
          ch2: {
            voltageActual: Number(ch2Vmon.toFixed(3)),
            currentActual: Number(ch2Imon.toFixed(4)),
            voltageSetpoint: Number((!isNaN(ch2Vset) && ch2Vset >= 0 ? ch2Vset : this.lastTelemetry.ch2.voltageSetpoint).toFixed(3)),
            currentSetpoint: Number((!isNaN(ch2Iset) && ch2Iset >= 0 ? ch2Iset : this.lastTelemetry.ch2.currentSetpoint).toFixed(4)),
            powerActual: Number((ch2Vmon * ch2Imon).toFixed(2)),
            outputEnabled: this.isOutputEnabled,
          },
          totalVoltage: Number(activeTotalV.toFixed(3)),
          totalCurrent: Number(activeTotalI.toFixed(4)),
          masterVoltageSetpoint: Number((!isNaN(parVoltSet) && parVoltSet >= 0 ? parVoltSet : this.lastTelemetry.masterVoltageSetpoint).toFixed(3)),
          masterCurrentSetpoint: Number((!isNaN(serCurSet) && serCurSet >= 0 ? serCurSet : this.lastTelemetry.masterCurrentSetpoint).toFixed(4)),
          alarms: {
            ch1OverVoltage: false,
            ch1OverCurrent: false,
            ch2OverVoltage: false,
            ch2OverCurrent: false,
            commFault: false,
            emergencyStop: false,
          },
          isStale: false,
        };

        this.consecutiveErrors = 0;
        this.emitTelemetry(this.lastTelemetry);
      } catch (err) {
        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 3) {
          this.lastTelemetry.alarms.commFault = true;
          this.lastTelemetry.isStale = true;
          this.emitTelemetry(this.lastTelemetry);
          this.notifyStatus(false, 'Communication timeout / hardware error');
        }
      } finally {
        this.isPollInFlight = false;
      }
    });
  }

  private async pollSingleTelemetry(currentSession: number) {
    await this.busLock.runExclusive(async () => {
      try {
        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        try {
          const coilRes = await this.client.readCoils(0, 1);
          if (coilRes && coilRes.data && coilRes.data.length > 0) {
            this.isOutputEnabled = Boolean(coilRes.data[0]);
          }
        } catch (_) {}

        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        // Single Power Supply CSV Mapping:
        // Reg 4X 1 (PDU 0, 2 words FloatLE): V SET
        // Reg 4X 3 (PDU 2, 2 words FloatLE): I SET
        // Reg 4X 5 (PDU 4, 2 words FloatLE): V MON
        // Reg 4X 7 (PDU 6, 2 words FloatLE): I MON
        const res = await this.client.readHoldingRegisters(0, 8);

        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }

        const buf = res.buffer;
        const vSet = buf.readFloatLE(0);
        const iSet = buf.readFloatLE(4);
        const vMon = buf.readFloatLE(8);
        const iMon = buf.readFloatLE(12);

        const vMonVal = !isNaN(vMon) ? Math.max(0, Number(vMon.toFixed(3))) : 0;
        const iMonVal = !isNaN(iMon) ? Math.max(0, Number(iMon.toFixed(4))) : 0;
        const vSetVal = !isNaN(vSet) && vSet >= 0 ? Number(vSet.toFixed(3)) : this.lastSingleTelemetry.vSet;
        const iSetVal = !isNaN(iSet) && iSet >= 0 ? Number(iSet.toFixed(4)) : this.lastSingleTelemetry.iSet;
        const powerVal = Number((vMonVal * iMonVal).toFixed(2));

        this.lastSingleTelemetry = {
          timestamp: Date.now(),
          outputState: this.isOutputEnabled ? 'ON' : 'OFF',
          vMon: vMonVal,
          iMon: iMonVal,
          vSet: vSetVal,
          iSet: iSetVal,
          powerActual: powerVal,
          alarms: {
            commFault: false,
            emergencyStop: false,
          },
          isStale: false,
          maxVoltage: 60.0,
          maxCurrent: 10.0,
        };

        this.consecutiveErrors = 0;
        this.emitSingleTelemetry(this.lastSingleTelemetry);
      } catch (err) {
        if (!this.isConnected || this.sessionId !== currentSession) {
          return;
        }
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= 3) {
          this.lastSingleTelemetry.alarms.commFault = true;
          this.lastSingleTelemetry.isStale = true;
          this.emitSingleTelemetry(this.lastSingleTelemetry);
          this.notifyStatus(false, 'Communication timeout / hardware error (Single PS)');
        }
      } finally {
        this.isPollInFlight = false;
      }
    });
  }

  private async writeFloat32(pduAddress: number, value: number) {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(value, 0);
    // Write 2 adjacent 16-bit registers (Little-Endian float representation)
    const word1 = buf.readUInt16BE(0);
    const word2 = buf.readUInt16BE(2);
    await this.client.writeRegisters(pduAddress, [word1, word2]);
  }

  private emitTelemetry(telemetry: DualPSTelemetry) {
    const win = this.windowGetter();
    if (win && !win.isDestroyed()) {
      win.webContents.send('modbus:telemetry', telemetry);
    }
  }

  private emitSingleTelemetry(telemetry: SinglePSTelemetry) {
    const win = this.windowGetter();
    if (win && !win.isDestroyed()) {
      win.webContents.send('modbus:singleTelemetry', telemetry);
    }
  }

  private notifyStatus(connected: boolean, error?: string) {
    const win = this.windowGetter();
    if (win && !win.isDestroyed()) {
      win.webContents.send('modbus:statusChange', {
        connected,
        port: this.settings.port,
        error,
      });
    }
  }

  public getOutputState(): boolean {
    return this.isOutputEnabled;
  }

  public async writeHardwareMode(mode: OperatingMode): Promise<{ success: boolean; readbackMode?: OperatingMode; error?: string }> {
    if (!this.isConnected) {
      return { success: false, error: 'Hardware is not connected' };
    }

    const currentSession = this.sessionId;
    let modeCode = 11; // ISOLATED
    if (mode === 'PARALLEL') modeCode = 12;
    else if (mode === 'SERIES') modeCode = 13;

    return this.busLock.runExclusive(async () => {
      if (!this.isConnected || this.sessionId !== currentSession) {
        return { success: false, error: 'Connection session changed' };
      }

      try {
        console.log(`[Sequence Startup] Requested Mode: ${mode}`);
        console.log(`[Sequence Startup] Mode Write: ${modeCode} to Reg 4X 29 (PDU 28)`);

        // Holding Register 4X 29 -> PDU Wire Address 28
        await this.client.writeRegister(28, modeCode);

        // Small delay before readback
        await new Promise((r) => setTimeout(r, 50));

        // Readback Register 4X 29
        const res = await this.client.readHoldingRegisters(28, 1);
        let readbackCode = 11;
        if (res && res.data && res.data.length > 0) {
          readbackCode = res.data[0];
        }

        let readbackMode: OperatingMode = 'ISOLATED';
        if (readbackCode === 12) readbackMode = 'PARALLEL';
        else if (readbackCode === 13) readbackMode = 'SERIES';

        console.log(`[Sequence Startup] Mode Readback: ${readbackCode} (${readbackMode})`);
        const isVerified = readbackMode === mode;
        console.log(`[Sequence Startup] Mode Verification: ${isVerified ? 'PASS' : 'FAIL'}`);

        if (!isVerified) {
          return {
            success: false,
            readbackMode,
            error: `Hardware mode verification failed: Requested ${mode}, hardware returned ${readbackMode} (code ${readbackCode})`,
          };
        }

        this.activeMode = readbackMode;
        this.lastTelemetry.mode = readbackMode;
        return { success: true, readbackMode };
      } catch (err: any) {
        console.error('[Sequence Startup] Mode write error:', err);
        return { success: false, error: err?.message || 'Failed to write hardware mode' };
      }
    });
  }

  public async writeOutputStateConfirmed(enabled: boolean): Promise<{ success: boolean; confirmedState?: boolean; error?: string }> {
    if (!this.isConnected) {
      return { success: false, error: 'Hardware is not connected' };
    }

    const currentSession = this.sessionId;

    return this.busLock.runExclusive(async () => {
      if (!this.isConnected || this.sessionId !== currentSession) {
        return { success: false, error: 'Connection session changed' };
      }

      try {
        console.log(`[Sequence Startup] Output ${enabled ? 'ON' : 'OFF'} command`);

        // Coil START_STOP: Address 0X 1 (PDU Wire Address 0)
        await this.client.writeCoil(0, enabled);

        // Small delay before readback
        await new Promise((r) => setTimeout(r, 30));

        // Read back Coil 0
        const coilRes = await this.client.readCoils(0, 1);
        let confirmedState = enabled;
        if (coilRes && coilRes.data && coilRes.data.length > 0) {
          confirmedState = Boolean(coilRes.data[0]);
        }

        console.log(`[Sequence Startup] Output Readback: ${confirmedState ? 'ON' : 'OFF'}`);
        const isVerified = confirmedState === enabled;
        console.log(`[Sequence Startup] Output Verification: ${isVerified ? 'PASS' : 'FAIL'}`);

        this.isOutputEnabled = confirmedState;
        this.lastTelemetry.outputState = confirmedState ? 'ON' : 'OFF';

        if (!isVerified) {
          return {
            success: false,
            confirmedState,
            error: `Output state verification failed: Requested ${enabled ? 'ON' : 'OFF'}, hardware reported ${confirmedState ? 'ON' : 'OFF'}`,
          };
        }

        return { success: true, confirmedState };
      } catch (err: any) {
        console.error('[Sequence Startup] Output write error:', err);
        return { success: false, error: err?.message || 'Failed to write output state' };
      }
    });
  }

  public getSequenceProgress(): SequenceProgress {
    const activeStep =
      (this.sequenceStatus === 'RUNNING' || this.sequenceStatus === 'INITIALIZING') && this.sequenceSteps.length > 0
        ? this.sequenceSteps[this.sequenceCurrentStepIdx] || null
        : null;

    let remainingSec = 0;
    if (this.sequenceStatus === 'RUNNING' && this.sequenceStepDeadlineTime > 0) {
      remainingSec = Math.max(0, Math.ceil((this.sequenceStepDeadlineTime - Date.now()) / 1000));
    }

    return {
      status: this.sequenceStatus,
      currentCycle: this.sequenceCurrentCycle,
      totalCycles: this.sequenceTotalCycles,
      currentStepIndex: this.sequenceCurrentStepIdx,
      totalSteps: this.sequenceSteps.length,
      stepRemainingSeconds: remainingSec,
      activeStep,
      stepStartTime: this.sequenceStepStartTime,
      stepDeadlineTime: this.sequenceStepDeadlineTime,
    };
  }

  public async startSequence(steps: SequenceStep[], totalCycles: number): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected) {
      return { success: false, error: 'Cannot start sequence: Power Supply is not connected' };
    }
    if (this.activeMode !== 'ISOLATED') {
      return {
        success: false,
        error: `Cannot start sequence: Hardware Register 4X 29 is currently in ${this.activeMode} mode. Automated Test Sequence requires ISOLATED mode.`,
      };
    }
    if (this.isOutputEnabled) {
      return { success: false, error: 'Cannot start sequence: Hardware output is currently ON. Turn output OFF first.' };
    }
    if (!steps || steps.length === 0) {
      return { success: false, error: 'Cannot start sequence: Recipe step list is empty' };
    }

    await this.stopSequence();

    this.sequenceSteps = [...steps];
    this.sequenceTotalCycles = Math.max(1, totalCycles);
    this.sequenceCurrentCycle = 1;
    this.sequenceCurrentStepIdx = 0;
    this.sequenceStatus = 'INITIALIZING';

    console.log(`================================================================================`);
    console.log(`[Sequence Startup] Starting Sequence Execution Flow at ${new Date().toISOString()}`);
    console.log(`[Sequence Startup] Total Steps: ${steps.length}, Total Cycles: ${this.sequenceTotalCycles}`);
    console.log(`[Sequence Startup] Verified Hardware Register 4X 29 Mode: ISOLATED (Read-Only)`);

    this.emitSequenceProgress();

    // Execute sequence initialization flow asynchronously
    const capturedSessionId = ++this.sessionId;

    (async () => {
      // Re-verify Hardware Register 4X 29 is ISOLATED
      if (this.activeMode !== 'ISOLATED') {
        if (this.sessionId === capturedSessionId) {
          this.sequenceStatus = 'ERROR';
          const err = `Cannot start sequence: Hardware Register 4X 29 is in ${this.activeMode} mode. Test Sequence requires ISOLATED mode.`;
          console.error(`[Sequence Startup] ABORTED: ${err}`);
          this.emitSequenceProgress(err);
        }
        return;
      }

      // Write OUTPUT ON to hardware & verify
      const outputResult = await this.writeOutputStateConfirmed(true);
      if (!outputResult.success || this.sessionId !== capturedSessionId) {
        if (this.sessionId === capturedSessionId) {
          this.sequenceStatus = 'ERROR';
          const err = outputResult.error || 'Output ON verification failed';
          console.error(`[Sequence Startup] ABORTED: ${err}`);
          this.emitSequenceProgress(err);
        }
        return;
      }

      // Output verified -> Mark status RUNNING and execute Step 1 setpoints
      this.sequenceStatus = 'RUNNING';
      this.emitSequenceProgress();
      this.executeSequenceStep(capturedSessionId);
    })();

    return { success: true };
  }

  public async stopSequence(): Promise<boolean> {
    if (this.sequenceStepDeadlineTimer) {
      clearTimeout(this.sequenceStepDeadlineTimer);
      this.sequenceStepDeadlineTimer = null;
    }
    if (this.sequenceUiTimer) {
      clearInterval(this.sequenceUiTimer);
      this.sequenceUiTimer = null;
    }

    this.sessionId++; // Invalidate pending async callbacks & sequence execution tasks
    const isRunningOrInit = this.sequenceStatus === 'RUNNING' || this.sequenceStatus === 'INITIALIZING';
    this.sequenceStatus = 'STOPPED';
    this.sequenceStepStartTime = 0;
    this.sequenceStepDeadlineTime = 0;

    console.log(`================================================================================`);
    console.log(`[Sequence OFF] Sequence STOPPED at ${new Date().toISOString()}`);

    if (this.isConnected && isRunningOrInit) {
      // Turn output OFF safely with hardware confirmation
      await this.writeOutputStateConfirmed(false);
    }

    console.log(`[Sequence OFF] Output Readback: ${!this.isOutputEnabled ? 'OFF' : 'FAIL/ON'}`);
    console.log(`[Sequence OFF] Sequence safely stopped.`);
    console.log(`================================================================================`);

    this.emitSequenceProgress();
    return true;
  }

  private async executeSequenceStep(capturedSessionId: number) {
    if (this.sequenceStatus !== 'RUNNING' || !this.isConnected || this.sessionId !== capturedSessionId) {
      return;
    }

    const stepIdx = this.sequenceCurrentStepIdx;
    const cycle = this.sequenceCurrentCycle;
    const step = this.sequenceSteps[stepIdx];

    if (!step) {
      console.error(`[Sequence Engine] Invalid step index ${stepIdx}`);
      this.stopSequence();
      return;
    }

    const writeStartTime = Date.now();
    console.log(`================================================================================`);
    console.log(`[Sequence Engine] TRANSITION -> Cycle ${cycle}/${this.sequenceTotalCycles}, Step ${stepIdx + 1}/${this.sequenceSteps.length} ("Step ${step.stepNumber || stepIdx + 1}")`);
    console.log(`[Sequence Engine] [Write START] Timestamp: ${new Date(writeStartTime).toISOString()} (${writeStartTime} ms)`);
    console.log(`[Sequence Engine] Mode: ${this.activeMode}`);

    // Build mode-specific setpoint object
    const params: {
      ch1Vset?: number;
      ch1Iset?: number;
      ch2Vset?: number;
      ch2Iset?: number;
      masterVset?: number;
      masterIset?: number;
    } = {};

    const mode = step.mode || this.activeMode;
    if (mode === 'ISOLATED') {
      params.ch1Vset = step.ch1Vset;
      params.ch1Iset = step.ch1Iset;
      params.ch2Vset = step.ch2Vset;
      params.ch2Iset = step.ch2Iset;
      console.log(`[Sequence Engine] Setpoints: CH1 V=${step.ch1Vset}V, I=${step.ch1Iset}A | CH2 V=${step.ch2Vset}V, I=${step.ch2Iset}A`);
    } else if (mode === 'PARALLEL') {
      params.masterVset = step.masterVset ?? step.ch1Vset;
      params.ch1Iset = step.ch1Iset;
      params.ch2Iset = step.ch2Iset;
      console.log(`[Sequence Engine] Setpoints: Master Parallel V=${params.masterVset}V | CH1 I=${step.ch1Iset}A, CH2 I=${step.ch2Iset}A`);
    } else if (mode === 'SERIES') {
      params.ch1Vset = step.ch1Vset;
      params.ch2Vset = step.ch2Vset;
      params.masterIset = step.masterIset ?? step.ch1Iset;
      console.log(`[Sequence Engine] Setpoints: Master Series I=${params.masterIset}A | CH1 V=${step.ch1Vset}V, CH2 V=${step.ch2Vset}V`);
    }

    // Execute required setpoint writes through SerialBusLock
    const success = await this.setSetpoints(params);
    const writeCompletionTime = Date.now();
    const writeDuration = writeCompletionTime - writeStartTime;

    if (this.sequenceStatus !== 'RUNNING' || !this.isConnected || this.sessionId !== capturedSessionId) {
      console.log(`[Sequence Engine] Sequence cancelled during write execution.`);
      return;
    }

    if (!success) {
      console.error(`[Sequence Engine] [Write FAILED] Timestamp: ${new Date(writeCompletionTime).toISOString()} (Transaction time: ${writeDuration} ms)`);
      this.sequenceStatus = 'ERROR';
      if (this.sequenceStepDeadlineTimer) clearTimeout(this.sequenceStepDeadlineTimer);
      if (this.sequenceUiTimer) clearInterval(this.sequenceUiTimer);

      const errorMsg = `Setpoints write failed on Cycle ${cycle}, Step ${stepIdx + 1} (Step ${step.stepNumber || stepIdx + 1})`;
      this.emitSequenceProgress(errorMsg, writeStartTime, writeCompletionTime);
      return;
    }

    console.log(`[Sequence Engine] [Write SUCCESS] Timestamp: ${new Date(writeCompletionTime).toISOString()} (Transaction time: ${writeDuration} ms)`);

    // STEP DURATION START POINT: Step timer starts ONLY AFTER writes complete successfully
    this.sequenceStepStartTime = Date.now();
    const durationMs = Math.max(1, step.durationSeconds) * 1000;
    this.sequenceStepDeadlineTime = this.sequenceStepStartTime + durationMs;

    console.log(`[Sequence Engine] [Step DURATION START] Start: ${new Date(this.sequenceStepStartTime).toISOString()} | Deadline: ${new Date(this.sequenceStepDeadlineTime).toISOString()} (${step.durationSeconds} sec)`);

    this.emitSequenceProgress(undefined, writeStartTime, writeCompletionTime);

    // Setup 200ms UI countdown ticker for UI progress update ONLY
    if (this.sequenceUiTimer) clearInterval(this.sequenceUiTimer);
    this.sequenceUiTimer = setInterval(() => {
      this.emitSequenceProgress();
    }, 200);

    // Precise Step Deadline Timer using setTimeout
    if (this.sequenceStepDeadlineTimer) clearTimeout(this.sequenceStepDeadlineTimer);
    this.sequenceStepDeadlineTimer = setTimeout(() => {
      if (this.sequenceUiTimer) clearInterval(this.sequenceUiTimer);
      this.sequenceUiTimer = null;

      const expiryTime = Date.now();
      console.log(`[Sequence Engine] [Step DURATION EXPIRED] Timestamp: ${new Date(expiryTime).toISOString()} (Elapsed: ${expiryTime - this.sequenceStepStartTime} ms)`);

      if (this.sequenceStatus !== 'RUNNING' || this.sessionId !== capturedSessionId) {
        return;
      }

      // Advance to next step / cycle
      this.sequenceCurrentStepIdx++;
      if (this.sequenceCurrentStepIdx >= this.sequenceSteps.length) {
        this.sequenceCurrentStepIdx = 0;
        this.sequenceCurrentCycle++;
      }

      if (this.sequenceCurrentCycle > this.sequenceTotalCycles) {
        this.sequenceStatus = 'COMPLETED';
        console.log(`================================================================================`);
        console.log(`[Sequence Engine] SEQUENCE COMPLETED ALL ${this.sequenceTotalCycles} CYCLES at ${new Date().toISOString()}`);
        console.log(`================================================================================`);
        this.emitSequenceProgress();
      } else {
        // Execute Next Step
        this.executeSequenceStep(capturedSessionId);
      }
    }, durationMs);
  }

  private emitSequenceProgress(errorMsg?: string, writeStartTime?: number, writeCompletionTime?: number) {
    const win = this.windowGetter();
    if (win && !win.isDestroyed()) {
      const activeStep =
        this.sequenceSteps.length > 0 && this.sequenceCurrentStepIdx < this.sequenceSteps.length
          ? this.sequenceSteps[this.sequenceCurrentStepIdx]
          : null;

      let remainingSec = 0;
      if (this.sequenceStatus === 'RUNNING' && this.sequenceStepDeadlineTime > 0) {
        remainingSec = Math.max(0, Math.ceil((this.sequenceStepDeadlineTime - Date.now()) / 1000));
      }

      const progress: SequenceProgress = {
        status: this.sequenceStatus,
        currentCycle: this.sequenceCurrentCycle,
        totalCycles: this.sequenceTotalCycles,
        currentStepIndex: this.sequenceCurrentStepIdx,
        totalSteps: this.sequenceSteps.length,
        stepRemainingSeconds: remainingSec,
        activeStep,
        errorMsg,
        writeStartTime,
        writeCompletionTime,
        stepStartTime: this.sequenceStepStartTime,
        stepDeadlineTime: this.sequenceStepDeadlineTime,
      };

      win.webContents.send('sequence:progress', progress);
    }
  }
}

