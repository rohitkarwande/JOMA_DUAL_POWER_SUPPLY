import React, { useState } from 'react';
import { Play, Square, Plus, Trash2, ListOrdered, Layers, AlertTriangle, ShieldAlert } from 'lucide-react';
import { SequenceStep, OperatingMode, DualPSTelemetry } from '../types/powerSupply';
import { SequenceProgress } from '../../electron/modbusRtuService';
import { LiveChart } from './LiveChart';

interface SequenceBuilderProps {
  connected: boolean;
  outputState: string;
  hardwareMode?: OperatingMode;
  onRunSequence: (steps: SequenceStep[], cycles: number) => void;
  onStopSequence: () => void;
  isRunning: boolean;
  progress?: SequenceProgress | null;
  telemetryHistory?: DualPSTelemetry[];
  maxVoltage?: number;
  maxCurrent?: number;
}

export const SequenceBuilder: React.FC<SequenceBuilderProps> = ({
  connected,
  outputState,
  hardwareMode = 'ISOLATED',
  onRunSequence,
  onStopSequence,
  isRunning,
  progress,
  telemetryHistory = [],
  maxVoltage = 60.0,
  maxCurrent = 10.0,
}) => {
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [cycles, setCycles] = useState<number | string>(1);

  const [steps, setSteps] = useState<any[]>([
    {
      id: 'step_iso_1',
      stepNumber: 1,
      durationSeconds: 10,
      mode: 'ISOLATED',
      ch1Vset: 12.0,
      ch1Iset: 1.5,
      ch2Vset: 12.0,
      ch2Iset: 1.5,
    },
  ]);

  const isHardwareIsolated = hardwareMode === 'ISOLATED';

  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    const newStep: any = {
      id: `step_${Date.now()}`,
      stepNumber: nextNum,
      durationSeconds: 10,
      mode: 'ISOLATED',
      ch1Vset: 12.0,
      ch1Iset: 1.0,
      ch2Vset: 12.0,
      ch2Iset: 1.0,
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    );
  };

  const handleUpdateStep = (id: string, field: string, val: any) => {
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      if ((field.includes('Vset') || field.includes('vset')) && numVal > maxVoltage) {
        setLimitWarning(`⚠️ Warning: Voltage setpoint cannot exceed V_max limit (${maxVoltage} V). Input blocked.`);
        return;
      }
      if ((field.includes('Iset') || field.includes('iset')) && numVal > maxCurrent) {
        setLimitWarning(`⚠️ Warning: Current setpoint cannot exceed I_max limit (${maxCurrent} A). Input blocked.`);
        return;
      }
    }
    setLimitWarning(null);
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleStartSequence = () => {
    if (!isHardwareIsolated) {
      setLimitWarning(`⚠️ Cannot start sequence: Hardware Register 4X 29 must be in ISOLATED mode (Current: ${hardwareMode}).`);
      return;
    }

    // Validate all setpoints before launching sequence
    for (const s of steps) {
      const v1 = parseFloat(String(s.ch1Vset)) || 0;
      const v2 = parseFloat(String(s.ch2Vset)) || 0;
      const i1 = parseFloat(String(s.ch1Iset)) || 0;
      const i2 = parseFloat(String(s.ch2Iset)) || 0;

      if (v1 > maxVoltage || v2 > maxVoltage) {
        setLimitWarning(`⚠️ Cannot start sequence: Step ${s.stepNumber} voltage exceeds V_max limit (${maxVoltage} V).`);
        return;
      }
      if (i1 > maxCurrent || i2 > maxCurrent) {
        setLimitWarning(`⚠️ Cannot start sequence: Step ${s.stepNumber} current exceeds I_max limit (${maxCurrent} A).`);
        return;
      }
    }

    setLimitWarning(null);

    const sanitizedSteps: SequenceStep[] = steps.map((s) => ({
      id: s.id,
      stepNumber: s.stepNumber,
      mode: 'ISOLATED',
      durationSeconds: Math.max(1, parseFloat(String(s.durationSeconds)) || 1),
      ch1Vset: parseFloat(String(s.ch1Vset)) || 0,
      ch1Iset: parseFloat(String(s.ch1Iset)) || 0,
      ch2Vset: parseFloat(String(s.ch2Vset)) || 0,
      ch2Iset: parseFloat(String(s.ch2Iset)) || 0,
    }));
    const sanitizedCycles = Math.max(1, parseInt(String(cycles), 10) || 1);
    onRunSequence(sanitizedSteps, sanitizedCycles);
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-6 select-none overflow-hidden">
      {/* Top Header Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-5 h-5 text-sky-600" />
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Automated Sequence / Recipe Builder</h2>
            <p className="text-xs text-slate-500 font-semibold">Multi-step test execution engine (Isolated Mode)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Read-Only Recipe Mode Badge */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-black text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-600" /> RECIPE MODE:
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-sky-600 text-white shadow-xs tracking-wide uppercase">
              ISOLATED (READ-ONLY)
            </span>
          </div>

          {/* Total Cycles Box */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
            <span className="text-slate-700 font-extrabold whitespace-nowrap">Total Cycles:</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={cycles}
              onChange={(e) => setCycles(e.target.value)}
              className="w-28 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-center font-mono text-base font-black text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
            />
          </div>

          <button
            onClick={handleAddStep}
            disabled={isRunning || progress?.status === 'INITIALIZING'}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add Step
          </button>

          {/* START SEQUENCE Button (Enabled ONLY when Connected, Output OFF, & Hardware is in ISOLATED mode) */}
          {(() => {
            const isRunningOrInit = isRunning || progress?.status === 'INITIALIZING' || progress?.status === 'RUNNING';
            const isStartDisabled = !connected || outputState !== 'OFF' || isRunningOrInit || steps.length === 0 || !isHardwareIsolated;
            const isStopDisabled = !isRunningOrInit;

            return (
              <>
                <button
                  disabled={isStartDisabled}
                  onClick={handleStartSequence}
                  title={
                    !connected
                      ? 'Hardware is disconnected'
                      : outputState !== 'OFF'
                      ? 'Hardware Output is ON — Turn Output OFF first to enable START SEQUENCE'
                      : !isHardwareIsolated
                      ? `Hardware Register 4X 29 is in ${hardwareMode} mode. Test Sequence requires ISOLATED mode.`
                      : isRunningOrInit
                      ? 'Sequence is currently active'
                      : steps.length === 0
                      ? 'Add at least 1 step to start sequence'
                      : 'Start Automated Test Sequence'
                  }
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase flex items-center gap-2 shadow-md transition-all ${
                    isStartDisabled
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  START SEQUENCE
                </button>

                {/* TEST SEQUENCE OFF Button */}
                <button
                  disabled={isStopDisabled}
                  onClick={onStopSequence}
                  title={isStopDisabled ? 'No active sequence running' : 'Safely Stop Automated Test Sequence & Turn Output OFF'}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase flex items-center gap-2 shadow-md transition-all ${
                    isStopDisabled
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 animate-pulse cursor-pointer'
                  }`}
                >
                  <Square className="w-4 h-4 fill-current" />
                  TEST SEQUENCE OFF
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Hardware Register Mode Interlock Warning Banner */}
      {connected && !isHardwareIsolated && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            ⚠️ <strong>Hardware Interlock:</strong> Automated Test Sequence execution is disabled because Hardware Register 4X 29 is currently set to <span className="underline font-black">{hardwareMode}</span> mode. Hardware Register 4X 29 must be in <strong>ISOLATED</strong> mode to start a sequence.
          </span>
        </div>
      )}

      {/* Limit Warning Alert Banner */}
      {limitWarning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{limitWarning}</span>
          </div>
          <button
            onClick={() => setLimitWarning(null)}
            className="text-amber-700 hover:text-amber-950 font-extrabold text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Sequence Progress Status Banner */}
      {progress && progress.status !== 'IDLE' && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex flex-wrap items-center justify-between gap-4 transition-all ${
            progress.status === 'RUNNING'
              ? 'bg-sky-50 border-sky-200 text-sky-900 shadow-2xs'
              : progress.status === 'ERROR'
              ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-2xs'
              : progress.status === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-2xs'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                progress.status === 'RUNNING'
                  ? 'bg-sky-500 animate-ping'
                  : progress.status === 'ERROR'
                  ? 'bg-rose-600'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="font-extrabold uppercase tracking-wider text-sm">
              Status: {progress.status}
            </span>
            {progress.errorMsg && (
              <span className="font-semibold text-rose-700 font-mono ml-2">
                [{progress.errorMsg}]
              </span>
            )}
          </div>

          {progress.status === 'RUNNING' && (
            <div className="flex items-center gap-6 font-mono text-sm font-extrabold">
              <div>
                Cycle: <span className="text-sky-700">{progress.currentCycle} / {progress.totalCycles}</span>
              </div>
              <div>
                Step: <span className="text-sky-700">{progress.currentStepIndex + 1} / {progress.totalSteps}</span>
              </div>
              <div className="bg-white px-3 py-1 rounded-lg border border-sky-200 text-sky-800 shadow-2xs">
                Remaining: <span className="text-base text-sky-600 font-black">{progress.stepRemainingSeconds}s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steps Table (ISOLATED Mode Only) */}
      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3">Step #</th>
              <th className="p-3">Duration (sec)</th>
              <th className="p-3 text-sky-700">CH1 Vset (V)</th>
              <th className="p-3 text-sky-700">CH1 Iset (A)</th>
              <th className="p-3 text-blue-700">CH2 Vset (V)</th>
              <th className="p-3 text-blue-700">CH2 Iset (A)</th>
              <th className="p-3 text-right">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {steps.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-bold text-sky-700 font-mono">Step {s.stepNumber}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min="1"
                    value={s.durationSeconds}
                    onChange={(e) => handleUpdateStep(s.id, 'durationSeconds', e.target.value)}
                    className="w-32 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-black text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                  />
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    step="0.001"
                    value={s.ch1Vset}
                    onChange={(e) => handleUpdateStep(s.id, 'ch1Vset', e.target.value)}
                    className="w-36 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-black text-sky-700 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.0001"
                    value={s.ch1Iset}
                    onChange={(e) => handleUpdateStep(s.id, 'ch1Iset', e.target.value)}
                    className="w-36 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-black text-sky-700 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.001"
                    value={s.ch2Vset}
                    onChange={(e) => handleUpdateStep(s.id, 'ch2Vset', e.target.value)}
                    className="w-36 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-black text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.0001"
                    value={s.ch2Iset}
                    onChange={(e) => handleUpdateStep(s.id, 'ch2Iset', e.target.value)}
                    className="w-36 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm font-black text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                  />
                </td>

                <td className="p-3 text-right">
                  <button
                    onClick={() => handleRemoveStep(s.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Real-time Telemetry Graph inside Sequence Builder */}
      <div className="pt-2">
        <LiveChart telemetryHistory={telemetryHistory} />
      </div>
    </div>
  );
};

