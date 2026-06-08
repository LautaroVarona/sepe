import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

const EMPTY_DB = { empresas: [], trabajadores: [] };

function loadDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    return structuredClone(EMPTY_DB);
  }
  const raw = readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    empresas: (parsed.empresas ?? []).map(ensureEmpresaMasterShape),
    trabajadores: (parsed.trabajadores ?? []).map(ensureWorkerMasterShape),
  };
}

function saveDb(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
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
