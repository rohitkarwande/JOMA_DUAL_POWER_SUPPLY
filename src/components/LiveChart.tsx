import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DualPSTelemetry } from '../types/powerSupply';

interface LiveChartProps {
  telemetryHistory: DualPSTelemetry[];
}

export const LiveChart: React.FC<LiveChartProps> = ({ telemetryHistory }) => {
  const [selectedSignal, setSelectedSignal] = useState<'ALL' | 'CH1' | 'CH2' | 'TOTAL'>('ALL');

  const chartData = telemetryHistory.map((t) => ({
    time: new Date(t.timestamp).toLocaleTimeString(),
    v1: t.ch1.voltageActual,
    i1: t.ch1.currentActual,
    v2: t.ch2.voltageActual,
    i2: t.ch2.currentActual,
    totalV: t.totalVoltage,
    totalI: t.totalCurrent,
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col gap-2 select-none">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
        <h3 className="text-xs font-black text-slate-800 tracking-wider">REAL-TIME TELEMETRY GRAPH</h3>
        <div className="flex items-center gap-1.5">
          {(['ALL', 'CH1', 'CH2', 'TOTAL'] as const).map((sig) => (
            <button
              key={sig}
              onClick={() => setSelectedSignal(sig)}
              className={`px-2.5 py-1 rounded font-extrabold text-[10px] transition-colors ${
                selectedSignal === sig
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sig}
            </button>
          ))}
        </div>
      </div>

      <div className="h-40 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-semibold text-xs">
            Waiting for live Modbus telemetry data stream...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

              {(selectedSignal === 'ALL' || selectedSignal === 'CH1') && (
                <>
                  <Line type="monotone" dataKey="v1" name="CH1 V (V)" stroke="#0284c7" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="i1" name="CH1 I (A)" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                </>
              )}

              {(selectedSignal === 'ALL' || selectedSignal === 'CH2') && (
                <>
                  <Line type="monotone" dataKey="v2" name="CH2 V (V)" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="i2" name="CH2 I (A)" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
                </>
              )}

              {(selectedSignal === 'ALL' || selectedSignal === 'TOTAL') && (
                <>
                  <Line type="monotone" dataKey="totalV" name="Total V (V)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="totalI" name="Total I (A)" stroke="#10b981" strokeWidth={1.5} dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
