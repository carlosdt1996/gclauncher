# Instrucciones para Crear el Instalador

## Requisitos Previos

1. Node.js instalado (versión 18 o superior)
2. npm o yarn instalado
3. Todas las dependencias instaladas (`npm install`)

## Crear el Instalador

### Opción 1: Instalador NSIS (Recomendado)
```bash
npm run build:win
```

Esto creará un instalador `.exe` en la carpeta `dist-build/` que:
- Permite elegir la carpeta de instalación
- Crea accesos directos en el escritorio y menú de inicio
- Incluye un desinstalador
- Ejecuta la aplicación automáticamente después de la instalación

### Opción 2: Versión Portable
```bash
npm run build:win:portable
```

Esto creará una versión portable que no requiere instalación.

## Ubicación del Instalador

El instalador se generará en:
```
dist-build/GC Game Launcher Setup 1.0.0.exe
```

## Instalación en Otro Equipo

1. Copia el archivo `.exe` al equipo destino
2. Ejecuta el instalador
3. Sigue el asistente de instalación
4. La aplicación estará lista para usar

## Notas

- El instalador incluye todos los archivos necesarios
- No se requiere Node.js en el equipo destino
- La aplicación se instalará en: `C:\Users\[Usuario]\AppData\Local\Programs\GC Game Launcher\`
- Los datos de la aplicación se guardan en: `C:\Users\[Usuario]\AppData\Roaming\gclauncher\`

