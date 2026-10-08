# JOMA SCADA Architecture Blueprint

## Executive Summary

This document provides a comprehensive architectural blueprint of the **JOMA Next Gen SCADA Application**. It documents the software architecture, process boundaries, hardware abstraction, Modbus RTU communication strategy, data persistence, and state management patterns. 

This blueprint serves as the definitive reference for understanding how to reproduce this architecture in new industrial desktop applications (such as a Dual Channel Power Supply SCADA).

---

## 1. Project Structure & Organization

```
JOMA/
├── package.json                   # Dependencies, scripts, electron-builder config
├── tsconfig.json                  # React Renderer TypeScript config
├── tsconfig.electron.json         # Electron Main/Preload TypeScript config
├── vite.config.ts                 # Vite build & alias configuration (@ -> ./src)
├── index.html                     # HTML entry point for React SPA
├── electron/                      # Main Process & Node Backend Services
│   ├── main.ts                    # Electron app lifecycle, window management, IPC handlers
│   ├── preload.ts                 # Context isolation bridge (contextBridge)
│   ├── modbusRtuService.ts        # Modbus RTU client, serial lock, simulator, polling, sequence engine
│   ├── databaseService.ts        # JSON file-based persistence for test sessions & sequence presets
│   └── modbus-serial.d.ts         # Type declarations for modbus-serial library
└── src/                           # React Renderer (Frontend SPA)
    ├── main.tsx                   # React entry point rendering <App />
    ├── App.tsx                    # Root application component & global UI state manager
    ├── components/                # Modular React UI components
    │   ├── Header.tsx             # System status bar, COM connection controls, mode badges
    │   ├── NavigationTabs.tsx     # View switching tabs (Dashboard, Sequence, History, Diagnostics, Eng Settings)
    │   ├── MetricsGrid.tsx        # Live Vmon, Imon, Pmon readouts with 7-segment digital styling
    │   ├── OutputControlPanel.tsx # Master Output ON/OFF & Mode selector (CV, CC, CR, CP, BAT TEST)
    │   ├── LiveChart.tsx          # Real-time Recharts V/I/P vs Time telemetry chart
    │   ├── HistoryAndPdf.tsx      # Past sessions list, CSV export, PDF report generator
    │   ├── SequenceBuilder.tsx    # Multi-step automated test sequence editor & execution runner
    │   ├── SettingsModal.tsx      # Serial COM Port, Baud rate, Slave ID, and Register profile config
    │   ├── EngSettings.tsx        # Vmax, Imax, Pmax, Rmax safety limit configurations
    │   ├── RegisterDiagnosticsPanel.tsx # Low-level Modbus coil/holding register reader/writer
    │   ├── KeyboardNumericInput.tsx # Touch/on-screen numeric keypad input
    │   ├── SafetyModal.tsx        # Over-voltage / Over-power emergency alarm popups
    │   └── JomaLogo.tsx           # Application branding logo component
    ├── styles/
    │   └── index.css              # Custom SCADA design system CSS (Dark mode, glassmorphism, LED fonts)
    └── types/
        ├── scada.ts               # Core domain models (DeviceProfile, TelemetryPoint, SequenceConfig, etc.)
        └── electron.d.ts          # Window.electronAPI type definitions exposed by preload
```

### Component Dependencies & Data Flow Relationships

