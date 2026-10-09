import React, { useState } from 'react';
import { Power, Zap, Activity, AlertTriangle } from 'lucide-react';
import { SinglePSTelemetry } from '../types/powerSupply';
import { LiveChart } from './LiveChart';
import { formatVoltage, formatCurrent } from '../utils/formatters';

interface SinglePowerSupplyViewProps {
  telemetry: SinglePSTelemetry;
  connected: boolean;
  onUpdateSetpoints: (params: { vSet?: number; iSet?: number }) => void;
  onToggleOutput: () => void;
  telemetryHistory?: any[];
  maxVoltage?: number;
  maxCurrent?: number;
}

export const SinglePowerSupplyView: React.FC<SinglePowerSupplyViewProps> = ({
  telemetry,
  connected,
  onUpdateSetpoints,
  onToggleOutput,
  telemetryHistory = [],
  maxVoltage = 60.0,
  maxCurrent = 10.0,
}) => {
  const [vSetInput, setVSetInput] = useState<string>(telemetry.vSet ? telemetry.vSet.toString() : '');
  const [iSetInput, setISetInput] = useState<string>(telemetry.iSet ? telemetry.iSet.toString() : '');
  const [isVsetFocused, setIsVsetFocused] = useState(false);
  const [isIsetFocused, setIsIsetFocused] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const isOutputOn = telemetry.outputState === 'ON';

  // Format timestamp / date like HMI top right
  const now = new Date(telemetry.timestamp || Date.now());
  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString();

  // Sync inputs with hardware readouts when user is not actively typing
  React.useEffect(() => {
    if (!isVsetFocused) {
      setVSetInput(telemetry.vSet ? telemetry.vSet.toString() : '0');
    }
  }, [telemetry.vSet, isVsetFocused]);

  React.useEffect(() => {
    if (!isIsetFocused) {
      setISetInput(telemetry.iSet ? telemetry.iSet.toString() : '0');
    }
  }, [telemetry.iSet, isIsetFocused]);

  const handleApplyVset = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;
    if (val < 0 || val > maxVoltage) {
      setWarning(`⚠️ Voltage setpoint must be between 0.000 V and ${maxVoltage} V`);
      return;
    }
    setWarning(null);
    onUpdateSetpoints({ vSet: val });
  };

  const handleApplyIset = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;
    if (val < 0 || val > maxCurrent) {
      setWarning(`⚠️ Current setpoint must be between 0.0000 A and ${maxCurrent} A`);
      return;
    }
    setWarning(null);
    onUpdateSetpoints({ iSet: val });
  };

  return (
    <div className="flex flex-col gap-5 select-none w-full max-w-7xl mx-auto">
      {/* Top Banner Header inspired by HMI Screenshot */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-800 rounded-2xl p-5 text-white shadow-lg border border-blue-400/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
            <Zap className="w-8 h-8 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-black tracking-widest text-cyan-200 uppercase">JOMA Next Gen Power</div>
            <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">SINGLE POWER SUPPLY CONTROL SYSTEM</h2>
            <div className="flex items-center gap-3 text-xs font-bold text-sky-100 mt-1">
              <span className="bg-blue-900/60 px-2.5 py-0.5 rounded-full border border-sky-400/40">Reg 4X Mapping (1..8)</span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                RS485 Modbus RTU Online
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Date & Clock */}
        <div className="bg-black/30 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 text-right font-mono">
          <div className="text-xl font-black tracking-wider text-cyan-300">{timeStr}</div>
          <div className="text-xs font-bold text-slate-300">{dateStr}</div>
        </div>
      </div>

      {/* Safety Interlock Warning Banner */}
      {warning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{warning}</span>
          </div>
          <button onClick={() => setWarning(null)} className="text-amber-700 hover:text-amber-950 font-extrabold px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Primary Display HMI Console */}
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-6 shadow-2xl flex flex-col gap-6 text-white relative overflow-hidden">
        {/* Subtle grid background texture */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Section 1: Measured Values (Vmon & Imon) - Styled like HMI Screenshot Black Displays */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Measured Vmon */}
          <div className="bg-black border-2 border-slate-700 rounded-xl p-5 shadow-inner flex flex-col justify-between relative group hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-black tracking-wider text-slate-400 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Measured Voltage (Vmon)
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-cyan-300">REG 4X 5</span>
            </div>
            <div className="py-4 text-right">
              <span className="font-mono text-5xl md:text-6xl font-black text-cyan-400 tracking-tight drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                {formatVoltage(telemetry.vMon)}
              </span>
              <span className="text-xl font-extrabold text-cyan-600 font-mono ml-2">V</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 flex justify-between pt-1 border-t border-slate-800/80">
              <span>Actual Output Readout</span>
              <span>Resolution: {Math.abs(telemetry.vMon) < 30 ? '0.001' : Math.abs(telemetry.vMon) < 60 ? '0.01' : '0.1'} V</span>
            </div>
          </div>

          {/* Measured Imon */}
          <div className="bg-black border-2 border-slate-700 rounded-xl p-5 shadow-inner flex flex-col justify-between relative group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-sm font-black tracking-wider text-slate-400 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Measured Current (Imon)
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-300">REG 4X 7</span>
            </div>
            <div className="py-4 text-right">
              <span className="font-mono text-5xl md:text-6xl font-black text-emerald-400 tracking-tight drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                {formatCurrent(telemetry.iMon)}
              </span>
              <span className="text-xl font-extrabold text-emerald-600 font-mono ml-2">A</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 flex justify-between pt-1 border-t border-slate-800/80">
              <span>Actual Output Readout</span>
              <span>Resolution: {Math.abs(telemetry.iMon) < 30 ? '0.001' : Math.abs(telemetry.iMon) < 60 ? '0.01' : '0.1'} A</span>
            </div>
          </div>
        </div>

        {/* Section 2: Setpoint Controls (Vset & Iset) - Keyboard Input & Immediate Hardware Write on Enter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Voltage Setpoint Vset */}
          <div className="bg-cyan-950/40 border-2 border-cyan-500/40 rounded-xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2">
                Voltage Setpoint (Vset)
              </span>
              <span className="text-[10px] font-mono font-bold bg-cyan-900/60 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/30">
                REG 4X 1
              </span>
            </div>

            {/* Big Cyan Numeric Display Box */}
            <div className="bg-cyan-400/10 border border-cyan-400/50 rounded-lg p-3 flex items-center justify-between font-mono shadow-inner">
              <span className="text-xs font-bold text-cyan-300 uppercase">Active Vset:</span>
              <span className="text-3xl font-black text-cyan-300 tracking-tight">
                {telemetry.vSet.toFixed(3)} <span className="text-lg text-cyan-500">V</span>
              </span>
            </div>

            {/* Direct Keyboard Input Field - Enter ↵ to Write */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-extrabold text-slate-400">
                <span>Type Value & Press Enter ↵</span>
                <span>(Range: 0 - {maxVoltage} V)</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={maxVoltage}
                  placeholder={`Enter Vset (0-${maxVoltage}V)...`}
                  value={vSetInput}
                  onChange={(e) => setVSetInput(e.target.value)}
                  onFocus={() => setIsVsetFocused(true)}
                  onBlur={() => {
                    setIsVsetFocused(false);
                    handleApplyVset(vSetInput);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyVset(vSetInput);
                      e.currentTarget.blur();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-cyan-500/50 rounded-lg px-3.5 py-2.5 font-mono text-base font-bold text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-inner"
                />
                <button
                  onClick={() => handleApplyVset(vSetInput)}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  WRITE ↵
                </button>
              </div>
            </div>
          </div>

          {/* Current Setpoint Iset */}
          <div className="bg-emerald-950/40 border-2 border-emerald-500/40 rounded-xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wider text-emerald-300 uppercase flex items-center gap-2">
                Current Setpoint (Iset)
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/30">
                REG 4X 3
              </span>
            </div>

            {/* Big Cyan Numeric Display Box */}
            <div className="bg-emerald-400/10 border border-emerald-400/50 rounded-lg p-3 flex items-center justify-between font-mono shadow-inner">
              <span className="text-xs font-bold text-emerald-300 uppercase">Active Iset:</span>
              <span className="text-3xl font-black text-emerald-300 tracking-tight">
                {telemetry.iSet.toFixed(4)} <span className="text-lg text-emerald-500">A</span>
              </span>
            </div>

            {/* Direct Keyboard Input Field - Enter ↵ to Write */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] font-extrabold text-slate-400">
                <span>Type Value & Press Enter ↵</span>
                <span>(Range: 0 - {maxCurrent} A)</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max={maxCurrent}
                  placeholder={`Enter Iset (0-${maxCurrent}A)...`}
                  value={iSetInput}
                  onChange={(e) => setISetInput(e.target.value)}
                  onFocus={() => setIsIsetFocused(true)}
                  onBlur={() => {
                    setIsIsetFocused(false);
                    handleApplyIset(iSetInput);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyIset(iSetInput);
                      e.currentTarget.blur();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-emerald-500/50 rounded-lg px-3.5 py-2.5 font-mono text-base font-bold text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-inner"
                />
                <button
                  onClick={() => handleApplyIset(iSetInput)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  WRITE ↵
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Bottom Control Bar inspired by HMI Screenshot (Red Light Bulb & ON / OFF Push Buttons) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-6 relative z-10">
          {/* Output Status Indicator Bulb (Red OFF / Green ON) */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isOutputOn
                    ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.8)] animate-pulse'
                    : 'bg-rose-600 border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.6)]'
                }`}
              />
              <div
                className={`w-4 h-4 rounded-full bg-white/40 absolute top-1 left-2 pointer-events-none blur-[1px]`}
              />
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                COIL 0X 1 OUTPUT STATUS
              </span>
              <div className="text-xl font-black tracking-tight flex items-center gap-2 mt-0.5">
                <span className={isOutputOn ? 'text-emerald-400' : 'text-rose-500'}>
                  {isOutputOn ? 'OUTPUT HIGH (ENERGIZED)' : 'OUTPUT LOW (DISABLED)'}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Calculated Power Display */}
          <div className="bg-slate-900 border border-slate-800 px-6 py-2.5 rounded-xl flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Output Power</span>
              <span className="text-2xl font-black text-amber-300 font-mono">
                {telemetry.powerActual.toFixed(2)} <span className="text-xs text-amber-500">W</span>
              </span>
            </div>
          </div>

          {/* HMI Push Buttons: [ ON ] & [ OFF ] */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => !isOutputOn && onToggleOutput()}
              disabled={isOutputOn || !connected}
              className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${
                isOutputOn
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50 hover:shadow-emerald-600/50 active:scale-95 cursor-pointer border border-emerald-400/40'
              }`}
            >
              <Power className="w-4 h-4" /> ON
            </button>

            <button
              onClick={() => isOutputOn && onToggleOutput()}
              disabled={!isOutputOn || !connected}
              className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${
                !isOutputOn
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50 hover:shadow-rose-600/50 active:scale-95 cursor-pointer border border-rose-400/40 animate-pulse'
              }`}
            >
              <Power className="w-4 h-4" /> OFF
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Live Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" /> Single Power Supply Live Telemetry Graph
          </h3>
          <span className="text-xs font-semibold text-slate-400">Plotting Vmon (V) & Imon (A)</span>
        </div>
        <LiveChart telemetryHistory={telemetryHistory} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
      </div>
    </div>
  );
};

export default SinglePowerSupplyView;
