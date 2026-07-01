/**
 * Modal de importación de trabajadores A3 (PDF y Excel).
 */

import { appendStoreToFormData } from './localDb.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let lastParseResult = null;
/** @type {File | null} */
let lastExcelFile = null;
let pendingWorkerMaster = null;
let activeImportView = 'registros';
let setupCollapsed = false;
/** @type {{ descartadas: Set<number>, inconsistencias: Set<string> }} */
let reviewState = { descartadas: new Set(), inconsistencias: new Set() };

export function getPendingWorkerMaster() {
  return pendingWorkerMaster;
}

export function setPendingWorkerMaster(payload) {
  pendingWorkerMaster = payload ? { ...payload } : null;
}

export function clearPendingWorkerMaster() {
  pendingWorkerMaster = null;
  lastParseResult = null;
  lastExcelFile = null;
  reviewState = { descartadas: new Set(), inconsistencias: new Set() };
  activeImportView = 'registros';
}

function getSelectedIndices() {
  if (activeImportView !== 'registros') return [];
  const boxes = document.querySelectorAll(
    '#workerImportPreview .worker-import-check:checked',
  );
  return [...boxes].map((el) => Number(el.dataset.workerIndex));
}

function updateLoadButtonState() {
  const loadBtn = document.getElementById('workerImportLoad');
  if (!loadBtn) return;

  if (lastParseResult?.source === 'excel') {
    const n =
      lastParseResult.stats?.personasUnicas ??
      lastParseResult.personasPreview?.length ??
      0;
    loadBtn.disabled = n === 0;
    loadBtn.textContent = `Importar todos (${n})`;
    loadBtn.title = 'Registra en el sistema todas las personas únicas del Excel';
    return;
  }

  const onRegistros = activeImportView === 'registros';
  const hasWorkers = Boolean(lastParseResult?.workers?.length);
  loadBtn.disabled = !hasWorkers || !onRegistros;
  loadBtn.title = onRegistros
    ? 'Carga el registro seleccionado en el formulario (no guarda automáticamente)'
    : 'Ve a la pestaña Registros, elige uno y pulsa aquí';
  loadBtn.textContent = onRegistros
    ? 'Cargar en formulario'
    : 'Cargar en formulario (solo pestaña Registros)';
}

function formatFieldList(items) {
  if (!items?.length) return '—';
  return items.map((f) => escapeHtml(f.label ?? f.key ?? f)).join(', ');
}

function renderExcelFieldSummary(fieldSummary, stats) {
  if (!fieldSummary?.partialSource) return '';
  let html = '<details class="import-field-summary"><summary class="import-field-summary__title">Resumen del Excel (fuente parcial A3)</summary>';
  html += '<ul class="import-field-summary__list">';
  html += `<li><strong>${stats?.filasValidas ?? 0}</strong> registros laborales</li>`;
  html += `<li><strong>${stats?.personasUnicas ?? 0}</strong> personas únicas</li>`;
  html += `<li>Campos en archivo: ${formatFieldList(fieldSummary.availableInFile)}</li>`;
  if (fieldSummary.optionalNotInFile?.length) {
    html += `<li class="muted">Opcionales ausentes: ${formatFieldList(fieldSummary.optionalNotInFile)}</li>`;
  }
  html += '</ul></details>';
  return html;
}

function setSetupCollapsed(collapsed) {
  setupCollapsed = collapsed;
  const inner = document.getElementById('workerImportInner');
  const chip = document.getElementById('workerImportSetupChip');
  const toggle = document.getElementById('workerImportToggleSetup');
  if (inner) {
    inner.classList.toggle('import-dialog__inner--setup-collapsed', collapsed);
  }
  if (chip) chip.hidden = !collapsed || !lastParseResult?.preview?.length;
  if (toggle) {
    toggle.hidden = !lastParseResult?.preview?.length;
    toggle.textContent = collapsed ? 'Mostrar opciones' : 'Ocultar opciones';
  }
}

function updateSetupChip({ fileName, stats } = {}) {
  const chip = document.getElementById('workerImportSetupChip');
  if (!chip) return;
  const parts = [];
  if (fileName) parts.push(`<strong>${escapeHtml(fileName)}</strong>`);
  if (stats?.filasValidas != null) parts.push(`${stats.filasValidas} reg.`);
  if (stats?.personasUnicas != null) parts.push(`${stats.personasUnicas} pers.`);
  if (stats?.filasDescartadas) {
    parts.push(`<span class="import-chip-warn">${stats.filasDescartadas} desc.</span>`);
  }
  if (stats?.personasConInconsistencias) {
    parts.push(`<span class="import-chip-warn">${stats.personasConInconsistencias} inc.</span>`);
  }
  chip.innerHTML = parts.join(' · ');
}

