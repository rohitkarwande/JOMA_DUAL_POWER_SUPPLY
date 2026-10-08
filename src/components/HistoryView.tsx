import React, { useState, useEffect } from 'react';
import { Download, Database as DbIcon, Calendar, Activity } from 'lucide-react';
import { TestSessionRecord } from '../types/powerSupply';

export const HistoryView: React.FC = () => {
  const [sessions, setSessions] = useState<TestSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.db) {
        const data = await window.electronAPI.db.getSessions();
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching SQLite sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async (sessionId: string) => {
    setExportingId(sessionId);
    try {
      if (window.electronAPI?.db) {
        const res = await window.electronAPI.db.exportSessionCsv(sessionId);
        if (res.success) {
          alert(`Session exported successfully to:\n${res.filePath}`);
        } else {
          alert(`Export failed: ${res.error}`);
        }
      }
    } catch (err: any) {
      alert(`Export error: ${err?.message}`);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-6 select-none overflow-hidden">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <DbIcon className="w-5 h-5 text-sky-600" />
          <h2 className="text-xl font-extrabold text-slate-800">SQLite Test Session History</h2>
        </div>
        <button
          onClick={loadSessions}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2"
        >
          <Activity className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Records
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
        {sessions.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-semibold text-sm">
            No logged SQLite test sessions found.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
              <tr>
                <th className="p-3.5">Session ID</th>
                <th className="p-3.5">Start Time</th>
                <th className="p-3.5">Operating Mode</th>
                <th className="p-3.5">Total Samples</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-mono text-xs font-bold text-sky-700">{s.id}</td>
                  <td className="p-3.5 font-medium text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(s.startTime).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold text-xs">
                      {s.initialMode}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-700">{s.totalSamples}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded font-bold text-xs ${
                        s.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleExportCsv(s.id)}
                      disabled={exportingId === s.id}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 ml-auto transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exportingId === s.id ? 'Exporting...' : 'Export CSV'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
