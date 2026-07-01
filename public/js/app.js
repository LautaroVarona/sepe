import {
  initCompanyImport,
  getPendingMasterPayload,
  setPendingMasterPayload,
  clearPendingMasterPayload,
} from './company-import.js';
import {
  initWorkerImport,
  getPendingWorkerMaster,
  setPendingWorkerMaster,
  clearPendingWorkerMaster,
} from './worker-import.js';
import {
  initAppStore,
  getAppStore,
  upsertEmpresa,
  removeEmpresa,
  upsertTrabajador,
  addTrabajadores,
  removeTrabajador,
  clearTrabajadores,
  replaceStore,
  appendStoreToFormData,
  pushStoreToServer,
} from './localDb.js';

// --- Utilidades ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function latin1ToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

const XML_FILE_EXTENSION = '.XML';

function toXmlExportName(name) {
  const stem = String(name ?? '')
    .trim()
    .replace(/\.(xml|XML)$/i, '');
  return `${stem}${XML_FILE_EXTENSION}`;
}

async function saveXmlFile(name, xml) {
  const fileName = toXmlExportName(name);
  const bytes = latin1ToBytes(xml);
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'XML SEPE',
            accept: { 'application/xml': ['.XML', '.xml'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const blob = new Blob([bytes], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Tabs ---
const tabBtns = document.querySelectorAll('.tabs__btn');
const panels = {
  generar: document.getElementById('panel-generar'),
  empresas: document.getElementById('panel-empresas'),
  trabajadores: document.getElementById('panel-trabajadores'),
};

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('tabs__btn--active'));
    btn.classList.add('tabs__btn--active');
    Object.values(panels).forEach((p) => {
      p.hidden = true;
      p.classList.remove('panel--active');
    });
    const tab = btn.dataset.tab;
    panels[tab].hidden = false;
    panels[tab].classList.add('panel--active');
    if (tab === 'empresas') loadEmpresas();
    if (tab === 'trabajadores') loadTrabajadores();
  });
});

// --- Generar XML ---
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const fileNameEl = document.getElementById('fileName');
const generateBtn = document.getElementById('generateBtn');
const empresaSelect = document.getElementById('empresaSelect');
const resultArea = document.getElementById('resultArea');
const resultSummary = document.getElementById('resultSummary');
const xmlOutput = document.getElementById('xmlOutput');

let selectedFile = null;
let generatedFiles = [];
let processedRecords = [];
let exportBaseName = 'LLAMAMIENTOS';
let activeFileIndex = 0;
let recordsFilter = 'all';
let rebuildTimer = null;

const TABLE_FIELDS = [
  { key: 'IDENTIFICADORPFISICA', label: 'DNI/NIE', short: true },
  { key: 'NOMBRE', label: 'Nombre' },
  { key: 'PRIMER_APELLIDO', label: '1º apellido', short: true },
  { key: 'SEGUNDO_APELLIDO', label: '2º apellido', short: true },
  { key: 'NUMERO_SEGURIDAD_SOCIAL', label: 'NSS' },
  { key: 'FECHA_INICIO', label: 'F. inicio', short: true },
  { key: 'FECHA_FIN', label: 'F. fin', short: true },
  { key: 'CLAVE_CONTRATO_TRANS', label: 'Contrato', short: true },
  { key: 'CODIGO_OCUPACION', label: 'Ocupación', short: true },
  { key: 'CCC', label: 'CCC', short: true },
  { key: 'NIF_EMPRESA', label: 'NIF emp.', short: true },
  { key: 'SEXO', label: 'Sexo', short: true },
  { key: 'FECHA_NACIMIENTO', label: 'F. nac.', short: true },
  { key: 'NACIONALIDAD', label: 'Nac.', short: true },
  { key: 'NIVEL_FORMATIVO', label: 'Nivel', short: true },
  { key: 'IND_INCORPORA_ACTIVIDAD', label: 'Incorp.', short: true },
];

