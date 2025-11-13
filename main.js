import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setLogLevel,
    where,
    updateDoc,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Establecer nivel de log para depuración de Firestore
setLogLevel('Debug');

// Variables Globales
const appId = 'tacos-pos-app';
const firebaseConfig = window.firebaseConfig; // Desde firebase-config.js
const initialAuthToken = null; // Para autenticación anónima

let db;
let auth;
let userId = null;
let userEmail = null;
let currentDate = null;
let isAuthReady = false;
let isPaying = false; // Flag para evitar doble pago
let isRegistering = false; // Flag para alternar entre login y registro

// --- Estado de la Aplicación de Cuentas ---
let activeOrderId = null; // ID de la orden actualmente seleccionada/en edición
let currentOrderItems = []; // Items del pedido actual (se carga desde Firestore o es nuevo)

// Referencias del DOM
const loadingOverlay = document.getElementById('loading-overlay');
const appContainer = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const userEmailSpan = document.getElementById('user-email');
const currentDateSpan = document.getElementById('current-date');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const registerToggle = document.getElementById('register-toggle');
const authMessageDiv = document.getElementById('auth-message');
const changeDateBtn = document.getElementById('change-date-btn');

// Referencias de Cuentas/Pedidos
const openOrdersList = document.getElementById('open-orders-list');
const orderTitleSpan = document.getElementById('order-title');
const orderTotalSpan = document.getElementById('order-total');
const currentOrderItemsDiv = document.getElementById('current-order-items');
const emptyOrderMessage = document.getElementById('empty-order-message');
const paymentMethodSelect = document.getElementById('payment-method');
const orderMessageDiv = document.getElementById('order-message');
const payButton = document.getElementById('pay-button');

// Referencias de Gastos
const formGasto = document.getElementById('form-gasto');
const gastosList = document.getElementById('gastos-list');
const gastoMessageDiv = document.getElementById('gasto-message');

// Referencias de Reportes
const historialCompleto = document.getElementById('historial-completo');
const totalVentasSpan = document.getElementById('total-ventas');
const totalGastosSpan = document.getElementById('total-gastos');
const gananciaNetaSpan = document.getElementById('ganancia-neta');
const ventasEfectivoSpan = document.getElementById('ventas-efectivo');
const ventasTarjetaSpan = document.getElementById('ventas-tarjeta');

// --- Funciones de Utilidad ---
function getCurrentDate() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showAuthMessage(message, isSuccess = true) {
    authMessageDiv.textContent = message;
    authMessageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
    authMessageDiv.classList.add(isSuccess ? 'bg-green-100' : 'bg-red-100', isSuccess ? 'text-green-700' : 'text-red-700');
    setTimeout(() => authMessageDiv.classList.add('hidden'), 5000);
}

function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}

function formatCurrency(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num === null) return "$0.00";
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(timestamp) {
    if (!timestamp) return 'Fecha desconocida';
    // Manejar tanto el formato Timestamp de Firestore como Date.now()
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showMessage(elementId, message, isSuccess = true) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
    el.classList.add(isSuccess ? 'bg-green-100' : 'bg-red-100', isSuccess ? 'text-green-700' : 'text-red-700');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// --- Funciones de Autenticación ---
async function handleLogin(email, password) {
    try {
        loginBtn.textContent = "Iniciando sesión...";
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login exitoso:", userCredential.user.email);
    } catch (error) {
        console.error("❌ Error en login:", error);
        let mensaje = "Ocurrió un error. Intenta de nuevo.";
        // Mensajes claros para el usuario
        if (
            error.code === 'auth/user-not-found' ||
            error.code === 'auth/wrong-password' ||
            error.code === 'auth/invalid-credential' ||
            error.message?.toLowerCase().includes('password') ||
            error.message?.toLowerCase().includes('contraseña')
        ) {
            mensaje = "Email o contraseña incorrectos.";
        } else if (error.code === 'auth/invalid-email') {
            mensaje = "El email ingresado no es válido.";
        } else if (error.code === 'auth/too-many-requests') {
            mensaje = "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.";
        } else if (error.code === 'auth/network-request-failed') {
            mensaje = "No se pudo conectar. Verifica tu conexión a internet.";
        } else if (error.code === 'auth/internal-error') {
            mensaje = "Error interno. Intenta de nuevo más tarde.";
        }
        showAuthMessage(mensaje, false);
    } finally {
        loginBtn.textContent = "Iniciar Sesión";
    }
}

console.log(document.getElementById('loading-overlay'));
// autenticacion de google

// --- Función de Autenticación con Google ---
// --- Función de Autenticación con Google ---
async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log('✅ Google login exitoso:', user.email);
        showAuthMessage(`✅ Bienvenido, ${user.displayName || user.email}`, true);
        // El onAuthStateChanged global ya maneja la transición UI → App
    } catch (error) {
        console.error('❌ Error en Google Sign-In:', error);
        let msg = 'Error al iniciar sesión con Google.';
        if (error.code === 'auth/popup-blocked') {
            msg = 'Popup bloqueado. Desbloquea y vuelve a intentar.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            msg = 'Inicio de sesión cancelado por el usuario.';
        } else if (error.code === 'auth/network-request-failed') {
            msg = 'Sin conexión. Verifica tu red.';
        } else if (error.code === 'auth/operation-not-allowed') {
            msg = 'Inicio con Google no permitido. Revisa Firebase Console > Authentication > Métodos de acceso.';
        }
        showAuthMessage(msg, false);
    }
}


