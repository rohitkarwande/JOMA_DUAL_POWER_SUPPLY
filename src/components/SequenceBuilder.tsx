import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Plus,
  Trash2,
  ListOrdered,
  AlertTriangle,
  ShieldAlert,
  Save,
  FolderOpen,
  FilePlus,
  Check,
  X,
} from 'lucide-react';
import { SequenceStep, SequenceRecipe, OperatingMode, DualPSTelemetry } from '../types/powerSupply';
import { SequenceProgress } from '../../electron/modbusRtuService';
import { LiveChart } from './LiveChart';
import { formatVoltage, formatCurrent } from '../utils/formatters';

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
  telemetry?: DualPSTelemetry;
}

const DEFAULT_PRESETS: SequenceRecipe[] = [
  {
    id: 'preset_burn_in_12v',
    name: '12V Burn-In Test (10s)',
    description: 'Standard 12V / 1.5A endurance test in Isolated mode',
    cycles: 1,
    steps: [
      {
        id: 'step_preset_1',
        stepNumber: 1,
        durationSeconds: 10,
        mode: 'ISOLATED',
        ch1Vset: 12.0,
        ch1Iset: 1.5,
        ch2Vset: 12.0,
        ch2Iset: 1.5,
      },
    ],
  },
  {
    id: 'preset_voltage_ramp',
    name: '3-Step Ramp (5V -> 12V -> 24V)',
    description: 'Sequential voltage step up test: 5V, 12V, and 24V',
    cycles: 2,
    steps: [
      {
        id: 'step_ramp_1',
        stepNumber: 1,
        durationSeconds: 10,
        mode: 'ISOLATED',
        ch1Vset: 5.0,
        ch1Iset: 1.0,
        ch2Vset: 5.0,
        ch2Iset: 1.0,
      },
      {
        id: 'step_ramp_2',
        stepNumber: 2,
        durationSeconds: 10,
        mode: 'ISOLATED',
        ch1Vset: 12.0,
        ch1Iset: 1.5,
        ch2Vset: 12.0,
        ch2Iset: 1.5,
      },
      {
        id: 'step_ramp_3',
        stepNumber: 3,
        durationSeconds: 15,
        mode: 'ISOLATED',
        ch1Vset: 24.0,
        ch1Iset: 2.0,
        ch2Vset: 24.0,
        ch2Iset: 2.0,
      },
    ],
  },
];

const LOCAL_STORAGE_RECIPES_KEY = 'joma_saved_sequences_v1';

const StepDurationInput: React.FC<{
  durationSeconds: number;
  disabled: boolean;
  onChange: (totalSeconds: number) => void;
}> = ({ durationSeconds, disabled, onChange }) => {
  const currentTotal = Math.max(1, Math.round(durationSeconds || 1));
  const [h, setH] = useState(() => String(Math.floor(currentTotal / 3600)));
  const [m, setM] = useState(() => String(Math.floor((currentTotal % 3600) / 60)));
  const [s, setS] = useState(() => String(currentTotal % 60));

  useEffect(() => {
    const tot = Math.max(1, Math.round(durationSeconds || 1));
    setH(String(Math.floor(tot / 3600)));
    setM(String(Math.floor((tot % 3600) / 60)));
    setS(String(tot % 60));
  }, [durationSeconds]);

  const commit = (newH: string, newM: string, newS: string) => {
    const numH = Math.max(0, parseInt(newH, 10) || 0);
    const numM = Math.max(0, Math.min(59, parseInt(newM, 10) || 0));
    const numS = Math.max(0, Math.min(59, parseInt(newS, 10) || 0));
    const total = numH * 3600 + numM * 60 + numS;
    onChange(Math.max(1, total));
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-bold text-slate-400">HRS</span>
        <input
          type="number"
          min="0"
          value={h}
          onChange={(e) => {
            setH(e.target.value);
            commit(e.target.value, m, s);
          }}
          disabled={disabled}
          className="w-12 bg-white border border-slate-300 rounded-md px-1 py-1 font-mono text-xs font-black text-center text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
        />
      </div>
      <span className="font-bold text-slate-400 mt-3">:</span>
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-bold text-slate-400">MIN</span>
        <input
          type="number"
          min="0"
          max="59"
          value={m}
          onChange={(e) => {
            setM(e.target.value);
            commit(h, e.target.value, s);
          }}
          disabled={disabled}
          className="w-12 bg-white border border-slate-300 rounded-md px-1 py-1 font-mono text-xs font-black text-center text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
        />
      </div>
      <span className="font-bold text-slate-400 mt-3">:</span>
      <div className="flex flex-col items-center">
        <span className="text-[9px] font-bold text-slate-400">SEC</span>
        <input
          type="number"
          min="0"
          max="59"
          value={s}
          onChange={(e) => {
            setS(e.target.value);
            commit(h, m, e.target.value);
          }}
          disabled={disabled}
          className="w-12 bg-white border border-slate-300 rounded-md px-1 py-1 font-mono text-xs font-black text-center text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
        />
      </div>
      <span className="text-[10px] text-slate-400 font-mono font-bold mt-3 ml-1 whitespace-nowrap">
        ({currentTotal}s)
      </span>
    </div>
  );
};

