/**
 * Modal de importación de ficha empresa PDF (A3).
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let pendingMasterPayload = null;
let lastParseResult = null;

export function getPendingMasterPayload() {
  return pendingMasterPayload;
}

export function setPendingMasterPayload(payload) {
  pendingMasterPayload = payload ? { ...payload } : null;
}

export function clearPendingMasterPayload() {
  pendingMasterPayload = null;
  lastParseResult = null;
}

function renderPreview(fieldStatus, validation, textPreview) {
  const preview = document.getElementById('companyImportPreview');
  const alerts = document.getElementById('companyImportAlerts');
  if (!preview || !alerts) return;

  const groups = new Map();
  for (const item of fieldStatus) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  let html = '<div class="import-preview">';
  for (const [group, items] of groups) {
    html += `<h4 class="import-preview__group">${escapeHtml(group)}</h4>`;
    html += '<table class="import-preview__table"><tbody>';
    for (const item of items) {
      const rowClass = item.detected
        ? 'import-preview__row--ok'
        : item.required
          ? 'import-preview__row--missing-required'
          : 'import-preview__row--missing';
      const status = item.detected ? 'Detectado' : item.required ? 'Obligatorio · no detectado' : 'No detectado';
      html += `<tr class="${rowClass}">
        <th scope="row">${escapeHtml(item.label)}</th>
        <td>${item.detected ? escapeHtml(item.value) : '<span class="muted">—</span>'}</td>
        <td class="import-preview__status">${escapeHtml(status)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
  }
  html += '</div>';
  preview.innerHTML = html;
  preview.hidden = false;

  let alertHtml = '';
  if (validation.errors?.length) {
    alertHtml += `<div class="alert alert--error"><strong>Revisar antes de guardar</strong><ul>${validation.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>`;
  }
  if (validation.warnings?.length) {
    alertHtml += `<div class="alert alert--warn"><ul>${validation.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`;
  }
  if (!alertHtml && validation.ok) {
    alertHtml =
      '<div class="alert alert--ok">Campos principales detectados. Revisa el formulario y guarda cuando esté correcto.</div>';
  }
  if (textPreview) {
    alertHtml += `<details class="import-debug"><summary>Texto leído del PDF (depuración)</summary><pre class="import-debug__pre">${escapeHtml(textPreview)}</pre></details>`;
  }
  alerts.innerHTML = alertHtml;
}

/**
 * @param {{ onApply: (prefill: object, masterPayload: object) => void }} options
 */
export function initCompanyImport({ onApply }) {
  const dialog = document.getElementById('companyImportDialog');
  const openBtn = document.getElementById('empresaImportPdf');
  const fileInput = document.getElementById('companyPdfInput');
  const browseBtn = document.getElementById('companyPdfBrowse');
  const applyBtn = document.getElementById('companyImportApply');
  const closeBtn = document.getElementById('companyImportClose');
  const fileNameEl = document.getElementById('companyImportFileName');
  const statusEl = document.getElementById('companyImportStatus');

  if (!dialog || !openBtn) return;

  function resetDialog() {
    if (fileInput) fileInput.value = '';
    if (fileNameEl) {
      fileNameEl.textContent = '';
      fileNameEl.hidden = true;
    }
    const preview = document.getElementById('companyImportPreview');
    const alerts = document.getElementById('companyImportAlerts');
    if (preview) {
      preview.innerHTML = '';
      preview.hidden = true;
    }
    if (alerts) alerts.innerHTML = '';
    if (applyBtn) applyBtn.disabled = true;
    if (statusEl) statusEl.textContent = '';
    lastParseResult = null;
  }

  function openDialog() {
    resetDialog();
    dialog.showModal();
  }

  openBtn.addEventListener('click', openDialog);

  browseBtn?.addEventListener('click', () => fileInput?.click());

  closeBtn?.addEventListener('click', () => {
    dialog.close();
    resetDialog();
  });

  applyBtn?.addEventListener('click', () => {
    if (!lastParseResult) return;
    setPendingMasterPayload(lastParseResult.masterPayload);
    onApply(lastParseResult.prefill, lastParseResult.masterPayload);
    dialog.close();
    resetDialog();
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (fileNameEl) {
      fileNameEl.textContent = file.name;
      fileNameEl.hidden = false;
    }
    if (statusEl) statusEl.textContent = 'Leyendo PDF…';
    if (applyBtn) applyBtn.disabled = true;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/empresas/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.errors?.join(' ') || 'Error al procesar el PDF';
        if (statusEl) statusEl.textContent = msg;
        const alertsEl = document.getElementById('companyImportAlerts');
        if (alertsEl) {
          alertsEl.innerHTML = `<div class="alert alert--error">${escapeHtml(msg)}</div>`;
        }
        return;
      }

      lastParseResult = data;
      renderPreview(data.fieldStatus, data.validation, data.textPreview);
      if (statusEl) {
        statusEl.textContent = 'Revisa los datos detectados y pulsa «Aplicar al formulario».';
      }
      if (applyBtn) applyBtn.disabled = false;
    } catch {
      if (statusEl) statusEl.textContent = 'No se pudo conectar con el servidor.';
    }
  });
}
