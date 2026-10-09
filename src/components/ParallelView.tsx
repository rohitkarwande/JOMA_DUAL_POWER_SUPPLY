import React, { useState, useEffect } from 'react';
import { Layers, Send, AlertTriangle } from 'lucide-react';
import { DualPSTelemetry } from '../types/powerSupply';
import { formatVoltage, formatCurrent } from '../utils/formatters';

interface ParallelViewProps {
  telemetry: DualPSTelemetry;
  onUpdateMasterVset: (val: number) => void;
  onUpdateCh1Iset: (val: number) => void;
  onUpdateCh2Iset: (val: number) => void;
}

export const ParallelView: React.FC<ParallelViewProps> = ({
  telemetry,
  onUpdateMasterVset,
  onUpdateCh1Iset,
  onUpdateCh2Iset,
}) => {
  const vMax = telemetry.maxVoltage || 60.0;
  const iMax = telemetry.maxCurrent || 10.0;

  const masterVset = telemetry.masterVoltageSetpoint || telemetry.ch1.voltageSetpoint;

  const [masterVsetInput, setMasterVsetInput] = useState<string>(masterVset.toString());
  const [ch1IsetInput, setCh1IsetInput] = useState<string>(telemetry.ch1.currentSetpoint.toString());
  const [ch2IsetInput, setCh2IsetInput] = useState<string>(telemetry.ch2.currentSetpoint.toString());
  const [warning, setWarning] = useState<string | null>(null);

  const [isMasterFocused, setIsMasterFocused] = useState(false);
  const [isCh1Focused, setIsCh1Focused] = useState(false);
  const [isCh2Focused, setIsCh2Focused] = useState(false);

  useEffect(() => {
    if (!isMasterFocused) {
      setMasterVsetInput(masterVset.toString());
    }
  }, [masterVset, isMasterFocused]);

  useEffect(() => {
    if (!isCh1Focused) {
      setCh1IsetInput(telemetry.ch1.currentSetpoint.toString());
    }
  }, [telemetry.ch1.currentSetpoint, isCh1Focused]);

  useEffect(() => {
    if (!isCh2Focused) {
      setCh2IsetInput(telemetry.ch2.currentSetpoint.toString());
    }
  }, [telemetry.ch2.currentSetpoint, isCh2Focused]);

  const handleMasterVsetSubmit = () => {
    const val = parseFloat(masterVsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > vMax) {
        setWarning(`⚠️ Master Parallel Vset (${val} V) exceeds V_max register limit (${vMax} V). Change rejected.`);
        setMasterVsetInput(masterVset.toString());
        return;
      }
      setWarning(null);
      onUpdateMasterVset(val);
    }
  };

  const handleCh1IsetSubmit = () => {
    const val = parseFloat(ch1IsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > iMax) {
        setWarning(`⚠️ CH1 Iset (${val} A) exceeds I_max register limit (${iMax} A). Change rejected.`);
        setCh1IsetInput(telemetry.ch1.currentSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateCh1Iset(val);
    }
  };

  const handleCh2IsetSubmit = () => {
    const val = parseFloat(ch2IsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > iMax) {
        setWarning(`⚠️ CH2 Iset (${val} A) exceeds I_max register limit (${iMax} A). Change rejected.`);
        setCh2IsetInput(telemetry.ch2.currentSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateCh2Iset(val);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3.5 select-none">
      {/* Warning Alert Banner */}
      {warning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{warning}</span>
          </div>
          <button onClick={() => setWarning(null)} className="text-amber-700 hover:text-amber-950 font-black px-2">
            ✕
          </button>
        </div>
      )}

      {/* Top Banner: Total Voltage & Total Current Displays */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-black text-slate-800 tracking-tight">PARALLEL CONFIGURATION</h2>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
            TOTAL I = CH1 I + CH2 I
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Total Voltage Readout (PAR_VOLT_MON Reg 4X 17) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Parallel Voltage (PAR_VOLT_MON - Reg 4X 17)
              </label>
            </div>
            <div className="digital-display-total rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-cyan-900 shadow-inner">
              <span>{formatVoltage(telemetry.totalVoltage)}</span>
              <span className="text-cyan-400 text-base font-sans">V</span>
            </div>
          </div>

          {/* Total Current Readout (PAR_CUR_MON Reg 4X 19) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Parallel Current (PAR_CUR_MON - Reg 4X 19)
              </label>
            </div>
            <div className="digital-display-total rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-cyan-900 shadow-inner">
              <span>{formatCurrent(telemetry.totalCurrent)}</span>
              <span className="text-cyan-400 text-base font-sans">A</span>
            </div>
          </div>
        </div>

        {/* Global Master Vset Control (PAR_VOLT_SET Reg 4X 21) */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-black text-indigo-950 tracking-tight whitespace-nowrap uppercase">
              Master Parallel Vset (Reg 4X 21)
            </span>
            <span className="text-[10px] font-bold text-indigo-600">Press Enter ↵ to Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                step="0.001"
                min="0"
                value={masterVsetInput}
                onChange={(e) => setMasterVsetInput(e.target.value)}
                onFocus={() => setIsMasterFocused(true)}
                onBlur={() => setIsMasterFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMasterVsetSubmit();
                }}
                className="w-full bg-white border border-indigo-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                placeholder="0.000"
              />
              <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">V</span>
            </div>
            <button
              onClick={handleMasterVsetSubmit}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" /> WRITE
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Individual CH1 and CH2 Current Controls */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* CH1 Current Setpoint */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-base font-extrabold text-sky-700">CH 1 CURRENT SETPOINT</h3>
            <span className="text-[10px] font-mono text-slate-400">I_SET_ID1 (Reg 4X 11)</span>
          </div>

          <div className="my-2.5">
            <div className="digital-display rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center border border-slate-800">
              <span>{telemetry.ch1.currentSetpoint.toFixed(4)}</span>
              <span className="text-slate-400 text-base font-sans">A</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap uppercase">
                ISET CH1 (Reg 4X 11)
              </span>
              <span className="text-[10px] font-bold text-slate-400">Press Enter ↵</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={ch1IsetInput}
                  onChange={(e) => setCh1IsetInput(e.target.value)}
                  onFocus={() => setIsCh1Focused(true)}
                  onBlur={() => setIsCh1Focused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCh1IsetSubmit();
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  placeholder="0.0000"
                />
                <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">A</span>
              </div>
              <button
                onClick={handleCh1IsetSubmit}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" /> WRITE
              </button>
            </div>
          </div>
        </div>

        {/* CH2 Current Setpoint */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-base font-extrabold text-blue-700">CH 2 CURRENT SETPOINT</h3>
            <span className="text-[10px] font-mono text-slate-400">I_SET_ID2 (Reg 4X 15)</span>
          </div>

          <div className="my-2.5">
            <div className="digital-display-ch2 rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center border border-slate-800">
              <span>{telemetry.ch2.currentSetpoint.toFixed(4)}</span>
              <span className="text-slate-400 text-base font-sans">A</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap uppercase">
                ISET CH2 (Reg 4X 15)
              </span>
              <span className="text-[10px] font-bold text-slate-400">Press Enter ↵</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={ch2IsetInput}
                  onChange={(e) => setCh2IsetInput(e.target.value)}
                  onFocus={() => setIsCh2Focused(true)}
                  onBlur={() => setIsCh2Focused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCh2IsetSubmit();
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  placeholder="0.0000"
                />
                <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">A</span>
              </div>
              <button
                onClick={handleCh2IsetSubmit}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" /> WRITE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


