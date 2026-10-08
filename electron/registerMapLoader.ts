import { RegisterDefinition, RegisterMap } from '../src/types/registerMap';

export class RegisterMapLoader {
  public static parseCsv(csvContent: string): RegisterMap {
    const lines = csvContent.split(/\r?\n/);
    const registerMap: RegisterMap = {
      version: '1.0',
      deviceName: 'Dual Channel Power Supply',
      registers: new Map<string, RegisterDefinition>(),
    };

    if (lines.length < 2) return registerMap;

    // Header expected: ParameterName,Address,FunctionCode,DataType,Scaling,Permission,Channel,Unit,Description
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('parameter'));
    const addrIdx = headers.findIndex((h) => h.includes('address') || h.includes('addr'));
    const fcIdx = headers.findIndex((h) => h.includes('function') || h.includes('fc'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('data'));
    const scaleIdx = headers.findIndex((h) => h.includes('scale') || h.includes('multiplier'));
    const permIdx = headers.findIndex((h) => h.includes('permission') || h.includes('rw') || h.includes('access'));
    const chanIdx = headers.findIndex((h) => h.includes('channel') || h.includes('ch'));
    const unitIdx = headers.findIndex((h) => h.includes('unit'));
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('info'));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map((c) => c.trim());
      const paramName = cols[nameIdx] || `REG_${i}`;
      const address = parseInt(cols[addrIdx] || '0', 10);
      const functionCode = (parseInt(cols[fcIdx] || '3', 10) as any) || 3;
      const dataType = (cols[typeIdx] as any) || 'FLOAT32_CDAB';
      const scaling = parseFloat(cols[scaleIdx] || '1.0');
      const permission = (cols[permIdx] as any) || 'RW';
      const channel = (cols[chanIdx] as any) || 'GLOBAL';
      const unit = cols[unitIdx] || '';
      const description = cols[descIdx] || '';

      const regDef: RegisterDefinition = {
        parameterName: paramName,
        address,
        functionCode,
        dataType,
        scaling,
        permission,
        channel,
        unit,
        description,
      };

      registerMap.registers.set(paramName, regDef);
    }

    return registerMap;
  }
}
