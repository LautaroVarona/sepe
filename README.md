# SEPEIMP — Generador XML LLAMAMIENTOS (L2606002)

Aplicación web para importar Excel (exportación Saltra u otros), completar datos desde un registro interno de empresas y trabajadores, y generar XML para Contrat@.

## Instalación y uso

```powershell
cd c:\Dev\sepeimp
npm install
npm run dev
```

Abrir **http://localhost:3000**

## Flujo de trabajo

1. **Empresas** — Registra CCC, NIF, valores por defecto (clave contrato, nivel formativo, etc.).
2. **Trabajadores** — Registra DNI/NIE y NSS (clave de cruce), datos personales y vínculo a empresa.
3. **Generar XML** — Importa el Excel de Saltra (arrastrar o elegir archivo).
   - Se reconocen columnas por alias (DNI, NSS, FECHA_INICIO, etc.).
   - Lo que falte en el Excel se rellena desde empresa/trabajador si hay coincidencia por DNI o NSS.
   - El XML se muestra en pantalla; tú decides cuándo guardarlo en tu PC (**Guardar en mi ordenador…**).

## Excel incompleto (Saltra)

Ya no se bloquea por columnas faltantes en la cabecera. Se genera el XML y se avisa:

- Qué columnas no venían en el export.
- Qué filas siguen incompletas tras fusionar con el sistema.
- Errores de formato solo si un dato presente es inválido (p. ej. NSS con longitud incorrecta).

## Datos persistentes

**En el navegador:** empresas y trabajadores se guardan en `localStorage` del mismo equipo/navegador. Sobreviven a recargas de página y despliegues en Vercel.

**En local (servidor Node):** además se sincronizan con `data/db.json` cuando ejecutas `npm run dev`. Haz copia de seguridad de esa carpeta si trabajas en local.

## Estructura XML

Raíz `LLAMAMIENTOS`, máximo 30 `LLAMAMIENTO_TIPO` por fichero, codificación ISO-8859-1.

## Alias de columnas Excel

Definidos en `src/config/mapping.js` → `HEADER_ALIASES`. Si Saltra usa otro nombre, añádelo ahí.

## Servicio TypeScript (fuentes → XML)

Generación batch desde la carpeta `fuentes/`:

```powershell
npm install
npm run generate:fuentes
```

| Archivo | Rol |
|---------|-----|
| `fuentes/tmp22E8.xls` | Base maestra trabajadores A3 |
| `fuentes/00. 2026 GR. EL ALTO - Llamamientos.xlsx` | Movimientos Alta/Baja |
| `fuentes/L2606002.XML` | Referencia de estructura XML |

Salida en `data/generated/*.XML` (ISO-8859-1, máx. 30 registros/fichero).

Código en `src/services/sepe-llamamientos/`:

1. Ingesta movimientos → orden por DNI/fecha → empareja Alta+Baja del mismo mes → descarta bajas huérfanas
2. Cruce con maestro A3 por DNI (error logueado, no detiene)
3. Limpieza: NIE sin ceros, fechas invertidas, nombres truncados (15/20)
4. XML según estructura L2606002

```typescript
import { generateSepeLlamamientosXml } from './src/services/sepe-llamamientos/index.js';

const result = generateSepeLlamamientosXml({
  movementPaths: ['fuentes/00. 2026 GR. EL ALTO - Llamamientos.xlsx'],
  masterPath: 'fuentes/tmp22E8.xls',
  empresa: { nifEmpresa: 'B96562467', ccc: '46109049727', codigoEmpresaA3: '96280' },
});
```
