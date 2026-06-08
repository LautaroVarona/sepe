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

Se guardan en `data/db.json` (no se sube al repositorio). Haz copia de seguridad de esa carpeta.

## Estructura XML

Raíz `LLAMAMIENTOS`, máximo 30 `LLAMAMIENTO_TIPO` por fichero, codificación ISO-8859-1.

## Alias de columnas Excel

Definidos en `src/config/mapping.js` → `HEADER_ALIASES`. Si Saltra usa otro nombre, añádelo ahí.
