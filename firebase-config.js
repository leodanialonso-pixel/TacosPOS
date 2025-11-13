// firebase-config.js
// Configuración de Firebase para TacoPOS
// Esta configuración se hace disponible globalmente para el HTML

const firebaseConfig = {
  apiKey: "AIzaSyAtFgcMzZeWp3MWjhjf1WvNfnC4IWez2eI",
  authDomain: "tacospos.firebaseapp.com",
  databaseURL: "https://tacospos-default-rtdb.firebaseio.com",
  projectId: "tacospos",
  storageBucket: "tacospos.firebasestorage.app",
  messagingSenderId: "95530586237",
  appId: "1:95530586237:web:bb6d6a52551c67b21da114",
  measurementId: "G-V3YTD5K9WN"
};

// Exportar la configuración para uso en el HTML
window.firebaseConfig = firebaseConfig;

// Para debugging
console.log('Firebase Config cargado:', firebaseConfig);