import React, { useState, useEffect } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { formatVoltage, formatCurrent } from '../utils/formatters';

interface ChannelCardProps {
  channelNumber: 1 | 2;
  title: string;
  voltageActual: number;
  currentActual: number;
  voltageSetpoint: number;
  currentSetpoint: number;
  powerActual: number;
  isCh2Theme?: boolean;
  maxVoltage?: number;
  maxCurrent?: number;
  onUpdateVset: (newVset: number) => void;
  onUpdateIset: (newIset: number) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channelNumber,
  title,
  voltageActual,
  currentActual,
  voltageSetpoint,
  currentSetpoint,
  powerActual,
  isCh2Theme = false,
  maxVoltage = 60.0,
  maxCurrent = 10.0,
  onUpdateVset,
  onUpdateIset,
}) => {
  const accentColorClass = isCh2Theme ? 'text-blue-700' : 'text-sky-700';
  const badgeBgClass = isCh2Theme ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-sky-50 text-sky-700 border-sky-200';
  const digitalClass = isCh2Theme ? 'digital-display-ch2' : 'digital-display';
  const btnBgClass = isCh2Theme ? 'bg-blue-600 hover:bg-blue-700' : 'bg-sky-600 hover:bg-sky-700';

  const [vsetInput, setVsetInput] = useState<string>(voltageSetpoint.toString());
  const [isetInput, setIsetInput] = useState<string>(currentSetpoint.toString());
  const [warning, setWarning] = useState<string | null>(null);

  const [isVsetFocused, setIsVsetFocused] = useState(false);
  const [isIsetFocused, setIsIsetFocused] = useState(false);

  useEffect(() => {
    if (!isVsetFocused) {
      setVsetInput(voltageSetpoint.toString());
    }
  }, [voltageSetpoint, isVsetFocused]);

  useEffect(() => {
    if (!isIsetFocused) {
      setIsetInput(currentSetpoint.toString());
    }
  }, [currentSetpoint, isIsetFocused]);

  const handleVsetSubmit = () => {
    const val = parseFloat(vsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > maxVoltage) {
        setWarning(`⚠️ Voltage setpoint (${val} V) exceeds V_max register limit (${maxVoltage} V). Change rejected.`);
        setVsetInput(voltageSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateVset(val);
    }
  };

  const handleIsetSubmit = () => {
    const val = parseFloat(isetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > maxCurrent) {
        setWarning(`⚠️ Current setpoint (${val} A) exceeds I_max register limit (${maxCurrent} A). Change rejected.`);
        setIsetInput(currentSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateIset(val);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition-shadow">
      {/* Channel Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
        <h2 className={`text-base font-extrabold ${accentColorClass}`}>{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">P: {powerActual.toFixed(2)} W</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeBgClass}`}>
            CH{channelNumber} ONLINE
          </span>
        </div>
      </div>

      {warning && (
        <div className="mt-2 bg-amber-50 border border-amber-300 text-amber-900 p-2 rounded-lg flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{warning}</span>
          </div>
          <button onClick={() => setWarning(null)} className="text-amber-700 hover:text-amber-950 font-black px-1">
            ✕
          </button>
        </div>
      )}

      {/* Side-by-Side Main Telemetry Readouts (7-Segment Style) */}
      <div className="grid grid-cols-2 gap-3 my-2.5">
        {/* Voltage Monitor */}
        <div>
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voltage (Vmon)</label>
            <span className="text-[10px] font-mono text-slate-400">Reg {channelNumber === 1 ? '4X 1' : '4X 5'}</span>
          </div>
          <div className={`${digitalClass} rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-slate-800`}>
            <span>{formatVoltage(voltageActual)}</span>
            <span className="text-slate-400 text-base font-sans">V</span>
          </div>
        </div>

        {/* Current Monitor */}
        <div>
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current (Imon)</label>
            <span className="text-[10px] font-mono text-slate-400">Reg {channelNumber === 1 ? '4X 3' : '4X 7'}</span>
          </div>
          <div className={`${digitalClass} rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-slate-800`}>
            <span>{formatCurrent(currentActual)}</span>
            <span className="text-slate-400 text-base font-sans">A</span>
          </div>
        </div>
      </div>

      {/* Setpoint Controls with Keyboard Input & Enter to Write */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        {/* Voltage Setpoint (Vset) */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap">
              VSET (Reg {channelNumber === 1 ? '4X 9' : '4X 13'})
            </span>
            <span className="text-[10px] font-bold text-slate-400">Press Enter ↵ to Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                step="0.001"
                min="0"
                value={vsetInput}
                onChange={(e) => setVsetInput(e.target.value)}
                onFocus={() => setIsVsetFocused(true)}
                onBlur={() => setIsVsetFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVsetSubmit();
                }}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                placeholder="0.000"
              />
              <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">V</span>
            </div>
            <button
              onClick={handleVsetSubmit}
              className={`px-3.5 py-1.5 ${btnBgClass} text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap`}
              title="Write to Register"
            >
              <Send className="w-3.5 h-3.5" /> WRITE
            </button>
          </div>
        </div>

        {/* Current Setpoint (Iset) */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap">
              ISET (Reg {channelNumber === 1 ? '4X 11' : '4X 15'})
            </span>
            <span className="text-[10px] font-bold text-slate-400">Press Enter ↵ to Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={isetInput}
                onChange={(e) => setIsetInput(e.target.value)}
                onFocus={() => setIsIsetFocused(true)}
                onBlur={() => setIsIsetFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleIsetSubmit();
                }}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                placeholder="0.0000"
              />
              <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">A</span>
            </div>
            <button
              onClick={handleIsetSubmit}
              className={`px-3.5 py-1.5 ${btnBgClass} text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap`}
              title="Write to Register"
            >
              <Send className="w-3.5 h-3.5" /> WRITE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

