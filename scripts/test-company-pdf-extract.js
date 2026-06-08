/**
 * Prueba del extractor ficha empresa A3.
 * Ejecutar: node scripts/test-company-pdf-extract.js
 */
import { readFileSync, existsSync } from 'fs';
import { normalizeCompanyPdfText } from '../src/lib/pdf/company-text-normalizer.js';
import { extractCompanyFields } from '../src/lib/mappings/company-field-extractor.js';
import { validateExtractedCompany } from '../src/lib/store/company-master-store.js';
import { parseCompanyPdf } from '../src/lib/pdf/company-pdf-parser.js';

/** Layout real A3: dos columnas con tabuladores (como extrae pdf-parse). */
const SAMPLE_A3_TABS = `
Ficha de empresa
Empresa	96280 - EL ALTO VALENCIA, S.L.
Fecha listado	03/06/2026	Página	1
Datos de identificación de la Empresa
Código de la Empresa	96280
Nombre de la Empresa	EL ALTO VALENCIA, S.L.
N.I.F./C.I.F. de la Empresa	B96562467
Domicilio envio documentación	Domicilio Fiscal
Sigla	PZ	Sigla	PZ
Via pública	AYUNTAMIENTO	Via pública	AYUNTAMIENTO
Número	16	Número	16
Esc.		Esc.	
Piso.	2	Piso.	2
Puerta.		Puerta.	
Municipio	VALENCIA	Municipio	VALENCIA
Provincia	VALENCIA	Provincia	VALENCIA
Cód. Postal	46002	Cód. Postal	46002
E-mail	administracion1@grupoelalto.com	Teléfono	963448944
Tablas
Enlace con A3GES
Fecha Alta Empresa	15/02/2024
Datos varios
Tipo de pago I.R.P.F.	Mensual
Código Centro Gestión	00001
Tipo de empresario	Colectivo. P. Jurídica
Datos de Ampliación de la Ficha del Trabajador
`;

/** Como muchos PDF A3 reales: etiqueta en una línea, valor en la siguiente. */
const SAMPLE_IDENT_ORPHAN_LINES = `
Ficha de empresa
Empresa	96280 - EL ALTO VALENCIA, S.L.
Datos de identificación de la Empresa
Código de la Empresa
96280
Nombre de la Empresa
EL ALTO VALENCIA, S.L.
N.I.F./C.I.F. de la Empresa
B96562467
Domicilio envio documentación	Domicilio Fiscal
E-mail	administracion1@grupoelalto.com	Teléfono	963448944
`;

/** Texto real Ctrl+C desde ficha empresa 96280.pdf (layout A3 sin tabs). */
/** Texto tipo pdf-parse: pegado, pie de página, NIF cerca de "Domicilio". */
const SAMPLE_PDF_PARSE = `Ficha de empresa Empresa - 96280 EL ALTO VALENCIA, S.L. Fecha listado 03/06/2026 Página 1 Observaciones Datos de identificación de la Empresa Código de la Empresa Nombre de la Empresa 96280 EL ALTO VALENCIA, S.L. N.I.F./C.I.F. de la Empresa B96562467 Domicilio envio documentación Domicilio Fiscal Sigla PZ Sigla PZ Via pública AYUNTAMIENTO Via pública AYUNTAMIENTO Número Esc. Piso. Puerta. Número Esc. Piso. Puerta. 16 2 16 2 Municipio VALENCIA Municipio VALENCIA Provincia Cód. Postal Provincia Cód. Postal VALENCIA 46002 VALENCIA 46002 Teléfono Teléfono 963448944 E-mail administracion1@grupoelalto.com Tablas Enlace con A3GES Fecha Alta Empresa 15/02/2024 Datos varios Tipo de pago I.R.P.F. Mensual Código Centro Gestión 00001 Tipo de empresario Colectivo. P. Jurídica -- 1 of 1 --`;

/** PDF con etiquetas acentuadas (Código, envío) — el bug principal. */
const SAMPLE_ACCENTED = `Ficha de empresa
Empresa - 96280 EL ALTO VALENCIA, S.L. Fecha listado 03/06/2026
Datos de identificación de la Empresa
Código de la Empresa Nombre de la Empresa 96280 EL ALTO VALENCIA, S.L.
N.I.F./C.I.F. de la Empresa B96562467
Domicilio envío documentación Domicilio Fiscal
E-mail administracion1@grupoelalto.com
`;

