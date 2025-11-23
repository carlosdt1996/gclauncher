# Guía de Distribución - GC Game Launcher

## Para Desarrolladores

### Crear el Instalador para Distribución

1. **Generar el Instalador**
   ```bash
   npm run build:win
   ```

2. **Ubicación del Instalador**
   - El archivo se generará en: `dist-build/GC Game Launcher Setup 1.0.0.exe`
   - Tamaño aproximado: 100-200 MB (dependiendo de las dependencias)

### Opciones de Distribución

#### Opción 1: Compartir Directamente
- Sube el archivo `.exe` a un servicio de almacenamiento en la nube:
  - Google Drive
  - Dropbox
  - OneDrive
  - Mega
  - MediaFire
- Comparte el enlace de descarga con los usuarios

#### Opción 2: GitHub Releases (Recomendado)
1. Ve a tu repositorio en GitHub
2. Crea un nuevo Release:
   - Tag: `v1.0.0`
   - Título: `GC Game Launcher v1.0.0`
   - Descripción: Incluye las características principales
3. Sube el archivo `GC Game Launcher Setup 1.0.0.exe` como asset
4. Los usuarios pueden descargarlo desde la página de Releases

#### Opción 3: Sitio Web Propio
- Crea una página de descarga en tu sitio web
- Proporciona el enlace directo al instalador
- Incluye instrucciones de instalación

#### Opción 4: Plataformas de Distribución
- **Itch.io**: Para distribución de software indie
- **SourceForge**: Plataforma tradicional de código abierto
- **Fosshub**: Para software libre y de código abierto

### Información a Incluir con el Instalador

1. **Archivo README o INSTRUCCIONES.txt** con:
   - Requisitos del sistema
   - Pasos de instalación básicos
   - Información de contacto para soporte

2. **Changelog** (opcional):
   - Lista de características
   - Versión actual
   - Notas de la versión

### Firma Digital (Opcional pero Recomendado)

Para evitar advertencias de Windows Defender:
- Obtén un certificado de firma de código (Code Signing Certificate)
- Firma el instalador antes de distribuirlo
- Costo aproximado: $200-400 USD/año

**Alternativa gratuita**: Los usuarios pueden hacer clic en "Ejecutar de todas formas" cuando aparezca la advertencia.

### Verificación del Instalador

Antes de distribuir, verifica que:
- [ ] El instalador se ejecuta correctamente
- [ ] La aplicación se instala en la ubicación correcta
- [ ] Los accesos directos se crean correctamente
- [ ] La aplicación se abre después de la instalación
- [ ] Todos los archivos necesarios están incluidos
- [ ] El desinstalador funciona correctamente

### Actualizaciones Futuras

Para nuevas versiones:
1. Actualiza la versión en `package.json`
2. Genera el nuevo instalador
3. Distribuye con el nuevo número de versión
4. Informa a los usuarios sobre la actualización

### Tamaño del Instalador

El instalador incluye:
- Electron runtime (~100 MB)
- Node.js runtime
- Todas las dependencias de la aplicación
- Binarios de 7z
- Assets y recursos

**Tamaño total**: Aproximadamente 150-200 MB

### Notas de Seguridad

- El instalador no requiere permisos de administrador por defecto
- Los datos del usuario se almacenan localmente
- No se recopila información personal
- La aplicación no requiere conexión a internet (excepto para funcionalidades opcionales como SteamGridDB)