function setFile(file) {
  if (!file) {
    selectedFile = null;
    fileNameEl.hidden = true;
    dropzone.classList.remove('dropzone--has-file');
    generateBtn.disabled = true;
    return;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    showGenerateError(['Solo archivos Excel (.xlsx, .xls)']);
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileNameEl.hidden = false;
  dropzone.classList.add('dropzone--has-file');
  generateBtn.disabled = false;
  resultArea.hidden = true;
}

function showGenerateError(errors) {
  resultArea.hidden = false;
  resultSummary.innerHTML = `
    <div class="alert alert--error">
      <strong>Error</strong>
      <ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
    </div>`;
  xmlOutput.innerHTML = '';
}

function renderXmlPreview(index) {
  activeFileIndex = index;
  const file = generatedFiles[index];
  if (!file) {
    xmlOutput.innerHTML = '';
    return;
  }

  xmlOutput.innerHTML = `
    <div class="xml-preview">
      <p class="xml-preview__name muted">${escapeHtml(file.name)} · ${file.count} reg.</p>
      <textarea readonly spellcheck="false" id="xmlTextarea"></textarea>
    </div>`;

  document.getElementById('xmlTextarea').value = file.xml;
}

function getActiveChunk() {
  const file = generatedFiles[activeFileIndex];
  if (!file) return { start: 0, count: processedRecords.length };
  return {
    start: file.startRow ?? 0,
    count: file.count ?? processedRecords.length,
  };
}

function isFieldMissing(record, field) {
  const v = record?.[field];
  return v === undefined || v === null || String(v).trim() === '';
}

function recordMatchesFilter(row) {
  if (recordsFilter === 'complete') return row.complete === true;
  if (recordsFilter === 'incomplete') return row.complete !== true;
  return true;
}

function getRecordsTableRows() {
  if (recordsFilter === 'all') {
    const { start, count } = getActiveChunk();
    return processedRecords.slice(start, start + count).map((row, i) => ({
      row,
      globalIdx: start + i,
    }));
  }
  return processedRecords
    .map((row, globalIdx) => ({ row, globalIdx }))
    .filter(({ row }) => recordMatchesFilter(row));
}

function renderRecordsTable() {
  const wrap = document.getElementById('recordsTableWrap');
  const workspace = document.getElementById('recordsWorkspace');
  const filtersEl = document.getElementById('recordsFilters');
  if (!wrap || !processedRecords.length) {
    if (workspace) workspace.hidden = true;
    if (filtersEl) filtersEl.hidden = true;
    return;
  }
  workspace.hidden = false;
  if (filtersEl) filtersEl.hidden = false;

  const tableRows = getRecordsTableRows();

  const thead = `
    <thead><tr>
      <th class="col-row">Fila</th>
      <th class="col-estado">Estado</th>
      <th class="col-match">Trabajador</th>
      ${TABLE_FIELDS.map((f) => `<th class="${f.short ? 'col-short' : ''}">${escapeHtml(f.label)}</th>`).join('')}
    </tr></thead>`;

  const tbody = tableRows
    .map(({ row, globalIdx }) => {
      const rec = row.record ?? {};
      const estado = row.complete
        ? '<span class="badge badge--ok">OK</span>'
        : `<span class="badge badge--warn" title="${escapeHtml((row.missingFields ?? []).join(', '))}">Incompleto</span>`;
      const match = row.matchedTrabajador
        ? `<span class="badge badge--match" title="Coincidencia por ${escapeHtml(row.matchBy ?? 'sistema')}">${escapeHtml(row.matchedTrabajador)}</span>`
        : '<span class="muted">—</span>';

      const cells = TABLE_FIELDS.map((f) => {
        const missing = isFieldMissing(rec, f.key);
        const val = rec[f.key] ?? '';
        return `<td class="${missing ? 'cell--missing' : ''}">
          <input type="text" class="record-cell" data-idx="${globalIdx}" data-field="${f.key}" value="${escapeHtml(String(val))}" />
        </td>`;
      }).join('');

      const filaLabel =
        row.sourceRows?.length >= 2
          ? `${row.sourceRows[0]}–${row.sourceRows[row.sourceRows.length - 1]}`
          : String(row.row ?? globalIdx + 2);
      const pairBadge = row.movementPair
        ? `<span class="badge badge--pair" title="${escapeHtml(row.movementPair)}">${row.movementPair === 'alta+baja' ? 'Alta+Baja' : escapeHtml(row.movementPair)}</span>`
        : '';

      return `<tr data-global-idx="${globalIdx}" class="${row.complete ? 'record-row--ok' : 'record-row--incomplete'}">
        <td class="col-row">${escapeHtml(filaLabel)} ${pairBadge}</td>
        <td class="col-estado">${estado}</td>
        <td class="col-match">${match}</td>
        ${cells}
      </tr>`;
    })
    .join('');

  wrap.innerHTML = tableRows.length
    ? `<table class="data-table data-table--records">${thead}<tbody>${tbody}</tbody></table>`
    : '<p class="muted">Ningún registro coincide con este filtro.</p>';

  const hint = document.getElementById('recordsChunkHint');
  if (hint) {
    if (recordsFilter === 'all') {
      const { start, count } = getActiveChunk();
      const shown = Math.min(count, processedRecords.length - start);
      hint.textContent = `Mostrando ${shown} de ${processedRecords.length} registros`;
    } else {
      const total = processedRecords.filter(recordMatchesFilter).length;
      const label = recordsFilter === 'complete' ? 'correctos' : 'incompletos';
      hint.textContent = `${total} ${label} de ${processedRecords.length} registros`;
    }
  }

  wrap.querySelectorAll('.record-cell').forEach((input) => {
    input.addEventListener('change', onRecordCellChange);
    input.addEventListener('blur', onRecordCellChange);
  });
}

function onRecordCellChange(e) {
  const input = e.target;
  const idx = Number(input.dataset.idx);
  const field = input.dataset.field;
  if (!processedRecords[idx]) return;
  processedRecords[idx].record[field] = input.value.trim();
  input.closest('td')?.classList.toggle('cell--missing', isFieldMissing(processedRecords[idx].record, field));
  scheduleRebuildXml();
}

function scheduleRebuildXml() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildXmlFromRecords, 500);
}

async function rebuildXmlFromRecords() {
  if (!processedRecords.length) return;
  try {
    const res = await fetch('/api/rebuild-xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseName: exportBaseName,
        records: processedRecords.map((r) => ({
          excelRowNumber: r.row,
          sourceRows: r.sourceRows,
          movementPair: r.movementPair,
          record: r.record,
          matchedTrabajador: r.matchedTrabajador,
          matchedEmpresa: r.matchedEmpresa,
          matchBy: r.matchBy,
          filledFrom: r.filledFrom,
        })),
      }),
    });
    const data = await res.json();
    if (!data.ok) return;
    applyGenerationPayload(data, { scroll: false });
  } catch {
    /* silencioso: el usuario sigue viendo la tabla */
  }
}

