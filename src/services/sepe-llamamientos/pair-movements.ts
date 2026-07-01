import type { GenerateLogEntry, PairedLlamamiento, RawMovement } from './types.js';
import { monthKeyYmd } from './normalize.js';

interface WorkerMonthQueue {
  altas: RawMovement[];
}

/**
 * Ordena por trabajador y fecha; empareja Alta+Baja; descarta bajas huérfanas
 * (sin Alta previa en el mismo mes calendario YYYYMM).
 */
export function pairAndNormalizeMovements(
  movements: RawMovement[],
): {
  paired: PairedLlamamiento[];
  logs: GenerateLogEntry[];
  stats: { paired: number; altaSinBaja: number; orphanBajasDiscarded: number };
} {
  const logs: GenerateLogEntry[] = [];
  const paired: PairedLlamamiento[] = [];
  let pairedCount = 0;
  let altaSinBaja = 0;
  let orphanBajasDiscarded = 0;

  const byWorker = new Map<string, RawMovement[]>();
  for (const mov of movements) {
    if (!mov.dni) {
      logs.push({
        level: 'warn',
        message: 'Movimiento sin DNI; omitido',
        row: mov.excelRowNumber,
        file: mov.sourceFile,
      });
      continue;
    }
    const list = byWorker.get(mov.dni) ?? [];
    list.push(mov);
    byWorker.set(mov.dni, list);
  }

  for (const [dni, workerMovements] of byWorker) {
    workerMovements.sort((a, b) => {
      const fa = a.fecha || '00000000';
      const fb = b.fecha || '00000000';
      if (fa !== fb) return fa.localeCompare(fb);
      if (a.movementType === b.movementType) return a.excelRowNumber - b.excelRowNumber;
      return a.movementType === 'alta' ? -1 : 1;
    });

    const pendingByMonth = new Map<string, WorkerMonthQueue>();

    for (const mov of workerMovements) {
      if (mov.movementType === 'alta') {
        const month = monthKeyYmd(mov.fecha);
        if (!month) {
          logs.push({
            level: 'warn',
            message: 'Alta sin fecha válida; omitida',
            dni,
            row: mov.excelRowNumber,
            file: mov.sourceFile,
          });
          continue;
        }
        const queue = pendingByMonth.get(month) ?? { altas: [] };
        queue.altas.push(mov);
        pendingByMonth.set(month, queue);
        continue;
      }

      const month = monthKeyYmd(mov.fecha);
      if (!month) {
        logs.push({
          level: 'warn',
          message: 'Baja sin fecha válida; descartada',
          dni,
          row: mov.excelRowNumber,
          file: mov.sourceFile,
        });
        orphanBajasDiscarded += 1;
        continue;
      }

      const queue = pendingByMonth.get(month);
      const alta = queue?.altas.shift();

      if (!alta) {
        logs.push({
          level: 'warn',
          message: `Baja huérfana descartada (sin Alta en ${month.slice(0, 4)}-${month.slice(4, 6)})`,
          dni,
          row: mov.excelRowNumber,
          file: mov.sourceFile,
        });
        orphanBajasDiscarded += 1;
        continue;
      }

      paired.push({
        dni,
        fechaInicio: alta.fecha,
        fechaFin: mov.fecha,
        contrato: alta.contrato || mov.contrato,
        cno: alta.cno || mov.cno,
        ccc: alta.ccc || mov.ccc,
        nss: alta.nss || mov.nss,
        nombre: alta.nombre,
        primerApellido: alta.primerApellido,
        segundoApellido: alta.segundoApellido,
        sourceRows: [alta.excelRowNumber, mov.excelRowNumber],
        sourceFile: mov.sourceFile,
        movementPair: 'alta+baja',
      });
      pairedCount += 1;
    }

    for (const [, queue] of pendingByMonth) {
      for (const alta of queue.altas) {
        paired.push({
          dni,
          fechaInicio: alta.fecha,
          fechaFin: '',
          contrato: alta.contrato,
          cno: alta.cno,
          ccc: alta.ccc,
          nss: alta.nss,
          nombre: alta.nombre,
          primerApellido: alta.primerApellido,
          segundoApellido: alta.segundoApellido,
          sourceRows: [alta.excelRowNumber],
          sourceFile: alta.sourceFile,
          movementPair: 'alta-sin-baja',
        });
        altaSinBaja += 1;
        logs.push({
          level: 'info',
          message: 'Alta sin Baja emparejada en el mismo mes',
          dni,
          row: alta.excelRowNumber,
          file: alta.sourceFile,
        });
      }
    }
  }

  return {
    paired,
    logs,
    stats: { paired: pairedCount, altaSinBaja, orphanBajasDiscarded },
  };
}
