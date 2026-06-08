import {
  buildTrabajadorIndex,
  findTrabajadorInIndex,
} from '../src/lib/trabajadorIndex.js';

const trabajadores = [
  {
    id: 1,
    codigo_interno_a3: '021106',
    identificador_pfisica: '12345678Z',
    nombre: 'JUAN',
    primer_apellido: 'GARCIA',
    segundo_apellido: 'LOPEZ',
    numero_seguridad_social: '461110523839',
  },
  {
    id: 2,
    codigo_interno_a3: '019916',
    identificador_pfisica: '87654321X',
    nombre: 'MARIA',
    primer_apellido: 'PEREZ',
    segundo_apellido: '',
    numero_seguridad_social: '461162997304',
  },
];

const index = buildTrabajadorIndex(trabajadores);
let failed = 0;

const byCodigo = findTrabajadorInIndex(index, { CODIGO_TRABAJADOR: '021106' });
const okCodigo =
  byCodigo.trabajador?.id === 1 && byCodigo.matchBy === 'codigo';
console.log(`${okCodigo ? 'OK' : 'FAIL'} match por código trabajador`);
if (!okCodigo) {
  console.log('  got:', byCodigo);
  failed += 1;
}

const byDni = findTrabajadorInIndex(index, { IDENTIFICADORPFISICA: '87654321X' });
const okDni = byDni.trabajador?.id === 2 && byDni.matchBy === 'dni';
console.log(`${okDni ? 'OK' : 'FAIL'} match por DNI`);
if (!okDni) {
  console.log('  got:', byDni);
  failed += 1;
}

const codigoWins = findTrabajadorInIndex(index, {
  CODIGO_TRABAJADOR: '021106',
  IDENTIFICADORPFISICA: '87654321X',
});
const okPriority =
  codigoWins.trabajador?.id === 1 && codigoWins.matchBy === 'codigo';
console.log(`${okPriority ? 'OK' : 'FAIL'} código tiene prioridad sobre DNI`);
if (!okPriority) {
  console.log('  got:', codigoWins);
  failed += 1;
}

const noMatch = findTrabajadorInIndex(index, { IDENTIFICADORPFISICA: '00000000A' });
const okNoMatch = noMatch.trabajador === null;
console.log(`${okNoMatch ? 'OK' : 'FAIL'} sin match devuelve null`);
if (!okNoMatch) {
  console.log('  got:', noMatch);
  failed += 1;
}

process.exit(failed > 0 ? 1 : 0);