async function handleRegister(email, password) {
    try {
        loginBtn.textContent = "Registrando...";
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("✅ Registro exitoso:", userCredential.user.email);
        showAuthMessage("¡Taquería registrada exitosamente!", true);
    } catch (error) {
        console.error("❌ Error en registro:", error);
        if (error.code === 'auth/email-already-in-use') {
            showAuthMessage("Este email ya está registrado. Inicia sesión en su lugar.", false);
        } else if (error.code === 'auth/weak-password') {
            showAuthMessage("La contraseña debe tener al menos 6 caracteres", false);
        } else {
            showAuthMessage(`Error: ${error.message}`, false);
        }
    } finally {
        loginBtn.textContent = isRegistering ? "Registrar Taquería" : "Iniciar Sesión";
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("👋 Sesión cerrada");
    } catch (error) {
        console.error("❌ Error al cerrar sesión:", error);
    }
}

function toggleRegisterMode() {
    isRegistering = !isRegistering;
    if (isRegistering) {
        loginBtn.textContent = "Registrar Taquería";
        registerToggle.textContent = "¿Ya tienes cuenta? Iniciar sesión";
        document.querySelector('h2').textContent = "🌮 Registrar Nueva Taquería";
    } else {
        loginBtn.textContent = "Iniciar Sesión";
        registerToggle.textContent = "¿Primera vez? Registrar nueva taquería";
        document.querySelector('h2').textContent = "🌮 TacoPOS";
    }
}

function changeWorkingDate() {
    const newDate = prompt("Introduce la fecha de corte (YYYY-MM-DD):", currentDate);
    if (newDate && newDate !== currentDate) {
        // Validar formato de fecha
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(newDate)) {
            alert("Formato de fecha inválido. Usa YYYY-MM-DD");
            return;
        }

        const oldDate = currentDate;
        currentDate = newDate;
        currentDateSpan.textContent = formatDateForDisplay(currentDate);

        console.log(`📅 Fecha de corte cambiada de ${oldDate} a ${currentDate}`);

        // Reiniciar listeners con la nueva fecha
        setupRealtimeListeners();

        // Limpiar estado actual
        activeOrderId = null;
        currentOrderItems = [];
        orderTitleSpan.textContent = '-- Seleccione o Cree --';
        renderCurrentOrder();

        showMessage('order-message', `Corte cambiado a: ${formatDateForDisplay(currentDate)}`, true);
    }
}

// --- Inicialización y Autenticación de Firebase ---
console.log("🔧 Inicializando Firebase...");
console.log("⚙️ Configuración cargada:", !!firebaseConfig);
console.log("📋 Project ID:", firebaseConfig?.projectId);

