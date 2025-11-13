# TacoPOS - Configuración de Firebase

Este proyecto requiere Firebase para funcionar correctamente. Sigue estos pasos para configurar Firebase y desplegar tu aplicación.

## Requisitos Previos

1. **Instalar Node.js** (si no lo tienes instalado):
   - Descargar desde: https://nodejs.org/
   - Verificar instalación: `node --version`

2. **Instalar Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

3. **Verificar instalación de Firebase CLI**:
   ```bash
   firebase --version
   ```

## Configuración del Proyecto Firebase

### 1. Crear un proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto" o "Create project"
3. Nombra tu proyecto (ej: `tacos-pos`)
4. Sigue las instrucciones para crear el proyecto

### 2. Habilitar Firestore Database

1. En tu proyecto de Firebase, ve a "Firestore Database"
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba" (temporal)
4. Elige una ubicación cercana para tu base de datos

### 3. Habilitar Authentication

1. Ve a "Authentication" en el panel lateral
2. Haz clic en la pestaña "Sign-in method"
3. Habilita "Anonymous" authentication

### 4. Configurar Web App

1. En "Project Overview", haz clic en el icono de web (`</>`)
2. Registra tu app con un nickname (ej: `tacos-pos-web`)
3. Copia la configuración que te proporcione Firebase
4. Pega esa configuración en el archivo `firebase-config.js`, reemplazando los valores de ejemplo

### 5. Inicializar Firebase en tu proyecto local

```bash
# Navegar a tu directorio del proyecto
cd /home/danialonso/Escritorio/TacosPOS

# Iniciar sesión en Firebase
firebase login

# Inicializar el proyecto (selecciona Firestore y Hosting)
firebase init

# Seleccionar proyecto existente (el que creaste en paso 1)
# Para Firestore: usar archivos por defecto
# Para Hosting: seleccionar directorio actual (.)
```

## Estructura de Archivos Creados

- `firebase.json` - Configuración principal de Firebase
- `firestore.rules` - Reglas de seguridad de Firestore  
- `firestore.indexes.json` - Índices de Firestore
- `firebase-config.js` - Configuración de tu proyecto (ACTUALIZAR CON TUS DATOS)

## Despliegue

### Desarrollo Local
```bash
# Servir localmente
firebase serve
```

### Despliegue a Producción
```bash
# Desplegar a Firebase Hosting
firebase deploy
```

## Configuración de Seguridad

Las reglas actuales en `firestore.rules` permiten acceso a usuarios autenticados. Para producción, considera:

1. Restringir acceso por usuario específico
2. Validar estructura de datos
3. Limitar operaciones de escritura

## URLs Importantes

- **Firebase Console**: https://console.firebase.google.com/
- **Documentación**: https://firebase.google.com/docs/
- **Firestore Docs**: https://firebase.google.com/docs/firestore/

## Solución de Problemas

1. **Error de autenticación**: Verifica que Anonymous auth esté habilitado
2. **Error de permisos**: Revisa las reglas en `firestore.rules`
3. **Config no encontrada**: Asegúrate de actualizar `firebase-config.js` con tus datos reales

## Próximos Pasos

1. Actualizar `firebase-config.js` con tu configuración real
2. Ejecutar `firebase init` para conectar con tu proyecto
3. Probar localmente con `firebase serve`
4. Desplegar con `firebase deploy`