/**
 * Data maestra de empresas (ficha A3 + campos operativos SEPE).
 */

const EMPTY_ADDRESS_DB = () => ({
  sigla: '',
  via: '',
  numero: '',
  escalera: '',
  piso: '',
  puerta: '',
  municipio: '',
  provincia: '',
  codigo_postal: '',
});

export const EMPTY_ADDRESS = EMPTY_ADDRESS_DB;

/** Definición de campos para preview UI (clave interna → etiqueta humana). */
export const COMPANY_FIELD_DEFINITIONS = [
  { group: 'Identificación', fields: [
    { key: 'codigo_empresa_a3', extractKey: 'codigoEmpresaA3', label: 'Código de empresa A3', required: false },
    { key: 'nombre_empresa', extractKey: 'nombreEmpresa', label: 'Nombre empresa (A3)', required: true },
    { key: 'nif_empresa', extractKey: 'nifEmpresa', label: 'NIF/CIF', required: true },
    { key: 'ccc', extractKey: 'ccc', label: 'CCC', required: false },
  ]},
  { group: 'Contacto', fields: [
    { key: 'telefono', extractKey: 'telefono', label: 'Teléfono', required: false },
    { key: 'email', extractKey: 'email', label: 'E-mail', required: false },
  ]},
  { group: 'Administrativo', fields: [
    { key: 'fecha_alta_empresa', extractKey: 'fechaAltaEmpresa', label: 'Fecha alta empresa', required: false },
    { key: 'tipo_pago_irpf', extractKey: 'tipoPagoIRPF', label: 'Tipo pago IRPF', required: false },
    { key: 'codigo_centro_gestion', extractKey: 'codigoCentroGestion', label: 'Código centro gestión', required: false },
    { key: 'tipo_empresario', extractKey: 'tipoEmpresario', label: 'Tipo empresario', required: false },
  ]},
  { group: 'Domicilio fiscal', prefix: 'fiscal', address: true },
  { group: 'Domicilio envío documentación', prefix: 'envio', address: true },
];

const ADDRESS_PREVIEW_FIELDS = [
  { suffix: 'sigla', label: 'Sigla' },
  { suffix: 'via', label: 'Vía' },
  { suffix: 'numero', label: 'Número' },
  { suffix: 'escalera', label: 'Escalera' },
  { suffix: 'piso', label: 'Piso' },
  { suffix: 'puerta', label: 'Puerta' },
  { suffix: 'municipio', label: 'Municipio' },
  { suffix: 'provincia', label: 'Provincia' },
  { suffix: 'codigo_postal', label: 'Código postal' },
];

function mapAddressToDb(addr) {
  const a = addr ?? {};
  return {
    sigla: a.sigla?.trim() ?? '',
    via: a.via?.trim() ?? '',
    numero: a.numero?.trim() ?? '',
    escalera: a.escalera?.trim() ?? '',
    piso: a.piso?.trim() ?? '',
    puerta: a.puerta?.trim() ?? '',
    municipio: a.municipio?.trim() ?? '',
    provincia: a.provincia?.trim() ?? '',
    codigo_postal: a.codigoPostal?.trim() ?? a.codigo_postal?.trim() ?? '',
  };
}

function pickMasterFromBody(data) {
  return {
    codigo_empresa_a3: data.codigo_empresa_a3?.trim() ?? '',
    nombre_empresa: data.nombre_empresa?.trim() ?? '',
    telefono: data.telefono?.trim() ?? '',
    email: data.email?.trim() ?? '',
    fecha_alta_empresa: data.fecha_alta_empresa?.trim() ?? '',
    tipo_pago_irpf: data.tipo_pago_irpf?.trim() ?? '',
    codigo_centro_gestion: data.codigo_centro_gestion?.trim() ?? '',
    tipo_empresario: data.tipo_empresario?.trim() ?? '',
    domicilio_fiscal: mapAddressToDb(data.domicilio_fiscal),
    domicilio_envio: mapAddressToDb(data.domicilio_envio),
  };
}

/** Construye registro completo para db.json. */
export function normalizeEmpresaPayload(data, { id } = {}) {
  const master = pickMasterFromBody(data);
  const record = {
    ...(id ? { id } : {}),
    nombre: data.nombre?.trim() ?? '',
    ccc: data.ccc?.trim() ?? '',
    nif_empresa: data.nif_empresa?.trim().toUpperCase() ?? '',
    usolibre_empresa: data.usolibre_empresa?.trim() ?? '',
    clave_contrato_trans: data.clave_contrato_trans?.trim() ?? '',
    nivel_formativo: data.nivel_formativo?.trim() ?? '',
    ind_incorpora_actividad: data.ind_incorpora_actividad?.trim().toUpperCase() ?? '',
    ...master,
  };
  if (!record.nombre_empresa && record.nombre) {
    record.nombre_empresa = record.nombre;
  }
  return record;
}

