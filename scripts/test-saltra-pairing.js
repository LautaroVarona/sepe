import assert from 'node:assert/strict';
import {
  pairAltaBajaMovements,
  isSaltraLlamamientosFormat,
} from '../src/lib/saltraLlamamientosReader.js';

function mov({ row, type, dni = '', nss = '', fecha = '' }) {
  const record = {
    IDENTIFICADORPFISICA: dni,
    NUMERO_SEGURIDAD_SOCIAL: nss,
    NOMBRE: 'ANA',
    PRIMER_APELLIDO: 'GARCIA',
    SEGUNDO_APELLIDO: 'LOPEZ',
    CLAVE_CONTRATO_TRANS: type === 'alta' ? '300' : '',
    FECHA_INICIO: type === 'alta' ? fecha : '',
    FECHA_FIN: type === 'baja' ? fecha : '',
  };
  return {
    record,
    excelRowNumber: row,
    movementType: type,
    fecha,
    nombreCompleto: 'ANA GARCIA LOPEZ',
  };
}

// Alta + Baja consecutivas, mismo DNI
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'alta', dni: '12345678Z', fecha: '20260101' }),
    mov({ row: 3, type: 'baja', dni: '12345678Z', fecha: '20260201' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'alta+baja');
  assert.equal(rows[0].record.FECHA_INICIO, '20260101');
  assert.equal(rows[0].record.FECHA_FIN, '20260201');
  assert.equal(pairing.pairedAltaBaja, 1);
}

// Alta con DNI, Baja solo con NSS del mismo trabajador
{
  const { rows } = pairAltaBajaMovements([
    mov({
      row: 2,
      type: 'alta',
      dni: '12345678Z',
      nss: '461163466742',
      fecha: '20260101',
    }),
    mov({ row: 3, type: 'baja', nss: '461163466742', fecha: '20260201' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'alta+baja');
  assert.equal(rows[0].record.FECHA_FIN, '20260201');
}

// Alta sin Baja → se conserva con marcador implícito (sin FECHA_FIN)
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'alta', dni: '12345678Z', fecha: '20260101' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'alta-sin-baja');
  assert.equal(rows[0].record.FECHA_INICIO, '20260101');
  assert.equal(rows[0].record.FECHA_FIN, '');
  assert.equal(pairing.altaSinBaja, 1);
}

// Baja sin Alta previa → registro independiente con FECHA_FIN
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'baja', dni: '12345678Z', fecha: '20260201' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'baja-sin-alta');
  assert.equal(rows[0].record.FECHA_FIN, '20260201');
  assert.equal(pairing.bajaSinAlta, 1);
}

// Dos parejas del mismo trabajador
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'alta', dni: '12345678Z', fecha: '20260101' }),
    mov({ row: 3, type: 'baja', dni: '12345678Z', fecha: '20260201' }),
    mov({ row: 4, type: 'alta', dni: '12345678Z', fecha: '20260301' }),
    mov({ row: 5, type: 'baja', dni: '12345678Z', fecha: '20260401' }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(pairing.pairedAltaBaja, 2);
  assert.equal(rows[0].sourceRows.join(','), '2,3');
  assert.equal(rows[1].sourceRows.join(','), '4,5');
}

// Detección de cabeceras Saltra
assert.equal(
  isSaltraLlamamientosFormat(['NOMBRE', 'NIF/DNI/CIF', 'MOVIMIENTO', 'FECHA']),
  true,
);
assert.equal(
  isSaltraLlamamientosFormat(['NOMBRE', 'TIPO DE MOVIMIENTO', 'FECHA']),
  true,
);
assert.equal(isSaltraLlamamientosFormat(['NOMBRE', 'DNI', 'FECHA_INICIO']), false);

// Baja antes que Alta, misma fecha → llamamiento de un solo día (válido)
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 673, type: 'baja', dni: '12345678Z', fecha: '20260307' }),
    mov({ row: 674, type: 'alta', dni: '12345678Z', fecha: '20260307' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'alta+baja');
  assert.equal(rows[0].record.FECHA_INICIO, '20260307');
  assert.equal(rows[0].record.FECHA_FIN, '20260307');
  assert.equal(rows[0].sourceRows.join(','), '673,674');
  assert.equal(pairing.pairedAltaBaja, 1);
  assert.equal(pairing.bajaSinAlta, 0);
  assert.equal(pairing.altaSinBaja, 0);
}

// Alta + Baja mismo día (orden natural)
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'alta', dni: '12345678Z', fecha: '20260308' }),
    mov({ row: 3, type: 'baja', dni: '12345678Z', fecha: '20260308' }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].movementPair, 'alta+baja');
  assert.equal(rows[0].record.FECHA_INICIO, '20260308');
  assert.equal(rows[0].record.FECHA_FIN, '20260308');
  assert.equal(pairing.pairedAltaBaja, 1);
}

// Baja huérfana + Alta de otro día → no se emparejan
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 2, type: 'baja', dni: '12345678Z', fecha: '20260301' }),
    mov({ row: 3, type: 'alta', dni: '12345678Z', fecha: '20260310' }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(pairing.bajaSinAlta, 1);
  assert.equal(pairing.altaSinBaja, 1);
  assert.equal(pairing.pairedAltaBaja, 0);
}

// Excel de más reciente a más antiguo: Baja 11/07 luego Alta 10/07 → un llamamiento
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 651, type: 'baja', dni: '23889417F', fecha: '20260711' }),
    mov({ row: 652, type: 'alta', dni: '23889417F', fecha: '20260710' }),
    mov({ row: 653, type: 'alta', dni: '23889417F', fecha: '20260610' }),
    mov({ row: 654, type: 'baja', dni: '23889417F', fecha: '20260607' }),
  ]);
  assert.equal(pairing.pairedAltaBaja, 2);
  assert.equal(pairing.altaSinBaja, 0);
  assert.equal(pairing.bajaSinAlta, 0);
  const first = rows.find((r) => r.sourceRows.includes(651));
  assert.equal(first.movementPair, 'alta+baja');
  assert.equal(first.record.FECHA_INICIO, '20260710');
  assert.equal(first.record.FECHA_FIN, '20260711');
}

// Dos periodos Baja→Alta del mismo trabajador (orden inverso del Excel)
{
  const { rows, pairing } = pairAltaBajaMovements([
    mov({ row: 4101, type: 'baja', dni: '22592654F', fecha: '20260616' }),
    mov({ row: 4102, type: 'alta', dni: '22592654F', fecha: '20260610' }),
    mov({ row: 4103, type: 'baja', dni: '22592654F', fecha: '20260531' }),
    mov({ row: 4104, type: 'alta', dni: '22592654F', fecha: '20260528' }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(pairing.pairedAltaBaja, 2);
  assert.equal(rows[0].record.FECHA_INICIO, '20260610');
  assert.equal(rows[0].record.FECHA_FIN, '20260616');
  assert.equal(rows[1].record.FECHA_INICIO, '20260528');
  assert.equal(rows[1].record.FECHA_FIN, '20260531');
}

console.log('test-saltra-pairing: OK');
