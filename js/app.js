// ═══════════════════════════════════════════════════════════════════
// App — Login, Auth, Router, Backup semanal
// ═══════════════════════════════════════════════════════════════════

// Estado global compartido (también accesible desde admin.js / operador.js)
window.State = {
  productos: [],
  marcas: [],
  proveedores: [],
  movimientos: [],
  historialPrecios: [],
  nextProdId: 1,
  nextMarcaId: 20,
  nextProvId: 1,
  editingId: null,
  loginMode: 'admin',
  authHashes: null,  // { admin: "hash...", operador: "hash..." }
  syncBusy: false,
  chartCat: null,
  chartMar: null
};

// Contraseñas por defecto (primer login, antes de cambiar)
const DEFAULT_PASSWORDS = {
  admin: 'golosinas2024',
  operador: 'operador2024'
};

// Marcas pre-cargadas (se usan si Firestore está vacío la primera vez)
const MARCAS_INICIALES = [
  {id:1,nombre:"ARCOR",cat:"General"},
  {id:2,nombre:"FELFORT",cat:"Chocolates"},
  {id:3,nombre:"CABRALES",cat:"General"},
  {id:4,nombre:"BILLIKEN",cat:"Caramelos"},
  {id:5,nombre:"BON O BON",cat:"Chocolates"},
  {id:6,nombre:"COFLER",cat:"Chocolates"},
  {id:7,nombre:"BELDENT",cat:"Chicles"},
  {id:8,nombre:"TOPLINE",cat:"Chicles"},
  {id:9,nombre:"MENTOS",cat:"Caramelos"},
  {id:10,nombre:"HALLS",cat:"Caramelos"},
  {id:11,nombre:"SUGUS",cat:"Caramelos"},
  {id:12,nombre:"SERENITO",cat:"Alfajores"},
  {id:13,nombre:"JORGITO",cat:"Alfajores"},
  {id:14,nombre:"GUAYMALLEN",cat:"Alfajores"},
  {id:15,nombre:"TERRABUSI",cat:"Alfajores"},
  {id:16,nombre:"MILKA",cat:"Chocolates"},
  {id:17,nombre:"NESTLE",cat:"Chocolates"},
  {id:18,nombre:"MOGUL",cat:"Caramelos"},
  {id:19,nombre:"TOFI",cat:"Caramelos"}
];

// ── LOGIN ───────────────────────────────────────────────────────────
function selectLoginMode(m) {
  State.loginMode = m;
  document.getElementById('mode-admin-btn').classList.toggle('selected', m === 'admin');
  document.getElementById('mode-op-btn').classList.toggle('selected', m === 'operador');
}

async function doLogin() {
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginError');
  const btn  = document.querySelector('.login-btn');

  if (!pass) { err.textContent = 'Ingresá la contraseña.'; return; }

  btn.disabled = true;
  err.textContent = '';

  try {
    // Esperar Firebase Auth listo
    await window._fb.ready();

    // Cargar hashes desde Firestore (si existen)
    let cfg = await window._fb.getConfig();

    // Primera vez: si no hay config, crear con passwords por defecto
    if (!cfg || !cfg.auth) {
      const hashAdmin = await Utils.sha256(DEFAULT_PASSWORDS.admin);
      const hashOp    = await Utils.sha256(DEFAULT_PASSWORDS.operador);
      await window._fb.setConfig({
        auth: { admin: hashAdmin, operador: hashOp },
        createdAt: new Date().toISOString()
      });
      cfg = { auth: { admin: hashAdmin, operador: hashOp } };
    }

    State.authHashes = cfg.auth;

    // Validar password ingresada contra hash almacenado
    const hashIngresado = await Utils.sha256(pass);
    const hashEsperado  = State.authHashes[State.loginMode];

    if (hashIngresado !== hashEsperado) {
      err.textContent = 'Contraseña incorrecta.';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
      btn.disabled = false;
      return;
    }

    // Login OK
    sessionStorage.setItem('stk_auth', State.loginMode);
    document.getElementById('loginOverlay').style.display = 'none';

    if (State.loginMode === 'admin') {
      document.getElementById('admin-ui').style.display = 'block';
      await cargarDesdeFirestore();
      if (window.Admin) {
        Admin.normalizarFechasLotes();
        Admin.renderDashboard();
        Admin.renderSelectMarca();
        Admin.renderSelectProv();
        Admin.renderAlertas();
        Admin.checkBackupSemanal();
      }
    } else {
      document.getElementById('modo-operador').classList.add('active');
      await cargarDesdeFirestore();
      if (window.Operador) Operador.renderHistory();
    }

    btn.disabled = false;
  } catch (e) {
    console.error('Error en login:', e);
    err.textContent = 'Error de conexión. Reintentá.';
    btn.disabled = false;
  }
}

function cerrarSesion() {
  sessionStorage.removeItem('stk_auth');
  if (window.Operador) Operador.cerrarCamara();
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('admin-ui').style.display = 'none';
  document.getElementById('modo-operador').classList.remove('active');
  document.getElementById('loginPass').value = '';
  State.loginMode = 'admin';
  selectLoginMode('admin');
}