function applyGenerationPayload(data, { scroll = true } = {}) {
  generatedFiles = data.files;
  exportBaseName = data.baseName ?? exportBaseName;
  recordsFilter = 'all';
  const recordsFilters = document.getElementById('recordsFilters');
  recordsFilters?.querySelectorAll('[data-records-filter]').forEach((b) => {
    b.classList.toggle('records-filter--active', b.dataset.recordsFilter === 'all');
  });
  processedRecords = (data.records ?? []).map((r) => ({
    row: r.row,
    sourceRows: r.sourceRows,
    movementPair: r.movementPair,
    complete: r.complete,
    missingFields: r.missingFields,
    matchedTrabajador: r.matchedTrabajador,
    matchedEmpresa: r.matchedEmpresa,
    matchBy: r.matchBy,
    filledFrom: r.filledFrom,
    record: { ...r.record },
  }));

  const select = document.getElementById('xmlFileSelect');
  if (select) {
    select.innerHTML = data.files
      .map(
        (f, i) =>
          `<option value="${i}">${escapeHtml(f.name)} (${f.count} reg.)</option>`,
      )
      .join('');
    select.value = String(Math.min(activeFileIndex, data.files.length - 1));
  }

  renderRecordsTable();
  renderXmlPreview(Number(select?.value ?? 0));
  if (scroll) resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function exportCurrentXml() {
  const file = generatedFiles[activeFileIndex];
  if (!file) return;
  await saveXmlFile(file.name, file.xml);
}

async function exportAllXml() {
  if (!generatedFiles.length) return;
  const folderName = exportBaseName.replace(/[^\w.-]/g, '_') || 'LLAMAMIENTOS';
  const bytesFor = (xml) => latin1ToBytes(xml);

  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker();
      const sub = await dir.getDirectoryHandle(folderName, { create: true });
      for (let i = 0; i < generatedFiles.length; i++) {
        const name = toXmlExportName(`${folderName}_${i + 1}`);
        const handle = await sub.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(bytesFor(generatedFiles[i].xml));
        await writable.close();
      }
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  for (let i = 0; i < generatedFiles.length; i++) {
    const name = toXmlExportName(`${folderName}_${i + 1}`);
    await saveXmlFile(name, generatedFiles[i].xml);
    await new Promise((r) => setTimeout(r, 120));
  }
}

function renderWarningSummary(summary, warnings) {
  if (!summary && !warnings?.length) return '';

  const s = summary ?? { total: warnings?.length ?? 0, global: warnings ?? [] };
  let html = '';

  if (s.global?.length) {
    html += `<details class="fold">
      <summary>Avisos generales (${s.global.length})</summary>
      <div class="fold__body"><ul>${s.global.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>
    </details>`;
  }

  if (s.missingFieldsSorted?.length) {
    html += `<details class="fold">
      <summary>Campos que más faltan (${s.total} avisos en total)</summary>
      <div class="fold__body"><ul>
        ${s.missingFieldsSorted
          .map(([field, n]) => `<li><strong>${escapeHtml(field)}</strong> — ${n} fila(s)</li>`)
          .join('')}
      </ul></div>
    </details>`;
  }

  if (s.discardByReasonSorted?.length) {
    html += `<details class="fold">
      <summary>Registros descartados (${s.discarded ?? 0})</summary>
      <div class="fold__body"><ul>
        ${s.discardByReasonSorted
          .map((d) => `<li><strong>${escapeHtml(d.label)}</strong> — ${d.count} fila(s)</li>`)
          .join('')}
      </ul></div>
    </details>`;
  }

  if (s.discardSamples?.length) {
    html += `<details class="fold">
      <summary>Filas descartadas (ejemplos)</summary>
      <div class="fold__body"><ul>
        ${s.discardSamples
          .map(
            (d) =>
              `<li>Fila ${escapeHtml(String(d.excelRowNumber))}: ${escapeHtml(d.label)} — ${escapeHtml(d.message)}</li>`,
          )
          .join('')}
      </ul></div>
    </details>`;
  }

  if (s.samples?.length) {
    html += `<details class="fold">
      <summary>Ejemplos (${s.samples.length} de ${s.total})</summary>
      <div class="fold__body"><ul>${s.samples.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>
    </details>`;
  }

  return html;
}

function showGenerateResult(data) {
  resultArea.hidden = false;
  activeFileIndex = 0;

  const incomplete = data.incompleteCount > 0;
  const matched = data.matchedFromTrabajador ?? 0;
  const enSistema = data.trabajadoresEnSistema ?? 0;

  const movimientos = data.excelMovementCount ?? data.rowCount;
  const pairing = data.meta?.pairing;
  const discarded = data.discardedCount ?? data.processingLog?.discarded ?? 0;
  let summaryHtml = `
    <div class="stats-row">
      <span class="stat"><strong>${data.recordCount}</strong> llamamientos</span>
      ${movimientos !== data.recordCount ? `<span class="stat muted-stat">(${movimientos} filas Excel)</span>` : ''}
      ${discarded > 0 ? `<span class="stat stat--warn"><strong>${discarded}</strong> descartados</span>` : ''}
      <span class="stat"><strong>${data.fileCount}</strong> XML</span>
      <span class="stat ${incomplete ? 'stat--warn' : 'stat--ok'}">
        <strong>${data.completeCount}</strong> OK · <strong>${data.incompleteCount}</strong> incompletos
      </span>
      <span class="stat"><strong>${matched}</strong> enlazados a trabajadores (${enSistema} en sistema)</span>
    </div>`;

  if (pairing) {
    summaryHtml += `<p class="hint-line hint-line--ok">
      Formato Saltra: cada llamamiento une una fila <strong>Alta</strong> (inicio, contrato, ocupación) con la <strong>Baja</strong> del mismo trabajador (fecha fin).
      ${pairing.pairedAltaBaja} parejas · ${pairing.altaSinBaja} solo alta · ${pairing.bajaSinAlta} solo baja.
    </p>`;
  }

  if (matched > 0) {
    summaryHtml += `<p class="hint-line hint-line--ok">Datos completados desde trabajadores/empresas guardados. Revisa la tabla y edita si hace falta.</p>`;
  } else if (enSistema > 0) {
    summaryHtml += `<p class="hint-line">No se enlazó ningún registro con trabajadores guardados. Comprueba que el <strong>nombre completo</strong> del Excel coincida con el del sistema, o importa trabajadores con DNI/NSS.</p>`;
  }

  summaryHtml += `<p class="hint-line hint-line--sub">Vacíos en XML → <code>???????</code>. La tabla permite corregir antes de exportar.</p>`;

  if (data.meta?.format === 'saltra-alta-baja') {
    summaryHtml += `<p class="muted">Columnas Saltra: movimiento, nombre, DNI, NSS, contrato, fecha, CNO, cuenta cotización.</p>`;
  } else if (data.meta?.detectedColumns?.length) {
    summaryHtml += `<p class="muted">Leído del Excel: ${escapeHtml(data.meta.detectedColumns.join(', '))}</p>`;
  }

  if (data.meta?.missingColumns?.length) {
    summaryHtml += `<details class="fold">
      <summary>Columnas no detectadas (${data.meta.missingColumns.length})</summary>
      <div class="fold__body"><div class="tag-list">
        ${data.meta.missingColumns.map((c) => `<span class="tag">${escapeHtml(c)}</span>`).join('')}
      </div></div>
    </details>`;
  }

  summaryHtml += renderWarningSummary(data.warningSummary, data.warnings);
  resultSummary.innerHTML = summaryHtml;

  exportBaseName = data.baseName ?? exportBaseName;
  applyGenerationPayload(data);

  const select = document.getElementById('xmlFileSelect');
  if (select && !select.dataset.bound) {
    select.dataset.bound = '1';
    select.addEventListener('change', () => {
      activeFileIndex = Number(select.value);
      renderRecordsTable();
      renderXmlPreview(activeFileIndex);
    });
  }

  const exportOneBtn = document.getElementById('exportOneBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  if (exportOneBtn && !exportOneBtn.dataset.bound) {
    exportOneBtn.dataset.bound = '1';
    exportOneBtn.addEventListener('click', exportCurrentXml);
  }
  if (exportAllBtn && !exportAllBtn.dataset.bound) {
    exportAllBtn.dataset.bound = '1';
    exportAllBtn.addEventListener('click', exportAllXml);
  }

  const recordsFilters = document.getElementById('recordsFilters');
  if (recordsFilters && !recordsFilters.dataset.bound) {
    recordsFilters.dataset.bound = '1';
    recordsFilters.querySelectorAll('[data-records-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        recordsFilter = btn.dataset.recordsFilter ?? 'all';
        recordsFilters.querySelectorAll('[data-records-filter]').forEach((b) => {
          b.classList.toggle('records-filter--active', b === btn);
        });
        renderRecordsTable();
      });
    });
  }
}

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropzone.addEventListener('click', (e) => {
  if (e.target === browseBtn) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) setFile(f);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dropzone--active');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--active'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dropzone--active');
  const f = e.dataTransfer.files?.[0];
  if (f) setFile(f);
});

generateBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('sheetIndex', document.getElementById('sheetIndex').value);
  formData.append('headerRow', document.getElementById('headerRow').value);
  const prefix = document.getElementById('prefix').value.trim();
  if (prefix) formData.append('prefix', prefix);
  if (empresaSelect.value) formData.append('empresaId', empresaSelect.value);
  appendStoreToFormData(formData);

  generateBtn.disabled = true;
  const label = generateBtn.textContent;
  generateBtn.innerHTML = '<span class="spinner"></span> Generando…';

  try {
    const res = await fetch('/api/generate', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.ok) {
      showGenerateError(data.errors ?? ['Error desconocido']);
      return;
    }
    showGenerateResult(data);
  } catch {
    showGenerateError(['No se pudo conectar con el servidor']);
  } finally {
    generateBtn.disabled = !selectedFile;
    generateBtn.textContent = label;
  }
});

// --- Empresas ---
const empresaForm = document.getElementById('empresaForm');
const empresasList = document.getElementById('empresasList');
const empresaCancel = document.getElementById('empresaCancel');

async function loadEmpresasForSelects() {
  await pushStoreToServer();
  let empresas = getAppStore().empresas;
  try {
    const res = await fetch('/api/empresas');
    const data = await res.json();
    if (data.empresas?.length) {
      empresas = data.empresas;
      replaceStore({ ...getAppStore(), empresas });
    }
  } catch {
    /* usar copia local */
  }

  empresaSelect.innerHTML =
    '<option value="">— Sin empresa fija —</option>' +
    empresas
      .map((e) => {
        const cod = e.codigo_empresa_a3 ? ` · A3 ${e.codigo_empresa_a3}` : '';
        const label = e.nombre || e.ccc || e.nif_empresa || 'Sin nombre';
        return `<option value="${e.id}">${escapeHtml(label)}${escapeHtml(cod)}</option>`;
      })
      .join('');

  const trabSel = document.getElementById('trabajadorEmpresa');
  if (trabSel) {
    trabSel.innerHTML =
      '<option value="">— Sin empresa —</option>' +
      empresas
        .map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`)
        .join('');
  }
  return empresas;
}

async function loadEmpresas() {
  const empresas = await loadEmpresasForSelects();
  if (empresas.length === 0) {
    empresasList.innerHTML = '<p class="muted">No hay empresas. Crea una arriba.</p>';
    return;
  }
  empresasList.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Nombre</th><th>Cód. A3</th><th>CCC</th><th>NIF</th><th></th></tr></thead>
      <tbody>
        ${empresas
          .map(
            (e) => `
          <tr>
            <td>${escapeHtml(e.nombre)}</td>
            <td>${escapeHtml(e.codigo_empresa_a3 || '—')}</td>
            <td>${escapeHtml(e.ccc)}</td>
            <td>${escapeHtml(e.nif_empresa)}</td>
            <td>
              <button type="button" class="btn btn--ghost" data-edit-empresa="${e.id}">Editar</button>
              <button type="button" class="btn btn--ghost" data-del-empresa="${e.id}">Borrar</button>
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  empresasList.querySelectorAll('[data-edit-empresa]').forEach((btn) => {
    btn.addEventListener('click', () => editEmpresa(btn.dataset.editEmpresa, empresas));
  });
  empresasList.querySelectorAll('[data-del-empresa]').forEach((btn) => {
    btn.addEventListener('click', () => deleteEmpresa(btn.dataset.delEmpresa));
  });
}

function resetEmpresaForm() {
  document.getElementById('empresaId').value = '';
  empresaForm.reset();
  empresaCancel.hidden = true;
  clearPendingMasterPayload();
}

function applyEmpresaPrefill(prefill, masterPayload) {
  document.getElementById('empresaNombre').value = prefill.nombre ?? '';
  document.getElementById('empresaCodigoA3').value =
    prefill.codigo_empresa_a3 ?? masterPayload?.codigo_empresa_a3 ?? '';
  document.getElementById('empresaCcc').value = prefill.ccc ?? '';
  document.getElementById('empresaNif').value = prefill.nif_empresa ?? '';
  document.getElementById('empresaUsoLibre').value = prefill.usolibre_empresa ?? '';
  document.getElementById('empresaClaveContrato').value = prefill.clave_contrato_trans ?? '';
  document.getElementById('empresaNivel').value = prefill.nivel_formativo ?? '';
  document.getElementById('empresaInd').value = prefill.ind_incorpora_actividad ?? '';
  document.getElementById('empresaId').value = '';
  empresaCancel.hidden = true;
  if (masterPayload) setPendingMasterPayload(masterPayload);
  document.getElementById('panel-empresas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function editEmpresa(id, empresas) {
  const e = empresas.find((x) => x.id === id);
  if (!e) return;
  document.getElementById('empresaId').value = e.id;
  document.getElementById('empresaNombre').value = e.nombre;
  document.getElementById('empresaCodigoA3').value = e.codigo_empresa_a3 ?? '';
  document.getElementById('empresaCcc').value = e.ccc;
  document.getElementById('empresaNif').value = e.nif_empresa;
  document.getElementById('empresaUsoLibre').value = e.usolibre_empresa;
  document.getElementById('empresaClaveContrato').value = e.clave_contrato_trans;
  document.getElementById('empresaNivel').value = e.nivel_formativo;
  document.getElementById('empresaInd').value = e.ind_incorpora_actividad;
  setPendingMasterPayload({
    codigo_empresa_a3: e.codigo_empresa_a3 ?? '',
    nombre_empresa: e.nombre_empresa ?? e.nombre ?? '',
    telefono: e.telefono ?? '',
    email: e.email ?? '',
    fecha_alta_empresa: e.fecha_alta_empresa ?? '',
    tipo_pago_irpf: e.tipo_pago_irpf ?? '',
    codigo_centro_gestion: e.codigo_centro_gestion ?? '',
    tipo_empresario: e.tipo_empresario ?? '',
    domicilio_fiscal: e.domicilio_fiscal ?? {},
    domicilio_envio: e.domicilio_envio ?? {},
  });
  empresaCancel.hidden = false;
}

empresaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('empresaId').value;
  const nombre = document.getElementById('empresaNombre').value.trim();
  const nif = document.getElementById('empresaNif').value.trim();
  if (!nombre || !nif) {
    alert('Nombre interno y NIF empresa son obligatorios antes de guardar.');
    return;
  }
  const master = getPendingMasterPayload() ?? {};
  const codigoA3 = document.getElementById('empresaCodigoA3').value.trim();
  const body = {
    nombre,
    ccc: document.getElementById('empresaCcc').value,
    nif_empresa: nif,
    usolibre_empresa: document.getElementById('empresaUsoLibre').value,
    clave_contrato_trans: document.getElementById('empresaClaveContrato').value,
    nivel_formativo: document.getElementById('empresaNivel').value,
    ind_incorpora_actividad: document.getElementById('empresaInd').value,
    ...master,
    codigo_empresa_a3: codigoA3,
    nombre_empresa: master.nombre_empresa || nombre,
    nif_empresa: nif,
  };
  const url = id ? `/api/empresas/${id}` : '/api/empresas';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.empresa) upsertEmpresa(data.empresa);
  }
  resetEmpresaForm();
  loadEmpresas();
});

