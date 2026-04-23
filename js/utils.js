// ═══════════════════════════════════════════════════════════════════
// Utils — helpers compartidos (formato, hash, lotes, estado)
// ═══════════════════════════════════════════════════════════════════

// ── FORMATO ─────────────────────────────────────────────────────────
function fmt$(n) { return '$' + Math.round(n || 0).toLocaleString('es-AR'); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtFecha(f) { if (!f) return ''; const p = f.split('-'); if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]; return f; }
function margen(c, v) { if (!c || !v) return '—'; return Math.round((v - c) / c * 100) + '%'; }
function margenCls(c, v) { if (!c || !v) return ''; return ((v - c) / c) >= 0 ? 'style="color:var(--green)"' : 'style="color:var(--danger)"'; }

// ── HASH SHA-256 (para passwords) ───────────────────────────────────
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── LOTES Y VENCIMIENTOS ────────────────────────────────────────────
// Cada producto tiene un array `lotes` (opcional). Cada lote: { id, cant, vto, fechaRecepcion }
// El stock total del producto = suma de cant de todos los lotes.
// Si el producto no tiene lotes (legacy o sin vencimiento), usa el `stock` directo.

function stockTotal(p) {
  if (Array.isArray(p.lotes) && p.lotes.length > 0) {
    return p.lotes.reduce((s, l) => s + (l.cant || 0), 0);
  }
  return p.stock || 0;
}

// Retorna lotes ordenados FIFO (por vencimiento ascendente, los sin vto al final)
function lotesFIFO(p) {
  if (!Array.isArray(p.lotes)) return [];
  return [...p.lotes]
    .filter(l => l.cant > 0)
    .sort((a, b) => {
      if (!a.vto && !b.vto) return (a.fechaRecepcion || '').localeCompare(b.fechaRecepcion || '');
      if (!a.vto) return 1;
      if (!b.vto) return -1;
      return a.vto.localeCompare(b.vto);
    });
}

// Próximo vencimiento (el lote más urgente)
function proxVencimiento(p) {
  const lotes = lotesFIFO(p);
  for (const l of lotes) if (l.vto) return l.vto;
  return null;
}

// Días hasta vencimiento (negativo si ya venció)
function diasHastaVto(fechaVto) {
  if (!fechaVto) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vto = new Date(fechaVto + 'T00:00:00');
  return Math.floor((vto - hoy) / (1000 * 60 * 60 * 24));
}

// Estado de vencimiento del producto (mirando su lote más próximo)
function estadoVencimiento(p) {
  const vto = proxVencimiento(p);
  if (!vto) return null;
  const dias = diasHastaVto(vto);
  if (dias < 0) return { key: 'vencido', label: `Vencido hace ${-dias}d`, cls: 'badge-vencido', dias };
  if (dias <= 30) return { key: 'por-vencer', label: `Vence en ${dias}d`, cls: 'badge-por-vencer', dias };
  return { key: 'ok-vto', label: `Vence ${fmtFecha(vto)}`, cls: 'badge-cat', dias };
}

// Retira `cant` unidades usando FIFO. Retorna array de {loteId, cant} descontados.
// Si no alcanza stock en lotes, descuenta del stock directo.
function retirarFIFO(p, cant) {
  const descontados = [];
  let restante = cant;

  if (Array.isArray(p.lotes) && p.lotes.length > 0) {
    const lotes = lotesFIFO(p);
    for (const l of lotes) {
      if (restante <= 0) break;
      const toma = Math.min(l.cant, restante);
      l.cant -= toma;
      restante -= toma;
      descontados.push({ loteId: l.id, cant: toma, vto: l.vto });
    }
    // Limpiar lotes vacíos
    p.lotes = p.lotes.filter(l => l.cant > 0);
    // Sincronizar stock directo también
    p.stock = stockTotal(p);
  } else {
    p.stock = Math.max(0, (p.stock || 0) - cant);
  }
  return descontados;
}

// Agrega un lote nuevo al producto
function agregarLote(p, cant, vto) {
  if (!Array.isArray(p.lotes)) p.lotes = [];
  const id = 'L' + Date.now() + Math.floor(Math.random() * 1000);
  const lote = {
    id,
    cant: parseInt(cant) || 0,
    vto: vto || null,
    fechaRecepcion: todayStr()
  };
  p.lotes.push(lote);
  p.stock = stockTotal(p);
  return lote;
}

// ── ESTADO DE PRODUCTO (stock) ──────────────────────────────────────
function estadoProd(p) {
  const s = stockTotal(p);
  if (s === 0) return { label: 'Agotado', cls: 'badge-out', key: 'agotado' };
  if (s <= (p.min || 0)) return { label: 'Stock bajo', cls: 'badge-warn', key: 'bajo' };
  return { label: 'OK', cls: 'badge-ok', key: 'ok' };
}

// ── BÚSQUEDA POR CÓDIGO DE BARRAS ───────────────────────────────────
function getAllBarcodes(p) {
  const codes = [];
  if (p.barcode) codes.push(p.barcode);
  if (Array.isArray(p.barcodes)) p.barcodes.forEach(b => { if (b && !codes.includes(b)) codes.push(b); });
  return codes;
}

function findByBarcode(codigo, productos) {
  if (!codigo) return null;
  const c = codigo.trim();
  return productos.find(p => getAllBarcodes(p).includes(c)) || null;
}

// ── NOTIFICACIONES ──────────────────────────────────────────────────
function notify(msg) {
  const n = document.getElementById('notif');
  if (!n) return;
  n.textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2500);
}

// ── EXPONER AL SCOPE GLOBAL ─────────────────────────────────────────
window.Utils = {
  fmt$, todayStr, fmtFecha, margen, margenCls,
  sha256,
  stockTotal, lotesFIFO, proxVencimiento, diasHastaVto, estadoVencimiento,
  retirarFIFO, agregarLote,
  estadoProd,
  getAllBarcodes, findByBarcode,
  notify
};
