import assert from 'node:assert/strict';
import { sortLlamamientoRowsByPersonaFecha } from '../src/lib/processLlamamientos.js';

const rows = [
  {
    excelRowNumber: 10,
    record: {
      NOMBRE: 'JESUS',
      PRIMER_APELLIDO: 'AZNAR',
      SEGUNDO_APELLIDO: 'LOPEZ',
      FECHA_INICIO: '20260329',
    },
  },
  {
    excelRowNumber: 3,
    record: {
      NOMBRE: 'CELIA',
      PRIMER_APELLIDO: 'GARCIA',
      SEGUNDO_APELLIDO: 'MARTINEZ',
      FECHA_INICIO: '20260328',
    },
  },
  {
    excelRowNumber: 4,
    record: {
      NOMBRE: 'CELIA',
      PRIMER_APELLIDO: 'GARCIA',
      SEGUNDO_APELLIDO: 'MARTINEZ',
      FECHA_INICIO: '20260124',
    },
  },
  {
    excelRowNumber: 5,
    record: {
      NOMBRE: 'CARLA',
      PRIMER_APELLIDO: 'MERCADO',
      SEGUNDO_APELLIDO: 'SANCHEZ',
      FECHA_INICIO: '20260412',
    },
  },
];

const sorted = sortLlamamientoRowsByPersonaFecha(rows);
const keys = sorted.map(
  (r) =>
    `${r.record.NOMBRE} ${r.record.PRIMER_APELLIDO}:${r.record.FECHA_INICIO}`,
);

assert.deepEqual(keys, [
  'CARLA MERCADO:20260412',
  'CELIA GARCIA:20260124',
  'CELIA GARCIA:20260328',
  'JESUS AZNAR:20260329',
]);

console.log('OK — sort nombre + fecha');