if (firebaseConfig) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("✅ Firebase inicializado correctamente");
        console.log("🔥 Firestore:", !!db);
        console.log("🔐 Auth:", !!auth);
    } catch (error) {
        console.error("❌ Error al inicializar Firebase:", error);
    }

    onAuthStateChanged(auth, async (user) => {
        console.log("🔐 Estado de autenticación cambió:", user ? "Usuario autenticado" : "Usuario no autenticado");

        if (user) {
            userId = user.uid;
            userEmail = user.email || 'Usuario Anónimo';
            currentDate = getCurrentDate();
            isAuthReady = true;

            console.log("✅ Firebase Auth listo:");
            console.log("👤 User ID:", userId);
            console.log("� Email:", userEmail);
            console.log("📅 Fecha actual:", currentDate);
            console.log("📂 Ruta de ejemplo:", getCollectionPath('orders'));

            // Actualizar UI
            userEmailSpan.textContent = userEmail;
            currentDateSpan.textContent = formatDateForDisplay(currentDate);

            // Mostrar aplicación principal
            loadingOverlay.classList.add('hidden');
            loginScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');

            // Iniciar listeners de datos
            setupRealtimeListeners();
        } else {
            console.log("🔑 Usuario no autenticado - mostrar login");

            // Mostrar pantalla de login
            loadingOverlay.classList.add('hidden');
            appContainer.classList.add('hidden');
            loginScreen.classList.remove('hidden');

            // Reset variables
            userId = null;
            userEmail = null;
            currentDate = null;
            isAuthReady = false;
        }
    });
} else {
    console.error("Configuración de Firebase no disponible.");
    loadingOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

// --- Rutas de Colección ---
function getCollectionPath(collectionName) {
    // Estructura con corte diario: users/{userId}/dates/{date}/{collectionName}
    if (userId && currentDate) {
        return `users/${userId}/dates/${currentDate}/${collectionName}`;
    }
    return null;
}

// --- Lógica de Pedido Activo ---
// Eliminar item individual de la cuenta activa
window.removeItemFromOrder = async (itemIndex) => {
    if (!activeOrderId || itemIndex < 0 || itemIndex >= currentOrderItems.length) {
        showMessage('order-message', 'No se puede eliminar el item.', false);
        return;
    }
    const item = currentOrderItems[itemIndex];
    const confirmMsg = `¿Seguro que deseas eliminar "${item.name}" de la cuenta?`;
    if (!confirm(confirmMsg)) {
        return;
    }
    const removed = currentOrderItems.splice(itemIndex, 1);
    try {
        await updateDoc(doc(db, getCollectionPath('orders'), activeOrderId), {
            items: JSON.parse(JSON.stringify(currentOrderItems)),
            total: calculateTotal(currentOrderItems),
            updatedAt: serverTimestamp()
        });
        renderCurrentOrder();
        showMessage('order-message', `Item eliminado.`, true);
    } catch (error) {
        console.error("Error al eliminar item:", error);
        showMessage('order-message', 'Error al eliminar item en DB.', false);
        // Si falla, restaurar el item
        currentOrderItems.splice(itemIndex, 0, removed[0]);
    }
};

// Eliminar cuenta (orden) recién creada o en cualquier estado
window.deleteOrder = async (orderId) => {
    if (!orderId) {
        showMessage('order-message', 'No se puede eliminar la cuenta.', false);
        return;
    }
    if (!confirm(`¿Está seguro de eliminar la cuenta #${orderId.substring(0, 5).toUpperCase()}? Esta acción no se puede deshacer.`)) {
        return;
    }
    try {
        await deleteDoc(doc(db, getCollectionPath('orders'), orderId));
        if (activeOrderId === orderId) {
            activeOrderId = null;
            currentOrderItems = [];
            orderTitleSpan.textContent = '-- Seleccione o Cree --';
            renderCurrentOrder();
        }
        showMessage('order-message', `Cuenta eliminada con éxito.`, true);
    } catch (error) {
        console.error("Error al eliminar cuenta:", error);
        showMessage('order-message', `Error al eliminar cuenta: ${error.message}`, false);
    }
};

function renderCurrentOrder() {
    const total = calculateTotal(currentOrderItems);
    orderTotalSpan.textContent = formatCurrency(total);

    if (currentOrderItems.length === 0) {
        currentOrderItemsDiv.innerHTML = '<p id="empty-order-message" class="text-gray-400 text-center py-4">Agregue items con los botones de arriba.</p>';
        return;
    }

    // Mostrar cada item con botón de eliminar
    currentOrderItemsDiv.innerHTML = currentOrderItems.map((item, idx) => `
                <div class="flex justify-between items-center p-2 rounded-lg active-order-item group">
                    <span class="text-gray-700 font-medium">${item.name}</span>
                    <span class="font-semibold text-teal-600">${formatCurrency(item.price)}</span>
                    <button class="ml-2 text-red-500 hover:text-red-700 px-2 py-1 rounded focus:outline-none" title="Eliminar item" onclick="removeItemFromOrder(${idx})">
                        <svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'/></svg>
                    </button>
                </div>
            `).join('');
}

window.addItemToOrder = async (name, price) => {
    if (!activeOrderId) {
        showMessage('order-message', 'Por favor, abra o seleccione una cuenta primero.', false);
        return;
    }

    const newItem = { name, price, addedAt: Date.now() };
    currentOrderItems.push(newItem);

    // Actualizar Firestore
    try {
        // Se usa JSON.stringify/parse ya que Firestore tiene limitaciones con arrays anidados
        await updateDoc(doc(db, getCollectionPath('orders'), activeOrderId), {
            items: JSON.parse(JSON.stringify(currentOrderItems)), // Clonar para evitar problemas de referencia
            total: calculateTotal(currentOrderItems),
            updatedAt: serverTimestamp()
        });
        renderCurrentOrder();
    } catch (error) {
        console.error("Error al añadir item:", error);
        showMessage('order-message', 'Error al actualizar la orden en DB.', false);
        // Si falla, revertir el item en el array local
        currentOrderItems.pop();
    }
};

window.clearCurrentOrderItems = async () => {
    if (!activeOrderId) {
        showMessage('order-message', 'No hay cuenta activa para limpiar.', false);
        return;
    }

    // Usar una confirmación de UI en lugar de window.confirm()
    if (!confirm("¿Está seguro que desea limpiar todos los items de la cuenta activa?")) {
        return;
    }

    currentOrderItems = [];

    try {
        await updateDoc(doc(db, getCollectionPath('orders'), activeOrderId), {
            items: [],
            total: 0,
            updatedAt: serverTimestamp()
        });
        renderCurrentOrder();
        showMessage('order-message', 'Items de la cuenta limpiados.', true);
    } catch (error) {
        console.error("Error al limpiar items:", error);
        showMessage('order-message', 'Error al limpiar items en DB.', false);
    }
};


// --- Lógica de Cuentas (Órdenes) ---

window.createNewOrder = async () => {
    console.log("🆕 Intentando crear nueva orden...");
    console.log("📊 Estado de autenticación:", { isAuthReady, userId, dbReady: !!db });

    if (!isAuthReady) {
        console.log("❌ Base de datos no lista");
        showMessage('order-message', 'Base de datos no lista, espere por favor.', false);
        return;
    }

    const collectionPath = getCollectionPath('orders');
    console.log("📂 Ruta de colección:", collectionPath);

    // Solicitar nombre personalizado para el pedido
    let orderName = prompt("Nombre para el pedido (ejemplo: Pedido de Juan):", "");
    if (orderName === null) return; // Cancelado
    orderName = orderName.trim();
    if (!orderName) orderName = `#${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newOrder = {
        status: 'Abierta',
        items: [],
        total: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        name: orderName
    };

    console.log("📄 Documento a crear:", newOrder);

    try {
        console.log("💾 Intentando guardar en Firestore...");
        const docRef = await addDoc(collection(db, collectionPath), newOrder);
        console.log("✅ Orden creada exitosamente. ID:", docRef.id);

        // Cargar inmediatamente la nueva orden como activa
        loadOrder(docRef.id, newOrder.items || [], newOrder.total);
        showMessage('order-message', `Nueva cuenta "${orderName}" abierta.`, true);
    } catch (error) {
        console.error("❌ Error detallado al crear orden:", error);
        console.error("Código:", error.code);
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);

        showMessage('order-message', `Error: ${error.message}`, false);
    }
};

window.loadOrder = (orderId, items, total) => {
    activeOrderId = orderId;
    // Asegurarse de que los items se copien correctamente al estado local
    currentOrderItems = Array.isArray(items) ? [...items] : [];

    // Buscar el nombre en la lista de órdenes abiertas
    let orderName = `#${orderId.substring(0, 5).toUpperCase()}`;
    const tileElement = document.getElementById(`tile-${orderId}`);
    if (tileElement) {
        const nameEl = tileElement.querySelector('.order-name');
        if (nameEl) orderName = nameEl.textContent;
    }
    orderTitleSpan.textContent = `${orderName} (${formatCurrency(total)})`;
    renderCurrentOrder();

    // Resaltar la cuenta activa con color especial
    document.querySelectorAll('.order-tile').forEach(el => {
        el.classList.remove('active', 'bg-yellow-100', 'border-yellow-400');
    });
    if (tileElement) {
        tileElement.classList.add('active', 'bg-yellow-100', 'border-yellow-400');
    }

    // Toast/Notificación visual al cambiar de cuenta activa
    showMessage('order-message', `Cuenta activa cambiada: ${orderName}`, true);
};

window.payCurrentOrder = async () => {
    if (!activeOrderId || currentOrderItems.length === 0) {
        alert('No hay cuenta activa o está vacía para pagar.');
        return;
    }
    if (isPaying) return; // Evitar doble clic

    const paymentMethod = paymentMethodSelect.value;
    const totalAmount = calculateTotal(currentOrderItems);

    const confirmation = `¿Desea pagar la cuenta #${activeOrderId.substring(0, 5).toUpperCase()} por ${formatCurrency(totalAmount)} con ${paymentMethod}?`;

    if (!confirm(confirmation)) {
        return;
    }

    isPaying = true;
    payButton.textContent = "Procesando...";

    try {
        await updateDoc(doc(db, getCollectionPath('orders'), activeOrderId), {
            status: 'Pagada',
            total: totalAmount,
            method: paymentMethod,
            closedAt: serverTimestamp()
        });

        // === FIX: Actualización de UI Inmediata para Cuentas Abiertas ===
        const paidOrderId = activeOrderId;
        let paidOrderName = `#${paidOrderId ? paidOrderId.substring(0, 5).toUpperCase() : 'N/A'}`;
        // Intentar obtener el nombre personalizado desde el DOM
        const paidOrderTile = paidOrderId ? document.getElementById(`tile-${paidOrderId}`) : null;
        if (paidOrderTile) {
            const nameEl = paidOrderTile.querySelector('.order-name');
            if (nameEl && nameEl.textContent) {
                paidOrderName = nameEl.textContent;
            }
            paidOrderTile.remove(); // Eliminar visualmente la tarjeta de la lista de abiertas
        }

        // Si la lista de abiertas queda vacía, mostrar el mensaje
        if (openOrdersList.children.length === 0) {
            openOrdersList.innerHTML = '<p class="text-gray-500 text-center p-4">¡No hay cuentas abiertas! Cree una nueva para comenzar.</p>';
        }

        // Limpiar estado local después de pagar
        activeOrderId = null;
        currentOrderItems = [];
        orderTitleSpan.textContent = '-- Seleccione o Cree --';
        renderCurrentOrder();

        showMessage('order-message', `Cuenta ${paidOrderName} pagada con éxito: ${formatCurrency(totalAmount)}`, true);

    } catch (error) {
        console.error("Error al pagar cuenta:", error);
        showMessage('order-message', `Error al pagar cuenta: ${error.message}`, false);
    } finally {
        isPaying = false;
        payButton.textContent = "PAGAR CUENTA";
    }
};

window.cancelCurrentOrder = async () => {
    if (!activeOrderId) {
        showMessage('order-message', 'No hay cuenta activa para cancelar.', false);
        return;
    }

    const confirmation = `¿Está seguro de CANCELAR y eliminar la cuenta #${activeOrderId.substring(0, 5).toUpperCase()}?`;

    if (!confirm(confirmation)) {
        return;
    }

    try {
        const canceledOrderId = activeOrderId;

        // Eliminar el documento de la base de datos
        await deleteDoc(doc(db, getCollectionPath('orders'), activeOrderId));

        // === FIX: Actualización de UI Inmediata para Cuentas Abiertas (al cancelar) ===
        const canceledOrderTile = document.getElementById(`tile-${canceledOrderId}`);
        if (canceledOrderTile) {
            canceledOrderTile.remove(); // Eliminar visualmente la tarjeta de la lista de abiertas
        }

        // Si la lista de abiertas queda vacía, mostrar el mensaje
        if (openOrdersList.children.length === 0) {
            openOrdersList.innerHTML = '<p class="text-gray-500 text-center p-4">¡No hay cuentas abiertas! Cree una nueva para comenzar.</p>';
        }

        // Limpiar estado local
        activeOrderId = null;
        currentOrderItems = [];
        orderTitleSpan.textContent = '-- Seleccione o Cree --';
        renderCurrentOrder();

        showMessage('order-message', `Cuenta #${canceledOrderId.substring(0, 5).toUpperCase()} cancelada y eliminada con éxito.`, true);
    } catch (error) {
        console.error("Error al cancelar cuenta:", error);
        showMessage('order-message', `Error al cancelar cuenta: ${error.message}`, false);
    }
};

// --- Renderización de Listas (Gastos y Reportes) ---

function renderItem(item, type) {
    const isOrder = type === 'order';
    const isExpense = type === 'expense';

    let colorClass = 'border-gray-300';
    let sign = '';
    let textColor = 'text-gray-700';
    let title = 'Transacción';
    let description = '';

    if (isOrder) {
        colorClass = item.status === 'Pagada' ? 'border-teal-400' : 'border-blue-400';
        sign = item.status === 'Pagada' ? '+' : '';
        textColor = item.status === 'Pagada' ? 'text-teal-600' : 'text-blue-600';
        const orderName = item.name ? item.name : `#${item.id.substring(0, 5).toUpperCase()}`;
        title = item.status === 'Pagada' ? `Orden Pagada: <span class="order-name">${orderName}</span>` : `Cuenta Abierta: <span class="order-name">${orderName}</span>`;
        description = `${item.items.length} items.`;
        if (item.method) description += ` (${item.method})`;

    } else if (isExpense) {
        colorClass = 'border-red-400';
        sign = '-';
        textColor = 'text-red-600';
        title = 'Gasto';
        description = item.description || item.category || 'Sin descripción';
    }

    // Usar JSON.stringify para pasar el array de items de forma segura a loadOrder
    const itemsString = JSON.stringify(item.items || []).replace(/"/g, '&quot;');
    const totalAmount = item.total || item.amount;


    return `
                <div id="tile-${item.id}" class="order-tile flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border-l-4 ${colorClass} ${isOrder && item.status === 'Abierta' && item.id === activeOrderId ? 'active' : ''}"
                     ${isOrder && item.status === 'Abierta' ? `onclick="loadOrder('${item.id}', ${itemsString}, ${totalAmount})"` : ''}>
                    <div>
                        <p class="font-semibold text-gray-800">${title} (${formatDate(item.timestamp || item.createdAt || item.closedAt)})</p>
                        <p class="text-sm text-gray-500">${description}</p>
                    </div>
                    <p class="font-bold text-lg ${textColor}">
                        ${sign}${formatCurrency(totalAmount)}
                    </p>
                </div>
            `;
}

// --- Listeners de Firestore y Reportes ---

function setupRealtimeListeners() {
    if (!isAuthReady || !userId || !db) return;

    const ordersCollectionRef = collection(db, getCollectionPath('orders'));
    const expensesCollectionRef = collection(db, getCollectionPath('expenses'));

    // 1. Listener de Cuentas Abiertas (para el panel de Pedidos)
    const openOrdersQ = query(ordersCollectionRef, where('status', '==', 'Abierta'));
    onSnapshot(openOrdersQ, (snapshot) => {
        const openOrders = [];

        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const order = { ...data, id: change.doc.id, type: 'order' };

            if (change.type === "added" || change.type === "modified") {
                openOrders.push(order);
            } else if (change.type === "removed") {
                // Si se eliminó (cancelada o pagada), el código en payCurrentOrder ya se encarga de la eliminación visual inmediata.
                // Solo necesitamos re-renderizar la lista si es necesario.
                // La lógica de eliminación visual inmediata reduce la necesidad de un re-renderizado completo aquí.
                // Si se está editando una orden pagada/cancelada, la lógica de remoción del DOM es más rápida.
            }
        });

        // Re-obtener todas las órdenes abiertas desde el cache del listener para asegurar la consistencia.
        const currentOpenOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, type: 'order' }));

        // Ordenar localmente por fecha de creación (más reciente primero)
        currentOpenOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let renderedTiles = currentOpenOrders.map(data =>
            renderItem({ ...data, status: 'Abierta', timestamp: data.createdAt }, 'order')
        ).join('');

        openOrdersList.innerHTML = renderedTiles.length > 0 ? renderedTiles : '<p class="text-gray-500 text-center p-4">¡No hay cuentas abiertas! Cree una nueva para comenzar.</p>';

        // Si la orden activa ya no está en la lista de abiertas (fue pagada o cancelada), limpiar la vista de pedido activo
        if (activeOrderId && !currentOpenOrders.some(order => order.id === activeOrderId)) {
            activeOrderId = null;
            currentOrderItems = [];
            orderTitleSpan.textContent = '-- Seleccione o Cree --';
            renderCurrentOrder();
        }

        // Si hay una orden activa, asegurarse de que se mantenga resaltada
        if (activeOrderId) {
            const tileElement = document.getElementById(`tile-${activeOrderId}`);
            if (tileElement) {
                tileElement.classList.add('active');
            }
        }

    }, (error) => { console.error("Error al escuchar cuentas abiertas:", error); });


    // 2. Listener de Órdenes Pagadas (para Reportes)
    const paidOrdersQ = query(ordersCollectionRef, where('status', '==', 'Pagada'));
    onSnapshot(paidOrdersQ, (snapshot) => {
        let totalVentas = 0;
        let ventasEfectivo = 0;
        let ventasTarjeta = 0;
        const allPaidOrders = [];

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            allPaidOrders.push({ ...data, id: doc.id, type: 'order', timestamp: data.closedAt, amount: data.total });
            totalVentas += data.total;
            if (data.method === 'Efectivo') {
                ventasEfectivo += data.total;
            } else if (data.method === 'Tarjeta') {
                ventasTarjeta += data.total;
            }
        });

        // Ordenar localmente por fecha de cierre (más reciente primero)
        allPaidOrders.sort((a, b) => (b.closedAt?.seconds || 0) - (a.closedAt?.seconds || 0));

        // Actualizar UI de Reportes
        totalVentasSpan.textContent = formatCurrency(totalVentas);
        ventasEfectivoSpan.textContent = formatCurrency(ventasEfectivo);
        ventasTarjetaSpan.textContent = formatCurrency(ventasTarjeta);

        // Re-ejecutar cálculo de Ganancia Neta
        updateNetProfit();

        // Actualizar historial completo
        window.allSales = allPaidOrders;
        updateFullHistory();
    }, (error) => { console.error("Error al escuchar órdenes pagadas:", error); });

    // 3. Listener de Gastos
    const expensesQ = query(expensesCollectionRef);
    onSnapshot(expensesQ, (snapshot) => {
        let totalGastos = 0;
        const allExpenses = [];

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            allExpenses.push({ ...data, id: doc.id, type: 'expense' });
            totalGastos += data.amount;
        });

        // Ordenar localmente por timestamp (más reciente primero)
        allExpenses.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        // Mostrar solo los últimos 5 gastos ordenados
        const latestExpenses = allExpenses.slice(0, 5).map(item => renderItem(item, 'expense'));


        // Actualizar UI de Gastos y Reportes
        gastosList.innerHTML = latestExpenses.length > 0 ? latestExpenses.join('') : '<p class="text-gray-500 text-center p-4 bg-white rounded-lg">No hay gastos registrados.</p>';
        totalGastosSpan.textContent = formatCurrency(totalGastos);

        // Re-ejecutar cálculo de Ganancia Neta
        updateNetProfit();

        // Actualizar historial completo
        window.allExpenses = allExpenses;
        updateFullHistory();
    }, (error) => { console.error("Error al escuchar gastos:", error); });
}

