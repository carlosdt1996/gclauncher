# Instalador de WireGuard

Este directorio debe contener el instalador MSI de WireGuard para Windows.

## Cómo obtener el instalador MSI

1. Visita la página oficial de descarga de WireGuard: https://www.wireguard.com/install/
2. Descarga el instalador MSI para Windows (archivo `.msi`)
   - Nota: Necesitas el instalador MSI, no el EXE
   - El MSI permite instalación completamente silenciosa con msiexec
3. Renombra el archivo descargado a `wireguard-installer.msi`
4. Coloca el archivo en este directorio: `build/wireguard/wireguard-installer.msi`

## Notas importantes

- El instalador debe ser la versión más reciente de WireGuard para Windows
- El archivo debe llamarse exactamente `wireguard-installer.msi` (extensión .msi)
- El instalador se ejecutará automáticamente durante la instalación de GC Game Launcher
- La instalación se realizará en modo completamente silencioso usando `msiexec /quiet /norestart`
- Si WireGuard ya está instalado en el sistema, se omitirá la instalación automática

## Verificación

Para verificar que el instalador está en el lugar correcto:

```bash
# En Windows PowerShell
Test-Path "build\wireguard\wireguard-installer.msi"
```

Debe devolver `True` si el archivo está presente.


