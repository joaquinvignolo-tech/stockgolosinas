// ═══════════════════════════════════════════════════════════════════
// Utils — helpers compartidos (encapsulado en IIFE)
// ═══════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── FORMATO ───────────────────────────────────────────────────────
  function fmt$(n) { return '$' + Math.round(n || 0).toLocaleString('es-AR'); }
  function todayStr() { return new Date().toISOString().split('T')[0]; }
  function fmtFecha(f) { if (!f) return ''; var p = f.split('-'); if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]; return f; }
  function margen(c, v) { if (!c || !v) return '—'; return Math.round((v - c) / c * 100) + '%'; }
  function margenCls(c, v) { if (!c || !v) return ''; return ((v - c) / c) >= 0 ? 'style="color:var(--green)"' : 'style="color:var(--danger)"'; }

  // ── HASH SHA-256 ──────────────────────────────────────────────────
  async function sha256(str) {
    var buf = new TextEncoder().encode(str);
    var hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ── LOTES Y VENCIMIENTOS ──────────────────────────────────────────
  function stockTotal(p) {
    if (Array.isArray(p.lotes) && p.lotes.length > 0) {
      return p.lotes.reduce(function(s, l) { return s + (l.cant || 0); }, 0);
    }
    return p.stock || 0;
  }

  function lotesFIFO(p) {
    if (!Array.isArray(p.lotes)) return [];
    return p.lotes.slice()
      .filter(function(l) { return l.cant > 0; })
      .sort(function(a, b) {
        if (!a.vto && !b.vto) return (a.fechaRecepcion || '').localeCompare(b.fechaRecepcion || '');
        if (!a.vto) return 1;
        if (!b.vto) return -1;
        return a.vto.localeCompare(b.vto);
      });
  }

  function proxVencimiento(p) {
    var lotes = lotesFIFO(p);
    for (var i = 0; i < lotes.length; i++) if (lotes[i].vto) return lotes[i].vto;
    return null;
  }

  function diasHastaVto(fechaVto) {
    if (!fechaVto) return null;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var vto = new Date(fechaVto + 'T00:00:00');
    return Math.floor((vto - hoy) / (1000 * 60 * 60 * 24));
  }

  function estadoVencimiento(p) {
    var vto = proxVencimiento(p);
    if (!vto) return null;
    var dias = diasHastaVto(vto);
    if (dias < 0) return { key: 'vencido', label: 'Vencido hace ' + (-dias) + 'd', cls: 'badge-vencido', dias: dias };
    if (dias <= 30) return { key: 'por-vencer', label: 'Vence en ' + dias + 'd', cls: 'badge-por-vencer', dias: dias };
    return { key: 'ok-vto', label: 'Vence ' + fmtFecha(vto), cls: 'badge-cat', dias: dias };
  }

  function retirarFIFO(p, cant) {
    var descontados = [];
    var restante = cant;
    if (Array.isArray(p.lotes) && p.lotes.length > 0) {
      var lotes = lotesFIFO(p);
      for (var i = 0; i < lotes.length; i++) {
        if (restante <= 0) break;
        var l = lotes[i];
        var toma = Math.min(l.cant, restante);
        l.cant -= toma;
        restante -= toma;
        descontados.push({ loteId: l.id, cant: toma, vto: l.vto });
      }
      p.lotes = p.lotes.filter(function(l) { return l.cant > 0; });
      p.stock = stockTotal(p);
    } else {
      p.stock = Math.max(0, (p.stock || 0) - cant);
    }
    return descontados;
  }

  function agregarLote(p, cant, vto) {
    if (!Array.isArray(p.lotes)) p.lotes = [];
    var id = 'L' + Date.now() + Math.floor(Math.random() * 1000);
    var lote = {
      id: id,
      cant: parseInt(cant) || 0,
      vto: vto || null,
      fechaRecepcion: todayStr()
    };
    p.lotes.push(lote);
    p.stock = stockTotal(p);
    return lote;
  }

  // ── ESTADO DE PRODUCTO (stock) ────────────────────────────────────
  function estadoProd(p) {
    var s = stockTotal(p);
    if (s === 0) return { label: 'Agotado', cls: 'badge-out', key: 'agotado' };
    if (s <= (p.min || 0)) return { label: 'Stock bajo', cls: 'badge-warn', key: 'bajo' };
    return { label: 'OK', cls: 'badge-ok', key: 'ok' };
  }

  // ── BÚSQUEDA POR CÓDIGO DE BARRAS ─────────────────────────────────
  function getAllBarcodes(p) {
    var codes = [];
    if (p.barcode) codes.push(p.barcode);
    if (Array.isArray(p.barcodes)) p.barcodes.forEach(function(b) { if (b && codes.indexOf(b) === -1) codes.push(b); });
    return codes;
  }

  function findByBarcode(codigo, productos) {
    if (!codigo) return null;
    var c = codigo.trim();
    return productos.find(function(p) { return getAllBarcodes(p).indexOf(c) !== -1; }) || null;
  }

  // ── NOTIFICACIONES ────────────────────────────────────────────────
  function notify(msg) {
    var n = document.getElementById('notif');
    if (!n) return;
    n.textContent = msg;
    n.classList.add('show');
    setTimeout(function() { n.classList.remove('show'); }, 2500);
  }

  // ── EXPONER SOLO COMO window.Utils (no como globales sueltas) ─────
  window.Utils = {
    fmt$: fmt$,
    todayStr: todayStr,
    fmtFecha: fmtFecha,
    margen: margen,
    margenCls: margenCls,
    sha256: sha256,
    stockTotal: stockTotal,
    lotesFIFO: lotesFIFO,
    proxVencimiento: proxVencimiento,
    diasHastaVto: diasHastaVto,
    estadoVencimiento: estadoVencimiento,
    retirarFIFO: retirarFIFO,
    agregarLote: agregarLote,
    estadoProd: estadoProd,
    getAllBarcodes: getAllBarcodes,
    findByBarcode: findByBarcode,
    notify: notify
  };
})();