```
┌────────────────────────────────────────────────────────────────────────┐
│                          REACT RENDERER SPA                            │
│  [App.tsx] ──> [MetricsGrid] / [LiveChart] / [SequenceBuilder] / etc.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ window.electronAPI (Typed IPC Bridge)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ELECTRON PRELOAD SCRIPT                         │
│   [preload.ts] (contextBridge.exposeInMainWorld('electronAPI', ...))   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC Channels (invoke / on)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                          │
│   [main.ts] (Window creation, IPC Listeners, App Lifecycle)           │
│         │                                        │                     │
│         ▼                                        ▼                     │
│  [ModbusRtuService]                      [DatabaseService]             │
│   ├── SerialBusLock (Mutex Queue)         ├── JSON File Persistence   │
│   ├── ModbusRTU (modbus-serial)           ├── Test Sessions History    │
│   ├── Virtual Hardware Simulator          └── Sequence Presets         │
│   └── Sequence Execution Runner                                        │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │ RS485 Serial (COM Port)
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PHYSICAL HARDWARE / POWER SUPPLY                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Electron Architecture & Security Model

### Process Boundaries & Isolation Rules
- **Context Isolation (`contextIsolation: true`):** The React renderer operates in an isolated JavaScript context. Node.js primitives (`require`, `fs`, `net`, `child_process`) are completely hidden from the renderer.
- **Node Integration Disabled (`nodeIntegration: false`):** Prevents XSS vulnerabilities or untrusted scripts from accessing host operating system APIs.
- **Preload Script (`electron/preload.ts`):** Serves as an explicit security gate. Only explicitly whitelisted functions are exposed via `window.electronAPI`.

### IPC Communication Patterns
1. **Request / Response Pattern (`ipcRenderer.invoke` $\rightarrow$ `ipcMain.handle`):**
   - Used for asynchronous, command-driven operations (e.g., `modbus:connect`, `modbus:writeSetpoints`, `modbus:setOutput`, `db:getSessions`).
   - Handler functions in `main.ts` execute asynchronous backend operations and return typed results back to the renderer.

2. **Event Streaming Pattern (`mainWindow.webContents.send` $\rightarrow$ `ipcRenderer.on`):**
   - Used for continuous, unidirectional data pushing from backend services to renderer without blocking UI thread.
   - Channel `modbus:telemetry`: Streams live telemetry points at regular polling intervals.
   - Channel `modbus:statusChange`: Pushes connection state updates (`CONNECTED`, `DISCONNECTED`, `SIMULATOR`).
   - Channel `sequence:progress`: Streams real-time automated sequence progress.

### Application Shutdown Interlock
- When the user attempts to close the window (`mainWindow.on('close')`), `main.ts` checks if hardware output is actively running (`modbusService.getOutputState()`).
- If an active test is running, closing is intercepted (`e.preventDefault()`) and a native safety dialog alerts the operator, requiring explicit confirmation to stop the test before destroying the window.

---

## 3. Modbus RTU Architecture

### Communication Stack
- **Library:** `modbus-serial` (NPM).
- **Physical Medium:** RS485 / RS232 Serial Port (`COMx` on Windows).
- **Protocol:** Modbus RTU Slave/Master architecture.

### Serial Bus Locking Mechanism (`SerialBusLock`)
To prevent Modbus packet corruption and RS485 bus collisions caused by concurrent asynchronous reads/writes, all Modbus calls are funneled through a strict single-threaded queue:
- `SerialBusLock.runExclusive(fn)` wraps all physical register queries.
- Ensures only **one** Modbus transaction is active on the serial wire at any given millisecond.
- Includes inter-frame delays (default 10ms–50ms) between transactions to satisfy slave hardware timing constraints.

### Floating Point Register Packing / Unpacking
- Hardware registers use 32-bit IEEE 754 Floating Point values stored across **two adjacent 16-bit Modbus holding registers**.
- **Byte Ordering:** Supports both **Word-Swapped** (Low Word First / CDAB) and **Big Endian** (High Word First / ABCD) modes configurable via settings (`wordSwap: boolean`).
- **Base Addressing:** Supports both **Base-1 Direct MainAddress** (1-indexed matching user CSV specification) and **Base-0 Wire PDU Offset** (`MainAddress - 1`).

### Polling & Error Recovery
- **Polling Loop:** `ModbusRtuService` runs an internal `setInterval` timer (configurable, default 500ms).
- **Consecutive Error Tracking:** Tracks failed Modbus transactions (`consecutiveErrors`). If 3 consecutive reads fail:
  - Connection status transitions to `COMMUNICATION_FAULT`.
  - Telemetry points are flagged with `isStale: true` and `deviceResponding: false`.
  - Polling attempts reconnection automatically without crashing the renderer.

---

## 4. Hardware Abstraction Layer (HAL)

### Device Profile Abstraction
The application decouples UI components from physical register addresses via `DeviceProfile` and `RegisterOffsets` definitions:

```typescript
export interface DeviceProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  deviceType: 'POWER_SUPPLY' | 'ELECTRONIC_LOAD';
  outputControlFc: 5 | 6; // FC05 (Coil) or FC06 (Holding Register)
  voltageScale: number;
  currentScale: number;
  registers: RegisterOffsets;
}
```

### Register Mapping Concept
UI components interact with generic domain properties (`vset`, `iset`, `mode`, `outputState`). The backend service maps domain commands to hardware registers:
- `vset` $\rightarrow$ Register 4X 5 (Float, 2 Regs)
- `mode` $\rightarrow$ Register 4X 29 (INT, 1 Reg: 6=CV, 7=CC, 8=CR, 9=CP, 14=BAT TEST)
- `outputCoil` $\rightarrow$ Register 0X 1 (Bit: 1=ON, 0=OFF)

Adding a new device model requires only creating a new `DeviceProfile` entry with its corresponding `RegisterOffsets` mapping—**zero changes to UI code**.

---

## 5. Database & Persistence Architecture

### Storage Strategy
- Data persistence is implemented in `electron/databaseService.ts` using JSON document storage located in the user data folder (`app.getPath('userData')`):
  - `joma_scada_history.json`: Stores historical `TestSession` records.
  - `joma_scada_presets.json`: Stores automated `SequencePreset` recipes.

### Data Models
- **`TestSession`:** Contains metadata (start time, mode, device profile info, status) and an array of time-stamped `TelemetryPoint` records.
- **`SequencePreset`:** Contains multi-step program configurations (step duration, setpoints, mode transitions).

### IPC Layer Data Flow
```
[React Renderer UI] ──> window.electronAPI.db.saveSession(session)
                       ──> [IPC: db:saveSession]
                       ──> [DatabaseService.saveSession()]
                       ──> [fs.writeFileSync(jsonFilePath)]
