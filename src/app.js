import express from 'express';
import multer from 'multer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ALL_FIELDS } from './config/mapping.js';
import {
  processLlamamientos,
  rebuildLlamamientosFromRows,
} from './lib/processLlamamientos.js';
import {
  listEmpresas,
  listTrabajadores,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
  deleteAllTrabajadores,
  getStore,
  persistStore,
} from './lib/store.js';
import { importWorkersFromExcelBuffer } from './lib/workerExcelImport.js';
import { bulkImportWorkersFromExcelBuffer } from './lib/services/worker-bulk-import-service.js';
import { enrichTrabajadorList } from './lib/worker-completeness.js';
import { backfillFechasFromExcelBuffer } from './lib/services/worker-fecha-backfill-service.js';
import { backfillCodigosFromExcelBuffer } from './lib/services/worker-codigo-backfill-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Cambia si ves errores antiguos tipo "Faltan columnas obligatorias". */
export const APP_VERSION = '2.5.1';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      /\.xlsx?$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF (.pdf)'));
  },
});

const workerPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF (.pdf)'));
  },
});

const app = express();
/** En Vercel el cwd es la raíz del proyecto; en local, relativo a src/. */
const publicDir = process.env.VERCEL
  ? join(process.cwd(), 'public')
  : join(__dirname, '..', 'public');

app.use(express.json({ limit: '2mb' }));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-SEPEIMP-Version', APP_VERSION);
  next();
});
app.use(express.static(publicDir, { etag: false, maxAge: 0 }));

app.get('/api/health', (_req, res) => {
  res.json({
    version: APP_VERSION,
    incompleteXml: true,
    placeholder: '???????',
    runtime: process.env.VERCEL ? 'vercel' : 'node',
  });
});

app.get('/api/fields', (_req, res) => {
  res.json({ fields: ALL_FIELDS });
});

function resolveStoreFromBody(body) {
  const raw = body?.store;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.empresas) && Array.isArray(parsed.trabajadores)) {
        persistStore({
          empresas: parsed.empresas,
          trabajadores: parsed.trabajadores,
        });
        return parsed;
      }
    } catch {
      /* usar store en disco */
    }
  }
  return getStore();
}

app.get('/api/store', (_req, res) => {
  res.json(getStore());
});

app.put('/api/store', (req, res) => {
  const { empresas, trabajadores } = req.body ?? {};
  if (!Array.isArray(empresas) || !Array.isArray(trabajadores)) {
    return res.status(400).json({ error: 'store inválido' });
  }
  persistStore({ empresas, trabajadores });
  res.json({ ok: true, ...getStore() });
});

app.get('/api/empresas', (_req, res) => {
  res.json({ empresas: listEmpresas() });
});

app.post('/api/empresas', (req, res) => {
  const empresa = createEmpresa(req.body ?? {});
  res.status(201).json({ empresa });
});

app.put('/api/empresas/:id', (req, res) => {
  const empresa = updateEmpresa(req.params.id, req.body ?? {});
  if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
  res.json({ empresa });
});

app.delete('/api/empresas/:id', (req, res) => {
  if (!deleteEmpresa(req.params.id)) {
    return res.status(404).json({ error: 'Empresa no encontrada' });
  }
  res.json({ ok: true });
});

app.post('/api/empresas/parse-pdf', pdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo PDF'],
      });
    }
    const { importCompanyFromPdfBuffer } = await import('./lib/companyPdfImport.js');
    const result = await importCompanyFromPdfBuffer(req.file.buffer);
    res.json(result);
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo leer el PDF'],
    });
  }
});

app.get('/api/trabajadores', (_req, res) => {
  const empresas = listEmpresas();
  const raw = listTrabajadores().map((t) => ({
    ...t,
    empresa_nombre:
      empresas.find((e) => e.id === t.empresa_id)?.nombre ??
      empresas.find((e) => e.id === t.empresa_id)?.nombre_empresa ??
      '',
  }));
  const trabajadores = enrichTrabajadorList(raw);
  res.json({ trabajadores, empresas });
});

app.post('/api/trabajadores/backfill-fechas-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo Excel'],
      });
    }
    const headerRow = parseInt(req.body.headerRow ?? '1', 10);
    const db = resolveStoreFromBody(req.body);
    const result = backfillFechasFromExcelBuffer(req.file.buffer, {
      headerRow: Number.isNaN(headerRow) ? 1 : headerRow,
      store: db,
    });
    persistStore(db);
    res.json({ ...result, trabajadores: db.trabajadores });
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo actualizar fechas'],
    });
  }
});

app.post('/api/trabajadores/backfill-codigos-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo Excel'],
      });
    }
    const headerRow = parseInt(req.body.headerRow ?? '1', 10);
    const db = resolveStoreFromBody(req.body);
    const result = backfillCodigosFromExcelBuffer(req.file.buffer, {
      headerRow: Number.isNaN(headerRow) ? 1 : headerRow,
      store: db,
    });
    persistStore(db);
    res.json({ ...result, trabajadores: db.trabajadores });
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo actualizar códigos de trabajador'],
    });
  }
});

app.post('/api/trabajadores/import-excel-a3', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo Excel'],
      });
    }

    const sheetIndex = parseInt(req.body.sheetIndex ?? '0', 10);
    const headerRow = parseInt(req.body.headerRow ?? '1', 10);
    const empresaId = req.body.empresaId?.trim() || null;
    const store = resolveStoreFromBody(req.body);

    const result = bulkImportWorkersFromExcelBuffer(req.file.buffer, {
      sheetIndex: Number.isNaN(sheetIndex) ? 0 : sheetIndex,
      headerRow: Number.isNaN(headerRow) ? 1 : headerRow,
      originalFileName: req.file.originalname,
      empresaId,
      store,
    });

    if (!result.ok) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo importar el Excel'],
    });
  }
});

