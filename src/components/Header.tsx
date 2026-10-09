import React from 'react';
import { JomaLogo } from './JomaLogo';
import { OperatingMode, AppMode, OutputState } from '../types/powerSupply';
import { Activity, Plug, Power, Settings, Lock, Layers, Zap, Terminal, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  connected: boolean;
  activePort?: string;
  outputState: OutputState;
  appMode: AppMode;
  activeMode: OperatingMode;
  connectionError?: string | null;
  isSimulator?: boolean;
  logCount?: number;
  onToggleOutput: () => void;
  onOpenSettings: () => void;
  onOpenLogs?: () => void;
  onSelectAppMode: (mode: AppMode) => void;
  onSelectMode: (mode: OperatingMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  activePort = 'COM1',
  outputState,
  appMode,
  activeMode,
  connectionError = null,
  isSimulator = false,
  logCount = 0,
  onToggleOutput,
  onOpenSettings,
  onOpenLogs,
  onSelectAppMode,
  onSelectMode,
}) => {
  const isOutputOn = outputState === 'ON';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm select-none">
      {/* Left Branding & Top App Mode Toggle */}
      <div className="flex items-center gap-5">
        <JomaLogo height={34} />
        <div className="h-6 w-px bg-slate-200" />
        <div>
          <h1 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            JOMA Power Supply Control HMI
          </h1>
          <p className="text-[11px] font-semibold text-slate-400">RS485 Modbus RTU System</p>
        </div>

        {/* Top Level App Mode Selector (Dual PS vs Single PS) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 ml-4">
          <button
            onClick={() => !isOutputOn && onSelectAppMode('DUAL_PS')}
            disabled={isOutputOn}
            title={isOutputOn ? 'Safety Interlock: Turn Output OFF to switch modes' : 'Switch to Dual Channel Power Supply Mode'}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
              appMode === 'DUAL_PS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            } ${isOutputOn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Layers className="w-3.5 h-3.5" /> DUAL PS MODE
          </button>
          <button
            onClick={() => !isOutputOn && onSelectAppMode('SINGLE_PS')}
            disabled={isOutputOn}
            title={isOutputOn ? 'Safety Interlock: Turn Output OFF to switch modes' : 'Switch to Single Power Supply Mode'}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
              appMode === 'SINGLE_PS'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            } ${isOutputOn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" /> SINGLE PS MODE
          </button>
        </div>
      </div>

      {/* Right Controls & Status */}
      <div className="flex items-center gap-4">
        {/* Hardware Operating Mode Display (Only relevant in Dual PS Mode) */}
        {appMode === 'DUAL_PS' && (
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-black text-slate-600 px-2 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-600" /> MODE:
            </span>
            {connected ? (
              <div
                className="flex items-center gap-2 px-3.5 py-1.5 bg-sky-700 text-white rounded-lg text-xs font-black shadow-xs tracking-wide"
                title="Operating Mode is controlled directly by Hardware HMI (Reg 4X 29 POP_WINDOW)"
              >
                <Lock className="w-3.5 h-3.5 text-sky-200" />
                <span>{activeMode} MODE (HARDWARE READ-ONLY)</span>
              </div>
            ) : (
              (['ISOLATED', 'PARALLEL', 'SERIES'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectMode(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeMode === m
                      ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-700'
                      : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                  title={`Offline Preview Mode: ${m}`}
                >
                  {m}
                </button>
              ))
            )}
          </div>
        )}

        {/* RS485 Connection Badge */}
        <div
          onClick={onOpenSettings}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
            connected
              ? isSimulator
                ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : connectionError
              ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
          }`}
          title={connectionError ? `Connection Error: ${connectionError} (Click to open settings)` : connected ? `Connected to ${isSimulator ? 'Virtual Simulator' : activePort}` : 'Disconnected. Click to configure COM port.'}
        >
          {connectionError && !connected ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
          ) : (
            <Plug className={`w-4 h-4 ${connected ? (isSimulator ? 'text-sky-600' : 'text-emerald-600') : 'text-slate-400'}`} />
          )}
          <span className="font-bold">
            {connected
              ? isSimulator
                ? 'SIMULATOR ACTIVE'
                : `CONNECTED (${activePort})`
              : 'DISCONNECTED'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              connected
                ? isSimulator
                  ? 'bg-sky-500 animate-pulse'
                  : 'bg-emerald-500 animate-pulse'
                : connectionError
                ? 'bg-rose-600'
                : 'bg-slate-400'
            }`}
          />
        </div>

        {/* Diagnostics & Logs Button */}
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Open Modbus Diagnostic Logs Console"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-600" />
            <span>LOGS</span>
            {logCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-mono">
                {logCount}
              </span>
            )}
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition-colors"
          title="COM Port & System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Emergency / Main Output Control */}
        <button
          onClick={onToggleOutput}
          className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase flex items-center gap-2 transition-all shadow-sm ${
            isOutputOn
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
          }`}
        >
          <Power className="w-4 h-4" />
          {isOutputOn ? 'OUTPUT ON (STOP)' : 'OUTPUT OFF (START)'}
        </button>
      </div>
    </header>
  );
};


