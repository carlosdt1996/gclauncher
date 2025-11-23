# Instrucciones para Crear el Release en GitHub

## Paso 1: Verificar el Instalador

El instalador se encuentra en:
```
dist-build/GC Game Launcher Setup 1.0.0.exe
```

Verifica que el archivo existe y tiene un tamaño aproximado de 150-200 MB.

## Paso 2: Crear el Release en GitHub

### Opción A: Desde la Interfaz Web de GitHub

1. Ve a tu repositorio: https://github.com/carlosdt1996/gclauncher
2. Haz clic en "Releases" (en el menú lateral derecho)
3. Haz clic en "Create a new release" o "Draft a new release"
4. Completa el formulario:
   - **Tag version**: `v1.0.0`
   - **Release title**: `GC Game Launcher v1.0.0 - Primera Versión`
   - **Description**: Copia y pega el contenido de abajo
5. Arrastra el archivo `GC Game Launcher Setup 1.0.0.exe` a la sección de "Attach binaries"
6. Marca "Set as the latest release" si es la versión más reciente
7. Haz clic en "Publish release"

### Opción B: Usando GitHub CLI (gh)

Si tienes GitHub CLI instalado:

```bash
gh release create v1.0.0 "dist-build/GC Game Launcher Setup 1.0.0.exe" --title "GC Game Launcher v1.0.0" --notes-file RELEASE_NOTES.md
```

## Descripción del Release

Copia y pega esto en la descripción del release:

```markdown
# GC Game Launcher v1.0.0

## 🎮 Primera Versión Pública

Un launcher de juegos completo que permite descargar juegos desde torrents e integrarlos a tu biblioteca.

## ✨ Características

- 🎮 Integración completa con Steam
- 📥 Descarga de juegos desde torrents
- 🖼️ Portadas personalizables desde SteamGridDB
- 🎯 Soporte para controladores/gamepads
- 🎨 Temas personalizables (Dark y Switch)
- 📊 Seguimiento de tiempo de juego
- 🔍 Búsqueda de juegos en múltiples fuentes

## 📥 Instalación

1. Descarga el instalador `GC Game Launcher Setup 1.0.0.exe`
2. Ejecuta el instalador
3. Sigue el asistente de instalación
4. ¡Listo! La aplicación se abrirá automáticamente

## 📋 Requisitos

- Windows 10 o superior (64 bits)
- 200 MB de espacio libre
- 2 GB de RAM mínimo

## ⚠️ Nota Importante

Si Windows Defender SmartScreen muestra una advertencia:
1. Haz clic en "Más información"
2. Haz clic en "Ejecutar de todas formas"

Esto es normal para aplicaciones no firmadas digitalmente.

## 🧪 Pruebas

Por favor, prueba la instalación y reporta cualquier problema en los [Issues](https://github.com/carlosdt1996/gclauncher/issues).

Consulta [TEST_INSTALADOR.md](./TEST_INSTALADOR.md) para una guía completa de pruebas.

## 📚 Documentación

- [Instrucciones de Instalación](./INSTALACION_USUARIO.md)
- [Guía de Pruebas](./TEST_INSTALADOR.md)
- [Documentación de Desarrollo](./BUILD_INSTRUCTIONS.md)

## 🐛 Reportar Problemas

Si encuentras algún problema, por favor:
1. Abre un [Issue](https://github.com/carlosdt1996/gclauncher/issues/new)
2. Describe el problema detalladamente
3. Incluye información del sistema (Windows 10/11, versión, etc.)

---

**¡Gracias por probar GC Game Launcher!** 🎉
```

## Paso 3: Verificar el Release

Después de crear el release:
1. Ve a la página del release
2. Verifica que el archivo `.exe` está disponible para descarga
3. Prueba descargar el instalador desde otro dispositivo/navegador
4. Verifica que el tamaño del archivo es correcto

## Paso 4: Compartir el Release

Una vez publicado, puedes compartir el enlace del release:
```
https://github.com/carlosdt1996/gclauncher/releases/tag/v1.0.0
```

O el enlace de descarga directa:
```
https://github.com/carlosdt1996/gclauncher/releases/download/v1.0.0/GC%20Game%20Launcher%20Setup%201.0.0.exe
```

## Notas Adicionales

- El archivo `.blockmap` también se generó, pero no es necesario subirlo
- Considera crear un tag antes del release: `git tag v1.0.0 && git push origin v1.0.0`
- Para futuras versiones, incrementa el número de versión en `package.json` y crea un nuevo release