app.post('/api/trabajadores/parse-excel-a3', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo Excel'],
      });
    }

    const sheetIndex = parseInt(req.body.sheetIndex ?? '0', 10);
    const headerRow = parseInt(req.body.headerRow ?? '1', 10);

    const empresaId = req.body.empresaId?.trim() || null;

    const result = importWorkersFromExcelBuffer(req.file.buffer, {
      sheetIndex: Number.isNaN(sheetIndex) ? 0 : sheetIndex,
      headerRow: Number.isNaN(headerRow) ? 1 : headerRow,
      originalFileName: req.file.originalname,
      empresaId,
      store: getStore(),
    });

    res.json(result);
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo leer el Excel'],
    });
  }
});

app.post('/api/trabajadores/parse-pdf', workerPdfUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar un archivo PDF'],
      });
    }
    const { importWorkersFromPdfBuffer } = await import('./lib/workerPdfImport.js');
    const result = await importWorkersFromPdfBuffer(req.file.buffer);
    res.json(result);
  } catch (err) {
    res.status(422).json({
      ok: false,
      errors: [err.message || 'No se pudo leer el PDF'],
    });
  }
});

app.post('/api/trabajadores', (req, res) => {
  const trabajador = createTrabajador(req.body ?? {});
  res.status(201).json({ trabajador });
});

app.put('/api/trabajadores/:id', (req, res) => {
  const trabajador = updateTrabajador(req.params.id, req.body ?? {});
  if (!trabajador) {
    return res.status(404).json({ error: 'Trabajador no encontrado' });
  }
  res.json({ trabajador });
});

app.delete('/api/trabajadores', (req, res) => {
  const deleted = deleteAllTrabajadores();
  res.json({ ok: true, deleted });
});

app.delete('/api/trabajadores/:id', (req, res) => {
  if (!deleteTrabajador(req.params.id)) {
    return res.status(404).json({ error: 'Trabajador no encontrado' });
  }
  res.json({ ok: true });
});

app.post('/api/rebuild-xml', (req, res) => {
  try {
    const { records, baseName } = req.body ?? {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        ok: false,
        errors: ['No hay registros para reconstruir el XML'],
      });
    }
    const result = rebuildLlamamientosFromRows(records, baseName || 'LLAMAMIENTOS');
    res.json({
      ok: true,
      baseName: result.baseName,
      recordCount: result.recordCount,
      completeCount: result.completeCount,
      incompleteCount: result.incompleteCount,
      fileCount: result.fileCount,
      records: result.records.map((r) => ({
        row: r.excelRowNumber,
        sourceRows: r.sourceRows,
        movementPair: r.movementPair,
        complete: r.complete,
        missingFields: r.missingFields,
        matchedTrabajador: r.matchedTrabajador,
        matchedEmpresa: r.matchedEmpresa,
        matchBy: r.matchBy,
        filledFrom: r.filledFrom,
        record: r.record,
      })),
      files: result.files.map((f) => ({
        name: f.name,
        count: f.count,
        part: f.part,
        totalParts: f.totalParts,
        startRow: f.startRow,
        incompleteInFile: f.incompleteInFile,
        xml: f.xml,
      })),
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      errors: [err.message || 'Error al reconstruir XML'],
    });
  }
});

app.post('/api/generate', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        errors: ['Debes seleccionar o arrastrar un archivo Excel'],
      });
    }

    const sheetIndex = parseInt(req.body.sheetIndex ?? '0', 10);
    const headerRow = parseInt(req.body.headerRow ?? '1', 10);
    const prefix = req.body.prefix?.trim() || undefined;
    const empresaId = req.body.empresaId?.trim() || null;

    const result = processLlamamientos(req.file.buffer, {
      sheetIndex: Number.isNaN(sheetIndex) ? 0 : sheetIndex,
      headerRow: Number.isNaN(headerRow) ? 1 : headerRow,
      prefix,
      originalFileName: req.file.originalname,
      store: resolveStoreFromBody(req.body),
      empresaId,
    });

    if (!result.ok) {
      return res.status(422).json(result);
    }

    res.json({
      ok: true,
      baseName: result.baseName,
      recordCount: result.recordCount,
      discardedCount: result.discardedCount,
      completeCount: result.completeCount,
      incompleteCount: result.incompleteCount,
      fileCount: result.fileCount,
      rowCount: result.rowCount,
      excelMovementCount: result.excelMovementCount,
      matchedFromTrabajador: result.matchedFromTrabajador,
      trabajadoresEnSistema: result.trabajadoresEnSistema,
      processingLog: result.processingLog,
      excelIncomplete: result.excelIncomplete,
      warnings: result.warnings,
      warningSummary: result.warningSummary,
      meta: result.meta,
      records: result.records.map((r) => ({
        row: r.excelRowNumber,
        sourceRows: r.sourceRows,
        movementPair: r.movementPair,
        complete: r.complete,
        missingFields: r.missingFields,
        matchedTrabajador: r.matchedTrabajador,
        matchedEmpresa: r.matchedEmpresa,
        matchBy: r.matchBy,
        filledFrom: r.filledFrom,
        record: r.record,
      })),
      files: result.files.map((f) => ({
        name: f.name,
        count: f.count,
        part: f.part,
        totalParts: f.totalParts,
        startRow: f.startRow,
        incompleteInFile: f.incompleteInFile,
        xml: f.xml,
      })),
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      errors: [err.message || 'Error al procesar el archivo'],
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error('[SEPEIMP]', err);
  res.status(400).json({
    ok: false,
    errors: [err.message || 'Error en la petición'],
  });
});

export default app;
