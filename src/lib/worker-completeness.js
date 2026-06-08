/**
 * Completitud de ficha trabajador para listado (verde / naranja).
 * NSS no es obligatorio (Excel A3 parcial).
 */

export const TRABAJADOR_COMPLETENESS_FIELDS = [
  { key: 'identificador_pfisica', label: 'DNI/NIE' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'primer_apellido', label: 'Primer apellido' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'fecha_nacimiento', label: 'F. nacimiento' },
  { key: 'nacionalidad', label: 'Nacionalidad' },
  { key: 'municipio_residencia', label: 'Municipio' },
  { key: 'pais_residencia', label: 'País residencia' },
  { key: 'nivel_formativo', label: 'Nivel formativo' },
  { key: 'ind_incorpora_actividad', label: 'Incorpora' },
  { key: 'empresa_id', label: 'Empresa' },
];

function isFieldFilled(trabajador, key) {
  const v = trabajador[key];
  if (key === 'fecha_nacimiento') {
    return /^\d{8}$/.test(String(v ?? '').trim());
  }
  if (key === 'empresa_id') {
    return v != null && String(v).trim() !== '';
  }
  return v != null && String(v).trim() !== '';
}

export function getTrabajadorMissingFields(trabajador) {
  return TRABAJADOR_COMPLETENESS_FIELDS.filter(
    ({ key }) => !isFieldFilled(trabajador, key),
  ).map(({ key, label }) => ({ key, label }));
}

export function isTrabajadorComplete(trabajador) {
  return getTrabajadorMissingFields(trabajador).length === 0;
}

export function normDniKey(nif) {
  return String(nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
}

/** Mapa DNI normalizado → cantidad de registros con ese DNI. */
export function buildDniCountMap(trabajadores) {
  const counts = new Map();
  for (const t of trabajadores) {
    const key = normDniKey(t.identificador_pfisica);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function enrichTrabajadorList(trabajadores) {
  const dniCounts = buildDniCountMap(trabajadores);
  return trabajadores.map((t) => {
    const missingFields = getTrabajadorMissingFields(t);
    const dniKey = normDniKey(t.identificador_pfisica);
    const duplicateDni = dniKey ? (dniCounts.get(dniKey) ?? 0) > 1 : false;
    return {
      ...t,
      completeness: missingFields.length === 0 ? 'complete' : 'incomplete',
      missingFields: missingFields.map((m) => m.label),
      duplicateDni,
    };
  });
}
