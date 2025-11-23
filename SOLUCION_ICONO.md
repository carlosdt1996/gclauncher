# Solución para el Icono

## Problema

Electron-builder requiere que el icono sea de **al menos 256x256 píxeles** para Windows. Si tu icono es más pequeño, obtendrás el error:

```
⨯ image C:\CursorProjects\gclauncher\public\logo.png must be at least 256x256
```

## Soluciones

### Opción 1: Redimensionar el PNG (Más Fácil)

1. Abre `public/logo.png` en un editor de imágenes (Paint, GIMP, Photoshop, etc.)
2. Redimensiona la imagen a **256x256 píxeles** o más grande (512x512 es ideal)
3. Guarda el archivo
4. Vuelve a compilar: `npm run build:win`

### Opción 2: Crear un archivo .ico (Recomendado para Windows)

Para Windows, es mejor usar un archivo `.ico` con múltiples tamaños. Puedes:

1. **Usar una herramienta online**:
   - https://convertio.co/png-ico/
   - https://www.icoconverter.com/
   - Sube tu `logo.png` y genera un `.ico`

2. **Usar ImageMagick** (si lo tienes instalado):
   ```bash
   magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 logo.ico
   ```

3. **Usar GIMP**:
   - Abre `logo.png`
   - Exporta como `.ico`
   - Selecciona múltiples tamaños (16, 32, 48, 64, 128, 256)

### Opción 3: Configurar electron-builder para usar el icono

Una vez que tengas el icono en el tamaño correcto, actualiza `package.json`:

```json
"win": {
  "target": [...],
  "icon": "public/logo.png",  // o "public/logo.ico" si usas .ico
  ...
}
```

## Verificar el Tamaño del Icono

Puedes verificar el tamaño de tu icono actual:

**En Windows (PowerShell)**:
```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("public\logo.png")
Write-Host "Ancho: $($img.Width)px, Alto: $($img.Height)px"
$img.Dispose()
```

**O simplemente**:
- Haz clic derecho en el archivo → Propiedades → Detalles
- Busca "Dimensiones"

## Configuración Actual

Actualmente, el icono está **deshabilitado** en la configuración para evitar el error. Una vez que redimensiones tu icono a 256x256 o más, puedes descomentar estas líneas en `package.json`:

```json
"win": {
  "icon": "public/logo.png",  // Descomenta esto
  ...
},
"nsis": {
  "installerIcon": "public/logo.png",  // Descomenta esto
  "uninstallerIcon": "public/logo.png",  // Descomenta esto
  ...
}
```

## Tamaños Recomendados

Para mejor calidad en Windows:
- **Mínimo**: 256x256 píxeles
- **Recomendado**: 512x512 píxeles
- **Óptimo**: Archivo .ico con múltiples tamaños (16, 32, 48, 64, 128, 256, 512)

## Nota

Si no configuras el icono, electron-builder usará el icono por defecto de Electron (que es lo que está pasando ahora).


