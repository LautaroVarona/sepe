/**
 * Fusión de datos importados con trabajadores existentes y resolución de duplicados.
 */
import { mapExtractedToFormPrefill } from '../store/worker-master-store.js';

/**
 * Busca trabajador por DNI/NIE (clave maestra).
 */
export function findTrabajadorByDni(trabajadores, nif) {
  const key = String(nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
  if (!key) return null;
  return (
    trabajadores.find(
      (t) =>
        String(t.identificador_pfisica ?? '')
          .trim()
          .toUpperCase()
          .replace(/[\s.-]/g, '') === key,
    ) ?? null
  );
}

/**
 * Combina prefill importado con registro existente (no sobrescribe con vacíos).
 */
export function mergePrefillWithExisting(prefill, existing) {
  if (!existing) return { ...prefill };
  const out = { ...prefill };
  const fields = [
    'numero_seguridad_social',
    'nombre',
    'primer_apellido',
    'segundo_apellido',
    'sexo',
    'fecha_nacimiento',
    'nacionalidad',
    'municipio_residencia',
    'pais_residencia',
    'codigo_ocupacion',
    'nivel_formativo',
    'ind_incorpora_actividad',
    'codigo_interno_a3',
    'codigo_empresa_a3',
  ];
  for (const f of fields) {
    if (!String(out[f] ?? '').trim() && String(existing[f] ?? '').trim()) {
      out[f] = existing[f];
    }
  }
  if (!out.empresa_id && existing.empresa_id) {
    out.empresa_id = existing.empresa_id;
  }
  return out;
}

/**
 * @param {object} extracted
 * @param {object[]} trabajadores
 * @param {object[]} empresas
 */
export function buildWorkerImportEntry(extracted, index, { trabajadores = [], empresas = [] } = {}) {
  const prefill = mapExtractedToFormPrefill(extracted);
  const duplicate = findTrabajadorByDni(trabajadores, prefill.identificador_pfisica);

  let suggestedEmpresaId = null;
  if (extracted.codigoEmpresaA3) {
    const emp = empresas.find(
      (e) => String(e.codigo_empresa_a3 ?? '').trim() === String(extracted.codigoEmpresaA3).trim(),
    );
    if (emp) suggestedEmpresaId = emp.id;
  }

  if (suggestedEmpresaId) {
    prefill.empresa_id = suggestedEmpresaId;
  }

  return {
    index,
    extracted,
    prefill: duplicate ? mergePrefillWithExisting(prefill, duplicate) : prefill,
    duplicate: duplicate
      ? {
          id: duplicate.id,
          identificador_pfisica: duplicate.identificador_pfisica,
          nombre: `${duplicate.nombre ?? ''} ${duplicate.primer_apellido ?? ''}`.trim(),
        }
      : null,
  };
}
