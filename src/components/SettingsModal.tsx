import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Save } from 'lucide-react';
import { SerialSettings } from '../types/powerSupply';

interface SettingsModalProps {
  isOpen: boolean;
  currentSettings: SerialSettings;
  onClose: () => void;
  onSave: (newSettings: SerialSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentSettings,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<SerialSettings>(currentSettings);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">RS485 Serial & Modbus Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* COM Port */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600">COM Port</label>
              <button
                onClick={fetchPorts}
                disabled={isScanning}
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
                onChange={(e) => setSettings({ ...settings, baudRate: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
                value={settings.slaveId}
                onChange={(e) => setSettings({ ...settings, slaveId: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Parity & Stop Bits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Parity</label>
              <select
                value={settings.parity}
                onChange={(e) => setSettings({ ...settings, parity: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
                onChange={(e) => setSettings({ ...settings, stopBits: parseInt(e.target.value, 10) as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(settings);
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-200 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" /> Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