empresaCancel.addEventListener('click', resetEmpresaForm);

initCompanyImport({
  onApply: (prefill, masterPayload) => applyEmpresaPrefill(prefill, masterPayload),
});

async function deleteEmpresa(id) {
  if (!confirm('¿Eliminar esta empresa?')) return;
  await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
  removeEmpresa(id);
  loadEmpresas();
}

// --- Trabajadores ---
const trabajadorForm = document.getElementById('trabajadorForm');
const trabajadoresList = document.getElementById('trabajadoresList');
const trabajadoresFilters = document.getElementById('trabajadoresFilters');
const trabajadoresDeleteAll = document.getElementById('trabajadoresDeleteAll');
const trabajadorCancel = document.getElementById('trabajadorCancel');

const DELETE_ALL_TRABAJADORES_CONFIRM = 'duplicado';

let cachedTrabajadores = [];
let trabajadoresFilter = 'all';

function trabajadorMatchesFilter(t) {
  if (trabajadoresFilter === 'complete') return t.completeness === 'complete';
  if (trabajadoresFilter === 'incomplete') return t.completeness === 'incomplete';
  if (trabajadoresFilter === 'duplicate') return t.duplicateDni;
  return true;
}

function trabajadorRowClass(t) {
  const parts = [];
  if (t.completeness === 'complete') parts.push('trabajador-row--complete');
  else parts.push('trabajador-row--incomplete');
  if (t.duplicateDni) parts.push('trabajador-row--duplicate-dni');
  return parts.join(' ');
}

