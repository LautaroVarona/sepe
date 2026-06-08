/**
 * Normaliza texto extraído de PDFs A3 (ficha empresa) para facilitar extracción por etiquetas.
 */

/** Línea con código y nombre de empresa juntos (layout A3). */
export function lineHasMultipleIdentLabels(line) {
  const norm = String(line ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return norm.includes('codigo de la empresa') && norm.includes('nombre de la empresa');
}

const A3_SECTION_MARKERS = [
  'Ficha de empresa',
  'Datos de identificación de la Empresa',
  'Domicilio envio documentación',
  'Domicilio Fiscal',
  'Tablas',
  'Enlace con A3GES',
  'Datos varios',
  'Datos de Ampliación de la Ficha del Trabajador',
];

/** Artefactos típicos de pdf-parse (pies de página, separadores). */
export function stripPdfArtifacts(text) {
  return String(text ?? '')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/page\s+\d+\s+of\s+\d+/gi, ' ')
    .replace(/^\s*--\s*$/gm, ' ');
}

/** Inserta saltos de línea antes de títulos de sección A3 (texto a menudo pegado). */
export function insertA3SectionBreaks(text) {
  let out = text;
  for (const marker of A3_SECTION_MARKERS) {
    const folded = toMatchableText(marker);
    const words = folded.split(' ').filter(Boolean).map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const pattern = words.join('[\\s\\u00a0]+');
    out = out.replace(new RegExp(`(?<!\\n)(${pattern})`, 'gi'), '\n$&');
  }
  return out;
}

/** Colapsa espacios y unifica saltos de línea. */
export function normalizeWhitespace(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ ]+/g, ' ')
    .replace(/\t+/g, '\t')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Une líneas donde la etiqueta quedó sola y el valor en la línea siguiente.
 */
export function joinOrphanLabelLines(text) {
  const lines = text.split('\n');
  const out = [];
  const labelEnd =
    /^(c[oó]digo|nombre|n\.?i\.?f|sigla|v[ií]a|n[uú]mero|escalera|piso|puerta|municipio|provincia|tel[eé]fono|e-?mail|fecha|tipo|domicilio|ccc|cuenta)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const next = lines[i + 1]?.trim() ?? '';
    if (line.includes('\t') || lineHasMultipleIdentLabels(line)) {
      out.push(line);
      continue;
    }
    const isLabelOnly =
      (line.endsWith(':') || labelEnd.test(line)) &&
      !line.includes(': ') &&
      !line.includes('\t') &&
      line.length < 80;
    if (
      isLabelOnly &&
      next &&
      !next.endsWith(':') &&
      !labelEnd.test(next) &&
      !/^--\s*\d/i.test(next)
    ) {
      out.push(`${line.replace(/:$/, '')}: ${next}`);
      i++;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function dedupeConsecutiveLines(text) {
  const lines = text.split('\n');
  const out = [];
  let prev = null;
  for (const line of lines) {
    const norm = line.trim().toLowerCase();
    if (norm && norm === prev) continue;
    out.push(line);
    prev = norm || prev;
  }
  return out.join('\n');
}

export function softenAcronymsInLabel(label) {
  return String(label ?? '')
    .replace(/([A-Za-zÁÉÍÓÚÑ])\s*\.\s*(?=[A-Za-zÁÉÍÓÚÑ])/g, '$1 ')
    .replace(/\s*\/\s*/g, ' ');
}

export function normalizeCompanyPdfText(raw) {
  let text = stripPdfArtifacts(raw);
  text = insertA3SectionBreaks(text);
  text = normalizeWhitespace(text);
  text = joinOrphanLabelLines(text);
  text = dedupeConsecutiveLines(text);
  return normalizeWhitespace(text);
}

export function normalizeLabel(label) {
  return String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto sin acentos y en minúsculas para regex (/i no iguala ó↔o en JavaScript). */
export function toMatchableText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function matchFolded(text, regex) {
  return toMatchableText(text).match(regex);
}
