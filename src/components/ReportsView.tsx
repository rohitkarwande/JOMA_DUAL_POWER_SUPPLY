import React, { useState, useEffect } from 'react';
import { FileText, FolderOpen, Trash2, Calendar, Clock, RefreshCw, Eye } from 'lucide-react';

export interface ReportItem {
  id: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  mode: string;
  totalSamples: number;
  durationSeconds: number;
  loggingIntervalMs: number;
  vMax: number;
  iMax: number;
}

interface ReportsViewProps {
  onRefreshTrigger?: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onRefreshTrigger }) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [onRefreshTrigger]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI?.reports) {
        const data = await window.electronAPI.reports.getReports();
        setReports(data || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPdf = async (filePath: string) => {
    try {
      if (window.electronAPI?.reports) {
        const res = await window.electronAPI.reports.openPdf(filePath);
        if (!res.success) {
          alert(res.error || 'Failed to open PDF document.');
        }
      }
    } catch (err: any) {
      alert(`Error opening PDF: ${err?.message}`);
    }
  };

  const handleShowInFolder = async (filePath: string) => {
    try {
      if (window.electronAPI?.reports) {
        await window.electronAPI.reports.showInFolder(filePath);
      }
    } catch (err: any) {
      alert(`Error locating file: ${err?.message}`);
    }
  };

  const handleDeleteReport = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete report "${fileName}"?`)) return;
    try {
      if (window.electronAPI?.reports) {
        await window.electronAPI.reports.deleteReport(id);
        setReports((prev) => prev.filter((r) => r.id !== id));
        setActionMsg(`Deleted "${fileName}"`);
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err: any) {
      alert(`Error deleting report: ${err?.message}`);
    }
  };

  const handleOpenReportsDir = async () => {
    if (reports.length > 0) {
      handleShowInFolder(reports[0].filePath);
    } else if (window.electronAPI?.reports) {
      // Show default folder
      handleShowInFolder('');
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-6 select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-600 shadow-2xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Automated PDF Test Reports</h2>
              <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold">
              Official test reports generated automatically upon Output OFF transitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionMsg && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fadeIn">
              {actionMsg}
            </span>
          )}

          <button
            onClick={loadReports}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Refresh reports list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={handleOpenReportsDir}
            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Open JOMA Reports storage folder"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Open Reports Folder
          </button>
        </div>
      </div>

      {/* Reports Table / List */}
      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
        {reports.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
            <FileText className="w-10 h-10 text-slate-300 stroke-[1.5]" />
            <span className="text-sm font-bold text-slate-600">No Automated PDF Test Reports Found</span>
            <p className="text-xs text-slate-400 max-w-md font-medium">
              Turn Output <strong>ON</strong> in Isolated, Series, or Parallel mode to start collecting telemetry at your configured interval. When you turn Output <strong>OFF</strong>, your official PDF report with telemetry data and trend graphs will automatically be generated here.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="p-3.5">Report Document</th>
                <th className="p-3.5">Operating Mode</th>
                <th className="p-3.5">Generated Time</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Samples</th>
                <th className="p-3.5">Logging Rate</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          onClick={() => handleOpenPdf(r.filePath)}
                          className="font-bold text-xs text-slate-800 hover:text-sky-600 cursor-pointer transition-colors"
                        >
                          {r.fileName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">{r.filePath}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded font-black text-[11px] border uppercase ${
                        r.mode === 'ISOLATED'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : r.mode === 'PARALLEL'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {r.mode}
                    </span>
                  </td>

                  <td className="p-3.5 font-medium text-slate-600">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(r.timestamp).toLocaleString()}</span>
                    </div>
                  </td>

                  <td className="p-3.5 font-bold text-slate-700 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDuration(r.durationSeconds)}</span>
                    </div>
                  </td>

                  <td className="p-3.5 font-mono text-xs font-bold text-slate-700">
                    {r.totalSamples} samples
                  </td>

                  <td className="p-3.5 font-mono text-xs text-slate-500">
                    {(r.loggingIntervalMs / 60000).toFixed(2)} min ({(r.loggingIntervalMs / 1000).toFixed(1)}s)
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenPdf(r.filePath)}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                        title="Open PDF report in default viewer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Open PDF
                      </button>

                      <button
                        onClick={() => handleShowInFolder(r.filePath)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Show in File Explorer"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteReport(r.id, r.fileName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ${secs}s`;
}
