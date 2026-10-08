# JOMA Architecture Rules

This document outlines the mandatory architectural rules that must be strictly preserved when building any new application (such as the Dual Channel Power Supply SCADA) using this framework.

---

## Rule 1: Process Boundaries & Security
1. **Never import Node.js native modules in React renderer code.**
   - Do NOT import `fs`, `path`, `net`, `child_process`, or `modbus-serial` in `src/`.
   - All system and hardware operations MUST go through `window.electronAPI`.

2. **Keep context isolation enabled (`contextIsolation: true`).**
   - Do NOT enable `nodeIntegration` in BrowserWindow configuration.
   - All IPC channels MUST be explicitly declared and typed in `preload.ts` and `src/types/electron.d.ts`.

---

## Rule 2: Hardware Communication & Modbus Code
1. **All Modbus RTU code belongs exclusively in the Electron Main process.**
   - Modbus master client instantiation, serial port connection, frame formatting, and register polling MUST reside inside backend services (e.g. `ModbusRtuService.ts`).

2. **Always serialize serial traffic with a Mutex / Serial Bus Lock.**
   - RS485 communication is half-duplex and single-channel. Every read/write query MUST execute through a mutex queue (`SerialBusLock.runExclusive`).
   - Never allow parallel asynchronous `modbusClient` calls.

3. **Separate register mapping from domain business logic.**
   - Hardware register offsets, scaling factors, function codes, and byte endianness MUST be abstracted into `DeviceProfile` definitions.
   - React components MUST only deal with human domain values (Volts, Amps, Watts, Mode strings).

---

## Rule 3: Real-Time Telemetry Data Flow
1. **Push telemetry from Main process to Renderer via IPC events.**
   - Main process executes polling loop $\rightarrow$ sends `modbus:telemetry` event to renderer via `webContents.send()`.
   - Do NOT poll hardware from React using `setInterval` + IPC `invoke`. Use push-based streaming listeners (`ipcRenderer.on`).

2. **Keep the UI rendering thread unblocked.**
   - Hardware serial latency, retries, and timeouts MUST execute asynchronously in Node.js event loop without blocking React state updates.

---

## Rule 4: Data Persistence Architecture
1. **Database / File persistence operations belong in Electron Main process.**
   - Data saving (`TestSession`, `SequencePreset`, configurations) MUST be executed by backend services (`DatabaseService.ts`).
   - Renderer invokes persistence via `window.electronAPI.db.*`.

2. **Keep historical telemetry logging windowed and throttled.**
   - Charting buffers in React MUST cap maximum data points or use sliding window sampling to maintain 60 FPS performance during long-duration tests.

---

## Rule 5: Virtual Simulator Requirement
1. **Every hardware service MUST implement a complete Virtual Simulator mode.**
   - The simulator MUST mock register reads/writes, simulate output slew rates, and generate realistic telemetry without requiring physical hardware.
   - Enabling `isSimulator: true` in settings MUST allow 100% of UI components and automated sequences to run seamlessly during development.

---

## Rule 6: Safety & Emergency Interlocks
1. **Window close interlock must check hardware state.**
   - Electron `main.ts` MUST intercept window close events (`mainWindow.on('close')`) and verify if hardware output is active before exiting.
   - If output is active, automatically prompt the user and safely disable hardware output before application exit.

---

## Rule 7: Product & Repository Isolation
1. **Each hardware product application MUST reside in its own clean folder / repository.**
   - Do NOT mix different product SCADA implementations in the same codebase.
   - Copy this architecture blueprint and project structure to the new repository (`d:\JOMA_DUAL_PS`) to preserve clean git history and standalone executable builds.

---

## Rule Summary Cheat Sheet

| Feature | Where it Belongs | Mechanism |
| :--- | :--- | :--- |
| **Modbus Serial Port I/O** | Electron Main (`modbusRtuService.ts`) | `modbus-serial` + `SerialBusLock` |
| **Hardware Register Mapping** | Hardware Abstraction Layer | `DeviceProfile` & `RegisterOffsets` |
| **IPC Exposure** | Preload Script (`preload.ts`) | `contextBridge.exposeInMainWorld` |
| **Telemetry Pipeline** | Main $\rightarrow$ Renderer Event Stream | `webContents.send('modbus:telemetry')` |
| **Data Persistence** | Electron Main (`databaseService.ts`) | JSON / SQLite File Storage |
| **UI Components & Charts** | React Renderer (`src/components/`) | React 19 + Recharts + Tailwind/CSS |
| **Hardware Simulator** | Electron Main (`modbusRtuService.ts`) | In-memory virtual register state |
