const STORAGE_KEY = 'sepeimp-db-v1';

const ENRICHMENT_KEYS = new Set([
  'completeness',
  'missingFields',
  'duplicateDni',
  'empresa_nombre',
]);

let appStore = { empresas: [], trabajadores: [] };

function stripTrabajador(t) {
  if (!t || typeof t !== 'object') return t;
  const out = { ...t };
  for (const key of ENRICHMENT_KEYS) delete out[key];
  return out;
}

export function stripStoreForPersistence(db) {
  return {
    empresas: (db?.empresas ?? []).map((e) => ({ ...e })),
    trabajadores: (db?.trabajadores ?? []).map(stripTrabajador),
  };
}

export function loadLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { empresas: [], trabajadores: [] };
    const parsed = JSON.parse(raw);
    return stripStoreForPersistence(parsed);
  } catch {
    return { empresas: [], trabajadores: [] };
  }
}

export function saveLocalStore(db) {
  const clean = stripStoreForPersistence(db);
  appStore = clean;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...clean, updatedAt: new Date().toISOString() }),
    );
  } catch (err) {
    console.warn('No se pudo guardar en localStorage:', err);
  }
  return clean;
}

export function getAppStore() {
  return appStore;
}

function mergeById(serverItems, localItems) {
  const map = new Map();
  for (const item of serverItems ?? []) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of localItems ?? []) {
    if (item?.id) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeStores(server, local) {
  return {
    empresas: mergeById(server.empresas, local.empresas),
    trabajadores: mergeById(server.trabajadores, local.trabajadores),
  };
}

async function fetchServerStore() {
  try {
    const res = await fetch('/api/store', { cache: 'no-store' });
    if (!res.ok) return { empresas: [], trabajadores: [] };
    const data = await res.json();
    return stripStoreForPersistence(data);
  } catch {
    return { empresas: [], trabajadores: [] };
  }
}

export async function pushStoreToServer(store = appStore) {
  const clean = stripStoreForPersistence(store);
  try {
    const res = await fetch('/api/store', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.empresas && data.trabajadores) {
        return stripStoreForPersistence(data);
      }
    }
  } catch {
    /* sin servidor: solo local */
  }
  return clean;
}

/** Al arrancar: une datos del navegador y del servidor; el local tiene prioridad. */
export async function initAppStore() {
  const local = loadLocalStore();
  const server = await fetchServerStore();
  const merged = mergeStores(server, local);
  saveLocalStore(merged);
  const synced = await pushStoreToServer(merged);
  saveLocalStore(synced);
  return appStore;
}

export function upsertEmpresa(empresa) {
  if (!empresa?.id) return appStore;
  const idx = appStore.empresas.findIndex((e) => e.id === empresa.id);
  if (idx >= 0) appStore.empresas[idx] = empresa;
  else appStore.empresas.push(empresa);
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function removeEmpresa(id) {
  appStore.empresas = appStore.empresas.filter((e) => e.id !== id);
  appStore.trabajadores = appStore.trabajadores.map((t) =>
    t.empresa_id === id ? { ...t, empresa_id: null } : t,
  );
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function upsertTrabajador(trabajador) {
  if (!trabajador?.id) return appStore;
  const clean = stripTrabajador(trabajador);
  const idx = appStore.trabajadores.findIndex((t) => t.id === clean.id);
  if (idx >= 0) appStore.trabajadores[idx] = clean;
  else appStore.trabajadores.push(clean);
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function addTrabajadores(trabajadores) {
  for (const t of trabajadores ?? []) {
    if (!t?.id) continue;
    const clean = stripTrabajador(t);
    const idx = appStore.trabajadores.findIndex((x) => x.id === clean.id);
    if (idx >= 0) appStore.trabajadores[idx] = clean;
    else appStore.trabajadores.push(clean);
  }
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function removeTrabajador(id) {
  appStore.trabajadores = appStore.trabajadores.filter((t) => t.id !== id);
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function clearTrabajadores() {
  appStore.trabajadores = [];
  saveLocalStore(appStore);
  pushStoreToServer().catch(() => {});
  return appStore;
}

export function replaceStore(db) {
  saveLocalStore(db);
  pushStoreToServer().catch(() => {});
  return appStore;
}

/** Adjunta el store local a FormData para que el servidor use los mismos datos. */
export function appendStoreToFormData(formData) {
  formData.append('store', JSON.stringify(appStore));
}