function renderTrabajadoresTable(trabajadores) {
  const filtered = trabajadores.filter(trabajadorMatchesFilter);

  if (trabajadores.length === 0) {
    trabajadoresFilters.hidden = true;
    if (trabajadoresDeleteAll) trabajadoresDeleteAll.hidden = true;
    trabajadoresList.innerHTML = '<p class="muted">No hay trabajadores registrados.</p>';
    return;
  }

  trabajadoresFilters.hidden = false;
  if (trabajadoresDeleteAll) trabajadoresDeleteAll.hidden = false;

  if (filtered.length === 0) {
    trabajadoresList.innerHTML =
      '<p class="muted">Ningún trabajador coincide con este filtro.</p>';
    return;
  }

  trabajadoresList.innerHTML = `
    <table class="data-table data-table--trabajadores">
      <thead><tr><th>DNI</th><th>Cód.</th><th>Nombre</th><th>NSS</th><th>Empresa</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${filtered
          .map((t) => {
            const estadoParts = [];
            if (t.completeness === 'complete') estadoParts.push('Completo');
            else estadoParts.push('Incompleto');
            if (t.duplicateDni) estadoParts.push('DNI dup.');
            const missingHint =
              t.missingFields?.length > 0
                ? `<span class="muted" title="${escapeHtml(t.missingFields.join(', '))}">Faltan: ${escapeHtml(t.missingFields.slice(0, 2).join(', '))}${t.missingFields.length > 2 ? '…' : ''}</span>`
                : '';
            return `
          <tr class="${trabajadorRowClass(t)}">
            <td>${escapeHtml(t.identificador_pfisica)}</td>
            <td>${escapeHtml(t.codigo_interno_a3 || '—')}</td>
            <td>${escapeHtml(`${t.nombre} ${t.primer_apellido}`.trim())}</td>
            <td>${escapeHtml(t.numero_seguridad_social || '—')}</td>
            <td>${escapeHtml(t.empresa_nombre || '—')}</td>
            <td class="trabajador-row__estado">${escapeHtml(estadoParts.join(' · '))} ${missingHint}</td>
            <td>
              <button type="button" class="btn btn--ghost" data-edit-trab="${t.id}">Editar</button>
              <button type="button" class="btn btn--ghost" data-del-trab="${t.id}">Borrar</button>
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  trabajadoresList.querySelectorAll('[data-edit-trab]').forEach((btn) => {
    btn.addEventListener('click', () => editTrabajador(btn.dataset.editTrab, trabajadores));
  });
  trabajadoresList.querySelectorAll('[data-del-trab]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTrabajador(btn.dataset.delTrab));
  });
}

async function loadTrabajadores() {
  await pushStoreToServer();
  try {
    const res = await fetch('/api/trabajadores');
    const { trabajadores, empresas } = await res.json();
    replaceStore({
      empresas: empresas ?? getAppStore().empresas,
      trabajadores: trabajadores ?? [],
    });
    cachedTrabajadores = trabajadores ?? [];
  } catch {
    cachedTrabajadores = getAppStore().trabajadores;
  }
  renderTrabajadoresTable(cachedTrabajadores);
}

if (trabajadoresFilters) {
  trabajadoresFilters.querySelectorAll('[data-trab-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      trabajadoresFilter = btn.dataset.trabFilter;
      trabajadoresFilters.querySelectorAll('[data-trab-filter]').forEach((b) => {
        b.classList.toggle('trabajadores-filter--active', b === btn);
      });
      renderTrabajadoresTable(cachedTrabajadores);
    });
  });
}

