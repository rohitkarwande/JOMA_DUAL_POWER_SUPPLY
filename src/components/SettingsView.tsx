import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Clock, HardDrive, CheckCircle2, Lock, Activity, Info } from 'lucide-react';
import { OperatingMode } from '../types/powerSupply';

interface SettingsViewProps {
  maxVoltage?: number;
  maxCurrent?: number;
  loggingIntervalMs: number;
  onUpdateLoggingInterval: (intervalMs: number) => void;
  activeMode: OperatingMode;
  isLoggingActive: boolean;
  loggedSamplesCount: number;
  activeSessionDurationSec: number;
  connected: boolean;
}

const PRESET_MINUTES = [
  { label: '0.1 min', sec: '6s', value: 0.1 },
  { label: '0.5 min', sec: '30s', value: 0.5 },
  { label: '1.0 min', sec: '60s', value: 1.0 },
  { label: '2.0 min', sec: '120s', value: 2.0 },
  { label: '5.0 min', sec: '300s', value: 5.0 },
  { label: '10.0 min', sec: '600s', value: 10.0 },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  maxVoltage = 60.0,
  maxCurrent = 10.0,
  loggingIntervalMs,
  onUpdateLoggingInterval,
  activeMode,
  isLoggingActive,
  loggedSamplesCount,
  activeSessionDurationSec,
  connected,
}) => {
  const [saveToast, setSaveToast] = useState(false);
  const [minutesInput, setMinutesInput] = useState<string>(
    Number((loggingIntervalMs / 60000).toFixed(4)).toString()
  );

  useEffect(() => {
    setMinutesInput(Number((loggingIntervalMs / 60000).toFixed(4)).toString());
  }, [loggingIntervalMs]);

  const handleApplyMinutes = (valStr: string) => {
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      // Minimum 0.02 minutes (~1.2s) to prevent RS485 queue congestion, max 120 minutes
      const clampedMinutes = Math.max(0.02, Math.min(120, parsed));
      const intervalMs = Math.round(clampedMinutes * 60000);
      onUpdateLoggingInterval(intervalMs);
      setMinutesInput(clampedMinutes.toString());
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    }
  };

  const calculateSecDisplay = (valStr: string): string => {
    const parsed = parseFloat(valStr);
    if (isNaN(parsed) || parsed <= 0) return 'Invalid';
    const totalSec = parsed * 60;
    if (totalSec < 60) return `${totalSec.toFixed(1)} seconds (${Math.round(totalSec * 1000)} ms)`;
    const m = Math.floor(totalSec / 60);
    const s = Math.round(totalSec % 60);
    return `${m}m ${s > 0 ? s + 's' : ''} (${Math.round(totalSec * 1000)} ms)`;
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-6 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 shadow-2xs">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">System Settings & Data Logging Configuration</h2>
            <p className="text-xs text-slate-500 font-semibold">Dual Channel Power Supply Hardware Limits & Telemetry Report Logging Engine</p>
          </div>
        </div>

        {saveToast && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Logging Interval Saved & Persisted</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Read-Only Hardware Limits */}
        <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Hardware Safety Limits</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3" /> READ-ONLY REGISTERS
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            These factory values are fetched directly from holding registers <strong>4X 30 (v_max)</strong> and <strong>4X 32 (I_max)</strong>. They cannot be edited via SCADA software to protect hardware from over-range conditions.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-1">
            {/* Vmax Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Vmax (v_max)</span>
                <span className="text-[10px] font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">REG 4X 30</span>
              </div>
              <div className="my-3 text-right">
                <span className="font-mono text-3xl font-black text-sky-700">
                  {connected && maxVoltage > 0 ? maxVoltage.toFixed(2) : (60.0).toFixed(2)}
                </span>
                <span className="text-base font-bold text-sky-600 font-mono ml-1.5">V</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2">
                <span>Maximum Voltage</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Locked
                </span>
              </div>
            </div>

            {/* Imax Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Imax (I_max)</span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">REG 4X 32</span>
              </div>
              <div className="my-3 text-right">
                <span className="font-mono text-3xl font-black text-emerald-700">
                  {connected && maxCurrent > 0 ? maxCurrent.toFixed(2) : (10.0).toFixed(2)}
                </span>
                <span className="text-base font-bold text-emerald-600 font-mono ml-1.5">A</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2">
                <span>Maximum Current</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Locked
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2 font-medium">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              All manual channel setpoints (Vset, Iset) and automated test sequences are bounded by these maximum limits. Any input exceeding these boundaries is automatically blocked.
            </span>
          </div>
        </div>

        {/* Section 2: Configurable Logging Interval in Minutes */}
        <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Report Telemetry Logging Interval</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
              CONFIGURED IN MINUTES
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Enter the telemetry data logging frequency in <strong>minutes</strong> for normal Dual Power Supply modes (Isolated, Series, Parallel). When Output is energized, data is logged at this interval for the official PDF test report.
          </p>

          {/* Numeric Minutes Input Box */}
          <div className="bg-white border-2 border-slate-200 focus-within:border-sky-500 rounded-xl p-4 shadow-2xs flex flex-col gap-3 transition-colors">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Telemetry Logging Interval (Minutes)</span>
              <span className="text-[11px] font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                Active: {(loggingIntervalMs / 60000).toFixed(2)} min ({(loggingIntervalMs / 1000).toFixed(1)}s)
              </span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.02"
                  max="120"
                  disabled={isLoggingActive}
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyMinutes(minutesInput);
                  }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-mono text-base font-black text-slate-800 focus:outline-none focus:bg-white transition-all ${
                    isLoggingActive
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                      : 'border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100'
                  }`}
                  placeholder="Enter minutes (e.g. 1)"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Minutes
                </span>
              </div>

              <button
                type="button"
                disabled={isLoggingActive}
                onClick={() => handleApplyMinutes(minutesInput)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${
                  isLoggingActive
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-100 cursor-pointer active:scale-95'
                }`}
              >
                Apply
              </button>
            </div>

            {/* Helper conversion display */}
            <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
              <span>
                Equivalent: <strong className="text-slate-700 font-mono">{calculateSecDisplay(minutesInput)}</strong>
              </span>
              <span className="text-slate-400">
                Min: 0.02 min (1.2s) • Max: 120 min
              </span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Preset Intervals:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PRESET_MINUTES.map((p) => {
                const isActive = Math.abs(loggingIntervalMs - p.value * 60000) < 50;
                return (
                  <button
                    key={p.value}
                    type="button"
                    disabled={isLoggingActive}
                    onClick={() => handleApplyMinutes(p.value.toString())}
                    className={`px-2 py-2 rounded-lg text-xs font-bold font-mono transition-all border flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    } ${isLoggingActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span>{p.label}</span>
                    <span className={`text-[10px] ${isActive ? 'text-sky-100' : 'text-slate-400'}`}>
                      {p.sec}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium pt-1">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Persisted to application storage and restored across restarts</span>
          </div>
        </div>
      </div>

      {/* Section 3: Live Automated Logging Engine Status Card */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-white flex flex-col gap-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Active Telemetry Logging Engine Status
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isLoggingActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
              }`}
            />
            <span className="text-xs font-black tracking-wider uppercase font-mono">
              {isLoggingActive ? 'LOGGING IN PROGRESS' : 'STANDBY (OUTPUT OFF)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Mode</span>
            <span className="text-sm font-black text-cyan-300 font-mono mt-1 block">{activeMode}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sampling Interval</span>
            <span className="text-sm font-black text-slate-100 font-mono mt-1 block">
              {(loggingIntervalMs / 60000).toFixed(2)} min ({(loggingIntervalMs / 1000).toFixed(1)}s)
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Session Samples Logged</span>
            <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">
              {loggedSamplesCount} samples
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Elapsed Time</span>
            <span className="text-sm font-black text-amber-300 font-mono mt-1 block">
              {formatDurationStr(activeSessionDurationSec)}
            </span>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
          <span>
            🔄 <strong>Workflow:</strong> When Output turns <strong>ON</strong>, a new test session starts automatically. When Output turns <strong>OFF</strong>, the session completes and an official PDF test report is automatically generated and archived in the Reports tab.
          </span>
        </div>
      </div>
    </div>
  );
};

function formatDurationStr(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}