function hideAllViews() {
  for (const id of [
    'workerImportPreview',
    'workerImportDescartadas',
    'workerImportInconsistencias',
  ]) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
}

function switchImportView(view) {
  activeImportView = view;
  hideAllViews();
  const map = {
    registros: 'workerImportPreview',
    descartadas: 'workerImportDescartadas',
    inconsistencias: 'workerImportInconsistencias',
  };
  const el = document.getElementById(map[view]);
  if (el) el.hidden = false;

  document.querySelectorAll('[data-import-view]').forEach((btn) => {
    btn.classList.toggle(
      'import-review-bar__tab--active',
      btn.dataset.importView === view,
    );
  });

  if (view !== 'registros' && lastParseResult?.preview?.length) {
    setSetupCollapsed(true);
  }
  updateLoadButtonState();
}

function updateReviewProgress() {
  const el = document.getElementById('workerImportReviewProgress');
  if (!el || !lastParseResult || lastParseResult.source !== 'excel') return;

  const dTotal = lastParseResult.descartadas?.length ?? 0;
  const iTotal = lastParseResult.inconsistencias?.length ?? 0;
  const dDone = reviewState.descartadas.size;
  const iDone = reviewState.inconsistencias.size;

  const parts = [];
  if (dTotal) parts.push(`Descartadas ${dDone}/${dTotal}`);
  if (iTotal) parts.push(`Inconsistencias ${iDone}/${iTotal}`);
  el.textContent = parts.length ? `Revisión: ${parts.join(' · ')}` : '';
}

function renderReviewBar(stats) {
  const bar = document.getElementById('workerImportReviewBar');
  if (!bar || lastParseResult?.source !== 'excel') {
    if (bar) bar.hidden = true;
    return;
  }

  const nReg =
    stats?.personasUnicas ??
    lastParseResult.personasPreview?.length ??
    stats?.filasValidas ??
    lastParseResult.preview?.length ??
    0;
  const nDesc = lastParseResult.descartadas?.length ?? 0;
  const nInc = lastParseResult.inconsistencias?.length ?? 0;

  bar.hidden = false;
  bar.innerHTML = `
    <div class="import-review-bar__tabs">
      <button type="button" class="import-review-bar__tab import-review-bar__tab--active" data-import-view="registros">
        Personas (${nReg})
      </button>
      <button type="button" class="import-review-bar__tab${nDesc ? ' import-review-bar__tab--warn' : ''}" data-import-view="descartadas"${nDesc ? '' : ' disabled'}>
        Descartadas (${nDesc})
      </button>
      <button type="button" class="import-review-bar__tab${nInc ? ' import-review-bar__tab--warn' : ''}" data-import-view="inconsistencias"${nInc ? '' : ' disabled'}>
        Inconsistencias (${nInc})
      </button>
    </div>
    <span id="workerImportReviewProgress" class="import-review-bar__progress"></span>`;

  bar.querySelectorAll('[data-import-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) switchImportView(btn.dataset.importView);
    });
  });

  updateReviewProgress();
  switchImportView(activeImportView);
}

function setAllReview(type, checked, ids) {
  reviewState[type] = checked ? new Set(ids) : new Set();
  updateReviewProgress();
  if (type === 'descartadas') {
    renderDescartadasView(lastParseResult?.descartadas ?? []);
  } else {
    renderInconsistenciasView(lastParseResult?.inconsistencias ?? []);
  }
}

function reviewToolbarHtml(type, ids) {
  if (!ids.length) return '';
  const allMarked = ids.every((id) => reviewState[type].has(id));
  return `
    <div class="import-review-toolbar">
      <button type="button" class="btn btn--ghost btn--sm" data-review-all="${type}" data-mark="${allMarked ? '0' : '1'}">
        ${allMarked ? 'Desmarcar todo' : 'Marcar todo'}
      </button>
      <span class="muted">${ids.length} elemento(s)</span>
    </div>`;
}