function switchToTrabajadoresTab() {
  const btn = document.querySelector('.tabs__btn[data-tab="trabajadores"]');
  if (btn) btn.click();
}

function showTrabajadorImportNotice(message) {
  const el = document.getElementById('trabajadorImportNotice');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function hideTrabajadorImportNotice() {
  const el = document.getElementById('trabajadorImportNotice');
  if (el) el.hidden = true;
}

function resetTrabajadorForm() {
  document.getElementById('trabajadorId').value = '';
  trabajadorForm.reset();
  document.getElementById('trabajadorInd').value = 'S';
  document.getElementById('trabajadorPais').value = '724';
  trabajadorCancel.hidden = true;
  clearPendingWorkerMaster();
  hideTrabajadorImportNotice();
}

function applyTrabajadorPrefill(prefill, masterPayload, { duplicate } = {}) {
  if (duplicate?.id) {
    document.getElementById('trabajadorId').value = duplicate.id;
    trabajadorCancel.hidden = false;
  } else {
    document.getElementById('trabajadorId').value = '';
    trabajadorCancel.hidden = true;
  }
  if (prefill.empresa_id) {
    document.getElementById('trabajadorEmpresa').value = prefill.empresa_id;
  }
  document.getElementById('trabajadorDni').value = prefill.identificador_pfisica ?? '';
  document.getElementById('trabajadorCodigo').value = prefill.codigo_interno_a3 ?? '';
  document.getElementById('trabajadorNss').value = prefill.numero_seguridad_social ?? '';
  document.getElementById('trabajadorNombre').value = prefill.nombre ?? '';
  document.getElementById('trabajadorApellido1').value = prefill.primer_apellido ?? '';
  document.getElementById('trabajadorApellido2').value = prefill.segundo_apellido ?? '';
  document.getElementById('trabajadorSexo').value = prefill.sexo ?? '';
  document.getElementById('trabajadorFecNac').value = prefill.fecha_nacimiento ?? '';
  document.getElementById('trabajadorNacionalidad').value = prefill.nacionalidad ?? '';
  document.getElementById('trabajadorMunicipio').value = prefill.municipio_residencia ?? '';
  document.getElementById('trabajadorPais').value = prefill.pais_residencia || '724';
  document.getElementById('trabajadorOcupacion').value = prefill.codigo_ocupacion ?? '';
  document.getElementById('trabajadorNivel').value = prefill.nivel_formativo ?? '';
  document.getElementById('trabajadorInd').value = prefill.ind_incorpora_actividad || 'S';
  if (masterPayload) setPendingWorkerMaster(masterPayload);
  document.getElementById('panel-trabajadores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleWorkerImportLoad(entry) {
  if (entry.duplicate && !document.getElementById('trabajadorId').value) {
    const action = confirm(
      `El trabajador ${entry.duplicate.identificador_pfisica} (${entry.duplicate.nombre}) ya existe.\n\n` +
        'Aceptar = actualizar registro existente\n' +
        'Cancelar = no cargar',
    );
    if (!action) return false;
  }
  applyTrabajadorPrefill(entry.prefill, entry.masterPayload, {
    duplicate: entry.duplicate,
  });
  switchToTrabajadoresTab();
  const nombre =
    [entry.prefill?.nombre, entry.prefill?.primer_apellido].filter(Boolean).join(' ').trim() ||
    entry.prefill?.identificador_pfisica ||
    'Trabajador';
  showTrabajadorImportNotice(
    `${nombre} cargado en el formulario. Revisa los datos y pulsa Guardar para añadirlo a trabajadores guardados.`,
  );
  return true;
}

function editTrabajador(id, list) {
  const t = list.find((x) => x.id === id);
  if (!t) return;
  document.getElementById('trabajadorId').value = t.id;
  document.getElementById('trabajadorEmpresa').value = t.empresa_id ?? '';
  document.getElementById('trabajadorDni').value = t.identificador_pfisica;
  document.getElementById('trabajadorCodigo').value = t.codigo_interno_a3 ?? '';
  document.getElementById('trabajadorNss').value = t.numero_seguridad_social;
  document.getElementById('trabajadorNombre').value = t.nombre;
  document.getElementById('trabajadorApellido1').value = t.primer_apellido;
  document.getElementById('trabajadorApellido2').value = t.segundo_apellido;
  document.getElementById('trabajadorSexo').value = t.sexo;
  document.getElementById('trabajadorFecNac').value = t.fecha_nacimiento;
  document.getElementById('trabajadorNacionalidad').value = t.nacionalidad;
  document.getElementById('trabajadorMunicipio').value = t.municipio_residencia;
  document.getElementById('trabajadorPais').value = t.pais_residencia;
  document.getElementById('trabajadorOcupacion').value = t.codigo_ocupacion;
  document.getElementById('trabajadorNivel').value = t.nivel_formativo;
  document.getElementById('trabajadorInd').value = t.ind_incorpora_actividad;
  trabajadorCancel.hidden = false;
}

trabajadorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dni = document.getElementById('trabajadorDni').value.trim();
  if (!dni) {
    alert('El DNI/NIE es obligatorio.');
    return;
  }
  let id = document.getElementById('trabajadorId').value;
  const master = getPendingWorkerMaster() ?? {};

  if (!id) {
    const res = await fetch('/api/trabajadores');
    const { trabajadores } = await res.json();
    const dup = trabajadores.find(
      (t) =>
        String(t.identificador_pfisica ?? '')
          .trim()
          .toUpperCase() === dni.toUpperCase(),
    );
    if (dup) {
      const choice = confirm(
        `Ya existe un trabajador con DNI ${dup.identificador_pfisica}.\n\n` +
          'Aceptar = actualizar el existente\n' +
          'Cancelar = no guardar',
      );
      if (!choice) return;
      id = dup.id;
      document.getElementById('trabajadorId').value = id;
    }
  }

  const body = {
    empresa_id: document.getElementById('trabajadorEmpresa').value || null,
    identificador_pfisica: dni,
    codigo_interno_a3: document.getElementById('trabajadorCodigo').value.trim(),
    numero_seguridad_social: document.getElementById('trabajadorNss').value,
    nombre: document.getElementById('trabajadorNombre').value,
    primer_apellido: document.getElementById('trabajadorApellido1').value,
    segundo_apellido: document.getElementById('trabajadorApellido2').value,
    sexo: document.getElementById('trabajadorSexo').value,
    fecha_nacimiento: document.getElementById('trabajadorFecNac').value,
    nacionalidad: document.getElementById('trabajadorNacionalidad').value,
    municipio_residencia: document.getElementById('trabajadorMunicipio').value,
    pais_residencia: document.getElementById('trabajadorPais').value,
    codigo_ocupacion: document.getElementById('trabajadorOcupacion').value,
    nivel_formativo: document.getElementById('trabajadorNivel').value,
    ind_incorpora_actividad: document.getElementById('trabajadorInd').value,
    ...master,
  };
  const url = id ? `/api/trabajadores/${id}` : '/api/trabajadores';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.trabajador) upsertTrabajador(data.trabajador);
  }
  resetTrabajadorForm();
  loadTrabajadores();
});