function updateNetProfit() {
    const totalVentas = parseFloat(totalVentasSpan.textContent.replace('$', '').replace(/,/g, '')) || 0;
    const totalGastos = parseFloat(totalGastosSpan.textContent.replace('$', '').replace(/,/g, '')) || 0;

    const gananciaNeta = totalVentas - totalGastos;
    gananciaNetaSpan.textContent = formatCurrency(gananciaNeta);
    // Aplicar color de texto basado en la ganancia neta
    gananciaNetaSpan.classList.remove('text-indigo-700', 'text-red-700');
    gananciaNetaSpan.classList.add(gananciaNeta >= 0 ? 'text-indigo-700' : 'text-red-700');
}

function updateFullHistory() {
    if (!window.allSales || !window.allExpenses) return;

    const combinedHistory = [...window.allSales, ...window.allExpenses];

    // Ordenar por timestamp descendente
    combinedHistory.sort((a, b) => {
        // Usar el timestamp adecuado para cada tipo (closedAt para órdenes, timestamp para gastos)
        const timeA = (a.timestamp || a.closedAt)?.seconds * 1000 + ((a.timestamp || a.closedAt)?.nanoseconds / 1000000 || 0);
        const timeB = (b.timestamp || b.closedAt)?.seconds * 1000 + ((b.timestamp || b.closedAt)?.nanoseconds / 1000000 || 0);
        return timeB - timeA;
    });

    // Mostrar solo los últimos 10 elementos combinados
    const renderedHistory = combinedHistory.slice(0, 10).map(item => renderItem(item, item.type)).join('');

    historialCompleto.innerHTML = renderedHistory.length > 0 ? renderedHistory : '<p class="text-gray-500 text-center p-4 bg-white rounded-lg">No hay transacciones registradas.</p>';
}