/** Asegura campos maestra en empresas antiguas al leer. */
export function ensureEmpresaMasterShape(empresa) {
  if (!empresa) return empresa;
  const base = normalizeEmpresaPayload(
    {
      ...empresa,
      domicilio_fiscal: empresa.domicilio_fiscal ?? EMPTY_ADDRESS_DB(),
      domicilio_envio: empresa.domicilio_envio ?? EMPTY_ADDRESS_DB(),
    },
    { id: empresa.id },
  );
  return { ...base, id: empresa.id };
}

/**
 * @typedef {Object} CompanyExtracted
 * @property {string} codigoEmpresaA3
 * @property {string} nombreEmpresa
 * @property {string} nifEmpresa
 * @property {string} telefono
 * @property {string} email
 * @property {string} fechaAltaEmpresa
 * @property {string} tipoPagoIRPF
 * @property {string} codigoCentroGestion
 * @property {string} tipoEmpresario
 * @property {string} ccc
 * @property {Object} domicilioFiscal
 * @property {Object} domicilioEnvio
 */

export function mapExtractedToStorePayload(extracted) {
  return {
    codigo_empresa_a3: extracted.codigoEmpresaA3 ?? '',
    nombre_empresa: extracted.nombreEmpresa ?? '',
    nif_empresa: (extracted.nifEmpresa ?? '').toUpperCase(),
    ccc: extracted.ccc ?? '',
    telefono: extracted.telefono ?? '',
    email: extracted.email ?? '',
    fecha_alta_empresa: extracted.fechaAltaEmpresa ?? '',
    tipo_pago_irpf: extracted.tipoPagoIRPF ?? '',
    codigo_centro_gestion: extracted.codigoCentroGestion ?? '',
    tipo_empresario: extracted.tipoEmpresario ?? '',
    domicilio_fiscal: mapAddressToDb(extracted.domicilioFiscal),
    domicilio_envio: mapAddressToDb(extracted.domicilioEnvio),
  };
}

/** Prefill del formulario operativo (sin inferir campos no presentes en PDF). */
export function mapExtractedToFormPrefill(extracted) {
  const prefill = {
    nombre: extracted.nombreEmpresa?.trim() ?? '',
    codigo_empresa_a3: extracted.codigoEmpresaA3?.trim() ?? '',
    nif_empresa: (extracted.nifEmpresa ?? '').toUpperCase(),
    ccc: extracted.ccc?.trim() ?? '',
    usolibre_empresa: '',
    clave_contrato_trans: '',
    nivel_formativo: '',
    ind_incorpora_actividad: '',
  };
  return prefill;
}

export function validateExtractedCompany(extracted) {
  const errors = [];
  const warnings = [];

  if (!extracted.nombreEmpresa?.trim()) {
    errors.push('No se detectó el nombre de la empresa. Revísalo antes de guardar.');
  }
  if (!extracted.nifEmpresa?.trim()) {
    errors.push('No se detectó el NIF/CIF de la empresa. Revísalo antes de guardar.');
  }
  if (!extracted.codigoEmpresaA3?.trim()) {
    warnings.push('Código de empresa A3 no detectado.');
  }
  if (!extracted.telefono?.trim() && !extracted.email?.trim()) {
    warnings.push('No se detectaron teléfono ni e-mail.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

function getExtractedScalar(extracted, extractKey) {
  if (!extractKey) return '';
  return extracted[extractKey] ?? '';
}

function getExtractedAddress(extracted, prefix, suffix) {
  const blockKey = prefix === 'fiscal' ? 'domicilioFiscal' : 'domicilioEnvio';
  const block = extracted[blockKey] ?? {};
  const camel =
    suffix === 'codigo_postal'
      ? 'codigoPostal'
      : suffix;
  return block[camel] ?? '';
}

/** Lista plana de campos para preview (detectado / no detectado). */
export function buildFieldStatusList(extracted) {
  const items = [];

  for (const group of COMPANY_FIELD_DEFINITIONS) {
    if (group.address) {
      for (const f of ADDRESS_PREVIEW_FIELDS) {
        const value = getExtractedAddress(extracted, group.prefix, f.suffix);
        items.push({
          group: group.group,
          key: `${group.prefix}_${f.suffix}`,
          label: f.label,
          value,
          detected: Boolean(value?.trim()),
          required: false,
        });
      }
      continue;
    }
    for (const f of group.fields) {
      const value = getExtractedScalar(extracted, f.extractKey);
      items.push({
        group: group.group,
        key: f.key,
        label: f.label,
        value,
        detected: Boolean(String(value).trim()),
        required: Boolean(f.required),
      });
    }
  }

  return items;
}