function bindReviewToolbar(container, type, ids) {
  container.querySelector(`[data-review-all="${type}"]`)?.addEventListener('click', (e) => {
    const mark = e.currentTarget.dataset.mark === '1';
    setAllReview(type, mark, ids);
  });
}

function bindReviewCheckbox(checkbox, { type, id }) {
  checkbox.addEventListener('change', () => {
    const set = reviewState[type];
    if (checkbox.checked) set.add(id);
    else set.delete(id);
    checkbox.closest('.import-review-check')?.classList.toggle(
      'import-review-check--done',
      checkbox.checked,
    );
    updateReviewProgress();
  });
}

function renderDescartadasView(descartadas) {
  const el = document.getElementById('workerImportDescartadas');
  if (!el) return;

  if (!descartadas?.length) {
    el.innerHTML = '<p class="muted">No hay filas descartadas.</p>';
    return;
  }

  const rows = descartadas
    .map((d) => {
      const id = d.filaExcel;
      const checked = reviewState.descartadas.has(id);
      return `
      <tr>
        <td>${id}</td>
        <td>${escapeHtml(d.dniRaw || '—')}</td>
        <td>${escapeHtml(d.nombre || '—')}</td>
        <td>${escapeHtml(d.motivo || '—')}</td>
        <td>
          <label class="import-review-check${checked ? ' import-review-check--done' : ''}">
            <input type="checkbox" class="review-discard-ok" data-fila="${id}" ${checked ? 'checked' : ''} />
            OK descartar
          </label>
        </td>
      </tr>`;
    })
    .join('');

  const ids = descartadas.map((d) => d.filaExcel);
  el.innerHTML = `
    ${reviewToolbarHtml('descartadas', ids)}
    <p class="muted" style="margin:0 0 0.5rem;font-size:0.72rem">
      Filas excluidas por DNI inválido. Revisa cada una y marca «OK descartar» si estás de acuerdo.
    </p>
    <table class="import-detail-table">
      <thead>
        <tr>
          <th>Fila</th>
          <th>DNI en Excel</th>
          <th>Nombre</th>
          <th>Motivo</th>
          <th>Revisión</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  el.querySelectorAll('.review-discard-ok').forEach((cb) => {
    bindReviewCheckbox(cb, { type: 'descartadas', id: Number(cb.dataset.fila) });
  });
  bindReviewToolbar(el, 'descartadas', ids);
}

function renderInconsistenciasView(inconsistencias) {
  const el = document.getElementById('workerImportInconsistencias');
  if (!el) return;

  if (!inconsistencias?.length) {
    el.innerHTML = '<p class="muted">No hay inconsistencias entre filas con el mismo DNI.</p>';
    return;
  }

  const blocks = inconsistencias
    .map((inc) => {
      const checked = reviewState.inconsistencias.has(inc.dni);
      const conflictRows = inc.conflictos
        .map((c) => {
          const diffCells = c.camposDistintos
            .map(
              (d) =>
                `<tr>
                  <td>${c.filaExcel}</td>
                  <td>${escapeHtml(d.label)}</td>
                  <td>${escapeHtml(d.canonical)} <span class="muted">(fila ${inc.filaPrimera})</span></td>
                  <td>${escapeHtml(d.alternativo)}</td>
                </tr>`,
            )
            .join('');
          return diffCells;
        })
        .join('');

      return `
      <article class="import-inconsistencia" data-dni="${escapeHtml(inc.dni)}">
        <div class="import-inconsistencia__head">
          <strong>${escapeHtml(inc.dni)}</strong>
          <span>${escapeHtml(inc.nombreCanonical || '—')}</span>
          <span class="muted">Primera aparición: fila ${inc.filaPrimera}</span>
          <span class="muted">${inc.totalConflictos} fila(s) con datos distintos</span>
          <label class="import-review-check${checked ? ' import-review-check--done' : ''}">
            <input type="checkbox" class="review-inc-ok" data-dni="${escapeHtml(inc.dni)}" ${checked ? 'checked' : ''} />
            Revisado — mantener primera aparición
          </label>
        </div>
        <table class="import-detail-table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>Campo</th>
              <th>Valor conservado</th>
              <th>Valor alternativo</th>
            </tr>
          </thead>
          <tbody>${conflictRows}</tbody>
        </table>
      </article>`;
    })
    .join('');

  const ids = inconsistencias.map((inc) => inc.dni);
  el.innerHTML = `
    ${reviewToolbarHtml('inconsistencias', ids)}
    <p class="muted" style="margin:0 0 0.5rem;font-size:0.72rem">
      Mismo DNI con datos personales distintos. Por defecto se conserva la primera fila del Excel.
      Revisa cada caso y marca cuando estés de acuerdo.
    </p>
    ${blocks}`;

  el.querySelectorAll('.review-inc-ok').forEach((cb) => {
    bindReviewCheckbox(cb, { type: 'inconsistencias', id: cb.dataset.dni });
  });
  bindReviewToolbar(el, 'inconsistencias', ids);
}

function renderRegistrosTable(preview, source) {
  const previewEl = document.getElementById('workerImportPreview');
  if (!previewEl) return;

  if (preview.length === 0) {
    previewEl.innerHTML = '';
    previewEl.hidden = true;
    return;
  }

  const isExcel = source === 'excel';

  if (isExcel) {
    const rows = preview
      .map(
        (p) => `
    <tr>
      <td>${p.filaExcel ?? '—'}</td>
      <td>${escapeHtml(p.nif || '—')}</td>
      <td>${escapeHtml(p.nombre || '—')}</td>
      <td>${escapeHtml(p.fechaNacimiento || '—')}</td>
      <td>${escapeHtml(p.municipio || '—')}</td>
      <td>${escapeHtml(p.nivelFormativo || '—')}</td>
    </tr>`,
      )
      .join('');

    previewEl.innerHTML = `
    <table class="data-table import-workers-table">
      <thead>
        <tr>
          <th>Fila</th>
          <th>DNI</th>
          <th>Nombre</th>
          <th>F. nac.</th>
          <th>Municipio</th>
          <th>Nivel</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
    previewEl.hidden = false;
    updateLoadButtonState();
    return;
  }

  const autoCheckAll = preview.length <= 30;
  const rows = preview
    .map((p) => {
      const checked = autoCheckAll && p.hasNif;
      return `
    <tr class="${p.duplicateId ? 'import-preview__row--missing-required' : ''}">
      <td><input type="checkbox" class="worker-import-check" data-worker-index="${p.index}" ${checked ? 'checked' : ''} /></td>
      <td>${escapeHtml(p.nif || '—')}</td>
      <td>${escapeHtml(p.nombre || '—')}${p.duplicateId ? ' <span class="muted">(ya existe)</span>' : ''}</td>
      <td>${escapeHtml(p.nss || '—')}</td>
      <td>${escapeHtml(p.fechaNacimiento || '—')}</td>
      <td>${escapeHtml(p.tipoContrato || '—')}</td>
    </tr>`;
    })
    .join('');

  previewEl.innerHTML = `
    <table class="data-table import-workers-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="workerImportSelectAll" title="Seleccionar todos" ${autoCheckAll ? 'checked' : ''} /></th>
          <th>NIF</th>
          <th>Nombre</th>
          <th>NSS</th>
          <th>F. nac.</th>
          <th>Contrato</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  previewEl.hidden = false;
  updateLoadButtonState();

  document.getElementById('workerImportSelectAll')?.addEventListener('change', (e) => {
    document.querySelectorAll('.worker-import-check').forEach((cb) => {
      cb.checked = e.target.checked;
    });
  });
}

function renderAlerts({
  preview,
  warnings,
  stats,
  source,
  info,
  fieldSummary,
  descartadas,
  inconsistencias,
}) {
  const alerts = document.getElementById('workerImportAlerts');
  if (!alerts) return;

  let html = '';

  if (source === 'excel' && fieldSummary) {
    html += renderExcelFieldSummary(fieldSummary, stats);
  }

  if (info?.length) {
    html += `<details class="alert alert--ok import-info-details"><summary>Información del archivo (${info.length})</summary><ul>${info.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul></details>`;
  }

  if (warnings?.length) {
    html += `<div class="alert alert--warn"><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`;
  }

  const nDesc = descartadas?.length ?? 0;
  const nInc = inconsistencias?.length ?? 0;
  if (source === 'excel' && (nDesc > 0 || nInc > 0)) {
    html += `<div class="alert alert--warn import-review-hint muted">
      ${nDesc ? `${nDesc} descartadas` : ''}${nDesc && nInc ? ' · ' : ''}${nInc ? `${nInc} inconsistencias` : ''}
      — revisa en las pestañas de abajo (las opciones se pueden ocultar para ganar espacio).
    </div>`;
  }

  if (preview.length === 0) {
    html += `<div class="alert alert--error">No se detectó ningún registro en el ${source === 'excel' ? 'Excel' : 'PDF'}.</div>`;
  } else if (source === 'excel') {
    const personas = stats?.personasUnicas ?? preview.length;
    const filas = stats?.filasValidas ?? preview.length;
    html += `<div class="alert alert--ok">Se importarán <strong>${personas}</strong> persona(s) única(s) (${filas} filas laborales en el Excel). Pulsa «Importar todos».</div>`;
    const hasFechaCol =
      stats?.fechaNacimientoDetectada ??
      fieldSummary?.availableInFile?.some((f) => (f.key ?? f) === 'FECHA_NACIMIENTO');
    const filasConFecha = stats?.filasConFecha ?? 0;
    if (!hasFechaCol) {
      html += `<div class="alert alert--warn">No se detectó la columna <strong>Fecha nacimiento</strong> en el Excel (cabecera fila ${stats?.headerRowUsed ?? 1}). En tu archivo suele llamarse «FECHA NACIMIENTO» (a veces aparece mal como «FECHA NACHIMIENTO»). Revisa «Fila cabeceras».</div>`;
    } else if (filasConFecha === 0) {
      html += `<div class="alert alert--warn">La columna Fecha nacimiento está en el Excel pero <strong>no se pudo leer ninguna fecha</strong>. Comprueba el formato de las celdas (dd/mm/aaaa).</div>`;
    } else {
      html += `<div class="alert alert--ok">Fechas de nacimiento leídas en <strong>${filasConFecha}</strong> fila(s).</div>`;
    }
  } else {
    html += `<div class="alert alert--ok">Se detectaron <strong>${preview.length}</strong> trabajador(es). Marca los que quieras cargar.</div>`;
  }

  alerts.innerHTML = html;
}

function renderExcelResult(data) {
  reviewState = { descartadas: new Set(), inconsistencias: new Set() };
  activeImportView = 'registros';

  renderAlerts({
    preview: data.preview,
    warnings: data.warnings,
    stats: data.stats,
    source: 'excel',
    info: data.info,
    fieldSummary: data.fieldSummary,
    descartadas: data.descartadas,
    inconsistencias: data.inconsistencias,
  });

  renderReviewBar(data.stats);
  renderRegistrosTable(data.personasPreview ?? data.preview, 'excel');
  renderDescartadasView(data.descartadas);
  renderInconsistenciasView(data.inconsistencias);

  updateSetupChip({ fileName: data.fileName, stats: data.stats });
  setSetupCollapsed(true);

  if ((data.descartadas?.length ?? 0) > 0 || (data.inconsistencias?.length ?? 0) > 0) {
    switchImportView(
      (data.inconsistencias?.length ?? 0) > 0 ? 'inconsistencias' : 'descartadas',
    );
  } else {
    updateLoadButtonState();
  }
}

function renderPdfResult(data) {
  document.getElementById('workerImportReviewBar').hidden = true;
  hideAllViews();
  renderAlerts({
    preview: data.preview,
    warnings: data.warnings,
    source: 'pdf',
    empresaHint: data.empresaHint,
  });
  if (data.empresaHint?.codigo) {
    const alerts = document.getElementById('workerImportAlerts');
    const match = data.empresaHint.matchedEmpresaId
      ? ' (empresa encontrada en el sistema)'
      : ' — selecciona la empresa en el formulario';
    alerts.innerHTML += `<div class="alert alert--ok">Empresa A3 <strong>${escapeHtml(data.empresaHint.codigo)}</strong>${escapeHtml(match)}</div>`;
  }
  renderRegistrosTable(data.preview, 'pdf');
  document.getElementById('workerImportPreview').hidden = false;
  updateSetupChip({ fileName: data.fileName, stats: data.stats });
  setSetupCollapsed(true);
}

function setImportMode(mode) {
  const panelPdf = document.getElementById('workerImportPanelPdf');
  const panelExcel = document.getElementById('workerImportPanelExcel');
  document.querySelectorAll('[data-worker-import-mode]').forEach((btn) => {
    const active = btn.dataset.workerImportMode === mode;
    btn.classList.toggle('import-tabs__btn--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (panelPdf) panelPdf.hidden = mode !== 'pdf';
  if (panelExcel) panelExcel.hidden = mode !== 'excel';
}

async function fillWorkerExcelEmpresaSelect() {
  const select = document.getElementById('workerExcelEmpresa');
  if (!select) return;
  const current = select.value;
  try {
    const res = await fetch('/api/empresas');
    const { empresas } = await res.json();
    select.innerHTML =
      '<option value="">— Sin empresa fija —</option>' +
      empresas
        .map(
          (e) =>
            `<option value="${escapeHtml(e.id)}">${escapeHtml(e.nombre || e.nombre_empresa || e.id)}</option>`,
        )
        .join('');
    if (current) select.value = current;
  } catch {
    /* noop */
  }
}

function resetDialog() {
  const pdfInput = document.getElementById('workerPdfInput');
  const excelInput = document.getElementById('workerExcelInput');
  if (pdfInput) pdfInput.value = '';
  if (excelInput) excelInput.value = '';
  for (const id of ['workerPdfFileName', 'workerExcelFileName']) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  }
  for (const id of [
    'workerImportPreview',
    'workerImportDescartadas',
    'workerImportInconsistencias',
  ]) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
      el.hidden = true;
    }
  }
  const bar = document.getElementById('workerImportReviewBar');
  if (bar) {
    bar.innerHTML = '';
    bar.hidden = true;
  }
  const alerts = document.getElementById('workerImportAlerts');
  if (alerts) alerts.innerHTML = '';
  const loadBtn = document.getElementById('workerImportLoad');
  if (loadBtn) loadBtn.disabled = true;
  const statusEl = document.getElementById('workerImportStatus');
  if (statusEl) statusEl.textContent = '';
  lastParseResult = null;
  lastExcelFile = null;
  reviewState = { descartadas: new Set(), inconsistencias: new Set() };
  activeImportView = 'registros';
  setupCollapsed = false;
  const inner = document.getElementById('workerImportInner');
  if (inner) inner.classList.remove('import-dialog__inner--setup-collapsed');
  const chip = document.getElementById('workerImportSetupChip');
  if (chip) {
    chip.innerHTML = '';
    chip.hidden = true;
  }
  const toggle = document.getElementById('workerImportToggleSetup');
  if (toggle) toggle.hidden = true;
}

function openDialog(mode) {
  const dialog = document.getElementById('workerImportDialog');
  if (!dialog) return;
  resetDialog();
  setImportMode(mode);
  if (mode === 'excel') fillWorkerExcelEmpresaSelect();
  dialog.showModal();
}

/**
 * @param {{ onLoadForm: (entry: object) => Promise<boolean>, onBulkImportDone?: (result: object) => void }} options
 */
export function initWorkerImport({
  onLoadForm,
  onBulkImportDone,
  onBackfillFechasDone,
  onBackfillCodigosDone,
}) {
  const dialog = document.getElementById('workerImportDialog');
  const openPdfBtn = document.getElementById('trabajadorImportPdf');
  const openExcelBtn = document.getElementById('trabajadorImportExcel');
  const pdfInput = document.getElementById('workerPdfInput');
  const excelInput = document.getElementById('workerExcelInput');
  const pdfBrowseBtn = document.getElementById('workerPdfBrowse');
  const excelBrowseBtn = document.getElementById('workerExcelBrowse');
  const loadBtn = document.getElementById('workerImportLoad');
  const closeBtn = document.getElementById('workerImportClose');
  const statusEl = document.getElementById('workerImportStatus');

  if (!dialog) return;

  openPdfBtn?.addEventListener('click', () => openDialog('pdf'));
  openExcelBtn?.addEventListener('click', () => openDialog('excel'));

  document.querySelectorAll('[data-worker-import-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setImportMode(btn.dataset.workerImportMode);
      resetDialog();
      if (btn.dataset.workerImportMode === 'excel') fillWorkerExcelEmpresaSelect();
    });
  });

  pdfBrowseBtn?.addEventListener('click', () => pdfInput?.click());
  excelBrowseBtn?.addEventListener('click', () => excelInput?.click());

  closeBtn?.addEventListener('click', () => {
    dialog.close();
    resetDialog();
  });

  document.getElementById('workerImportToggleSetup')?.addEventListener('click', () => {
    setSetupCollapsed(!setupCollapsed);
  });

  loadBtn?.addEventListener('click', async () => {
    if (!lastParseResult) return;

    if (lastParseResult.source === 'excel') {
      const n =
        lastParseResult.stats?.personasUnicas ??
        lastParseResult.personasPreview?.length ??
        0;
      if (!n || !lastExcelFile) {
        alert('Selecciona un archivo Excel válido.');
        return;
      }

      const dPending =
        (lastParseResult.descartadas?.length ?? 0) - reviewState.descartadas.size;
      const iPending =
        (lastParseResult.inconsistencias?.length ?? 0) - reviewState.inconsistencias.size;
      if (dPending > 0 || iPending > 0) {
        const parts = [];
        if (dPending > 0) parts.push(`${dPending} descartada(s) sin revisar`);
        if (iPending > 0) parts.push(`${iPending} inconsistencia(s) sin revisar`);
        const ok = confirm(
          `Quedan ${parts.join(' y ')}.\n\nSe usará la primera aparición por DNI.\n\n¿Importar ${n} trabajador(es) de todos modos?`,
        );
        if (!ok) return;
      } else {
        const ok = confirm(
          `¿Importar ${n} trabajador(es) en el sistema?\n\n` +
            'Se crearán registros nuevos (los DNI repetidos se podrán filtrar después).',
        );
        if (!ok) return;
      }

      const fd = new FormData();
      fd.append('file', lastExcelFile);
      const empresaId = document.getElementById('workerExcelEmpresa')?.value?.trim();
      if (empresaId) fd.append('empresaId', empresaId);
      fd.append('headerRow', document.getElementById('workerExcelHeaderRow')?.value ?? '1');
      appendStoreToFormData(fd);

      if (loadBtn) {
        loadBtn.disabled = true;
        loadBtn.textContent = 'Importando…';
      }
      if (statusEl) statusEl.textContent = 'Importando trabajadores…';

      try {
        const res = await fetch('/api/trabajadores/import-excel-a3', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const msg = data.errors?.join(' ') || 'Error al importar';
          alert(msg);
          if (statusEl) statusEl.textContent = msg;
          updateLoadButtonState();
          return;
        }
        dialog.close();
        resetDialog();
        onBulkImportDone?.(data);
      } catch {
        alert('No se pudo conectar con el servidor.');
        if (statusEl) statusEl.textContent = 'Error de conexión.';
      } finally {
        updateLoadButtonState();
      }
      return;
    }

    if (!lastParseResult.workers?.length) return;

    const indices = getSelectedIndices();
    if (activeImportView !== 'registros') {
      alert('Ve a la pestaña Registros, marca uno y pulsa Cargar en formulario.');
      return;
    }
    if (indices.length === 0) {
      alert('Selecciona un registro en la pestaña Registros.');
      return;
    }
    if (indices.length > 1) {
      const ok = confirm(
        `Has seleccionado ${indices.length} registros. Solo se cargará el primero en el formulario.\n\n` +
          'Después debes pulsar Guardar para añadirlo a trabajadores guardados.\n\n¿Continuar?',
      );
      if (!ok) return;
    }
    const entry = lastParseResult.workers.find((w) => w.index === indices[0]);
    if (!entry) return;
    const loaded = await onLoadForm(entry);
    if (!loaded) return;
    dialog.close();
    resetDialog();
  });

  async function handlePdfFile(file) {
    const fileNameEl = document.getElementById('workerPdfFileName');
    if (fileNameEl) {
      fileNameEl.textContent = file.name;
      fileNameEl.hidden = false;
    }
    if (statusEl) statusEl.textContent = 'Leyendo PDF… (puede tardar en fichas grandes)';
    if (loadBtn) loadBtn.disabled = true;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/trabajadores/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.errors?.join(' ') || 'Error al procesar el PDF';
        if (statusEl) statusEl.textContent = msg;
        document.getElementById('workerImportAlerts').innerHTML =
          `<div class="alert alert--error">${escapeHtml(msg)}</div>`;
        return;
      }

      lastParseResult = { ...data, source: 'pdf', fileName: file.name };
      renderPdfResult({ ...data, fileName: file.name });
      if (statusEl) {
        statusEl.textContent = `${data.stats?.withNif ?? 0} con NIF · ${data.stats?.duplicates ?? 0} duplicados en el sistema`;
      }
      if (loadBtn) loadBtn.disabled = !data.preview?.length;
    } catch {
      if (statusEl) statusEl.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  async function handleExcelFile(file) {
    const fileNameEl = document.getElementById('workerExcelFileName');
    if (fileNameEl) {
      fileNameEl.textContent = file.name;
      fileNameEl.hidden = false;
    }
    if (statusEl) statusEl.textContent = 'Leyendo Excel…';
    if (loadBtn) loadBtn.disabled = true;

    const fd = new FormData();
    fd.append('file', file);
    const empresaId = document.getElementById('workerExcelEmpresa')?.value?.trim();
    if (empresaId) fd.append('empresaId', empresaId);
    const headerRow = document.getElementById('workerExcelHeaderRow')?.value ?? '1';
    fd.append('headerRow', headerRow);

    try {
      const res = await fetch('/api/trabajadores/parse-excel-a3', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.errors?.join(' ') || 'Error al procesar el Excel';
        if (statusEl) statusEl.textContent = msg;
        document.getElementById('workerImportAlerts').innerHTML =
          `<div class="alert alert--error">${escapeHtml(msg)}</div>`;
        return;
      }

      lastExcelFile = file;
      lastParseResult = { ...data, source: 'excel', fileName: file.name };
      renderExcelResult({ ...data, fileName: file.name });
      if (statusEl) {
        const s = data.stats ?? {};
        statusEl.textContent =
          `${s.filasValidas ?? 0} registros · ${s.personasUnicas ?? 0} personas` +
          (s.filasDescartadas ? ` · ${s.filasDescartadas} descartadas` : '') +
          (s.personasConInconsistencias ? ` · ${s.personasConInconsistencias} inconsistencias` : '');
      }
      updateLoadButtonState();
    } catch {
      if (statusEl) statusEl.textContent = 'No se pudo conectar con el servidor.';
    }
  }

  pdfInput?.addEventListener('change', async () => {
    const file = pdfInput.files?.[0];
    if (!file) return;
    setImportMode('pdf');
    await handlePdfFile(file);
  });

  excelInput?.addEventListener('change', async () => {
    const file = excelInput.files?.[0];
    if (!file) return;
    setImportMode('excel');
    await handleExcelFile(file);
  });

  document.getElementById('workerExcelBackfillFechas')?.addEventListener('click', async () => {
    if (!lastExcelFile) {
      alert('Selecciona primero el archivo Excel (el mismo que usaste para importar).');
      return;
    }
    const ok = confirm(
      '¿Actualizar la fecha de nacimiento en los trabajadores ya guardados?\n\n' +
        'No crea trabajadores nuevos; solo rellena F. nacimiento por DNI.',
    );
    if (!ok) return;

    const fd = new FormData();
    fd.append('file', lastExcelFile);
    fd.append('headerRow', document.getElementById('workerExcelHeaderRow')?.value ?? '1');
    appendStoreToFormData(fd);

    if (statusEl) statusEl.textContent = 'Actualizando fechas…';
    try {
      const res = await fetch('/api/trabajadores/backfill-fechas-excel', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.errors?.join(' ') || 'Error al actualizar fechas');
        if (statusEl) statusEl.textContent = '';
        return;
      }
      if (statusEl) {
        statusEl.textContent = `Fechas actualizadas: ${data.updated} trabajador(es)`;
      }
      onBackfillFechasDone?.(data);
    } catch {
      alert('No se pudo conectar con el servidor.');
    }
  });

  document.getElementById('workerExcelBackfillCodigos')?.addEventListener('click', async () => {
    if (!lastExcelFile) {
      alert('Selecciona primero el archivo Excel con DNI y Código_del_Trabajador.');
      return;
    }
    const ok = confirm(
      '¿Actualizar el código de trabajador (A3) en los registros ya guardados?\n\n' +
        'Empareja por DNI. Solo rellena códigos vacíos; no sobrescribe los que ya tengas.',
    );
    if (!ok) return;

    const fd = new FormData();
    fd.append('file', lastExcelFile);
    fd.append('headerRow', document.getElementById('workerExcelHeaderRow')?.value ?? '1');
    appendStoreToFormData(fd);

    if (statusEl) statusEl.textContent = 'Actualizando códigos de trabajador…';
    try {
      const res = await fetch('/api/trabajadores/backfill-codigos-excel', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.errors?.join(' ') || 'Error al actualizar códigos');
        if (statusEl) statusEl.textContent = '';
        return;
      }
      if (statusEl) {
        statusEl.textContent = `Códigos actualizados: ${data.updated} trabajador(es)`;
      }
      onBackfillCodigosDone?.(data);
    } catch {
      alert('No se pudo conectar con el servidor.');
    }
  });
}