```

---

## 6. State Management

Application state is strictly partitioned across boundaries:

| State Domain | Location | Responsibility |
| :--- | :--- | :--- |
| **UI State** | React Renderer (`App.tsx`) | Active view tab, modal visibility, keypad inputs, theme options. |
| **Telemetry Buffer** | React Renderer (`App.tsx`) | `telemetryHistory` array used for live Recharts plotting (capped/windowed). |
| **Hardware State** | Electron Main (`ModbusRtuService`) | Actual COM port handle, confirmed output state, physical mode, register cache. |
| **Sequence Runner** | Electron Main (`ModbusRtuService`) | Active step index, remaining seconds, cycle counter, sequence state machine. |
| **Persisted Data** | Backend Filesystem (`DatabaseService`)| Saved test logs, PDF export templates, sequence recipes. |

---

## 7. Real-Time Telemetry Flow

```
1. Hardware / Simulator
   │ Modbus Read (FC03, 32-bit Float)
   ▼
2. ModbusRtuService (Main Process)
   │ Unpack floats, format timestamps, check alarms
   ▼
3. WebContents IPC Emission
   │ mainWindow.webContents.send('modbus:telemetry', point)
   ▼
4. Preload Listener (Bridge)
   │ ipcRenderer.on('modbus:telemetry', callback)
   ▼
5. React App.tsx State Update
   │ setTelemetry(point) & setTelemetryHistory(prev => [...prev, point])
   ▼
6. UI Components Re-render
   │ <MetricsGrid /> (7-Segment Display) & <LiveChart /> (Recharts SVG)
