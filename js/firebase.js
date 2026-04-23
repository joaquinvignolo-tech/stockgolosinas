// ═══════════════════════════════════════════════════════════════════
// Firebase — init + auth anónimo + API Firestore
// ═══════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// MISMO proyecto Firebase que StockTabaco, COLECCIÓN "inventarioGolosinas"
const firebaseConfig = {
  apiKey: "AIzaSyCzdg7fR8CeA2xa58H8Z4HviM78Qvu_LCE",
  authDomain: "stock-tabaco.firebaseapp.com",
  projectId: "stock-tabaco",
  storageBucket: "stock-tabaco.firebasestorage.app",
  messagingSenderId: "204176427528",
  appId: "1:204176427528:web:344ec4c7a91037fcde9fbd"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

const inventarioRef = doc(db, "inventarioGolosinas", "datos");
const configRef     = doc(db, "inventarioGolosinas", "config");

// Estado de autenticación — se resuelve cuando el login anónimo termina
let authReady = false;
let authPromise = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authReady = true;
      resolve(user);
    }
  });

  // Lanzar login anónimo
  signInAnonymously(auth).catch((err) => {
    console.error('Error en login anónimo:', err);
    reject(err);
  });
});

// API expuesta al resto de la app (window para acceso desde scripts clásicos)
window._fb = {
  // Esperar que Auth esté listo antes de cualquier operación
  ready: () => authPromise,

  // Inventario (datos productos/movimientos/etc)
  setInventario: (data) => setDoc(inventarioRef, data),
  onInventario: (cb) => onSnapshot(inventarioRef, snap => { if (snap.exists()) cb(snap.data()); }),

  // Config (credenciales hasheadas, ajustes admin)
  getConfig: async () => {
    const snap = await getDoc(configRef);
    return snap.exists() ? snap.data() : null;
  },
  setConfig: (data) => setDoc(configRef, data, { merge: true }),
  onConfig:  (cb) => onSnapshot(configRef, snap => { if (snap.exists()) cb(snap.data()); }),

  // Estado
  isReady: () => authReady,
};

// Avisar al resto de la app cuando Auth esté listo
authPromise.then(() => {
  window.dispatchEvent(new Event('firebase-ready'));
}).catch(err => {
  window.dispatchEvent(new CustomEvent('firebase-error', { detail: err }));
});
