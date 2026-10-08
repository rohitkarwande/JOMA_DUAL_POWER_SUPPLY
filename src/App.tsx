import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChannelCard } from './components/ChannelCard';
import { SeriesView } from './components/SeriesView';
import { ParallelView } from './components/ParallelView';
import { LiveChart } from './components/LiveChart';
import { HistoryView } from './components/HistoryView';
import { SequenceBuilder } from './components/SequenceBuilder';
import { SettingsModal } from './components/SettingsModal';
import { DualPSTelemetry, SerialSettings, OutputState } from './types/powerSupply';
import { Activity, History, ListOrdered, Zap, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [telemetry, setTelemetry] = useState<DualPSTelemetry>({
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
  });

  const [telemetryHistory, setTelemetryHistory] = useState<DualPSTelemetry[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'CONTROL' | 'SEQUENCE' | 'HISTORY'>('CONTROL');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSequenceRunning, setIsSequenceRunning] = useState<boolean>(false);

  const [sequenceProgress, setSequenceProgress] = useState<any>(null);

  const [serialSettings, setSerialSettings] = useState<SerialSettings>({
    port: 'COM1',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    slaveId: 1,
    pollingIntervalMs: 500,
    autoReconnect: true,
  });

  // Subscribe to push telemetry, connection status, and sequence progress from Electron Main process
  useEffect(() => {
    if (window.electronAPI) {
      const unsubTelemetry = window.electronAPI.onTelemetry((data) => {
        setTelemetry(data);
        setTelemetryHistory((prev) => [...prev.slice(-100), data]);
      });

      const unsubStatus = window.electronAPI.onStatusChange((status) => {
        setConnected(status.connected);
      });

      const unsubSeq = window.electronAPI.onSequenceProgress((progress) => {
        setSequenceProgress(progress);
        setIsSequenceRunning(progress.status === 'RUNNING');
      });

      return () => {
        unsubTelemetry();
        unsubStatus();
        unsubSeq();
      };
    }
  }, []);

  // Handlers
  const handleToggleOutput = async () => {
    const nextState: OutputState = telemetry.outputState === 'ON' ? 'OFF' : 'ON';
    if (window.electronAPI) {
      await window.electronAPI.setOutputState(nextState === 'ON');
    }
    setTelemetry((prev) => ({ ...prev, outputState: nextState }));
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

  const handleSaveSettings = async (newSettings: SerialSettings) => {
    setSerialSettings(newSettings);
    if (window.electronAPI) {
      await window.electronAPI.connectSerial(newSettings);
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

  // Priority 2: Sequence NOT active AND hardware Output = ON -> Normal Output Lock applies
  const isNormalOutputLockActive = !isSequenceActive && telemetry.outputState === 'ON';

  // Automatically force switch to MAIN CONTROL HMI when Output is ON in Normal Mode
  useEffect(() => {
    if (isNormalOutputLockActive && activeTab !== 'CONTROL') {
      setActiveTab('CONTROL');
    }
  }, [isNormalOutputLockActive, activeTab]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <Header
        connected={connected}
        activePort={serialSettings.port}
        outputState={telemetry.outputState}
        activeMode={telemetry.mode}
        onToggleOutput={handleToggleOutput}
        onOpenSettings={() => {
          if (!isNormalOutputLockActive && !isSequenceActive) {
            setIsSettingsOpen(true);
          }
        }}
        onSelectMode={handleSelectMode}
      />

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
            disabled={isNormalOutputLockActive}
            onClick={() => !isNormalOutputLockActive && setActiveTab('SEQUENCE')}
            title={
              isNormalOutputLockActive
                ? 'Normal Output is ON — Turn Output OFF to access Sequence Builder'
                : 'Sequence Builder & Execution Engine'
            }
            className={`px-5 py-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              isNormalOutputLockActive
                ? 'border-transparent text-slate-300 cursor-not-allowed'
                : activeTab === 'SEQUENCE'
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
        </div>

        {/* Dynamic Mode Status Indicator */}
        <div className="text-xs font-semibold text-slate-500">
          Hardware Register 4X 29 Mode: <span className="font-bold text-sky-700">{telemetry.mode}</span>
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
            <LiveChart telemetryHistory={telemetryHistory} />
          </div>
        )}

        {activeTab === 'SEQUENCE' && (
          <SequenceBuilder
            connected={connected}
            outputState={telemetry.outputState}
            isRunning={isSequenceRunning}
            onRunSequence={handleRunSequence}
            onStopSequence={handleStopSequence}
            progress={sequenceProgress}
            telemetryHistory={telemetryHistory}
            maxVoltage={telemetry.maxVoltage}
            maxCurrent={telemetry.maxCurrent}
          />
        )}

        {activeTab === 'HISTORY' && <HistoryView />}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentSettings={serialSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default App;
