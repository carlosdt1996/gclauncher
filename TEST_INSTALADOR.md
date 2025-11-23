# Guía de Pruebas del Instalador

## Checklist de Pruebas

### Antes de la Instalación

- [ ] Verificar que el archivo `GC Game Launcher Setup 1.0.0.exe` existe
- [ ] Verificar el tamaño del archivo (debe ser aproximadamente 150-200 MB)
- [ ] Verificar que no hay errores de antivirus (falsos positivos son comunes)

### Durante la Instalación

- [ ] El instalador se abre correctamente
- [ ] El icono de la aplicación se muestra correctamente
- [ ] El asistente de instalación muestra todos los pasos
- [ ] Se puede elegir una carpeta de instalación personalizada
- [ ] Las opciones de accesos directos funcionan (escritorio y menú inicio)
- [ ] La instalación se completa sin errores
- [ ] La aplicación se abre automáticamente al finalizar

### Después de la Instalación

- [ ] La aplicación se encuentra en: `C:\Users\[Usuario]\AppData\Local\Programs\GC Game Launcher\`
- [ ] Existe un acceso directo en el escritorio (si se seleccionó)
- [ ] Existe un acceso directo en el menú inicio (si se seleccionó)
- [ ] La aplicación se abre correctamente desde el acceso directo
- [ ] La aplicación se abre correctamente desde el menú inicio
- [ ] La aplicación se abre correctamente desde el ejecutable directo

### Funcionalidad de la Aplicación

- [ ] La aplicación inicia sin errores
- [ ] La interfaz se muestra correctamente
- [ ] Los juegos de Steam se detectan (si Steam está instalado)
- [ ] Se puede navegar con el teclado
- [ ] Se puede navegar con un controlador/gamepad (si está conectado)
- [ ] Los temas funcionan correctamente (Dark y Switch)
- [ ] La configuración se guarda correctamente
- [ ] Los datos se guardan en: `C:\Users\[Usuario]\AppData\Roaming\gclauncher\`

### Desinstalación

- [ ] El desinstalador está disponible en "Configuración" → "Aplicaciones"
- [ ] El desinstalador funciona correctamente
- [ ] Los archivos de la aplicación se eliminan
- [ ] Los accesos directos se eliminan
- [ ] Los datos del usuario se mantienen (o se eliminan según configuración)

### Pruebas en Diferentes Sistemas

#### Windows 10
- [ ] Instalación exitosa
- [ ] Aplicación funciona correctamente

#### Windows 11
- [ ] Instalación exitosa
- [ ] Aplicación funciona correctamente

### Problemas Conocidos y Soluciones

#### Problema: Windows Defender SmartScreen bloquea la instalación
**Solución**: 
1. Haz clic en "Más información"
2. Haz clic en "Ejecutar de todas formas"
3. Esto es normal para aplicaciones no firmadas digitalmente

#### Problema: El icono no se muestra correctamente
**Solución**: 
- El icono debe ser de al menos 256x256 píxeles
- Si el icono no se muestra, verifica que `public/logo.png` tenga el tamaño correcto

#### Problema: La aplicación no detecta juegos de Steam
**Solución**: 
- Asegúrate de tener Steam instalado
- Inicia sesión en Steam al menos una vez
- Verifica que los juegos estén instalados

## Reporte de Pruebas

Después de completar las pruebas, documenta:

- **Sistema Operativo**: Windows 10/11
- **Arquitectura**: x64
- **Resultado**: ✅ Éxito / ❌ Fallo
- **Problemas encontrados**: (lista cualquier problema)
- **Notas adicionales**: (cualquier observación)

## Instrucciones Rápidas de Prueba

1. **Instalación Básica**:
   ```
   1. Ejecutar GC Game Launcher Setup 1.0.0.exe
   2. Seguir el asistente
   3. Verificar que la app se abre
   ```

2. **Prueba de Funcionalidad**:
   ```
   1. Abrir la aplicación
   2. Verificar que la interfaz carga
   3. Probar navegación con teclado
   4. Probar cambio de temas
   ```

3. **Prueba de Desinstalación**:
   ```
   1. Ir a Configuración → Aplicaciones
   2. Buscar "GC Game Launcher"
   3. Desinstalar
   4. Verificar que se eliminó correctamente
   ```