// --- Manejo de Formularios de Gasto (sin cambios) ---

formGasto.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAuthReady) {
        showMessage('gasto-message', 'Base de datos no lista, espere por favor.', false);
        return;
    }

    const monto = parseFloat(document.getElementById('gasto-monto').value);
    const category = document.getElementById('gasto-categoria').value;
    const description = document.getElementById('gasto-descripcion').value.trim();

    if (isNaN(monto) || monto <= 0) {
        showMessage('gasto-message', 'Por favor ingrese un monto válido.', false);
        return;
    }

    try {
        await addDoc(collection(db, getCollectionPath('expenses')), {
            amount: monto,
            category: category,
            description: description,
            timestamp: serverTimestamp()
        });
        formGasto.reset();
        showMessage('gasto-message', `¡Gasto de ${formatCurrency(monto)} registrado con éxito!`, true);
    } catch (error) {
        console.error("Error al guardar gasto:", error);
        showMessage('gasto-message', `Error al guardar gasto: ${error.message}`, false);
    }
});

// --- Event Listeners de Autenticación ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAuthMessage("Por favor completa todos los campos", false);
        return;
    }

    if (isRegistering) {
        await handleRegister(email, password);
    } else {
        await handleLogin(email, password);
    }
});

// --- Event Listeners (Añadir a un bloque donde ya tengas otros listeners) ---

