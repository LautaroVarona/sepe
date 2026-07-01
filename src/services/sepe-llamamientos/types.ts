/** Registro SEPE listo para XML L2606002 */
export interface SepeLlamamientoRecord {
  CCC: string;
  NIF_EMPRESA: string;
  IDENTIFICADORPFISICA: string;
  NOMBRE: string;
  PRIMER_APELLIDO: string;
  SEGUNDO_APELLIDO: string;
  SEXO: string;
  FECHA_NACIMIENTO: string;
  NACIONALIDAD: string;
  MUNICIPIO_RESIDENCIA: string;
  PAIS_RESIDENCIA: string;
  NUMERO_SEGURIDAD_SOCIAL: string;
  FECHA_INICIO: string;
  FECHA_FIN: string;
  CLAVE_CONTRATO_TRANS: string;
  IND_INCORPORA_ACTIVIDAD: string;
  CODIGO_OCUPACION: string;
  NIVEL_FORMATIVO: string;
  USOLIBRE_EMPRESA: string;
  /** Auxiliares para USOLIBRE (no van al XML) */
  CODIGO_EMPRESA_A3?: string;
  CODIGO_INTERNO_A3?: string;
  CODIGO_CONTRATO_CORTO?: string;
}

export type MovementType = 'alta' | 'baja';

/** Fila cruda de movimiento (Saltra / cliente) */
export interface RawMovement {
  excelRowNumber: number;
  sourceFile: string;
  movementType: MovementType;
  fecha: string;
  dni: string;
  nss: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  contrato: string;
  cno: string;
  ccc: string;
}

/** Trabajador en base maestra A3 (tmp22E8) */
export interface MasterWorker {
  dni: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  sexo: string;
  fechaNacimiento: string;
  nacionalidad: string;
  municipio: string;
  pais: string;
  nss: string;
  nivelFormativo: string;
  codigoOcupacion: string;
  codigoInternoA3: string;
  codigoEmpresaA3: string;
  indIncorpora: string;
}

/** Llamamiento emparejado Alta+Baja */
export interface PairedLlamamiento {
  dni: string;
  fechaInicio: string;
  fechaFin: string;
  contrato: string;
  cno: string;
  ccc: string;
  nss: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  sourceRows: number[];
  sourceFile: string;
  movementPair: 'alta+baja' | 'alta-sin-baja';
}

export interface EmpresaDefaults {
  nifEmpresa: string;
  ccc: string;
  codigoEmpresaA3?: string;
  nivelFormativo?: string;
  indIncorporaActividad?: string;
}

export interface GenerateOptions {
  /** Rutas a Excel/CSV de movimientos (Saltra) */
  movementPaths: string[];
  /** Ruta al Excel maestro A3 (tmp22E8.xls) */
  masterPath: string;
  /** Datos de empresa si no vienen en movimientos */
  empresa?: EmpresaDefaults;
  headerRow?: number;
  /** Máximo registros por fichero XML (SEPE: 30) */
  maxRecordsPerFile?: number;
  /** Nombre base de exportación */
  outputBaseName?: string;
}

export interface GenerateLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  dni?: string;
  row?: number;
  file?: string;
}

export interface GeneratedXmlFile {
  name: string;
  xml: string;
  count: number;
  part: number;
  totalParts: number;
}

export interface GenerateResult {
  ok: boolean;
  files: GeneratedXmlFile[];
  records: SepeLlamamientoRecord[];
  logs: GenerateLogEntry[];
  stats: {
    movementsRead: number;
    paired: number;
    altaSinBaja: number;
    orphanBajasDiscarded: number;
    skippedNoMaster: number;
    recordsGenerated: number;
  };
}
