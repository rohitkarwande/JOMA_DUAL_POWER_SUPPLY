import React from 'react';
import { JomaLogo } from './JomaLogo';
import { OperatingMode, OutputState } from '../types/powerSupply';
import { Activity, Plug, Power, Settings, Lock } from 'lucide-react';

interface HeaderProps {
  connected: boolean;
  activePort?: string;
  outputState: OutputState;
  activeMode: OperatingMode;
  onToggleOutput: () => void;
  onOpenSettings: () => void;
  onSelectMode: (mode: OperatingMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  activePort = 'COM1',
  outputState,
  activeMode,
  onToggleOutput,
  onOpenSettings,
  onSelectMode,
}) => {
  const isOutputOn = outputState === 'ON';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm select-none">
      {/* Left Branding */}
      <div className="flex items-center gap-5">
        <JomaLogo height={34} />
        <div className="h-6 w-px bg-slate-200" />
        <div>
          <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Dual Channel Power Supply
          </h1>
          <p className="text-[11px] font-semibold text-slate-400">RS485 Modbus RTU Control System</p>
        </div>
      </div>

      {/* Right Controls & Status */}
      <div className="flex items-center gap-4">
        {/* Operating Mode Display / Selector */}
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

        {/* RS485 Connection Badge */}
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold cursor-pointer transition-colors"
        >
          <Plug className={`w-4 h-4 ${connected ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-slate-700 font-medium">
            {connected ? `CONNECTED (${activePort})` : 'DISCONNECTED'}
          </span>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        </div>

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

