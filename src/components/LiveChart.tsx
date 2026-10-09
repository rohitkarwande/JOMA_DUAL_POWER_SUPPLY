import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface LiveChartProps {
  telemetryHistory: any[];
  maxVoltage?: number;
  maxCurrent?: number;
}

export const LiveChart: React.FC<LiveChartProps> = ({
  telemetryHistory = [],
  maxVoltage = 60.0,
  maxCurrent = 10.0,
}) => {
  const [selectedSignal, setSelectedSignal] = useState<'ALL' | 'CH1' | 'CH2'>('ALL');

  // Sanitize telemetry data to prevent NaN, Infinity, or extreme exponent overflow
  const sanitize = (val: any): number => {
    if (typeof val === 'number' && isFinite(val) && !isNaN(val) && Math.abs(val) < 1000) {
      return Number(val.toFixed(4));
    }
    return 0;
  };

  const chartData = telemetryHistory.map((t, idx) => {
    const isSingle = (t as any).vMon !== undefined && (t as any).ch1 === undefined;

    const timeStr = t.timestamp
      ? new Date(t.timestamp).toLocaleTimeString([], { hour12: false })
      : `#${idx + 1}`;

    const v1 = sanitize(isSingle ? (t as any).vMon : t.ch1?.voltageActual);
    const i1 = sanitize(isSingle ? (t as any).iMon : t.ch1?.currentActual);
    const v2 = sanitize(t.ch2?.voltageActual);
    const i2 = sanitize(t.ch2?.currentActual);

    return {
      time: timeStr,
      v1,
      i1,
      v2,
      i2,
      isSingle,
    };
  });

  const isSingleMode = chartData.length > 0 && chartData[chartData.length - 1].isSingle;

  // Safe domain calculation to prevent NaN / -Infinity in Recharts tick generation
  const safeVoltageMax = (dataMax: number) => {
    const defaultMax = maxVoltage > 0 ? maxVoltage : 60;
    if (typeof dataMax !== 'number' || !isFinite(dataMax) || isNaN(dataMax) || dataMax <= 0) {
      return defaultMax;
    }
    return Math.max(defaultMax, Math.ceil(dataMax * 1.15));
  };

  const safeCurrentMax = (dataMax: number) => {
    const defaultMax = maxCurrent > 0 ? maxCurrent : 10;
    if (typeof dataMax !== 'number' || !isFinite(dataMax) || isNaN(dataMax) || dataMax <= 0) {
      return defaultMax;
    }
    return Math.max(defaultMax, Number((dataMax * 1.2).toFixed(2)));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col gap-2.5 select-none w-full">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">
            Real-Time Telemetry Graph
          </h3>
          <span className="text-[10px] font-mono font-semibold text-slate-400">
            ({chartData.length} samples)
          </span>
        </div>

        {!isSingleMode ? (
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'CH1', 'CH2'] as const).map((sig) => (
              <button
                key={sig}
                onClick={() => setSelectedSignal(sig)}
                className={`px-2.5 py-1 rounded font-extrabold text-[10px] transition-all cursor-pointer ${
                  selectedSignal === sig
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {sig}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            SINGLE PS MODE
          </span>
        )}
      </div>

      <div className="w-full h-[240px]">
        {chartData.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
            <span className="text-xs font-semibold">Waiting for live Modbus telemetry data stream...</span>
            <span className="text-[10px] text-slate-400 font-mono">Connect to COM port to begin streaming</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                minTickGap={25}
              />
              {/* Left Y Axis for Voltage */}
              <YAxis
                yAxisId="voltage"
                stroke="#0284c7"
                fontSize={10}
                domain={[0, safeVoltageMax]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Number(val).toFixed(0)}V`}
                width={42}
              />
              {/* Right Y Axis for Current */}
              <YAxis
                yAxisId="current"
                orientation="right"
                stroke="#10b981"
                fontSize={10}
                domain={[0, safeCurrentMax]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Number(val).toFixed(1)}A`}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

              {/* In Single Mode: Plot Vmon & Imon */}
              {isSingleMode && (
                <Line
                  key="single-vmon"
                  yAxisId="voltage"
                  type="monotone"
                  dataKey="v1"
                  name="VMON (V)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}
              {isSingleMode && (
                <Line
                  key="single-imon"
                  yAxisId="current"
                  type="monotone"
                  dataKey="i1"
                  name="IMON (A)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}

              {/* In Dual Mode: Plot based on selected signal (ALL, CH1, CH2) */}
              {!isSingleMode && (selectedSignal === 'ALL' || selectedSignal === 'CH1') && (
                <Line
                  key="dual-ch1-v"
                  yAxisId="voltage"
                  type="monotone"
                  dataKey="v1"
                  name="CH1 V (V)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}
              {!isSingleMode && (selectedSignal === 'ALL' || selectedSignal === 'CH1') && (
                <Line
                  key="dual-ch1-i"
                  yAxisId="current"
                  type="monotone"
                  dataKey="i1"
                  name="CH1 I (A)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}

              {!isSingleMode && (selectedSignal === 'ALL' || selectedSignal === 'CH2') && (
                <Line
                  key="dual-ch2-v"
                  yAxisId="voltage"
                  type="monotone"
                  dataKey="v2"
                  name="CH2 V (V)"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}
              {!isSingleMode && (selectedSignal === 'ALL' || selectedSignal === 'CH2') && (
                <Line
                  key="dual-ch2-i"
                  yAxisId="current"
                  type="monotone"
                  dataKey="i2"
                  name="CH2 I (A)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
