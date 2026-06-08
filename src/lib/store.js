import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  ensureEmpresaMasterShape,
  normalizeEmpresaPayload,
} from './store/company-master-store.js';
import {
  ensureWorkerMasterShape,
  normalizeTrabajadorPayload,
} from './store/worker-master-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_DIR = join(__dirname, '..', '..', 'data');
const BUNDLED_DB = join(LOCAL_DATA_DIR, 'db.json');

/** En Vercel el filesystem del proyecto es de solo lectura; persistir en /tmp. */
function resolveDataPaths() {
  if (process.env.VERCEL) {
    const dataDir = join(tmpdir(), 'sepeimp');
    return { dataDir, dbFile: join(dataDir, 'db.json') };
  }
  return { dataDir: LOCAL_DATA_DIR, dbFile: BUNDLED_DB };
}

function ensureDbFile(dataDir, dbFile) {
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(dbFile)) return;

  if (existsSync(BUNDLED_DB) && dbFile !== BUNDLED_DB) {
    try {
      copyFileSync(BUNDLED_DB, dbFile);
      return;
    } catch {
      /* seed opcional */
    }
  }

  writeFileSync(dbFile, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
}

const EMPTY_DB = { empresas: [], trabajadores: [] };

function loadDb() {
  const { dataDir, dbFile } = resolveDataPaths();
  ensureDbFile(dataDir, dbFile);
  const raw = readFileSync(dbFile, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    empresas: (parsed.empresas ?? []).map(ensureEmpresaMasterShape),
    trabajadores: (parsed.trabajadores ?? []).map(ensureWorkerMasterShape),
  };
}

function saveDb(db) {
  const { dataDir, dbFile } = resolveDataPaths();
  ensureDbFile(dataDir, dbFile);
  writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
}

export function getStore() {
  return loadDb();
}

export function persistStore(db) {
  saveDb(db);
}

export function listEmpresas() {
  return loadDb().empresas;
}

export function listTrabajadores() {
  return loadDb().trabajadores;
}

export function getEmpresa(id) {
  return loadDb().empresas.find((e) => e.id === id) ?? null;
}

export function getTrabajador(id) {
  return loadDb().trabajadores.find((t) => t.id === id) ?? null;
}

export function getTrabajadorByDni(nif) {
  const key = String(nif ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '');
  if (!key) return null;
  return (
    loadDb().trabajadores.find(
      (t) =>
        String(t.identificador_pfisica ?? '')
          .trim()
          .toUpperCase()
          .replace(/[\s.-]/g, '') === key,
    ) ?? null
  );
}

export function createEmpresa(data) {
  const db = loadDb();
  const empresa = normalizeEmpresaPayload(data, { id: randomUUID() });
  db.empresas.push(empresa);
  saveDb(db);
  return empresa;
}

export function updateEmpresa(id, data) {
  const db = loadDb();
  const idx = db.empresas.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  db.empresas[idx] = normalizeEmpresaPayload(
    { ...db.empresas[idx], ...data },
    { id },
  );
  saveDb(db);
  return db.empresas[idx];
}

export function deleteEmpresa(id) {
  const db = loadDb();
  const before = db.empresas.length;
  db.empresas = db.empresas.filter((e) => e.id !== id);
  db.trabajadores = db.trabajadores.map((t) =>
    t.empresa_id === id ? { ...t, empresa_id: null } : t,
  );
  saveDb(db);
  return db.empresas.length < before;
}

export function createTrabajador(data) {
  const db = loadDb();
  const trabajador = normalizeTrabajadorPayload(data, { id: randomUUID() });
  db.trabajadores.push(trabajador);
  saveDb(db);
  return trabajador;
}

/** Crea muchos trabajadores en una sola escritura a disco. */
export function bulkCreateTrabajadores(payloads) {
  if (!payloads?.length) return [];
  const db = loadDb();
  const created = payloads.map((data) =>
    normalizeTrabajadorPayload(data, { id: randomUUID() }),
  );
  db.trabajadores.push(...created);
  saveDb(db);
  return created;
}

export function updateTrabajador(id, data) {
  const db = loadDb();
  const idx = db.trabajadores.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  db.trabajadores[idx] = normalizeTrabajadorPayload(
    { ...db.trabajadores[idx], ...data },
    { id },
  );
  saveDb(db);
  return db.trabajadores[idx];
}

export function deleteTrabajador(id) {
  const db = loadDb();
  const before = db.trabajadores.length;
  db.trabajadores = db.trabajadores.filter((t) => t.id !== id);
  saveDb(db);
  return db.trabajadores.length < before;
}

export function deleteAllTrabajadores() {
  const db = loadDb();
  const deleted = db.trabajadores.length;
  if (deleted === 0) return 0;
  db.trabajadores = [];
  saveDb(db);
  return deleted;
}
