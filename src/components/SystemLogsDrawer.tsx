import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, Copy, Check, ChevronDown, ChevronUp, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SystemLogEntry } from '../types/powerSupply';

interface SystemLogsDrawerProps {
  isOpen: boolean;
  logs: SystemLogEntry[];
  onClose: () => void;
  onClear: () => void;
}

export const SystemLogsDrawer: React.FC<SystemLogsDrawerProps> = ({
  isOpen,
  logs,
  onClose,
  onClear,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'MODBUS' | 'SERIAL' | 'ERROR'>('ALL');
  const [isCopied, setIsCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'ALL') return true;
    if (filter === 'MODBUS') return l.source === 'MODBUS';
    if (filter === 'SERIAL') return l.source === 'SERIAL';
    if (filter === 'ERROR') return l.level === 'error';
    return true;
  });

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, isOpen]);

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.source}] [${l.level.toUpperCase()}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 shadow-2xl transition-all duration-200 flex flex-col font-mono text-xs ${
        isMinimized ? 'h-11' : 'h-80'
      }`}
    >
      {/* Top Bar / Header */}
      <div className="h-11 bg-slate-950 px-4 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>MODBUS & SYSTEM DIAGNOSTIC LOGS</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
            {logs.length} entries
          </span>
        </div>

        {/* Center Filter Tabs */}
        {!isMinimized && (
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            {(['ALL', 'MODBUS', 'SERIAL', 'ERROR'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  filter === tab
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200 mr-2">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
                />
                Auto-scroll
              </label>

              <button
                onClick={handleCopyLogs}
                title="Copy logs to clipboard"
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>

              <button
                onClick={onClear}
                title="Clear logs"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={isMinimized ? 'Expand Logs' : 'Minimize Logs'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Console Window */}
      {!isMinimized && (
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-1 bg-slate-950 font-mono text-[11px] leading-relaxed selection:bg-sky-900"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 font-sans italic">
              No diagnostic logs recorded yet. Connect to a COM port to stream Modbus traffic.
            </div>
          ) : (
            filteredLogs.map((log) => {
              let levelColor = 'text-slate-300';
              let badgeColor = 'bg-slate-800 text-slate-400';
              let Icon = Info;

              if (log.level === 'error') {
                levelColor = 'text-rose-400 font-semibold';
                badgeColor = 'bg-rose-950/80 text-rose-300 border border-rose-800';
                Icon = AlertCircle;
              } else if (log.level === 'warn') {
                levelColor = 'text-amber-300';
                badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-800';
                Icon = AlertTriangle;
              } else if (log.level === 'success') {
                levelColor = 'text-emerald-300 font-semibold';
                badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800';
                Icon = CheckCircle2;
              }

              return (
                <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 p-0.5 rounded transition-colors">
                  <span className="text-slate-500 shrink-0">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${badgeColor}`}>
                    {log.source}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-400' : log.level === 'success' ? 'text-emerald-400' : 'text-sky-400'
                  }`} />
                  <span className={`break-all ${levelColor}`}>{log.message}</span>
                  {log.details && (
                    <span className="text-slate-500 text-[10px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