function formatRemainingTime(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
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
  telemetry,
}) => {
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
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

  // Saved Sequences / Recipes State
  const [savedRecipes, setSavedRecipes] = useState<SequenceRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDesc, setNewRecipeDesc] = useState('');

  const isHardwareIsolated = hardwareMode === 'ISOLATED';

  // Load saved sequences from Electron DB & localStorage on mount
  useEffect(() => {
    loadSavedRecipes();
  }, []);

  const loadSavedRecipes = async () => {
    let recipes: SequenceRecipe[] = [];

    // 1. Try fetching from SQLite via Electron API
    try {
      if (window.electronAPI?.db) {
        const dbRecipes = await window.electronAPI.db.getRecipes();
        if (dbRecipes && Array.isArray(dbRecipes) && dbRecipes.length > 0) {
          recipes = dbRecipes;
        }
      }
    } catch (err) {
      console.warn('Could not read recipes from Electron DB, falling back to localStorage:', err);
    }

    // 2. Fallback or merge with localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_RECIPES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(recipes.map((r) => r.id));
          for (const item of parsed) {
            if (!existingIds.has(item.id)) {
              recipes.push(item);
            }
          }
        }
      }
    } catch (_) {}

    // If still empty, add default presets
    if (recipes.length === 0) {
      recipes = [...DEFAULT_PRESETS];
      localStorage.setItem(LOCAL_STORAGE_RECIPES_KEY, JSON.stringify(recipes));
    }

    setSavedRecipes(recipes);
  };

  const handleSelectRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (!recipeId) return;

    const found = savedRecipes.find((r) => r.id === recipeId);
    if (found) {
      setCycles(found.cycles || 1);
      setSteps(
        found.steps.map((s, idx) => ({
          ...s,
          id: s.id || `step_${Date.now()}_${idx}`,
          stepNumber: idx + 1,
        }))
      );
      setFeedbackMsg({
        type: 'info',
        text: `Loaded sequence: "${found.name}" (${found.steps.length} steps, ${found.cycles} cycles)`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleSaveRecipe = async () => {
    const trimmedName = newRecipeName.trim();
    if (!trimmedName) {
      alert('Please enter a name for this test sequence.');
      return;
    }

    const sanitizedSteps: SequenceStep[] = steps.map((s, idx) => ({
      id: s.id || `step_${idx + 1}`,
      stepNumber: idx + 1,
      mode: 'ISOLATED',
      durationSeconds: Math.max(1, parseFloat(String(s.durationSeconds)) || 1),
      ch1Vset: parseFloat(String(s.ch1Vset)) || 0,
      ch1Iset: parseFloat(String(s.ch1Iset)) || 0,
      ch2Vset: parseFloat(String(s.ch2Vset)) || 0,
      ch2Iset: parseFloat(String(s.ch2Iset)) || 0,
    }));

    const sanitizedCycles = Math.max(1, parseInt(String(cycles), 10) || 1);

    const newRecipe: SequenceRecipe = {
      id: `recipe_${Date.now()}`,
      name: trimmedName,
      description: newRecipeDesc.trim(),
      cycles: sanitizedCycles,
      steps: sanitizedSteps,
    };

    // Save to Electron DB
    try {
      if (window.electronAPI?.db) {
        await window.electronAPI.db.saveRecipe(newRecipe);
      }
    } catch (err) {
      console.warn('Failed saving recipe to Electron DB:', err);
    }

    // Save to localStorage
    const updated = [...savedRecipes.filter((r) => r.name !== trimmedName), newRecipe];
    setSavedRecipes(updated);
    setSelectedRecipeId(newRecipe.id);
    localStorage.setItem(LOCAL_STORAGE_RECIPES_KEY, JSON.stringify(updated));

    setIsSaveModalOpen(false);
    setNewRecipeName('');
    setNewRecipeDesc('');

    setFeedbackMsg({
      type: 'success',
      text: `Test sequence "${trimmedName}" saved successfully!`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    const found = savedRecipes.find((r) => r.id === recipeId);
    if (!found) return;

    if (!confirm(`Are you sure you want to delete the saved sequence "${found.name}"?`)) {
      return;
    }

    try {
      if (window.electronAPI?.db) {
        await window.electronAPI.db.deleteRecipe(recipeId);
      }
    } catch (_) {}

    const updated = savedRecipes.filter((r) => r.id !== recipeId);
    setSavedRecipes(updated);
    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId('');
    }
    localStorage.setItem(LOCAL_STORAGE_RECIPES_KEY, JSON.stringify(updated));

    setFeedbackMsg({
      type: 'info',
      text: `Sequence "${found.name}" deleted.`,
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleNewSequence = () => {
    setSelectedRecipeId('');
    setCycles(1);
    setSteps([
      {
        id: `step_${Date.now()}`,
        stepNumber: 1,
        durationSeconds: 10,
        mode: 'ISOLATED',
        ch1Vset: 12.0,
        ch1Iset: 1.5,
        ch2Vset: 12.0,
        ch2Iset: 1.5,
      },
    ]);
    setFeedbackMsg({ type: 'info', text: 'Started fresh sequence.' });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

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

  // Live telemetry readings
  const ch1Vmon = telemetry?.ch1?.voltageActual ?? 0;
  const ch1Imon = telemetry?.ch1?.currentActual ?? 0;
  const ch2Vmon = telemetry?.ch2?.voltageActual ?? 0;
  const ch2Imon = telemetry?.ch2?.currentActual ?? 0;
  const isOutputEnergized = outputState === 'ON';

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4 select-none">
      {/* Top Header: Title & Recipe Management Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 shadow-2xs">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Automated Test Sequence Builder</h2>
            <p className="text-xs text-slate-500 font-semibold">Configurable multi-step test execution (Isolated Mode)</p>
          </div>
        </div>

        {/* Recipe Selection, Save, and Management Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Load Previously Set Sequence Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl shadow-2xs">
            <FolderOpen className="w-4 h-4 text-sky-600 ml-2" />
            <select
              value={selectedRecipeId}
              onChange={(e) => handleSelectRecipe(e.target.value)}
              disabled={isRunning || progress?.status === 'INITIALIZING'}
              className="bg-transparent text-xs font-bold text-slate-800 py-1.5 px-2 focus:outline-none cursor-pointer max-w-[210px] truncate"
            >
              <option value="">-- Load Saved Sequence --</option>
              {savedRecipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.steps.length} steps)
                </option>
              ))}
            </select>

            {selectedRecipeId && (
              <button
                onClick={() => handleDeleteRecipe(selectedRecipeId)}
                disabled={isRunning}
                title="Delete this saved sequence"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Save Sequence Button */}
          <button
            onClick={() => {
              setNewRecipeName(
                selectedRecipeId
                  ? savedRecipes.find((r) => r.id === selectedRecipeId)?.name || ''
                  : `Sequence ${new Date().toLocaleDateString()}`
              );
              setIsSaveModalOpen(true);
            }}
            disabled={isRunning || steps.length === 0}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Save current test sequence for future use"
          >
            <Save className="w-3.5 h-3.5" /> Save Sequence
          </button>

          {/* New Sequence Button */}
          <button
            onClick={handleNewSequence}
            disabled={isRunning}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Start new blank sequence"
          >
            <FilePlus className="w-3.5 h-3.5" /> New
          </button>

          {/* Add Step Button */}
          <button
            onClick={handleAddStep}
            disabled={isRunning || progress?.status === 'INITIALIZING'}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Step
          </button>

          {/* Total Cycles */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold shadow-2xs">
            <span className="text-slate-600 font-bold whitespace-nowrap">Cycles:</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={cycles}
              onChange={(e) => setCycles(e.target.value)}
              disabled={isRunning}
              className="w-16 bg-white border border-slate-300 rounded-md px-2 py-1 text-center font-mono text-xs font-black text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* START SEQUENCE Button */}
          {(() => {
            const isRunningOrInit = isRunning || progress?.status === 'INITIALIZING' || progress?.status === 'RUNNING';
            const isStartDisabled = !connected || outputState !== 'OFF' || isRunningOrInit || steps.length === 0 || !isHardwareIsolated;
            const isStopDisabled = !isRunningOrInit;

            return (
              <div className="flex items-center gap-2">
                <button
                  disabled={isStartDisabled}
                  onClick={handleStartSequence}
                  title={
                    !connected
                      ? 'Hardware is disconnected'
                      : outputState !== 'OFF'
                      ? 'Turn Output OFF first to start test sequence'
                      : !isHardwareIsolated
                      ? `Hardware Register 4X 29 is in ${hardwareMode} mode. Requires ISOLATED mode.`
                      : isRunningOrInit
                      ? 'Sequence is currently active'
                      : steps.length === 0
                      ? 'Add at least 1 step to start'
                      : 'Start Automated Test Sequence'
                  }
                  className={`px-4 py-2 rounded-xl font-black text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-md transition-all ${
                    isStartDisabled
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer active:scale-95'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> START
                </button>

                <button
                  disabled={isStopDisabled}
                  onClick={onStopSequence}
                  title={isStopDisabled ? 'No active sequence running' : 'Safely Stop Test Sequence & Turn Output OFF'}
                  className={`px-4 py-2 rounded-xl font-black text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-md transition-all ${
                    isStopDisabled
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 animate-pulse cursor-pointer active:scale-95'
                  }`}
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> STOP
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-sky-50 border border-sky-300 text-sky-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Save Sequence Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-md w-full flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sky-700 font-black text-base">
                <Save className="w-5 h-5" />
                <span>Save Test Sequence</span>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Sequence Name *</label>
                <input
                  type="text"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  placeholder="e.g. 12V 10s Burn-In Test"
                  autoFocus
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Description (Optional)</label>
                <textarea
                  value={newRecipeDesc}
                  onChange={(e) => setNewRecipeDesc(e.target.value)}
                  placeholder="Notes about test limits, device type, or duration..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex justify-between">
                <span>Steps to save: <strong>{steps.length}</strong></span>
                <span>Configured cycles: <strong>{cycles}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecipe}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                Save Sequence
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE VMON & IMON HARDWARE TELEMETRY READOUT BAR */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-2.5 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOutputEnergized ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-black tracking-wider uppercase text-slate-200">
              Live Hardware Telemetry Readout
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              [Modbus Holding Registers 4X 1..8]
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold">Output State:</span>
            <span
              className={`px-2.5 py-0.5 rounded-md font-mono font-black text-[11px] ${
                isOutputEnergized
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isOutputEnergized ? 'ACTIVE (ON)' : 'STANDBY (OFF)'}
            </span>
          </div>
        </div>

        {/* 4-Meter Grid: CH1 VMON, CH1 IMON, CH2 VMON, CH2 IMON */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Channel 1 VMON */}
          <div className="bg-slate-950 rounded-lg p-2.5 border border-sky-900/60 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              <span>CH1 Voltage (VMON)</span>
              <span className="font-mono text-slate-500">Reg 4X 1</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl font-black text-sky-300 tracking-tight">
                {formatVoltage(ch1Vmon)}
              </span>
              <span className="text-xs font-bold text-slate-500">V</span>
            </div>
          </div>

          {/* Channel 1 IMON */}
          <div className="bg-slate-950 rounded-lg p-2.5 border border-sky-900/60 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              <span>CH1 Current (IMON)</span>
              <span className="font-mono text-slate-500">Reg 4X 3</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl font-black text-sky-300 tracking-tight">
                {formatCurrent(ch1Imon)}
              </span>
              <span className="text-xs font-bold text-slate-500">A</span>
            </div>
          </div>

          {/* Channel 2 VMON */}
          <div className="bg-slate-950 rounded-lg p-2.5 border border-indigo-900/60 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              <span>CH2 Voltage (VMON)</span>
              <span className="font-mono text-slate-500">Reg 4X 5</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl font-black text-indigo-300 tracking-tight">
                {formatVoltage(ch2Vmon)}
              </span>
              <span className="text-xs font-bold text-slate-500">V</span>
            </div>
          </div>

          {/* Channel 2 IMON */}
          <div className="bg-slate-950 rounded-lg p-2.5 border border-indigo-900/60 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              <span>CH2 Current (IMON)</span>
              <span className="font-mono text-slate-500">Reg 4X 7</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-2xl font-black text-indigo-300 tracking-tight">
                {formatCurrent(ch2Imon)}
              </span>
              <span className="text-xs font-bold text-slate-500">A</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Interlock Warning Banner */}
      {connected && !isHardwareIsolated && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            ⚠️ <strong>Hardware Interlock:</strong> Sequence execution requires Register 4X 29 in <strong>ISOLATED</strong> mode (Current: {hardwareMode}).
          </span>
        </div>
      )}

      {/* Setpoint Limit Warning */}
      {limitWarning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{limitWarning}</span>
          </div>
          <button onClick={() => setLimitWarning(null)} className="text-amber-700 hover:text-amber-950 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Live Sequence Progress Status Banner */}
      {progress && progress.status !== 'IDLE' && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex flex-wrap items-center justify-between gap-4 transition-all ${
            progress.status === 'RUNNING'
              ? 'bg-sky-50 border-sky-200 text-sky-900 shadow-2xs'
              : progress.status === 'ERROR'
              ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-2xs'
              : progress.status === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-2xs'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
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
            <div className="flex items-center gap-5 font-mono text-sm font-extrabold">
              <div>
                Cycle: <span className="text-sky-700">{progress.currentCycle} / {progress.totalCycles}</span>
              </div>
              <div>
                Step: <span className="text-sky-700">{progress.currentStepIndex + 1} / {progress.totalSteps}</span>
              </div>
              <div className="bg-white px-3 py-1 rounded-lg border border-sky-200 text-sky-800 shadow-2xs">
                Remaining: <span className="text-base text-sky-600 font-black">{formatRemainingTime(progress.stepRemainingSeconds)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steps Table */}
      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl min-h-[160px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-3">Step #</th>
              <th className="p-3">Duration (Hrs : Min : Sec)</th>
              <th className="p-3 text-sky-700">CH1 Vset (V)</th>
              <th className="p-3 text-sky-700">CH1 Iset (A)</th>
              <th className="p-3 text-indigo-700">CH2 Vset (V)</th>
              <th className="p-3 text-indigo-700">CH2 Iset (A)</th>
              <th className="p-3 text-right">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {steps.map((s, idx) => {
              const isCurrentStepRunning =
                progress?.status === 'RUNNING' && progress.currentStepIndex === idx;

              return (
                <tr
                  key={s.id}
                  className={`transition-colors ${
                    isCurrentStepRunning ? 'bg-sky-50/80 font-bold' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="p-3 font-bold text-sky-700 font-mono flex items-center gap-1.5">
                    {isCurrentStepRunning && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
                    )}
                    Step {s.stepNumber}
                  </td>
                  <td className="p-3">
                    <StepDurationInput
                      durationSeconds={parseFloat(String(s.durationSeconds)) || 1}
                      disabled={isRunning}
                      onChange={(val) => handleUpdateStep(s.id, 'durationSeconds', val)}
                    />
                  </td>

                  <td className="p-3">
                    <input
                      type="number"
                      step="0.001"
                      value={s.ch1Vset}
                      onChange={(e) => handleUpdateStep(s.id, 'ch1Vset', e.target.value)}
                      disabled={isRunning}
                      className="w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-black text-sky-700 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.0001"
                      value={s.ch1Iset}
                      onChange={(e) => handleUpdateStep(s.id, 'ch1Iset', e.target.value)}
                      disabled={isRunning}
                      className="w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-black text-sky-700 focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-2xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.001"
                      value={s.ch2Vset}
                      onChange={(e) => handleUpdateStep(s.id, 'ch2Vset', e.target.value)}
                      disabled={isRunning}
                      className="w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      step="0.0001"
                      value={s.ch2Iset}
                      onChange={(e) => handleUpdateStep(s.id, 'ch2Iset', e.target.value)}
                      disabled={isRunning}
                      className="w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                    />
                  </td>

                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleRemoveStep(s.id)}
                      disabled={isRunning || steps.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={steps.length <= 1 ? 'Cannot delete last step' : 'Delete step'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Real-time Telemetry Graph */}
      <div className="pt-1">
        <LiveChart telemetryHistory={telemetryHistory} maxVoltage={maxVoltage} maxCurrent={maxCurrent} />
      </div>
    </div>
  );
};
