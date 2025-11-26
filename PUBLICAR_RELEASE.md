# Cómo Publicar una Nueva Release para Actualizaciones Automáticas

Para que el sistema de actualizaciones automáticas funcione, necesitas publicar releases en GitHub con los archivos correctos.

## Pasos para Publicar una Nueva Release

### 1. Compilar la aplicación

```bash
npm run build:win
```

Esto generará:
- `dist-build/gclauncher-setup-{version}.exe` - El instalador
- `dist-build/latest.yml` - El archivo de metadatos para actualizaciones

### 2. Crear una Release en GitHub

1. Ve a: https://github.com/carlosdt1996/gclauncher/releases/new
2. Crea un nuevo tag (ej: `v1.0.2`)
3. Título: `GC Game Launcher v1.0.2` (o la versión correspondiente)
4. Descripción: Agrega las notas de la versión (release notes)

### 3. Subir los archivos necesarios

**IMPORTANTE**: Debes subir estos archivos a la release:

- ✅ `gclauncher-setup-{version}.exe` - El instalador principal
- ✅ `latest.yml` - El archivo de metadatos (necesario para que funcione el auto-updater)

### 4. Publicar la Release

1. Haz clic en "Publish release"
2. La release estará disponible en: https://github.com/carlosdt1996/gclauncher/releases

## Cómo Funciona el Sistema de Actualizaciones

1. **Al iniciar la app**: Verifica automáticamente si hay una nueva versión (5 segundos después del inicio)
2. **Verificación periódica**: Verifica cada 4 horas si hay actualizaciones
3. **Detección**: Compara la versión actual con la última release en GitHub
4. **Notificación**: Si hay una nueva versión, muestra un modal preguntando si quieres actualizar
5. **Descarga e instalación**: El usuario puede descargar e instalar la actualización desde la UI

## Estructura de Archivos en la Release

```
Release v1.0.2
├── gclauncher-setup-1.0.2.exe  (Instalador)
└── latest.yml                   (Metadatos - generado por electron-builder)
```

## Notas Importantes

- ⚠️ **Siempre incluye `latest.yml`** en cada release, sin esto el auto-updater no funcionará
- ⚠️ El nombre del tag debe seguir el formato `v{version}` (ej: `v1.0.2`)
- ⚠️ La versión en `package.json` debe coincidir con la versión de la release
- ⚠️ El archivo `latest.yml` se genera automáticamente en `dist-build/` después de compilar

## Automatización (Opcional)

Puedes automatizar esto con GitHub Actions para que se publique automáticamente cuando hagas push a main con un tag de versión.