const SAMPLE_REAL_PASTE = `Ficha de empresa
Empresa - 96280 EL ALTO VALENCIA, S.L. Fecha listado 03/06/2026
Página 1 Observaciones 
Datos de identificación de la Empresa
Código de la Empresa Nombre de la Empresa 96280 EL ALTO VALENCIA, S.L. 
N.I.F./C.I.F. de la Empresa B96562467 
Domicilio envio documentación Domicilio Fiscal
Sigla PZ Sigla PZ 
Via pública AYUNTAMIENTO Via pública AYUNTAMIENTO 
Número Esc. Piso. Puerta. Número Esc. Piso. Puerta. 16 2 16 2 
Municipio VALENCIA Municipio VALENCIA 
Provincia Cód. Postal Provincia Cód. Postal VALENCIA 46002 VALENCIA 46002
Teléfono Teléfono 963448944 
E-mail administracion1@grupoelalto.com 
Tablas Datos de Ampliación de la Ficha del Trabajador
Enlace con A3GES
Fecha Alta Empresa 15/02/2024
Datos varios
Tipo de pago I.R.P.F. Mensual 
Código Centro Gestión 00001
Tipo de empresario Colectivo. P. Jurídica 
`;

const SAMPLE_SIMPLE = `
Ficha de empresa
Código de la Empresa: 96280
Nombre de la Empresa: EL ALTO VALENCIA, S.L.
N.I.F./C.I.F. de la Empresa: B96562467
Domicilio Fiscal
Sigla: PZ
Teléfono: 963448944
E-mail: administracion1@grupoelalto.com
Fecha Alta Empresa: 15/02/2024
Código Centro Gestión: 00001
`;

const EXPECTED = {
  codigoEmpresaA3: '96280',
  nombreEmpresa: 'EL ALTO VALENCIA, S.L.',
  nifEmpresa: 'B96562467',
  telefono: '963448944',
  email: 'administracion1@grupoelalto.com',
  codigoCentroGestion: '00001',
};

function assertSample(name, raw, expected = EXPECTED) {
  const text = normalizeCompanyPdfText(raw);
  const extracted = extractCompanyFields(text);
  const validation = validateExtractedCompany(extracted);
  let failed = 0;

  for (const [key, expectedVal] of Object.entries(expected)) {
    const expected = expectedVal;
    if (key === 'telefono' && !extracted.telefono) continue;
    const got = extracted[key];
    if (got !== expected) {
      console.error(`[${name}] FAIL ${key}: expected "${expected}", got "${got}"`);
      failed++;
    }
  }
  if (name.includes('tabuladores') || name.includes('Ctrl+C')) {
    if (!extracted.domicilioFiscal?.municipio?.includes('VALENCIA')) {
      console.error(`[${name}] FAIL domicilio fiscal`);
      failed++;
    }
    if (!extracted.domicilioEnvio?.codigoPostal?.includes('46002')) {
      console.error(`[${name}] FAIL codigo postal envio`);
      failed++;
    }
  }
  if (!validation.ok) {
    console.error(`[${name}] FAIL validation:`, validation.errors);
    failed++;
  }
  if (failed) {
    console.log(JSON.stringify(extracted, null, 2));
    return false;
  }
  console.log(`OK — ${name}`);
  return true;
}

let ok = assertSample('etiquetas acentuadas (Código)', SAMPLE_ACCENTED, {
  codigoEmpresaA3: '96280',
  nombreEmpresa: 'EL ALTO VALENCIA, S.L.',
  nifEmpresa: 'B96562467',
  email: 'administracion1@grupoelalto.com',
});
ok = assertSample('texto pdf-parse (una línea)', SAMPLE_PDF_PARSE) && ok;
ok = assertSample('texto real Ctrl+C (A3)', SAMPLE_REAL_PASTE) && ok;
ok = assertSample('layout A3 (tabuladores)', SAMPLE_A3_TABS) && ok;
ok =
  assertSample('identificación (líneas separadas)', SAMPLE_IDENT_ORPHAN_LINES, {
    codigoEmpresaA3: '96280',
    nombreEmpresa: 'EL ALTO VALENCIA, S.L.',
    nifEmpresa: 'B96562467',
    telefono: '963448944',
    email: 'administracion1@grupoelalto.com',
  }) && ok;
ok = assertSample('layout simple (dos puntos)', SAMPLE_SIMPLE) && ok;

const pdfPath = process.argv[2];
if (pdfPath && existsSync(pdfPath)) {
  const buf = readFileSync(pdfPath);
  parseCompanyPdf(buf).then(({ normalizedText }) => {
    console.log('--- Texto extraído (primeros 2000 chars) ---');
    console.log(normalizedText.slice(0, 2000));
    console.log('--- Fin muestra ---');
    const extracted = extractCompanyFields(normalizedText);
    console.log(JSON.stringify(extracted, null, 2));
  });
} else if (!ok) {
  process.exit(1);
} else if (!pdfPath) {
  console.log('Tip: node scripts/test-company-pdf-extract.js "ruta/ficha.pdf"');
}
