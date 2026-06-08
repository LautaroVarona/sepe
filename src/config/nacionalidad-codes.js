/**
 * Códigos INE de nacionalidad (ISO 3166-1 numérico).
 * Mapa extensible: nombre país normalizado → código de 3 dígitos.
 */
export const NACIONALIDAD_CODES = new Map([
  ['ESPAÑA', '724'],
  ['ESPANA', '724'],
  ['SPAIN', '724'],
  ['ESP', '724'],
  ['ES', '724'],
  ['FRANCIA', '250'],
  ['FRANCE', '250'],
  ['FRA', '250'],
  ['PORTUGAL', '620'],
  ['PRT', '620'],
  ['ITALIA', '380'],
  ['ITALY', '380'],
  ['ITA', '380'],
  ['ALEMANIA', '276'],
  ['GERMANY', '276'],
  ['DEU', '276'],
  ['MARRUECOS', '504'],
  ['MOROCCO', '504'],
  ['MAR', '504'],
  ['RUMANIA', '642'],
  ['ROMANIA', '642'],
  ['ROU', '642'],
  ['COLOMBIA', '170'],
  ['COL', '170'],
  ['ECUADOR', '218'],
  ['ECU', '218'],
  ['VENEZUELA', '862'],
  ['VEN', '862'],
  ['ARGENTINA', '032'],
  ['ARG', '032'],
  ['BOLIVIA', '068'],
  ['BOL', '068'],
  ['PERU', '604'],
  ['PERÚ', '604'],
  ['CHILE', '152'],
  ['CHL', '152'],
  ['UCRANIA', '804'],
  ['UKRAINE', '804'],
  ['UKR', '804'],
  ['CHINA', '156'],
  ['CHN', '156'],
  ['PAKISTAN', '586'],
  ['PAK', '586'],
]);

function normalizeCountryKey(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Convierte texto de nacionalidad a código numérico INE.
 * Si ya es numérico (3 dígitos), lo devuelve tal cual.
 * @returns {{ code: string, recognized: boolean }}
 */
export function mapNacionalidadToCodigo(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { code: '', recognized: true };

  if (/^\d{3}$/.test(raw)) {
    return { code: raw, recognized: true };
  }

  const key = normalizeCountryKey(raw);
  if (NACIONALIDAD_CODES.has(key)) {
    return { code: NACIONALIDAD_CODES.get(key), recognized: true };
  }

  return { code: raw, recognized: false };
}
