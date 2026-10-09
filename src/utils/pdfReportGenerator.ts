import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OperatingMode } from '../types/powerSupply';

export interface LoggedSample {
  timestamp: number;
  timeStr: string;
  mode: OperatingMode;
  // Isolated fields
  ch1Vmon?: number;
  ch1Imon?: number;
  ch1Vset?: number;
  ch1Iset?: number;
  ch2Vmon?: number;
  ch2Imon?: number;
  ch2Vset?: number;
  ch2Iset?: number;
  // Series fields
  masterIset?: number;
  serVoltMon?: number;
  // Parallel fields
  masterVset?: number;
  parCurMon?: number;
}

export interface ReportSessionData {
  id: string;
  mode: OperatingMode;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  loggingIntervalMs: number;
  vMax: number;
  iMax: number;
  samples: LoggedSample[];
}

/**
 * Renders a high-resolution 2D Canvas chart for the session samples and returns PNG Data URL
 */
function renderChartToDataUrl(samples: LoggedSample[], mode: OperatingMode): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  const left = 80;
  const right = 1120;
  const top = 70;
  const bottom = 420;
  const plotWidth = right - left;
  const plotHeight = bottom - top;

  if (samples.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No telemetry samples recorded for this session', canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  }

  // Calculate dynamic max voltage and current across samples
  let maxMeasuredV = 0;
  let maxMeasuredI = 0;

  for (const s of samples) {
    const vVals = [s.ch1Vmon, s.ch2Vmon, s.serVoltMon, s.ch1Vset, s.ch2Vset, s.masterVset].filter(
      (v): v is number => typeof v === 'number' && isFinite(v)
    );
    const iVals = [s.ch1Imon, s.ch2Imon, s.parCurMon, s.ch1Iset, s.ch2Iset, s.masterIset].filter(
      (i): i is number => typeof i === 'number' && isFinite(i)
    );
    for (const v of vVals) if (v > maxMeasuredV) maxMeasuredV = v;
    for (const i of iVals) if (i > maxMeasuredI) maxMeasuredI = i;
  }

  const vMaxScale = Math.max(20, Math.ceil(maxMeasuredV * 1.15));
  const iMaxScale = Math.max(2, Math.ceil(maxMeasuredI * 1.25 * 10) / 10);

  // Grid Lines & Ticks (5 levels)
  const gridSteps = 5;
  ctx.textAlign = 'right';
  ctx.font = '12px Helvetica, Arial, sans-serif';

  for (let i = 0; i <= gridSteps; i++) {
    const y = top + (plotHeight / gridSteps) * i;
    const vVal = vMaxScale * (1 - i / gridSteps);
    const iVal = iMaxScale * (1 - i / gridSteps);

    // Grid line
    ctx.beginPath();
    ctx.strokeStyle = i === gridSteps ? '#cbd5e1' : '#f1f5f9';
    ctx.lineWidth = i === gridSteps ? 1.5 : 1;
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    // Left Y Axis Label (Voltage - Blue)
    ctx.fillStyle = '#0284c7';
    ctx.textAlign = 'right';
    ctx.fillText(`${vVal.toFixed(0)}V`, left - 12, y + 4);

    // Right Y Axis Label (Current - Green)
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'left';
    ctx.fillText(`${iVal.toFixed(1)}A`, right + 12, y + 4);
  }

  // X Axis Timestamps
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.font = '11px Helvetica, Arial, sans-serif';
  const timeTickCount = Math.min(6, samples.length);
  for (let t = 0; t < timeTickCount; t++) {
    const idx = Math.floor((t / Math.max(1, timeTickCount - 1)) * (samples.length - 1));
    const sample = samples[idx];
    const x = samples.length === 1 ? left + plotWidth / 2 : left + (idx / (samples.length - 1)) * plotWidth;
    ctx.fillText(sample.timeStr, x, bottom + 24);
  }

  // Helper coordinate functions
  const getX = (idx: number) => {
    if (samples.length <= 1) return left + plotWidth / 2;
    return left + (idx / (samples.length - 1)) * plotWidth;
  };
  const getY_V = (val: number | undefined) => {
    if (typeof val !== 'number' || !isFinite(val)) return bottom;
    const clamped = Math.max(0, val);
    return bottom - (clamped / vMaxScale) * plotHeight;
  };
  const getY_I = (val: number | undefined) => {
    if (typeof val !== 'number' || !isFinite(val)) return bottom;
    const clamped = Math.max(0, val);
    return bottom - (clamped / iMaxScale) * plotHeight;
  };

  // Function to draw a continuous line series
  const drawLine = (color: string, getYFn: (s: LoggedSample) => number, isDashed = false, lineWidth = 2.5) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (isDashed) ctx.setLineDash([6, 4]);

    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = getX(idx);
      const y = getYFn(s);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw small dots if sample count is modest
    if (samples.length <= 35 && !isDashed) {
      ctx.fillStyle = color;
      samples.forEach((s, idx) => {
        const x = getX(idx);
        const y = getYFn(s);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  };

  // Draw Mode-Specific Lines & Top Legend
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  let legendX = left;

  const addLegendItem = (color: string, label: string, isDashed = false) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (isDashed) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(legendX, 35);
    ctx.lineTo(legendX + 22, 35);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.fillText(label, legendX + 28, 39);
    legendX += ctx.measureText(label).width + 50;
  };

  if (mode === 'ISOLATED') {
    drawLine('#0284c7', (s) => getY_V(s.ch1Vmon), false, 2.5); // CH1 Vmon
    drawLine('#10b981', (s) => getY_I(s.ch1Imon), false, 2.5); // CH1 Imon
    drawLine('#8b5cf6', (s) => getY_V(s.ch2Vmon), false, 2.5); // CH2 Vmon
    drawLine('#f59e0b', (s) => getY_I(s.ch2Imon), false, 2.5); // CH2 Imon

    addLegendItem('#0284c7', 'CH1 Vmon (V)');
    addLegendItem('#10b981', 'CH1 Imon (A)');
    addLegendItem('#8b5cf6', 'CH2 Vmon (V)');
    addLegendItem('#f59e0b', 'CH2 Imon (A)');
  } else if (mode === 'SERIES') {
    drawLine('#0284c7', (s) => getY_V(s.serVoltMon), false, 3.0); // Total Series V
    drawLine('#10b981', (s) => getY_I(s.ch1Imon), false, 2.5);    // Series I
    drawLine('#8b5cf6', (s) => getY_V(s.ch1Vmon), true, 2.0);     // CH1 Vmon
    drawLine('#06b6d4', (s) => getY_V(s.ch2Vmon), true, 2.0);     // CH2 Vmon

    addLegendItem('#0284c7', 'Total Series V (V)');
    addLegendItem('#10b981', 'Series Imon (A)');
    addLegendItem('#8b5cf6', 'CH1 Vmon (V)', true);
    addLegendItem('#06b6d4', 'CH2 Vmon (V)', true);
  } else if (mode === 'PARALLEL') {
    drawLine('#0284c7', (s) => getY_V(s.ch1Vmon), false, 3.0);    // Parallel V
    drawLine('#10b981', (s) => getY_I(s.parCurMon), false, 3.0);  // Total Parallel I
    drawLine('#8b5cf6', (s) => getY_I(s.ch1Imon), true, 2.0);     // CH1 Imon
    drawLine('#f59e0b', (s) => getY_I(s.ch2Imon), true, 2.0);     // CH2 Imon

    addLegendItem('#0284c7', 'Parallel Vmon (V)');
    addLegendItem('#10b981', 'Total Parallel I (A)');
    addLegendItem('#8b5cf6', 'CH1 Imon (A)', true);
    addLegendItem('#f59e0b', 'CH2 Imon (A)', true);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates an official, publication-quality PDF test report from the finalized session data.
 */
export async function generatePdfReport(data: ReportSessionData): Promise<{
  dataBase64: string;
  fileName: string;
  fileBytes: number;
}> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const startDate = new Date(data.startTime);
  const endDate = new Date(data.endTime);
  const formattedDuration = formatDuration(data.durationSeconds);

  // 1. TOP HEADER BANNER
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFillColor(2, 132, 199); // Sky-600 top stripe
  doc.rect(0, 0, pageWidth, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('JOMA Next Gen Power Supply', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text('Automated Telemetry & Performance Test Report', margin, 21);

  // Mode Badge in Top Header (Right side)
  const modeBadgeText = `${data.mode} MODE`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const badgeWidth = doc.getTextWidth(modeBadgeText) + 12;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(2, 132, 199); // Sky-600
  doc.roundedRect(badgeX, 9, badgeWidth, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(modeBadgeText, badgeX + 6, 16.5);

  // 2. SESSION PARAMETERS & HARDWARE LIMITS GRID (2 columns)
  let y = 35;

  // Box border
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, y, pageWidth - margin * 2, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const col1X = margin + 6;
  const col2X = margin + (pageWidth - margin * 2) / 2 + 6;

  // Row 1
  doc.text('Session ID:', col1X, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(data.id, col1X + 28, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Report Generated:', col2X, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(new Date().toLocaleString(), col2X + 35, y + 7);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Test Start Time:', col1X, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(startDate.toLocaleTimeString() + ` (${startDate.toLocaleDateString()})`, col1X + 28, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Test End Time:', col2X, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(endDate.toLocaleTimeString() + ` (${endDate.toLocaleDateString()})`, col2X + 35, y + 15);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Total Duration:', col1X, y + 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`${formattedDuration} (${data.durationSeconds}s)`, col1X + 28, y + 23);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Logging Interval:', col2X, y + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const intervalMin = (data.loggingIntervalMs / 60000).toFixed(2);
  doc.text(`${intervalMin} min (${(data.loggingIntervalMs / 1000).toFixed(1)}s)`, col2X + 35, y + 23);

  // Row 4: Read-Only Hardware Limits
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Hardware Vmax:', col1X, y + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${data.vMax.toFixed(2)} V  (Reg 4X 30 Read-Only)`, col1X + 28, y + 30);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Hardware Imax:', col2X, y + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${data.iMax.toFixed(2)} A  (Reg 4X 32 Read-Only)`, col2X + 35, y + 30);

  y += 40;

  // 3. GRAPH SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Real-Time Voltage & Current Telemetry Trend', margin, y);

  const chartImgData = renderChartToDataUrl(data.samples, data.mode);
  if (chartImgData) {
    const chartHeightMm = 68;
    const chartWidthMm = pageWidth - margin * 2;
    doc.addImage(chartImgData, 'PNG', margin, y + 3, chartWidthMm, chartHeightMm);
    y += chartHeightMm + 9;
  } else {
    y += 8;
  }

  // 4. DATA LOGGING TABLE SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Recorded Telemetry Data Table (${data.samples.length} Samples)`, margin, y);

  y += 4;

  // Construct mode-specific table columns and rows
  let head: string[][] = [];
  let body: (string | number)[][] = [];

  if (data.mode === 'ISOLATED') {
    head = [
      ['#', 'Time', 'CH1 V (V)', 'CH1 I (A)', 'CH1 Vset', 'CH1 Iset', 'CH2 V (V)', 'CH2 I (A)', 'CH2 Vset', 'CH2 Iset'],
    ];
    body = data.samples.map((s, idx) => [
      idx + 1,
      s.timeStr,
      (s.ch1Vmon ?? 0).toFixed(3),
      (s.ch1Imon ?? 0).toFixed(4),
      (s.ch1Vset ?? 0).toFixed(3),
      (s.ch1Iset ?? 0).toFixed(4),
      (s.ch2Vmon ?? 0).toFixed(3),
      (s.ch2Imon ?? 0).toFixed(4),
      (s.ch2Vset ?? 0).toFixed(3),
      (s.ch2Iset ?? 0).toFixed(4),
    ]);
  } else if (data.mode === 'SERIES') {
    head = [
      ['#', 'Time', 'Total V (V)', 'Series I (A)', 'CH1 V (V)', 'CH2 V (V)', 'CH1 Vset', 'CH2 Vset', 'Master Iset'],
    ];
    body = data.samples.map((s, idx) => [
      idx + 1,
      s.timeStr,
      (s.serVoltMon ?? 0).toFixed(3),
      (s.ch1Imon ?? 0).toFixed(4),
      (s.ch1Vmon ?? 0).toFixed(3),
      (s.ch2Vmon ?? 0).toFixed(3),
      (s.ch1Vset ?? 0).toFixed(3),
      (s.ch2Vset ?? 0).toFixed(3),
      (s.masterIset ?? 0).toFixed(4),
    ]);
  } else if (data.mode === 'PARALLEL') {
    head = [
      ['#', 'Time', 'Parallel V (V)', 'Total I (A)', 'CH1 I (A)', 'CH2 I (A)', 'CH1 Iset', 'CH2 Iset', 'Master Vset'],
    ];
    body = data.samples.map((s, idx) => [
      idx + 1,
      s.timeStr,
      (s.ch1Vmon ?? 0).toFixed(3),
      (s.parCurMon ?? 0).toFixed(4),
      (s.ch1Imon ?? 0).toFixed(4),
      (s.ch2Imon ?? 0).toFixed(4),
      (s.ch1Iset ?? 0).toFixed(4),
      (s.ch2Iset ?? 0).toFixed(4),
      (s.masterVset ?? 0).toFixed(3),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'center',
    },
    headStyles: {
      fillColor: [2, 132, 199], // Sky-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50
    },
    margin: { left: margin, right: margin, bottom: 15 },
    didDrawPage: (hookData) => {
      // Repeat Footer on all pages
      const totalPages = doc.getNumberOfPages();
      const currentPage = hookData.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);

      // Left footer
      doc.text('JOMA Next Gen Dual Power Supply — Official Test Report', margin, pageHeight - 8);

      // Right footer
      const pageStr = `Page ${currentPage} of ${totalPages}`;
      doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), pageHeight - 8);
    },
  });

  // Calculate Base64 and output (safe in both browser and Node environments)
  const pdfOutputArray = doc.output('arraybuffer');
  let dataBase64 = '';
  if (typeof Buffer !== 'undefined') {
    dataBase64 = Buffer.from(pdfOutputArray).toString('base64');
  } else {
    const bytes = new Uint8Array(pdfOutputArray);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    dataBase64 = btoa(binary);
  }

  const timestampStr = new Date(data.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `JOMA_Report_${data.mode}_${timestampStr}.pdf`;

  return {
    dataBase64,
    fileName,
    fileBytes: pdfOutputArray.byteLength,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ${secs}s`;
}