initWorkerImport({
  onLoadForm: handleWorkerImportLoad,
  onBulkImportDone(result) {
    if (result.trabajadores?.length) addTrabajadores(result.trabajadores);
    switchToTrabajadoresTab();
    const n = result.created ?? 0;
    const desc = result.skippedDescartadas ?? 0;
    showTrabajadorImportNotice(
      `Importación completada: ${n} trabajador(es) registrados` +
        (desc ? ` (${desc} filas descartadas en el Excel)` : '') +
        '. Revisa el listado (verde = completo, naranja = faltan datos).',
    );
    loadTrabajadores();
  },
  onBackfillFechasDone(result) {
    if (result.trabajadores?.length) {
      replaceStore({ ...getAppStore(), trabajadores: result.trabajadores });
    }
    switchToTrabajadoresTab();
    showTrabajadorImportNotice(
      `Fechas actualizadas en ${result.updated ?? 0} trabajador(es). ` +
        `${result.alreadyOk ?? 0} ya tenían fecha correcta.`,
    );
    loadTrabajadores();
  },
  onBackfillCodigosDone(result) {
    if (result.trabajadores?.length) {
      replaceStore({ ...getAppStore(), trabajadores: result.trabajadores });
    }
    switchToTrabajadoresTab();
    showTrabajadorImportNotice(
      `Códigos A3 actualizados en ${result.updated ?? 0} trabajador(es). ` +
        `${result.skippedHasCodigo ?? 0} ya tenían código (no se sobrescribieron).`,
    );
    loadTrabajadores();
  },
});

trabajadorCancel.addEventListener('click', resetTrabajadorForm);

async function deleteTrabajador(id) {
  if (!confirm('¿Eliminar este trabajador?')) return;
  await fetch(`/api/trabajadores/${id}`, { method: 'DELETE' });
  removeTrabajador(id);
  loadTrabajadores();
}

function confirmDeleteAllTrabajadores(count) {
  if (
    !confirm(
      `¿Borrar los ${count} trabajador(es) registrados?\n\nEsta acción no se puede deshacer.`,
    )
  ) {
    return false;
  }
  const typed = prompt(
    `Para confirmar, escribe la palabra «${DELETE_ALL_TRABAJADORES_CONFIRM}»:`,
  );
  if (typed === null) return false;
  if (typed.trim().toLowerCase() !== DELETE_ALL_TRABAJADORES_CONFIRM) {
    alert('Confirmación incorrecta. No se borró nada.');
    return false;
  }
  return true;
}

async function deleteAllTrabajadores() {
  const count = cachedTrabajadores.length;
  if (count === 0) return;
  if (!confirmDeleteAllTrabajadores(count)) return;
  const res = await fetch('/api/trabajadores', { method: 'DELETE' });
  if (!res.ok) {
    alert('No se pudieron borrar los trabajadores.');
    return;
  }
  clearTrabajadores();
  resetTrabajadorForm();
  loadTrabajadores();
}

if (trabajadoresDeleteAll) {
  trabajadoresDeleteAll.addEventListener('click', deleteAllTrabajadores);
}

async function checkServerVersion() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const h = await res.json();
    document.getElementById('appVersion').textContent = `v${h.version}`;
    if (!h.incompleteXml) {
      showGenerateError([
        'Servidor desactualizado. Cierra la terminal antigua y ejecuta de nuevo: npm run dev',
      ]);
    }
  } catch {
    document.getElementById('appVersion').textContent = 'sin conexión';
  }
}

checkServerVersion();
initAppStore().then(() => {
  loadEmpresasForSelects();
});
