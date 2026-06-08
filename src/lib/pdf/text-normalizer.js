/**
 * Normalización de texto PDF A3 — Ficha del Trabajador.
 * Reutiliza utilidades de empresa y añade marcadores de sección de trabajador.
 */
import {
  stripPdfArtifacts,
  normalizeWhitespace,
  joinOrphanLabelLines,
  dedupeConsecutiveLines,
  insertA3SectionBreaks,
} from './company-text-normalizer.js';

const WORKER_SECTION_MARKERS = [
  'Ficha del Trabajador',
  'Datos de filiación',
  'Datos de filiacion',
  'Datos de identificación del Trabajador',
  'Datos de identificacion del Trabajador',
  'Datos de contrato',
  'Datos de Ampliación de la Ficha del Trabajador',
  'Domicilio del Trabajador',
  'Tablas',
];

/** Inserta saltos antes de títulos de sección de ficha trabajador. */
export function insertWorkerSectionBreaks(text) {
  let out = String(text ?? '');
  for (const marker of WORKER_SECTION_MARKERS) {
    const folded = marker
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase();
    const words = folded.split(' ').filter(Boolean).map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const pattern = words.join('[\\s\\u00a0]+');
    out = out.replace(new RegExp(`(?<!\\n)(${pattern})`, 'gi'), '\n$&');
  }
  return out;
}

/**
 * Pipeline completo de normalización para PDFs de trabajadores A3.
 */
export function normalizeWorkerPdfText(raw) {
  let text = stripPdfArtifacts(raw);
  text = insertA3SectionBreaks(text);
  text = insertWorkerSectionBreaks(text);
  text = normalizeWhitespace(text);
  text = joinOrphanLabelLines(text);
  text = dedupeConsecutiveLines(text);
  return normalizeWhitespace(text);
}
