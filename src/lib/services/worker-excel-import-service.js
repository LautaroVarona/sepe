import {
  findTrabajadorByDni,
  mergePrefillWithExisting,
} from './worker-merge-service.js';

const MASTER_KEYS = [
  'codigo_interno_a3',
  'estado_civil',
  'numero_hijos',
  'domicilio',
  'categoria',
  'puesto_trabajo',
  'grupo_tarifa',
  'tipo_contrato',
  'fecha_inicio_contrato',
  'fecha_fin_contrato',
  'codigo_empresa_a3',
  'nombre_empresa_pdf',
];

function pickMasterPayload(trabajador) {
  const out = {};
  for (const key of MASTER_KEYS) {
    out[key] = trabajador[key]?.trim?.() ?? trabajador[key] ?? '';
  }
  return out;
}

/**
 * @param {{ filaExcel: number, trabajador: object, llamamiento: object }} registro
 */
export function buildWorkerImportEntryFromTrabajador(
  registro,
  index,
  { trabajadores = [], empresas: _empresas = [] } = {},
) {
  const prefillRaw = { ...registro.trabajador };
  const duplicate = findTrabajadorByDni(
    trabajadores,
    prefillRaw.identificador_pfisica,
  );
  const prefill = duplicate
    ? mergePrefillWithExisting(prefillRaw, duplicate)
    : prefillRaw;

  return {
    index,
    filaExcel: registro.filaExcel,
    prefill,
    masterPayload: pickMasterPayload(prefillRaw),
    duplicate: duplicate
      ? {
          id: duplicate.id,
          identificador_pfisica: duplicate.identificador_pfisica,
          nombre: `${duplicate.nombre ?? ''} ${duplicate.primer_apellido ?? ''}`.trim(),
        }
      : null,
    llamamiento: registro.llamamiento,
  };
}

export function buildWorkerPreviewFromPrefill(entry) {
  const p = entry.prefill ?? {};
  const nombre = [p.nombre, p.primer_apellido, p.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    index: entry.index,
    filaExcel: entry.filaExcel,
    nif: p.identificador_pfisica ?? '',
    nombre,
    nss: p.numero_seguridad_social ?? '',
    fechaNacimiento: p.fecha_nacimiento ?? '',
    municipio: p.municipio_residencia ?? '',
    nivelFormativo: p.nivel_formativo ?? '',
    tipoContrato: entry.masterPayload?.tipo_contrato ?? '',
    hasNif: Boolean(p.identificador_pfisica?.trim()),
    duplicateId: entry.duplicate?.id ?? null,
  };
}
