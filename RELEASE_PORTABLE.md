# Release Portable - Instrucciones

## Archivo Portable Generado

✅ **Archivo**: `GC Game Launcher 1.0.0.exe`  
✅ **Ubicación**: `dist-build/GC Game Launcher 1.0.0.exe`  
✅ **Tamaño**: ~80.3 MB  
✅ **Tipo**: Portable (no requiere instalación)

## Crear el Release en GitHub

### Paso 1: Ve a GitHub Releases

1. Abre tu navegador y ve a: https://github.com/carlosdt1996/gclauncher/releases
2. Haz clic en "Draft a new release" o "Create a new release"

### Paso 2: Configura el Release

- **Tag version**: Selecciona `v1.0.0-portable` (debe aparecer en el dropdown)
- **Release title**: `GC Game Launcher v1.0.0 - Portable Edition`
- **Description**: Copia y pega el siguiente texto:

```markdown
# GC Game Launcher v1.0.0 - Portable Edition

## 🚀 Versión Portable

Esta es la versión portable del launcher. **No requiere instalación** - solo descarga y ejecuta.

## ✨ Características

- ✅ No requiere instalación
- ✅ Ejecutable directo
- ✅ No deja rastros en el sistema (excepto datos de la app)
- ✅ Perfecto para USB o uso temporal
- ✅ Todas las características de la versión instalable

## 📥 Cómo Usar

1. **Descarga** el archivo `GC Game Launcher 1.0.0.exe`
2. **Ejecuta** el archivo directamente (doble clic)
3. **¡Listo!** La aplicación se abrirá inmediatamente

## ⚠️ Nota Importante

Si Windows Defender SmartScreen muestra una advertencia:
1. Haz clic en "Más información"
2. Haz clic en "Ejecutar de todas formas"

Esto es normal para aplicaciones no firmadas digitalmente.

## 📋 Requisitos

- Windows 10 o superior (64 bits)
- 200 MB de espacio libre
- 2 GB de RAM mínimo

## 🔄 Diferencia con la Versión Instalable

| Característica | Portable | Instalable |
|---------------|----------|------------|
| Instalación | ❌ No requerida | ✅ Requerida |
| Accesos directos | ❌ No | ✅ Sí |
| Desinstalador | ❌ No | ✅ Sí |
| Ubicación | Donde ejecutes | Carpeta Programas |
| Datos guardados | Misma ubicación | Misma ubicación |

## 🧪 Pruebas

Por favor, prueba la versión portable y reporta cualquier problema en los [Issues](https://github.com/carlosdt1996/gclauncher/issues).

## 📚 Más Información

- [Versión Instalable](https://github.com/carlosdt1996/gclauncher/releases/tag/v1.0.0)
- [Guía de Instalación](./INSTALACION_USUARIO.md)
- [Guía de Pruebas](./TEST_INSTALADOR.md)

---

**¡Disfruta de GC Game Launcher!** 🎮
```

### Paso 3: Sube el Archivo

1. En la sección "Attach binaries", haz clic en "selecting them"
2. Navega a: `gclauncher/dist-build/`
3. Selecciona: `GC Game Launcher 1.0.0.exe`
4. Arrastra y suelta el archivo o haz clic para seleccionarlo

### Paso 4: Publica el Release

1. Marca "Set as the latest release" si quieres que sea la versión más reciente
2. Haz clic en "Publish release"

## Verificación

Después de publicar, verifica que:
- ✅ El archivo está disponible para descarga
- ✅ El tamaño del archivo es correcto (~80 MB)
- ✅ El enlace de descarga funciona
- ✅ Puedes descargar el archivo desde otro dispositivo

## Enlaces Útiles

- **Release**: https://github.com/carlosdt1996/gclauncher/releases/tag/v1.0.0-portable
- **Descarga directa**: (se generará automáticamente después de publicar)

---

**Nota**: El tag `v1.0.0-portable` ya está creado y subido al repositorio. Solo necesitas crear el release desde la interfaz web de GitHub.

