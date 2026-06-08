/**
 * Data maestra de trabajadores (ficha A3 + campos operativos SEPE).
 */

export const EMPTY_WORKER_MASTER = () => ({
  /** Token bloque T de USOLIBRE_EMPRESA (A3); hipótesis, rellenar cuando se confirme origen. */
  a3_worker_token: '',
  codigo_interno_a3: '',
  estado_civil: '',
  numero_hijos: '',
  domicilio: '',
  categoria: '',
  puesto_trabajo: '',
  grupo_tarifa: '',
  tipo_contrato: '',
  fecha_inicio_contrato: '',
  fecha_fin_contrato: '',
  codigo_empresa_a3: '',
  nombre_empresa_pdf: '',
});

/**
 * @typedef {import('../parsers/worker-field-extractor.js').EMPTY_WORKER_EXTRACTED} WorkerExtracted
 */

export function mapExtractedToStorePayload(extracted) {
  const e = extracted ?? {};
  return {
    ...EMPTY_WORKER_MASTER(),
    a3_worker_token: e.a3WorkerToken?.trim() ?? '',
    codigo_interno_a3: e.codigoInterno?.trim() ?? '',
    estado_civil: e.estadoCivil?.trim() ?? '',
    numero_hijos: e.numeroHijos?.trim() ?? '',
    domicilio: e.domicilio?.trim() ?? '',
    categoria: e.categoria?.trim() ?? '',
    puesto_trabajo: e.puestoTrabajo?.trim() ?? '',
    grupo_tarifa: e.grupoTarifa?.trim() ?? '',
    tipo_contrato: e.tipoContrato?.trim() ?? '',
    fecha_inicio_contrato: e.fechaInicioContrato?.trim() ?? '',
    fecha_fin_contrato: e.fechaFinContrato?.trim() ?? '',
    codigo_empresa_a3: e.codigoEmpresaA3?.trim() ?? '',
    nombre_empresa_pdf: e.nombreEmpresa?.trim() ?? '',
  };
}

/** Campos del formulario SEPE (sin inventar valores). */
export function mapExtractedToFormPrefill(extracted) {
  const e = extracted ?? {};
  return {
    identificador_pfisica: (e.nifNie ?? '').toUpperCase(),
    numero_seguridad_social: e.numeroSeguridadSocial ?? '',
    nombre: e.nombre?.trim() ?? '',
    primer_apellido: e.primerApellido?.trim() ?? '',
    segundo_apellido: e.segundoApellido?.trim() ?? '',
    sexo: e.sexo ?? '',
    fecha_nacimiento: e.fechaNacimiento ?? '',
    nacionalidad: e.nacionalidad?.trim() ?? '',
    municipio_residencia: e.municipio?.trim() ?? '',
    pais_residencia: e.pais?.trim() ?? '',
    codigo_ocupacion: e.codigoOcupacion?.trim() ?? '',
    nivel_formativo: e.nivelFormativo?.trim() ?? '',
    ind_incorpora_actividad: 'S',
    empresa_id: null,
    codigo_empresa_a3: e.codigoEmpresaA3?.trim() ?? '',
    codigo_interno_a3: e.codigoInterno?.trim() ?? '',
  };
}

export function ensureWorkerMasterShape(trabajador) {
  if (!trabajador) return trabajador;
  const base = { ...EMPTY_WORKER_MASTER(), ...pickMasterFromTrabajador(trabajador) };
  return { ...trabajador, ...base };
}

function pickMasterFromTrabajador(t) {
  const out = {};
  for (const key of Object.keys(EMPTY_WORKER_MASTER())) {
    out[key] = t[key]?.trim?.() ?? t[key] ?? '';
  }
  return out;
}

export function normalizeTrabajadorPayload(data, { id } = {}) {
  const master = pickMasterFromBody(data);
  return {
    ...(id ? { id } : {}),
    empresa_id: data.empresa_id || null,
    identificador_pfisica: data.identificador_pfisica?.trim().toUpperCase() ?? '',
    nombre: data.nombre?.trim() ?? '',
    primer_apellido: data.primer_apellido?.trim() ?? '',
    segundo_apellido: data.segundo_apellido?.trim() ?? '',
    sexo: data.sexo?.trim() ?? '',
    fecha_nacimiento: data.fecha_nacimiento?.trim() ?? '',
    nacionalidad: data.nacionalidad?.trim() ?? '',
    municipio_residencia: data.municipio_residencia?.trim() ?? '',
    pais_residencia: data.pais_residencia?.trim() || '724',
    numero_seguridad_social:
      data.numero_seguridad_social?.trim().replace(/\s/g, '') ?? '',
    codigo_ocupacion: data.codigo_ocupacion?.trim() ?? '',
    nivel_formativo: data.nivel_formativo?.trim() ?? '',
    ind_incorpora_actividad: data.ind_incorpora_actividad?.trim().toUpperCase() || 'S',
    ...master,
  };
}

function normalizeCodigoInternoA3(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (/^\d+$/.test(raw) && raw.length < 6) {
    return raw.padStart(6, '0');
  }
  return raw;
}

function pickMasterFromBody(data) {
  const m = EMPTY_WORKER_MASTER();
  for (const key of Object.keys(m)) {
    let val = data[key]?.trim?.() ?? data[key] ?? '';
    if (key === 'codigo_interno_a3') {
      val = normalizeCodigoInternoA3(val);
    }
    m[key] = val;
  }
  return m;
}

export function validateExtractedWorker(extracted) {
  const errors = [];
  const warnings = [];

  if (!extracted.nifNie?.trim()) {
    warnings.push('NIF/NIE no detectado');
  }
  if (!extracted.nombre?.trim() && !extracted.nombreCompleto?.trim()) {
    warnings.push('Nombre no detectado');
  }
  if (!extracted.numeroSeguridadSocial?.trim()) {
    warnings.push('NSS no detectado');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Fila resumida para tabla preview. */
export function buildWorkerPreviewRow(extracted, index) {
  const nombre = [extracted.nombre, extracted.primerApellido, extracted.segundoApellido]
    .filter(Boolean)
    .join(' ')
    .trim() || extracted.nombreCompleto || '';
  return {
    index,
    nif: extracted.nifNie ?? '',
    nombre,
    nss: extracted.numeroSeguridadSocial ?? '',
    fechaNacimiento: extracted.fechaNacimiento ?? '',
    tipoContrato: extracted.tipoContrato ?? '',
    codigoInterno: extracted.codigoInterno ?? '',
    hasNif: Boolean(extracted.nifNie?.trim()),
  };
}