// --- Listener del botón de Google (ya debe existir en el DOM) ---
const googleLoginBtn = document.getElementById('google-login-button');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        console.log('🔍 Botón de Google presionado');
        handleGoogleLogin();
    });
}

// ... otros listeners (loginForm, logoutBtn, etc.)

registerToggle.addEventListener('click', toggleRegisterMode);

logoutBtn.addEventListener('click', async () => {
    if (confirm('¿Estás seguro que quieres cerrar sesión?')) {
        await handleLogout();
    }
});

changeDateBtn.addEventListener('click', changeWorkingDate);

// --- Lógica de Pestañas ---
window.changeTab = function (tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.querySelectorAll('button[id^="tab-"]').forEach(btn => {
        btn.classList.remove('active-tab');
    });

    document.getElementById(`content-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active-tab');
}

// Inicializar la pestaña
window.onload = () => {
    changeTab('ventas');

    // --- Toggle de visibilidad de contraseña ---
    const passwordInput = document.getElementById('password');
    const eyeToggle = document.createElement('button');
    eyeToggle.type = 'button';
    eyeToggle.id = 'toggle-password-visibility';
    eyeToggle.className = 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700';
    eyeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>';

    // Insertar el botón en el contenedor del input de contraseña
    const passwordContainer = passwordInput.parentElement;
    passwordContainer.style.position = 'relative';
    passwordInput.style.paddingRight = '2.5rem';
    passwordContainer.appendChild(eyeToggle);

    let passwordVisible = false;
    eyeToggle.addEventListener('click', () => {
        passwordVisible = !passwordVisible;
        passwordInput.type = passwordVisible ? 'text' : 'password';
        eyeToggle.innerHTML = passwordVisible
            ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.634 6.634A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.293 5.255M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" /></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>';
    });
}