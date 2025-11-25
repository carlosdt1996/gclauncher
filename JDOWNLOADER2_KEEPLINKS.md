# JDownloader2 Embebido para Keeplinks

Este módulo integra JDownloader2 embebido en el launcher para manejar descargas de keeplinks.org automáticamente.

## Características

- ✅ Extracción automática de enlaces de keeplinks.org
- ✅ Integración con JDownloader2 (portable o instalado)
- ✅ Detección automática de JDownloader2
- ✅ Añadir enlaces automáticamente (vía clipboard o API)
- ✅ Monitoreo de progreso de descargas

## Uso

### 1. Extraer enlaces de Keeplinks

```javascript
// Desde el frontend (React)
const result = await window.electronAPI.keeplinksExtractLinks('https://www.keeplinks.org/p16/XXXXX');

if (result.success) {
    const links = result.data;
    // links es un array de objetos con:
    // - host: nombre del host (Rapidgator, DDownload, etc.)
    // - url: URL del enlace
    // - filename: nombre del archivo (si se detecta)
    // - size: tamaño del archivo (si se detecta)
}
```

### 2. Detectar tipo de enlace

```javascript
const result = await window.electronAPI.keeplinksDetectLinkType(url);
// Retorna: { type: 'keeplinks'|'unknown', url: string }
```

### 3. Usar JDownloader2

#### Verificar instalación

```javascript
const result = await window.electronAPI.jd2FindInstallation();
if (result.found) {
    console.log('JDownloader2 encontrado en:', result.path);
}
```

#### Iniciar JDownloader2

```javascript
// Iniciar en modo headless (sin interfaz)
await window.electronAPI.jd2Start(true);

// O iniciar con interfaz
await window.electronAPI.jd2Start(false);
```

#### Añadir enlaces a JDownloader2

```javascript
// Añadir enlaces extraídos de filecrypt
const links = ['https://rapidgator.net/file/...', 'https://ddownload.com/file/...'];
await window.electronAPI.jd2AddLinks(links, 'Nombre del Juego');

// O añadir un enlace de filecrypt directamente
await window.electronAPI.jd2AddLinks(['https://filecrypt.cc/Container/XXXXX.html'], 'Nombre del Juego');
```

#### Monitorear progreso

```javascript
const progress = await window.electronAPI.jd2GetDownloadProgress();
console.log('Descargas activas:', progress.active);
console.log('Descargas completadas:', progress.finished);
```

#### Controlar descargas

```javascript
// Iniciar descargas
await window.electronAPI.jd2StartDownloads();

// Pausar descargas
await window.electronAPI.jd2PauseDownloads();

// Detener descargas
await window.electronAPI.jd2StopDownloads();
```

## Flujo completo de ejemplo

```javascript
// 1. Extraer enlaces de keeplinks
const extractResult = await window.electronAPI.keeplinksExtractLinks(keeplinksUrl);
if (!extractResult.success) {
    console.error('Error:', extractResult.error);
    return;
}

// 2. Verificar/Iniciar JDownloader2
const installResult = await window.electronAPI.jd2FindInstallation();
if (!installResult.found) {
    console.error('JDownloader2 no encontrado');
    return;
}

const isRunning = await window.electronAPI.jd2IsRunning();
if (!isRunning.isRunning) {
    await window.electronAPI.jd2Start(true);
}

// 3. Añadir enlaces
const links = extractResult.data.map(link => link.url);
await window.electronAPI.jd2AddLinks(links, 'Mi Juego');

// 4. Iniciar descargas
await window.electronAPI.jd2StartDownloads();

// 5. Monitorear progreso (en un intervalo)
setInterval(async () => {
    const progress = await window.electronAPI.jd2GetDownloadProgress();
    console.log(`Progreso: ${progress.active} activas, ${progress.finished} completadas`);
}, 5000);
```

## Requisitos

1. **JDownloader2**: Debe estar instalado o disponible como portable
   - Rutas de búsqueda:
     - `electron/jdownloader2/JDownloader2.exe` (portable)
     - `%LOCALAPPDATA%/JDownloader2/JDownloader2.exe`
     - `C:\Program Files\JDownloader2\JDownloader2.exe`
     - `C:\Program Files (x86)\JDownloader2\JDownloader2.exe`

2. **Configuración de JDownloader2**:
   - Habilitar monitoreo de clipboard (por defecto está activado)
   - O configurar API local (opcional, más avanzado)

## Notas

- El método de clipboard es el más confiable y no requiere configuración adicional
- JDownloader2 detecta automáticamente los enlaces copiados al portapapeles
- Los enlaces de keeplinks se resuelven automáticamente por JDownloader2
- El scraper de keeplinks extrae los enlaces directos cuando es posible

## Solución de problemas

### JDownloader2 no se inicia
- Verifica que JDownloader2 esté instalado correctamente
- Intenta iniciarlo manualmente primero
- Revisa los permisos de ejecución

### Los enlaces no se añaden
- Verifica que JDownloader2 esté ejecutándose
- Asegúrate de que el monitoreo de clipboard esté habilitado
- Revisa los logs en la consola

### Keeplinks no extrae enlaces
- Verifica que la URL sea válida
- Algunos enlaces pueden estar protegidos con contraseña
- Revisa que la página de keeplinks esté accesible