```

### Performance & Thread Protection
- Hardware serial communication runs asynchronously in Node.js event loop in Main process.
- Renderer UI loop remains completely unblocked at 60 FPS.
- Data logging rate throttle (`logIntervalSeconds`) prevents memory saturation during multi-hour test runs.

---

## 8. Virtual Simulator Architecture

The system includes a complete hardware simulator mode (`isSimulator: true`), allowing full application testing without physical hardware:

### Key Features of Simulator Architecture
1. **Bypass Hardware Layer:** When `isSimulator` is enabled, `ModbusRtuService` disables physical serial port initialization.
2. **Virtual Registers:** Maintains in-memory register state matching physical holding registers and coils.
3. **Realistic Physical Response:**
   - Simulated voltage & current respond dynamically to setpoint changes with realistic slew rates.
   - Simulated battery discharge curve (`simBatteryVoltage`) drains voltage according to discharge current setpoint over time.
   - Gaussian noise ($\pm 0.02\text{ V/A}$) added to readouts for natural telemetry visualization.
4. **Alarm Injection:** API handlers (`triggerSimAlarm`) allow testing emergency over-voltage / over-power UI popups.

---

## 9. Automated Sequence / Recipe Architecture

### State Machine
The sequence runner maintains an internal state machine:
`IDLE` $\rightarrow$ `STARTING` $\rightarrow$ `RUNNING` $\rightleftarrows$ `PAUSED` $\rightarrow$ `STOPPING` $\rightarrow$ `COMPLETED` / `ABORTED` / `FAULT`.

### Execution Engine
- Located entirely in `ModbusRtuService` (Electron Main).
- Runs an asynchronous execution tick timer (1000ms interval).
- Programmatically issues setpoint updates (`writeSetpoints`) to hardware upon step transition.
- Emits real-time sequence progress updates (`sequence:progress`) via IPC.

---

## 10. Calibration & Diagnostics Architecture

- Low-level diagnostic reader/writer interface in `RegisterDiagnosticsPanel.tsx` allows inspecting any 16-bit register or 32-bit float register directly.
- Engineering limits screen (`EngSettings.tsx`) allows setting system-wide safety cutoffs (`vmax`, `imax`, `pmax`, `rmax`), which are stored both in local configuration and written to hardware protection registers (4X 7, 4X 9, 4X 11, 4X 30).

---

## 11. Dependencies & Technology Stack

### Main Process & Build Dependencies
- **`electron` (^34.2.0):** Desktop container framework.
- **`modbus-serial` (^8.0.25):** Modbus RTU communication over serial ports.
- **`serialport`:** Optional native serial port enumeration fallback.
- **`vite` (^6.1.1):** High-speed renderer builder & dev server.
- **`electron-builder` (^26.15.3):** Windows executable packager (NSIS & Portable target).

### Renderer Dependencies
- **`react` (^19.0.0) & `react-dom` (^19.0.0):** Frontend UI library.
- **`recharts` (^2.15.1):** SVG graph rendering for live telemetry charting.
- **`lucide-react` (^0.475.0):** SCADA icon system.
- **`jspdf` (^2.5.2) & `html2canvas` (^1.4.1):** PDF report generation and DOM canvas capture.

---

## 12. Text-Based Architecture Diagram

```
+-----------------------------------------------------------------------+
|                           REACT RENDERER                              |
|                                                                       |
|  +-------------------+  +------------------+  +--------------------+  |
|  |  Dashboard Views  |  | Sequence Builder |  | History & Reports  |  |
|  +---------+---------+  +--------+---------+  +---------+----------+  |
|            |                     |                      |             |
|            +---------------------+----------------------+             |
|                                  |                                    |
|                         React State & Hooks                           |
+----------------------------------+------------------------------------+
                                   |
                     window.electronAPI (Preload)
                                   |
+----------------------------------+------------------------------------+
|                         ELECTRON MAIN                                 |
|                                                                       |
|  +-------------------+  +------------------+  +--------------------+  |
|  |   IPC Handlers    |  | DatabaseService  |  | ModbusRtuService   |  |
|  +---------+---------+  +--------+---------+  +---------+----------+  |
|            |                     |                      |             |
|            |                     v                      v             |
|            |           JSON Persistence File   +-------------------+  |
|            |                                   |  Serial Bus Lock  |  |
|            |                                   +---------+---------+  |
|            |                                             |            |
+------------+---------------------------------------------+------------+
                                                           |
                                       +-------------------+-------------------+
                                       |                                       |
                                       v                                       v
                           [Physical RS485 Serial]                 [Virtual Simulator]
                                       |                                       |
                                       v                                       v
                            Dual Power Supply Hardware              Simulated Register Bank
```
