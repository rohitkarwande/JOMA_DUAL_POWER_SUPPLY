export type RegisterFunctionCode = 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16;
export type RegisterDataType = 'FLOAT32_CDAB' | 'FLOAT32_ABCD' | 'INT16' | 'UINT16' | 'BIT';
export type RegisterPermission = 'RO' | 'WO' | 'RW';

export interface RegisterDefinition {
  parameterName: string;
  address: number;             // Modbus Holding Register / Coil Address
  functionCode: RegisterFunctionCode;
  dataType: RegisterDataType;
  scaling: number;             // Scaling multiplier (e.g. 1.0 or 0.01)
  permission: RegisterPermission;
  channel: 'CH1' | 'CH2' | 'GLOBAL' | 'SYSTEM';
  unit: string;
  description: string;
}

export interface RegisterMap {
  version: string;
  deviceName: string;
  registers: Map<string, RegisterDefinition>;
}