// ── CARGA DE DATOS (suscripción realtime a Firestore) ───────────────
async function cargarDesdeFirestore() {
  const el = document.getElementById("sync-status");
  if (el) { el.textContent = "⏳ Cargando..."; el.style.color = "var(--text3)"; }

  await window._fb.ready();

  try {
    window._fb.onInventario(rec => {
      if (rec && rec.productos) {
        State.productos = rec.productos;
        State.movimientos = rec.movimientos || [];
        State.marcas = (rec.marcas && rec.marcas.length > 0) ? rec.marcas : MARCAS_INICIALES;
        State.proveedores = rec.proveedores || [];
        State.historialPrecios = rec.historialPrecios || [];
        State.nextProdId = rec.nextProdId || (State.productos.length > 0 ? Math.max(...State.productos.map(p => p.id)) + 1 : 1);
        State.nextMarcaId = rec.nextMarcaId || (Math.max(...State.marcas.map(m => m.id)) + 1);
        State.nextProvId = rec.nextProvId || 1;

        if (window.Admin) Admin.normalizarFechasLotes();

        const auth = sessionStorage.getItem('stk_auth');
        if (auth === 'admin' && window.Admin) {
          Admin.renderStats();
          const sec = document.querySelector('.section.active');
          if (sec && sec.id === 'sec-dashboard') Admin.renderDashboard();
          Admin.renderAlertas();
          if (el) { el.textContent = '✓ Sincronizado'; el.style.color = 'var(--green)'; setTimeout(() => el.textContent = '', 2000); }
        } else if (auth === 'operador' && window.Operador) {
          Operador.renderHistory();
          if (Operador.getProd()) {
            const p = State.productos.find(x => x.id === Operador.getProd().id);
            if (p) Operador.mostrarProducto(p);
          }
        }
      } else {
        // Primera vez: Firestore vacío, usar marcas iniciales
        State.marcas = MARCAS_INICIALES;
        if (el) { el.textContent = '✓ Listo para usar'; el.style.color = 'var(--green)'; setTimeout(() => el.textContent = '', 3000); }
      }
    });
  } catch (e) {
    console.warn("Error Firebase:", e);
    if (el) { el.textContent = "⚠ Sin conexión"; el.style.color = "var(--danger)"; }
  }
}

async function guardarEnFirestore() {
  if (State.syncBusy) return;
  State.syncBusy = true;
  try {
    await window._fb.setInventario({
      productos: State.productos,
      movimientos: State.movimientos,
      marcas: State.marcas,
      proveedores: State.proveedores,
      historialPrecios: State.historialPrecios,
      nextProdId: State.nextProdId,
      nextMarcaId: State.nextMarcaId,
      nextProvId: State.nextProvId
    });
    const el = document.getElementById('sync-status');
    if (el) { el.textContent = '✓ Guardado'; el.style.color = 'var(--green)'; setTimeout(() => el.textContent = '', 2000); }
  } catch (e) {
    const el = document.getElementById('sync-status');
    if (el) { el.textContent = '⚠ Error al guardar'; el.style.color = 'var(--danger)'; }
    console.error('Error guardando en Firebase:', e);
  } finally {
    State.syncBusy = false;
  }
}

// ── INIT ────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const auth = sessionStorage.getItem('stk_auth');
  if (auth === 'admin') {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('admin-ui').style.display = 'block';
    cargarDesdeFirestore().then(() => {
      if (window.Admin) {
        Admin.normalizarFechasLotes();
        Admin.renderDashboard();
        Admin.renderSelectMarca();
        Admin.renderSelectProv();
        Admin.renderAlertas();
        Admin.checkBackupSemanal();
      }
    });
  } else if (auth === 'operador') {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('modo-operador').classList.add('active');
    cargarDesdeFirestore().then(() => { if (window.Operador) Operador.renderHistory(); });
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
});

// Prevenir botón atrás
history.pushState({ page: 'app' }, '', window.location.href);
window.addEventListener('popstate', function() {
  history.pushState({ page: 'app' }, '', window.location.href);
  const auth = sessionStorage.getItem('stk_auth');
  if (auth === 'operador' && window.Operador) {
    const prod = document.getElementById('op-state-producto');
    const cam  = document.getElementById('op-state-camara');
    const foto = document.getElementById('op-state-foto');
    if (prod && prod.classList.contains('active')) Operador.nuevoEscaneo();
    else if (cam && cam.classList.contains('active')) Operador.cerrarCamara();
    else if (foto && foto.classList.contains('active')) Operador.cerrarFotoIA();
  } else if (auth === 'admin' && window.Admin) {
    Admin.closeSidebar();
  }
});

// Desregistrar SW para evitar cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

// Exponer al global
window.App = {
  doLogin, selectLoginMode, cerrarSesion,
  cargarDesdeFirestore, guardarEnFirestore,
  DEFAULT_PASSWORDS
};

// Atajos globales que usan el HTML directamente
window.doLogin = doLogin;
window.selectLoginMode = selectLoginMode;
window.cerrarSesion = cerrarSesion;
