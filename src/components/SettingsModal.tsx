import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Save, AlertTriangle, Terminal, Cpu, Loader2 } from 'lucide-react';
import { SerialSettings, SystemLogEntry } from '../types/powerSupply';

interface SettingsModalProps {
  isOpen: boolean;
  currentSettings: SerialSettings;
  connectionError?: string | null;
  isConnecting?: boolean;
  recentLogs?: SystemLogEntry[];
  onClose: () => void;
  onSave: (newSettings: SerialSettings) => Promise<boolean | void>;
  onOpenFullLogs?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentSettings,
  connectionError = null,
  isConnecting = false,
  recentLogs = [],
  onClose,
  onSave,
  onOpenFullLogs,
}) => {
  const [settings, setSettings] = useState<SerialSettings>(currentSettings);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showLogPreview, setShowLogPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      fetchPorts();
    }
  }, [isOpen, currentSettings]);

  const fetchPorts = async () => {
    setIsScanning(true);
    try {
      if (window.electronAPI) {
        const ports = await window.electronAPI.getSerialPorts();
        setAvailablePorts(ports || []);
        // If current port is COM1 but COM4 or other real port is detected, and settings.port isn't in list, select first available port
        if (ports && ports.length > 0 && !ports.includes(settings.port)) {
          setSettings((prev) => ({ ...prev, port: ports[0] }));
        }
      } else {
        setAvailablePorts([]);
      }
    } catch (err) {
      console.error('Error scanning serial ports:', err);
      setAvailablePorts([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveAndConnect = async () => {
    await onSave(settings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">RS485 Serial & Modbus Settings</h2>
            <p className="text-xs text-slate-500 font-medium">Configure COM port, RTU communication parameters, or simulator mode</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Connection Error Banner if present */}
          {connectionError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Connection / Communication Issue Detected</span>
                </div>
                <div className="font-mono text-[11px] bg-rose-100/70 p-2 rounded text-rose-900 break-all border border-rose-200">
                  {connectionError}
                </div>
                <div className="text-[11px] text-rose-700 font-medium">
                  <strong>Troubleshooting Checklist:</strong>
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                    <li>Is the power supply turned ON and connected to the RS485 converter?</li>
                    <li>Try swapping RS485 <strong>A (Data+)</strong> and <strong>B (Data-)</strong> wires.</li>
                    <li>Verify <strong>Baud Rate</strong> (usually 9600 or 115200) and <strong>Slave ID</strong> (usually 1).</li>
                    <li>Ensure no other serial software (Arduino IDE, PuTTY, etc.) is locking the port.</li>
                    <li>Or enable <strong>Virtual Simulator Mode</strong> below to test without physical hardware.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Virtual Simulator Mode Toggle */}
          <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg text-sky-700">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <span>Virtual Hardware Simulator</span>
                  {settings.isSimulator && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Simulate telemetry readouts and sequence automation without physical hardware
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.isSimulator)}
                onChange={(e) => setSettings({ ...settings, isSimulator: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* COM Port */}
          <div className={settings.isSimulator ? 'opacity-40 pointer-events-none' : ''}>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600">COM Port</label>
              <button
                onClick={fetchPorts}
                disabled={isScanning || settings.isSimulator}
                className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} /> Scan Ports
              </button>
            </div>
            <select
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {availablePorts.length > 0 ? (
                availablePorts.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No COM ports detected
                </option>
              )}
            </select>
          </div>

          {/* Baud Rate & Slave ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Baud Rate</label>
              <select
                value={settings.baudRate}
                disabled={settings.isSimulator}
                onChange={(e) => setSettings({ ...settings, baudRate: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-40"
              >
                {[4800, 9600, 19200, 38400, 57600, 115200].map((b) => (
                  <option key={b} value={b}>
                    {b} bps
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Modbus Slave ID</label>
              <input
                type="number"
                min="1"
                max="247"
                disabled={settings.isSimulator}
                value={settings.slaveId}
                onChange={(e) => setSettings({ ...settings, slaveId: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-40"
              />
            </div>
          </div>

          {/* Parity & Stop Bits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Parity</label>
              <select
                value={settings.parity}
                disabled={settings.isSimulator}
                onChange={(e) => setSettings({ ...settings, parity: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-40"
              >
                <option value="none">None (N)</option>
                <option value="even">Even (E)</option>
                <option value="odd">Odd (O)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Stop Bits</label>
              <select
                value={settings.stopBits}
                disabled={settings.isSimulator}
                onChange={(e) => setSettings({ ...settings, stopBits: parseInt(e.target.value, 10) as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-40"
              >
                <option value={1}>1 Bit</option>
                <option value={2}>2 Bits</option>
              </select>
            </div>
          </div>

          {/* Polling Interval */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Polling Interval (ms)</label>
            <input
              type="number"
              min="100"
              max="5000"
              step="100"
              value={settings.pollingIntervalMs}
              onChange={(e) =>
                setSettings({ ...settings, pollingIntervalMs: parseInt(e.target.value, 10) || 500 })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Embedded Connection Logs Preview */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowLogPreview(!showLogPreview)}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5 text-sky-600" />
                <span>Recent Modbus Diagnostic Logs ({recentLogs.length})</span>
                <span className="text-[10px] text-slate-400">({showLogPreview ? 'Hide' : 'Show'})</span>
              </button>

              {onOpenFullLogs && (
                <button
                  type="button"
                  onClick={onOpenFullLogs}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700"
                >
                  Open Full Log Drawer
                </button>
              )}
            </div>

            {showLogPreview && (
              <div className="bg-slate-950 rounded-lg p-2.5 text-[10px] font-mono max-h-36 overflow-y-auto space-y-1 text-slate-300 border border-slate-800">
                {recentLogs.length === 0 ? (
                  <div className="text-slate-500 italic">No logs yet. Click 'Save & Connect' to initiate.</div>
                ) : (
                  recentLogs.slice(-15).map((l) => (
                    <div key={l.id} className="flex items-start gap-1.5">
                      <span className="text-slate-500 shrink-0">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                      <span className={`shrink-0 font-bold ${
                        l.level === 'error' ? 'text-rose-400' : l.level === 'warn' ? 'text-amber-300' : l.level === 'success' ? 'text-emerald-300' : 'text-sky-300'
                      }`}>
                        [{l.source}]
                      </span>
                      <span className={`break-all ${l.level === 'error' ? 'text-rose-300' : ''}`}>{l.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {isConnecting ? (
              <span className="flex items-center gap-1.5 text-sky-600 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Connecting to {settings.isSimulator ? 'Simulator' : settings.port}...
              </span>
            ) : settings.isSimulator ? (
              <span className="text-emerald-700 font-semibold">Ready to run Simulator</span>
            ) : (
              <span>Target: {settings.port} @ {settings.baudRate} bps</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isConnecting}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndConnect}
              disabled={isConnecting}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-200 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save & Connect
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
