#!/bin/bash
# setup.sh - Script de configuración automática para TacoPOS

echo "🌮 TacoPOS - Setup de Firebase"
echo "================================"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instálalo desde: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está disponible"
    exit 1
fi

echo "✅ npm encontrado: $(npm --version)"

# Instalar Firebase CLI
echo "📦 Instalando Firebase CLI..."
npm install -g firebase-tools

# Verificar instalación de Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ Error al instalar Firebase CLI"
    exit 1
fi

echo "✅ Firebase CLI instalado: $(firebase --version)"

# Login a Firebase
echo "🔑 Iniciando sesión en Firebase..."
firebase login

# Inicializar proyecto
echo "🚀 Inicializando proyecto Firebase..."
echo "Selecciona:"
echo "- Firestore: Database"  
echo "- Hosting: Hosting"
echo "- Usar proyecto existente"
echo "- Directorio public: . (punto)"

firebase init

echo "✅ Setup completado!"
echo ""
echo "Próximos pasos:"
echo "1. Actualiza firebase-config.js con tu configuración"
echo "2. Ejecuta: firebase serve (para desarrollo local)"
echo "3. Ejecuta: firebase deploy (para desplegar)"