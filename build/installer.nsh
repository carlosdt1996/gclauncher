; Script de instalación personalizado para GC Game Launcher

; Establecer el directorio de instalación por defecto a Program Files (64-bit)
!macro customInit
  ; Establecer el directorio de instalación por defecto
  ${If} ${RunningX64}
    StrCpy $INSTDIR "$PROGRAMFILES64\GCLauncher"
  ${Else}
    StrCpy $INSTDIR "$PROGRAMFILES\GCLauncher"
  ${EndIf}
!macroend

!macro customInstall
  ; Instalar WireGuard si no está ya instalado
  ; Verificar si WireGuard ya está instalado buscando en el registro
  StrCpy $0 ""
  ReadRegStr $0 HKLM "SOFTWARE\WireGuard" "InstallationPath"
  ${If} $0 == ""
    ; Intentar otra ubicación del registro
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\WireGuard" "InstallationPath"
  ${EndIf}
  
  ${If} $0 == ""
    ; WireGuard no está instalado, proceder con la instalación
    DetailPrint "Instalando WireGuard..."
    
    ; Incluir el instalador MSI de WireGuard en el instalador NSIS
    ; El archivo debe estar en build/wireguard/wireguard-installer.msi
    ; Usar BUILD_RESOURCES_DIR que está definido por electron-builder
    ClearErrors
    File /oname=$PLUGINSDIR\wireguard-installer.msi "${BUILD_RESOURCES_DIR}\wireguard\wireguard-installer.msi"
    
    ; Verificar si hubo errores al copiar el archivo
    IfErrors WireGuardNotFound
    
    ; Verificar que el archivo se copió correctamente
    IfFileExists "$PLUGINSDIR\wireguard-installer.msi" 0 WireGuardNotFound
      DetailPrint "Ejecutando instalador MSI de WireGuard..."
      
      ; Cerrar WireGuard si está ejecutándose (opcional, con manejo de errores)
      ClearErrors
      ExecWait 'taskkill /F /IM wireguard.exe /T' $1
      ; Ignorar errores si wireguard.exe no está corriendo
      
      ; Ejecutar instalador MSI de WireGuard usando msiexec en modo completamente silencioso
      ; /i = instalar
      ; /qn = quiet mode sin UI (completamente silencioso)
      ; /norestart = no reiniciar el sistema
      ; REBOOT=ReallySuppress = suprimir reinicio
      ; /L*V = logging completo para debug (opcional, puede comentarse para silencio total)
      ExecWait 'msiexec /i "$PLUGINSDIR\wireguard-installer.msi" /qn /norestart REBOOT=ReallySuppress /L*V "$TEMP\wireguard-install.log"' $0
      
      ${If} $0 == 0
        DetailPrint "WireGuard instalado correctamente."
      ${Else}
        DetailPrint "Error: La instalación de WireGuard falló con código de error $0"
        DetailPrint "Ver log en: $TEMP\wireguard-install.log"
        DetailPrint "Códigos comunes: 1603 (error fatal), 3010 (requiere reinicio)"
      ${EndIf}
      Goto WireGuardInstallEnd
    WireGuardNotFound:
      DetailPrint "Error: No se encontró el instalador MSI de WireGuard."
      DetailPrint "Ruta esperada: ${BUILD_RESOURCES_DIR}\wireguard\wireguard-installer.msi"
    WireGuardInstallEnd:
  ${Else}
    DetailPrint "WireGuard ya está instalado. Omitiendo instalación."
  ${EndIf}
!macroend

!macro customUnInstall
  ; Aquí puedes agregar acciones personalizadas durante la desinstalación
  ; Por ejemplo, limpiar archivos temporales o configuraciones
  ; NOTA: No desinstalamos WireGuard automáticamente ya que puede ser usado por otros programas
!macroend
