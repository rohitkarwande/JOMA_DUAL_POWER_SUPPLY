import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChannelCard } from './components/ChannelCard';
import { SeriesView } from './components/SeriesView';
import { ParallelView } from './components/ParallelView';
import { LiveChart } from './components/LiveChart';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SequenceBuilder } from './components/SequenceBuilder';
import { SinglePowerSupplyView } from './components/SinglePowerSupplyView';
import { SettingsModal } from './components/SettingsModal';
import { SystemLogsDrawer } from './components/SystemLogsDrawer';
import { DualPSTelemetry, SinglePSTelemetry, AppMode, OperatingMode, SerialSettings, OutputState, SystemLogEntry } from './types/powerSupply';
import { generatePdfReport, LoggedSample, ReportSessionData } from './utils/pdfReportGenerator';
import { Activity, History, ListOrdered, Zap, Layers, Sliders, FileText, Eye, FolderOpen } from 'lucide-react';

function extractSampleFromTelemetry(t: DualPSTelemetry): LoggedSample {
  return {
    timestamp: t.timestamp || Date.now(),
    timeStr: new Date(t.timestamp || Date.now()).toLocaleTimeString([], { hour12: false }),
    mode: t.mode,
    ch1Vmon: t.ch1.voltageActual,
    ch1Imon: t.ch1.currentActual,
    ch1Vset: t.ch1.voltageSetpoint,
    ch1Iset: t.ch1.currentSetpoint,
    ch2Vmon: t.ch2.voltageActual,
    ch2Imon: t.ch2.currentActual,
    ch2Vset: t.ch2.voltageSetpoint,
    ch2Iset: t.ch2.currentSetpoint,
    masterIset: t.masterCurrentSetpoint,
    serVoltMon: t.totalVoltage,
    masterVset: t.masterVoltageSetpoint,
    parCurMon: t.totalCurrent,
  };
}

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('DUAL_PS');

  const [telemetry, setTelemetry] = useState<DualPSTelemetry>({
    timestamp: Date.now(),
    mode: 'ISOLATED',
    outputState: 'OFF',
    maxVoltage: 60.0,
    maxCurrent: 10.0,
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
  });

  const [singleTelemetry, setSingleTelemetry] = useState<SinglePSTelemetry>({
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
  });

  const [telemetryHistory, setTelemetryHistory] = useState<DualPSTelemetry[]>([]);
  const [singleTelemetryHistory, setSingleTelemetryHistory] = useState<any[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSimulator, setIsSimulator] = useState<boolean>(false);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);

  const [activeTab, setActiveTab] = useState<'CONTROL' | 'SEQUENCE' | 'HISTORY' | 'REPORTS' | 'SETTINGS'>('CONTROL');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSequenceRunning, setIsSequenceRunning] = useState<boolean>(false);

  const [sequenceProgress, setSequenceProgress] = useState<any>(null);

  // Settings & Automatic Logging States
  const [loggingIntervalMs, setLoggingIntervalMs] = useState<number>(() => {
    const saved = localStorage.getItem('joma_logging_interval_ms');
    const parsed = saved ? parseInt(saved, 10) : 60000;
    return !isNaN(parsed) && parsed >= 1000 ? parsed : 60000;
  });
  const [isLoggingActive, setIsLoggingActive] = useState<boolean>(false);
  const [loggedSamplesCount, setLoggedSamplesCount] = useState<number>(0);
  const [activeSessionDurationSec, setActiveSessionDurationSec] = useState<number>(0);
  const [reportsRefreshTrigger, setReportsRefreshTrigger] = useState<number>(0);
  const [activeReportNotification, setActiveReportNotification] = useState<{
    fileName: string;
    filePath: string;
    mode: string;
    durationSeconds: number;
    samplesCount: number;
  } | null>(null);

  // Session Refs
  const activeLoggingSessionRef = useRef<ReportSessionData | null>(null);
  const lastSampleTimeRef = useRef<number>(0);
  const loggingIntervalMsRef = useRef<number>(loggingIntervalMs);
  const telemetryRef = useRef<DualPSTelemetry>(telemetry);

  useEffect(() => {
    loggingIntervalMsRef.current = loggingIntervalMs;
  }, [loggingIntervalMs]);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  // Load persisted logging interval from database settings table
  useEffect(() => {
    if (window.electronAPI?.settings) {
      window.electronAPI.settings.get('loggingIntervalMs').then((val) => {
        if (val) {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed >= 1000 && parsed <= 7200000) {
            setLoggingIntervalMs(parsed);
            localStorage.setItem('joma_logging_interval_ms', String(parsed));
          }
        }
      }).catch(console.error);
    }
  }, []);

  // Timer for active logging duration
  useEffect(() => {
    let timer: any = null;
    if (isLoggingActive) {
      timer = setInterval(() => {
        if (activeLoggingSessionRef.current) {
          const sec = Math.floor((Date.now() - activeLoggingSessionRef.current.startTime) / 1000);
          setActiveSessionDurationSec(sec);
        }
      }, 1000);
    } else {
      setActiveSessionDurationSec(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoggingActive]);

  const handleUpdateLoggingInterval = async (intervalMs: number) => {
    setLoggingIntervalMs(intervalMs);
    localStorage.setItem('joma_logging_interval_ms', String(intervalMs));
    if (window.electronAPI?.settings) {
      await window.electronAPI.settings.set('loggingIntervalMs', String(intervalMs)).catch(console.error);
    }
  };

  const finalizeAndGenerateReport = async () => {
    const session = activeLoggingSessionRef.current;
    if (!session) {
      console.log('[Reports] finalizeAndGenerateReport called, but no session is active.');
      return; // Edge case: Output OFF when no session is active
    }

    // Atomically detach the session
    activeLoggingSessionRef.current = null;
    setIsLoggingActive(false);

    const now = Date.now();
    session.endTime = now;
    session.durationSeconds = Math.max(1, Math.round((session.endTime - session.startTime) / 1000));

    // Capture final sample if time has elapsed
    if (session.samples.length > 0 && now - session.samples[session.samples.length - 1].timestamp > 400) {
      session.samples.push(extractSampleFromTelemetry(telemetryRef.current));
    }
    // Guarantee at least 1 sample so report is never empty
    if (session.samples.length === 0) {
      session.samples.push(extractSampleFromTelemetry(telemetryRef.current));
    }

    try {
      console.log(`[Reports] Generating PDF report for ${session.mode} (${session.samples.length} samples, ${session.durationSeconds}s)...`);
      const pdfData = await generatePdfReport(session);
      console.log(`[Reports] PDF created successfully (${pdfData.fileBytes} bytes): ${pdfData.fileName}`);

      if (window.electronAPI?.reports) {
        const saveRes = await window.electronAPI.reports.savePdf({
          fileName: pdfData.fileName,
          dataBase64: pdfData.dataBase64,
          metadata: {
            mode: session.mode,
            startTime: session.startTime,
            endTime: session.endTime,
            durationSeconds: session.durationSeconds,
            totalSamples: session.samples.length,
            loggingIntervalMs: session.loggingIntervalMs,
            vMax: session.vMax,
            iMax: session.iMax,
          },
        });

        console.log('[Reports] savePdf response:', saveRes);

        if (saveRes && saveRes.success && saveRes.filePath) {
          setActiveReportNotification({
            fileName: saveRes.record?.fileName || pdfData.fileName,
            filePath: saveRes.filePath,
            mode: session.mode,
            durationSeconds: session.durationSeconds,
            samplesCount: session.samples.length,
          });
          setReportsRefreshTrigger((prev) => prev + 1);
        } else {
          console.error('[Reports] Failed to save PDF report:', saveRes?.error);
          alert(`Failed to save PDF report: ${saveRes?.error || 'Unknown IPC error'}`);
        }
      } else {
        console.error('[Reports] window.electronAPI.reports is unavailable!');
      }
    } catch (err: any) {
      console.error('[Reports] Error generating PDF report:', err);
      alert(`Error generating PDF report: ${err?.message || String(err)}`);
    }
  };

  const [serialSettings, setSerialSettings] = useState<SerialSettings>({
    port: 'COM1',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    slaveId: 1,
    pollingIntervalMs: 500,
    autoReconnect: true,
    isSimulator: false,
  });

  // Subscribe to push telemetry, connection status, logs, and sequence progress from Electron Main process
  useEffect(() => {
    if (window.electronAPI) {
      const unsubTelemetry = window.electronAPI.onTelemetry((data) => {
        setTelemetry(data);
        setTelemetryHistory((prev) => [...prev.slice(-100), data]);

        // Edge case: Output became OFF externally while logging was active
        if (data.outputState === 'OFF' && activeLoggingSessionRef.current) {
          finalizeAndGenerateReport();
          return;
        }

        // Automatic logging capture according to configured interval
        if (activeLoggingSessionRef.current && data.outputState === 'ON') {
          const now = Date.now();
          if (now - lastSampleTimeRef.current >= loggingIntervalMsRef.current - 50) {
            lastSampleTimeRef.current = now;
            const sample = extractSampleFromTelemetry(data);
            activeLoggingSessionRef.current.samples.push(sample);
            setLoggedSamplesCount(activeLoggingSessionRef.current.samples.length);
          }
        }
      });

      const unsubSingleTelemetry = window.electronAPI.onSingleTelemetry((data) => {
        setSingleTelemetry(data);
        setSingleTelemetryHistory((prev) => [...prev.slice(-100), data]);
      });

      const unsubStatus = window.electronAPI.onStatusChange((status) => {
        setConnected(status.connected);
        if (status.error) {
          setConnectionError(status.error);
        } else if (status.connected) {
          setConnectionError(null);
        }
        if (status.isSimulator !== undefined) {
          setIsSimulator(status.isSimulator);
        }
        // Edge case: Communication lost during active logging
        if (!status.connected && activeLoggingSessionRef.current) {
          finalizeAndGenerateReport();
        }
      });

      const unsubSeq = window.electronAPI.onSequenceProgress((progress) => {
        setSequenceProgress(progress);
        setIsSequenceRunning(progress.status === 'RUNNING');
      });

      const unsubLogs = window.electronAPI.onSystemLog((entry) => {
        setLogs((prev) => [...prev.slice(-300), entry]);
      });

      window.electronAPI.getRecentLogs().then((initialLogs) => {
        if (initialLogs && Array.isArray(initialLogs)) {
          setLogs(initialLogs);
        }
      });

      return () => {
        unsubTelemetry();
        unsubSingleTelemetry();
        unsubStatus();
        unsubSeq();
        unsubLogs();
      };
    }
  }, []);

  const activeOutputState: OutputState = appMode === 'SINGLE_PS' ? singleTelemetry.outputState : telemetry.outputState;

  // Handlers
  const handleSelectAppMode = async (newMode: AppMode) => {
    if (window.electronAPI) {
      const res = await window.electronAPI.setAppMode(newMode);
      if (!res.success) {
        alert(res.error || 'Failed to switch application mode');
        return;
      }
    }
    setAppMode(newMode);
  };

  const handleToggleOutput = async () => {
    const nextState: OutputState = activeOutputState === 'ON' ? 'OFF' : 'ON';

    if (nextState === 'ON') {
      let success = true;
      if (window.electronAPI) {
        success = await window.electronAPI.setOutputState(true);
      }

      // Requirement 3: Start session ONLY after output-ON command has been successfully accepted
      if (!success) {
        return;
      }

      if (appMode === 'SINGLE_PS') {
        setSingleTelemetry((prev) => ({ ...prev, outputState: 'ON' }));
      } else {
        setTelemetry((prev) => ({ ...prev, outputState: 'ON' }));

        // Only start automatic logging for Dual PS normal modes: ISOLATED, SERIES, PARALLEL
        // Do not implement for Test Sequence mode yet
        const currentMode: OperatingMode = telemetry.mode || 'ISOLATED';
        if (
          !isSequenceActive &&
          (currentMode === 'ISOLATED' || currentMode === 'SERIES' || currentMode === 'PARALLEL')
        ) {
          if (!activeLoggingSessionRef.current) {
            const now = Date.now();
            console.log(`[Logging] Starting new telemetry session for mode ${currentMode} at interval ${loggingIntervalMsRef.current}ms`);
            const initialSample = extractSampleFromTelemetry({ ...telemetry, outputState: 'ON', mode: currentMode });
            const newSession: ReportSessionData = {
              id: `session_${now}`,
              mode: currentMode,
              startTime: now,
              endTime: 0,
              durationSeconds: 0,
              loggingIntervalMs: loggingIntervalMsRef.current,
              vMax: telemetry.maxVoltage || 60.0,
              iMax: telemetry.maxCurrent || 10.0,
              samples: [initialSample],
            };
            activeLoggingSessionRef.current = newSession;
            lastSampleTimeRef.current = now;
            setIsLoggingActive(true);
            setLoggedSamplesCount(1);
          }
        }
      }
    } else {
      // Switching Output OFF
      if (window.electronAPI) {
        await window.electronAPI.setOutputState(false);
      }

      if (appMode === 'SINGLE_PS') {
        setSingleTelemetry((prev) => ({ ...prev, outputState: 'OFF' }));
      } else {
        setTelemetry((prev) => ({ ...prev, outputState: 'OFF' }));
        // Stop logging and auto generate PDF report
        finalizeAndGenerateReport();
      }
    }
  };

  const handleRunSequence = async (steps: any[], cycles: number) => {
    if (window.electronAPI) {
      const res = await window.electronAPI.startSequence(steps, cycles);
      if (!res.success) {
        alert(res.error || 'Failed to start sequence');
      }
    } else {
      setIsSequenceRunning(true);
    }
  };

  const handleStopSequence = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopSequence();
    }
    setIsSequenceRunning(false);
  };

  const handleUpdateSetpoints = async (params: {
    ch1Vset?: number;
    ch1Iset?: number;
    ch2Vset?: number;
    ch2Iset?: number;
    masterVset?: number;
    masterIset?: number;
  }) => {
    if (window.electronAPI) {
      await window.electronAPI.setSetpoints(params);
    }
    setTelemetry((prev) => ({
      ...prev,
      ch1: {
        ...prev.ch1,
        voltageSetpoint: params.ch1Vset !== undefined ? params.ch1Vset : prev.ch1.voltageSetpoint,
        currentSetpoint: params.ch1Iset !== undefined ? params.ch1Iset : prev.ch1.currentSetpoint,
      },
      ch2: {
        ...prev.ch2,
        voltageSetpoint: params.ch2Vset !== undefined ? params.ch2Vset : prev.ch2.voltageSetpoint,
        currentSetpoint: params.ch2Iset !== undefined ? params.ch2Iset : prev.ch2.currentSetpoint,
      },
      masterVoltageSetpoint: params.masterVset !== undefined ? params.masterVset : prev.masterVoltageSetpoint,
      masterCurrentSetpoint: params.masterIset !== undefined ? params.masterIset : prev.masterCurrentSetpoint,
    }));
  };

  const handleUpdateSingleSetpoints = async (params: { vSet?: number; iSet?: number }) => {
    if (window.electronAPI) {
      await window.electronAPI.setSingleSetpoints(params);
    }
    setSingleTelemetry((prev) => ({
      ...prev,
      vSet: params.vSet !== undefined ? params.vSet : prev.vSet,
      iSet: params.iSet !== undefined ? params.iSet : prev.iSet,
    }));
  };

  const handleSaveSettings = async (newSettings: SerialSettings) => {
    setSerialSettings(newSettings);
    setIsConnecting(true);
    setConnectionError(null);
    if (window.electronAPI) {
      try {
        const res = await window.electronAPI.connectSerial(newSettings);
        if (res && !res.success) {
          setConnectionError(res.error || 'Connection failed');
        } else {
          setConnectionError(null);
          setIsSettingsOpen(false);
        }
      } catch (err: any) {
        setConnectionError(err?.message || 'Failed to communicate with serial bridge');
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleSelectMode = async (mode: any) => {
    if (window.electronAPI) {
      await window.electronAPI.setMode(mode);
    }
    setTelemetry((prev) => ({ ...prev, mode }));
  };

  // Priority 1: Automated Sequence ACTIVE (INITIALIZING or RUNNING) -> Sequence owns UI & hardware
  const isSequenceActive = sequenceProgress?.status === 'INITIALIZING' || sequenceProgress?.status === 'RUNNING';

  // Priority 2: Sequence NOT active AND hardware Output = ON -> Normal Output Status
  const isNormalOutputLockActive = !isSequenceActive && activeOutputState === 'ON';

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <Header
        connected={connected}
        activePort={serialSettings.port}
        outputState={activeOutputState}
        appMode={appMode}
        activeMode={telemetry.mode}
        connectionError={connectionError}
        isSimulator={isSimulator}
        logCount={logs.length}
        onToggleOutput={handleToggleOutput}
        onOpenSettings={() => {
          if (!isNormalOutputLockActive && !isSequenceActive) {
            setIsSettingsOpen(true);
          }
        }}
        onOpenLogs={() => setIsLogsDrawerOpen((prev) => !prev)}
        onSelectAppMode={handleSelectAppMode}
        onSelectMode={handleSelectMode}
      />

      {/* Mode-Based Sub-Header & Main Rendering */}
      {appMode === 'SINGLE_PS' ? (
        /* SINGLE POWER SUPPLY INTERFACE */
        <main className="flex-1 p-4 flex flex-col overflow-y-auto">
          <SinglePowerSupplyView
            telemetry={singleTelemetry}
            connected={connected}
            onUpdateSetpoints={handleUpdateSingleSetpoints}
            onToggleOutput={handleToggleOutput}
            telemetryHistory={singleTelemetryHistory}
            maxVoltage={singleTelemetry.maxVoltage}
            maxCurrent={singleTelemetry.maxCurrent}
          />
        </main>
      ) : (
        /* DUAL POWER SUPPLY INTERFACE */
        <>
          {/* Sub-Header Navigation Tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('CONTROL')}
                className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === 'CONTROL'
                    ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" /> MAIN CONTROL HMI
              </button>

              {/* SEQUENCE BUILDER TAB */}
              <button
                onClick={() => setActiveTab('SEQUENCE')}
                title="Sequence Builder & Execution Engine"
                className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'SEQUENCE'
                    ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ListOrdered className="w-4 h-4" /> SEQUENCE BUILDER
              </button>

              {/* SQLITE HISTORY TAB */}
              <button
                disabled={isNormalOutputLockActive || isSequenceActive}
                onClick={() => !isNormalOutputLockActive && !isSequenceActive && setActiveTab('HISTORY')}
                title={
                  isNormalOutputLockActive || isSequenceActive
                    ? 'Output Active — Tab locked for safety'
                    : 'SQLite History & CSV Export'
                }
                className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  isNormalOutputLockActive || isSequenceActive
                    ? 'border-transparent text-slate-300 cursor-not-allowed'
                    : activeTab === 'HISTORY'
                    ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" /> SQLITE HISTORY & CSV EXPORT
              </button>

              {/* PDF REPORTS TAB */}
              <button
                disabled={isSequenceActive}
                onClick={() => !isSequenceActive && setActiveTab('REPORTS')}
                title="Generated PDF Test Reports"
                className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  isSequenceActive
                    ? 'border-transparent text-slate-300 cursor-not-allowed'
                    : activeTab === 'REPORTS'
                    ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" /> REPORT
              </button>

              {/* SETTINGS TAB */}
              <button
                disabled={isSequenceActive}
                onClick={() => !isSequenceActive && setActiveTab('SETTINGS')}
                title="Hardware Limits & Telemetry Logging Interval Settings"
                className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  isSequenceActive
                    ? 'border-transparent text-slate-300 cursor-not-allowed'
                    : activeTab === 'SETTINGS'
                    ? 'border-sky-600 text-sky-600 bg-sky-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" /> SETTINGS
                {isLoggingActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
                )}
              </button>
            </div>

            {/* Dynamic Status Indicator */}
            <div className="flex items-center gap-4">
              {isLoggingActive && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-md text-[11px] font-bold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LOGGING: {activeSessionDurationSec}s ({loggedSamplesCount} samples)</span>
                </div>
              )}
              <div className="text-xs font-semibold text-slate-500">
                Hardware Register 4X 29 Mode: <span className="font-bold text-sky-700">{telemetry.mode}</span>
              </div>
            </div>
          </div>

          {/* Safety Alert Banner for Normal Output Lock */}
          {isNormalOutputLockActive && (
            <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-rose-900 text-xs font-bold flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                <span className="font-extrabold uppercase tracking-wide">
                  SAFETY INTERLOCK: Hardware Output is ON (Normal Mode)
                </span>
                <span className="text-rose-700 font-semibold font-mono">
                  [Configuration tabs & Settings are locked while output is energized]
                </span>
              </div>
              <button
                onClick={handleToggleOutput}
                className="px-4 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-extrabold text-xs uppercase shadow-xs transition-colors"
              >
                TURN OUTPUT OFF
              </button>
            </div>
          )}

          {/* Main View Area */}
          <main className="flex-1 p-4 flex flex-col overflow-y-auto">
            {activeTab === 'CONTROL' && (
              <div className="flex flex-col gap-3.5">
                {/* Prominent Compact Operating Mode Control Banner */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 px-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 border border-sky-200 rounded-lg text-sky-700">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                        ACTIVE OPERATING MODE (REG 4X 29)
                      </span>
                      <div className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-0.5">
                        <span className="text-sky-700">{telemetry.mode} MODE</span>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mode Switcher Buttons */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 w-full md:w-auto justify-stretch">
                    <button
                      onClick={() => handleSelectMode('ISOLATED')}
                      className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-md font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                        telemetry.mode === 'ISOLATED'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" /> ISOLATED
                    </button>

                    <button
                      onClick={() => handleSelectMode('PARALLEL')}
                      className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-md font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                        telemetry.mode === 'PARALLEL'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" /> PARALLEL
                    </button>

                    <button
                      onClick={() => handleSelectMode('SERIES')}
                      className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-md font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                        telemetry.mode === 'SERIES'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> SERIES
                    </button>
                  </div>
                </div>

                {telemetry.mode === 'ISOLATED' && (
                  <div className="grid grid-cols-2 gap-4">
                    <ChannelCard
                      channelNumber={1}
                      title="CHANNEL 1 (ISOLATED)"
                      voltageActual={telemetry.ch1.voltageActual}
                      currentActual={telemetry.ch1.currentActual}
                      voltageSetpoint={telemetry.ch1.voltageSetpoint}
                      currentSetpoint={telemetry.ch1.currentSetpoint}
                      powerActual={telemetry.ch1.powerActual}
                      maxVoltage={telemetry.maxVoltage}
                      maxCurrent={telemetry.maxCurrent}
                      onUpdateVset={(val) => handleUpdateSetpoints({ ch1Vset: val })}
                      onUpdateIset={(val) => handleUpdateSetpoints({ ch1Iset: val })}
                    />
                    <ChannelCard
                      channelNumber={2}
                      title="CHANNEL 2 (ISOLATED)"
                      voltageActual={telemetry.ch2.voltageActual}
                      currentActual={telemetry.ch2.currentActual}
                      voltageSetpoint={telemetry.ch2.voltageSetpoint}
                      currentSetpoint={telemetry.ch2.currentSetpoint}
                      powerActual={telemetry.ch2.powerActual}
                      isCh2Theme={true}
                      maxVoltage={telemetry.maxVoltage}
                      maxCurrent={telemetry.maxCurrent}
                      onUpdateVset={(val) => handleUpdateSetpoints({ ch2Vset: val })}
                      onUpdateIset={(val) => handleUpdateSetpoints({ ch2Iset: val })}
                    />
                  </div>
                )}

                {telemetry.mode === 'SERIES' && (
                  <SeriesView
                    telemetry={telemetry}
                    onUpdateMasterIset={(val) => handleUpdateSetpoints({ masterIset: val })}
                    onUpdateCh1Vset={(val) => handleUpdateSetpoints({ ch1Vset: val })}
                    onUpdateCh2Vset={(val) => handleUpdateSetpoints({ ch2Vset: val })}
                  />
                )}

                {telemetry.mode === 'PARALLEL' && (
                  <ParallelView
                    telemetry={telemetry}
                    onUpdateMasterVset={(val) => handleUpdateSetpoints({ masterVset: val })}
                    onUpdateCh1Iset={(val) => handleUpdateSetpoints({ ch1Iset: val })}
                    onUpdateCh2Iset={(val) => handleUpdateSetpoints({ ch2Iset: val })}
                  />
                )}

                {/* Live Telemetry Chart embedded inside Main Control HMI */}
                <LiveChart
                  telemetryHistory={telemetryHistory}
                  maxVoltage={telemetry.maxVoltage}
                  maxCurrent={telemetry.maxCurrent}
                />
              </div>
            )}

            {activeTab === 'SEQUENCE' && (
              <SequenceBuilder
                connected={connected}
                outputState={telemetry.outputState}
                hardwareMode={telemetry.mode}
                isRunning={isSequenceRunning}
                onRunSequence={handleRunSequence}
                onStopSequence={handleStopSequence}
                progress={sequenceProgress}
                telemetryHistory={telemetryHistory}
                maxVoltage={telemetry.maxVoltage}
                maxCurrent={telemetry.maxCurrent}
                telemetry={telemetry}
              />
            )}

            {activeTab === 'HISTORY' && <HistoryView />}

            {activeTab === 'REPORTS' && (
              <ReportsView onRefreshTrigger={reportsRefreshTrigger} />
            )}

            {activeTab === 'SETTINGS' && (
              <SettingsView
                maxVoltage={telemetry.maxVoltage}
                maxCurrent={telemetry.maxCurrent}
                loggingIntervalMs={loggingIntervalMs}
                onUpdateLoggingInterval={handleUpdateLoggingInterval}
                activeMode={telemetry.mode}
                isLoggingActive={isLoggingActive}
                loggedSamplesCount={loggedSamplesCount}
                activeSessionDurationSec={activeSessionDurationSec}
                connected={connected}
              />
            )}
          </main>
        </>
      )}

      {/* Report Auto-Generation Notification Toast Banner */}
      {activeReportNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-white border border-sky-300 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  PDF Test Report Generated
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 font-mono truncate max-w-[260px]" title={activeReportNotification.fileName}>
                  {activeReportNotification.fileName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveReportNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded font-mono">
              {activeReportNotification.mode}
            </span>
            <span>•</span>
            <span>Duration: {activeReportNotification.durationSeconds}s</span>
            <span>•</span>
            <span>Samples: {activeReportNotification.samplesCount}</span>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => window.electronAPI?.reports?.openPdf(activeReportNotification.filePath)}
              className="flex-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Open PDF
            </button>
            <button
              onClick={() => window.electronAPI?.reports?.showInFolder(activeReportNotification.filePath)}
              className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Show in Folder
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentSettings={serialSettings}
        connectionError={connectionError}
        isConnecting={isConnecting}
        recentLogs={logs}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onOpenFullLogs={() => {
          setIsSettingsOpen(false);
          setIsLogsDrawerOpen(true);
        }}
      />

      {/* System & Modbus Diagnostics Log Drawer */}
      <SystemLogsDrawer
        isOpen={isLogsDrawerOpen}
        logs={logs}
        onClose={() => setIsLogsDrawerOpen(false)}
        onClear={() => {
          setLogs([]);
          if (window.electronAPI) {
            window.electronAPI.clearLogs();
          }
        }}
      />
    </div>
  );
};

export default App;

