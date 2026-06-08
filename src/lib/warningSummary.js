const DISCARD_REASON_LABELS = {
  no_trabajador: 'Trabajador no encontrado',
  no_fecha_inicio: 'Sin FECHA_INICIO',
  no_contrato: 'Sin CLAVE_CONTRATO_TRANS',
};

/**
 * Resume miles de avisos por fila en un resumen compacto para la UI.
 */
export function buildWarningSummary(allWarnings, { discardedRows = [], processingLog } = {}) {
  const unique = [...new Set(allWarnings)];
  const global = [];
  const missingFieldCounts = {};
  const samples = [];

  for (const w of unique) {
    if (!w.startsWith('Fila ')) {
      global.push(w);
      continue;
    }
    const missing = w.match(/^Fila \d+: falta ([A-Z_]+)/);
    if (missing) {
      missingFieldCounts[missing[1]] =
        (missingFieldCounts[missing[1]] || 0) + 1;
    } else if (samples.length < 30) {
      samples.push(w);
    }
  }

  const missingFieldsSorted = Object.entries(missingFieldCounts).sort(
    (a, b) => b[1] - a[1],
  );

  const discardSamples = discardedRows.slice(0, 20).map((d) => ({
    excelRowNumber: d.excelRowNumber,
    reason: d.reason,
    label: DISCARD_REASON_LABELS[d.reason] ?? d.reason,
    message: d.message,
  }));

  const discardByReason = processingLog?.byReason ?? {};
  const discardByReasonSorted = Object.entries(discardByReason)
    .map(([reason, count]) => ({
      reason,
      label: DISCARD_REASON_LABELS[reason] ?? reason,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: unique.length,
    global,
    missingFieldCounts,
    missingFieldsSorted,
    samples,
    discarded: processingLog?.discarded ?? discardedRows.length,
    processed: processingLog?.processed,
    discardByReasonSorted,
    discardSamples,
  };
}
