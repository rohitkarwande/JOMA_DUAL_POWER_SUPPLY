import React, { useState, useEffect } from 'react';
import { Zap, Send, AlertTriangle } from 'lucide-react';
import { DualPSTelemetry } from '../types/powerSupply';
import { formatVoltage, formatCurrent } from '../utils/formatters';

interface SeriesViewProps {
  telemetry: DualPSTelemetry;
  onUpdateMasterIset: (val: number) => void;
  onUpdateCh1Vset: (val: number) => void;
  onUpdateCh2Vset: (val: number) => void;
}

export const SeriesView: React.FC<SeriesViewProps> = ({
  telemetry,
  onUpdateMasterIset,
  onUpdateCh1Vset,
  onUpdateCh2Vset,
}) => {
  const vMax = telemetry.maxVoltage || 60.0;
  const iMax = telemetry.maxCurrent || 10.0;

  const masterIset = telemetry.masterCurrentSetpoint || telemetry.ch1.currentSetpoint;

  const [masterIsetInput, setMasterIsetInput] = useState<string>(masterIset.toString());
  const [ch1VsetInput, setCh1VsetInput] = useState<string>(telemetry.ch1.voltageSetpoint.toString());
  const [ch2VsetInput, setCh2VsetInput] = useState<string>(telemetry.ch2.voltageSetpoint.toString());
  const [warning, setWarning] = useState<string | null>(null);

  const [isMasterFocused, setIsMasterFocused] = useState(false);
  const [isCh1Focused, setIsCh1Focused] = useState(false);
  const [isCh2Focused, setIsCh2Focused] = useState(false);

  useEffect(() => {
    if (!isMasterFocused) {
      setMasterIsetInput(masterIset.toString());
    }
  }, [masterIset, isMasterFocused]);

  useEffect(() => {
    if (!isCh1Focused) {
      setCh1VsetInput(telemetry.ch1.voltageSetpoint.toString());
    }
  }, [telemetry.ch1.voltageSetpoint, isCh1Focused]);

  useEffect(() => {
    if (!isCh2Focused) {
      setCh2VsetInput(telemetry.ch2.voltageSetpoint.toString());
    }
  }, [telemetry.ch2.voltageSetpoint, isCh2Focused]);

  const handleMasterIsetSubmit = () => {
    const val = parseFloat(masterIsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > iMax) {
        setWarning(`⚠️ Master Series Iset (${val} A) exceeds I_max register limit (${iMax} A). Change rejected.`);
        setMasterIsetInput(masterIset.toString());
        return;
      }
      setWarning(null);
      onUpdateMasterIset(val);
    }
  };

  const handleCh1VsetSubmit = () => {
    const val = parseFloat(ch1VsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > vMax) {
        setWarning(`⚠️ CH1 Vset (${val} V) exceeds V_max register limit (${vMax} V). Change rejected.`);
        setCh1VsetInput(telemetry.ch1.voltageSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateCh1Vset(val);
    }
  };

  const handleCh2VsetSubmit = () => {
    const val = parseFloat(ch2VsetInput);
    if (!isNaN(val) && val >= 0) {
      if (val > vMax) {
        setWarning(`⚠️ CH2 Vset (${val} V) exceeds V_max register limit (${vMax} V). Change rejected.`);
        setCh2VsetInput(telemetry.ch2.voltageSetpoint.toString());
        return;
      }
      setWarning(null);
      onUpdateCh2Vset(val);
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
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-black text-slate-800 tracking-tight">SERIES CONFIGURATION</h2>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
            TOTAL V = CH1 V + CH2 V
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Total Voltage Readout (SER_VOLT_MON Reg 4X 23) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Series Voltage (SER_VOLT_MON - Reg 4X 23)
              </label>
            </div>
            <div className="digital-display-total rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-cyan-900 shadow-inner">
              <span>{formatVoltage(telemetry.totalVoltage)}</span>
              <span className="text-cyan-400 text-base font-sans">V</span>
            </div>
          </div>

          {/* Total Current Readout (SER_CUR_MON Reg 4X 25) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Series Current (SER_CUR_MON - Reg 4X 25)
              </label>
            </div>
            <div className="digital-display-total rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center mt-0.5 border border-cyan-900 shadow-inner">
              <span>{formatCurrent(telemetry.totalCurrent)}</span>
              <span className="text-cyan-400 text-base font-sans">A</span>
            </div>
          </div>
        </div>

        {/* Global Master Iset Control (SER_CUR_SET Reg 4X 27) */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-black text-amber-950 tracking-tight whitespace-nowrap uppercase">
              Master Series Iset (Reg 4X 27)
            </span>
            <span className="text-[10px] font-bold text-amber-600">Press Enter ↵ to Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={masterIsetInput}
                onChange={(e) => setMasterIsetInput(e.target.value)}
                onFocus={() => setIsMasterFocused(true)}
                onBlur={() => setIsMasterFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMasterIsetSubmit();
                }}
                className="w-full bg-white border border-amber-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                placeholder="0.0000"
              />
              <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">A</span>
            </div>
            <button
              onClick={handleMasterIsetSubmit}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" /> WRITE
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Individual CH1 and CH2 Voltage Controls */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* CH1 Voltage Setpoint */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-base font-extrabold text-sky-700">CH 1 VOLTAGE SETPOINT</h3>
            <span className="text-[10px] font-mono text-slate-400">V_SET_ID1 (Reg 4X 9)</span>
          </div>

          <div className="my-2.5">
            <div className="digital-display rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center border border-slate-800">
              <span>{telemetry.ch1.voltageSetpoint.toFixed(3)}</span>
              <span className="text-slate-400 text-base font-sans">V</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap uppercase">
                Vset CH1
              </span>
              <span className="text-[10px] font-bold text-slate-400">Press Enter ↵</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={ch1VsetInput}
                  onChange={(e) => setCh1VsetInput(e.target.value)}
                  onFocus={() => setIsCh1Focused(true)}
                  onBlur={() => setIsCh1Focused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCh1VsetSubmit();
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  placeholder="0.000"
                />
                <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">V</span>
              </div>
              <button
                onClick={handleCh1VsetSubmit}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" /> WRITE
              </button>
            </div>
          </div>
        </div>

        {/* CH2 Voltage Setpoint */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-base font-extrabold text-blue-700">CH 2 VOLTAGE SETPOINT</h3>
            <span className="text-[10px] font-mono text-slate-400">V_SET_ID2 (Reg 4X 13)</span>
          </div>

          <div className="my-2.5">
            <div className="digital-display-ch2 rounded-lg p-2.5 text-2xl font-bold flex justify-between items-center border border-slate-800">
              <span>{telemetry.ch2.voltageSetpoint.toFixed(3)}</span>
              <span className="text-slate-400 text-base font-sans">V</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap uppercase">
                Vset CH2
              </span>
              <span className="text-[10px] font-bold text-slate-400">Press Enter ↵</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={ch2VsetInput}
                  onChange={(e) => setCh2VsetInput(e.target.value)}
                  onFocus={() => setIsCh2Focused(true)}
                  onBlur={() => setIsCh2Focused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCh2VsetSubmit();
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 pr-7 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  placeholder="0.000"
                />
                <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400">V</span>
              </div>
              <button
                onClick={handleCh2VsetSubmit}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-md shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
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

