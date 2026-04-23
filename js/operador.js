// ═══════════════════════════════════════════════════════════════════
// Operador — Escáner, Foto+IA, Retiros FIFO, Recepciones con vto
// ═══════════════════════════════════════════════════════════════════

const { stockTotal, lotesFIFO, proxVencimiento, diasHastaVto, estadoVencimiento,
        retirarFIFO, agregarLote, estadoProd, getAllBarcodes, findByBarcode,
        fmtFecha, todayStr, notify } = window.Utils;

function getMarca(id) { return State.marcas.find(m => m.id === id) || null; }

let opProd = null;
let opQty = 1;
let opModo = 'retiro';
let opStream = null;
let opBarcodeDetecting = false;

function opEstado(estado) {
  document.getElementById('op-idle').style.display = estado === 'idle' ? 'flex' : 'none';
  document.getElementById('op-state-camara').classList.toggle('active', estado === 'camara');
  document.getElementById('op-state-foto').classList.toggle('active', estado === 'foto');
  document.getElementById('op-state-producto').classList.toggle('active', estado === 'producto');
}

async function iniciarEscanerBarras() {
  opEstado('camara');
  document.getElementById('op-barcode-manual').value = '';
  try {
    opStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
    const video = document.getElementById('op-video');
    video.srcObject = opStream;
    await video.play();
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'code_39', 'qr_code'] });
      opBarcodeDetecting = true;
      const scan = async () => {
        if (!opBarcodeDetecting || !opStream) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) { opBarcodeDetecting = false; buscarPorCodigo(codes[0].rawValue); return; }
        } catch (e) { }
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    }
  } catch (e) {
    cerrarCamara();
    opToast('No se pudo acceder a la cámara', 'error');
  }
}

function cerrarCamara() {
  opBarcodeDetecting = false;
  if (opStream) { opStream.getTracks().forEach(t => t.stop()); opStream = null; }
  const v = document.getElementById('op-video'); if (v) v.srcObject = null;
  opEstado('idle');
}

function buscarPorCodigo(codigo) {
  if (!codigo || !codigo.trim()) return;
  cerrarCamara();
  const c = codigo.trim();
  const p = findByBarcode(c, State.productos);
  if (p) { mostrarProducto(p); return; }
  const sim = State.productos.filter(x => getAllBarcodes(x).some(b => b.includes(c)) || x.nombre.toLowerCase().includes(c.toLowerCase()));
  if (sim.length === 1) { mostrarProducto(sim[0]); return; }
  if (sim.length > 1) { opEstado('idle'); mostrarSugs(sim); }
  else { opEstado('idle'); opToast('Producto no encontrado: ' + c, 'error'); }
}

function mostrarSugs(lista) {
  const el = document.getElementById('op-sug-manual');
  el.innerHTML = lista.slice(0, 8).map(p => {
    const m = getMarca(p.marcaId), e = estadoProd(p);
    return `<div class="op-sug-item" onclick="Operador.mostrarProducto(State.productos.find(x=>x.id===${p.id}));document.getElementById('op-sug-manual').style.display='none'"><div><div style="font-weight:700;font-size:14px">${p.nombre}</div><div style="font-size:11px;color:var(--text3)">${m ? m.nombre : ''} · ${p.variedad || ''}</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:800;color:var(--accent)">${stockTotal(p)}</div><span class="badge ${e.cls}" style="font-size:10px">${e.label}</span></div></div>`;
  }).join('');
  el.style.display = 'block';
}

function buscarManual(val) {
  const el = document.getElementById('op-sug-manual');
  if (val.length < 2) { el.style.display = 'none'; return; }
  const v = val.toLowerCase();
  const hits = State.productos.filter(p => p.nombre.toLowerCase().includes(v) || getAllBarcodes(p).some(b => b.includes(v)) || (p.variedad || '').toLowerCase().includes(v)).slice(0, 8);
  if (!hits.length) { el.style.display = 'none'; return; }
  mostrarSugs(hits);
}

function iniciarFotoIA() {
  opEstado('foto');
  document.getElementById('op-ai-matches').innerHTML = '';
  document.getElementById('op-photo-status').innerHTML = '';
  document.getElementById('op-photo-preview').innerHTML = '<span style="font-size:48px">📸</span>';
}
function cerrarFotoIA() { opEstado('idle'); }

async function analizarFoto(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => document.getElementById('op-photo-preview').innerHTML = `<img src="${e.target.result}">`;
  reader.readAsDataURL(file);

  document.getElementById('op-photo-status').innerHTML = '<div class="op-analyzing">Analizando con IA</div>';
  document.getElementById('op-ai-matches').innerHTML = '';

  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
    const lista = State.productos.map(p => { const m = getMarca(p.marcaId); return `ID:${p.id} | ${p.nombre} | ${m ? m.nombre : ''} | ${p.variedad || ''} | ${p.cat}`; }).join('\n');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 400,
        messages: [{
          role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 } },
            { type: 'text', text: `Sos asistente de inventario de un kiosco/almacén argentino especializado en golosinas (chocolates, caramelos, chicles, alfajores). Identificá el producto en la imagen.\n\nInventario:\n${lista}\n\nRespondé SOLO con JSON sin markdown:\n{"matches":[{"id":NUMERO,"nombre":"NOMBRE","confianza":"alta/media/baja"}]}\nHasta 3 resultados. Si no reconocés ninguno: {"matches":[]}` }
          ]
        }]
      })
    });
    const data = await resp.json();
    const txt = data.content?.[0]?.text || '{}';
    let result;
    try { result = JSON.parse(txt.replace(/```json|```/g, '').trim()); } catch (e) { result = { matches: [] }; }

    document.getElementById('op-photo-status').innerHTML = '';
    const matchesEl = document.getElementById('op-ai-matches');

    if (!result.matches || result.matches.length === 0) {
      matchesEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--danger);font-weight:700;font-size:13px">No se reconoció el producto.<br><span style="font-weight:400;color:var(--text3)">Intentá con otra foto o buscá manualmente.</span></div>';
      return;
    }
    matchesEl.innerHTML = '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px">Toca para seleccionar</div>';
    result.matches.forEach(m => {
      const prod = State.productos.find(p => p.id === m.id); if (!prod) return;
      const marc = getMarca(prod.marcaId), e = estadoProd(prod);
      const cc = { 'alta': 'var(--green)', 'media': 'var(--warn)', 'baja': 'var(--text3)' }[m.confianza] || 'var(--text3)';
      const ci = { 'alta': '✓✓', 'media': '✓', 'baja': '?' }[m.confianza] || '?';
      const div = document.createElement('div');
      div.className = 'op-ai-match';
      div.innerHTML = `<div><div style="font-weight:700;font-size:14px">${prod.nombre}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${marc ? marc.nombre : ''} · ${prod.variedad || ''} · Stock: <b style="color:var(--accent)">${stockTotal(prod)}</b></div></div><div style="text-align:right"><div style="font-size:11px;font-weight:700;color:${cc}">${ci} ${m.confianza}</div><div class="badge ${e.cls}" style="margin-top:4px;font-size:10px">${e.label}</div></div>`;
      div.onclick = () => { cerrarFotoIA(); mostrarProducto(prod); };
      matchesEl.appendChild(div);
    });
  } catch (err) {
    document.getElementById('op-photo-status').innerHTML = '<div style="text-align:center;padding:16px;color:var(--danger);font-weight:700;font-size:13px">Error al analizar.<br><span style="font-weight:400;color:var(--text3)">Verificá tu conexión e intentá de nuevo.</span></div>';
    console.error(err);
  }
  input.value = '';
}

function mostrarProducto(p) {
  opProd = p; opQty = 1; opModo = 'retiro';
  opEstado('producto');
  const m = getMarca(p.marcaId), e = estadoProd(p);
  const st = stockTotal(p);
  const sc = st === 0 ? 'danger' : st <= p.min ? 'warn' : 'ok';
  const ev = estadoVencimiento(p);

  let vtoInfo = '';
  if (ev) {
    const lotes = lotesFIFO(p);
    if (ev.key === 'vencido' || ev.key === 'por-vencer') {
      vtoInfo = `<div class="op-lote-proximo">⚠ ${ev.label} · ${lotes[0].cant} uds de este lote (vence ${fmtFecha(lotes[0].vto)})</div>`;
    } else {
      vtoInfo = `<div style="margin-top:10px;font-size:12px;color:var(--text3);text-align:center">📅 Próx. vto: ${fmtFecha(proxVencimiento(p))}</div>`;
    }
  }

  document.getElementById('op-prod-card').innerHTML = `
    <div class="op-prod-name">${p.nombre}</div>
    <div class="op-prod-meta">
      ${m ? `<span>${m.nombre}</span>` : ''}
      ${p.variedad ? `<span>${p.variedad}</span>` : ''}
      <span>${p.cat}</span>
      ${p.presentacion ? `<span>${p.presentacion}</span>` : ''}
      ${p.ubic ? `<span>📍 ${p.ubic}</span>` : ''}
    </div>
    <div class="op-stock-display">
      <div>
        <div class="op-stock-label">Stock actual</div>
        <div class="op-stock-num ${sc}">${st}</div>
        <div class="op-stock-min">Mínimo: ${p.min} uds</div>
      </div>
      <span class="badge ${e.cls} op-status-badge">${e.label}</span>
    </div>
    ${vtoInfo}`;

  document.getElementById('op-qty-display').value = 1;
  document.getElementById('op-nota').value = '';
  document.getElementById('op-tab-ret').classList.add('active');
  document.getElementById('op-tab-rec').classList.remove('active');

  // Campo de vencimiento aparece al cambiar a modo recepción
  document.getElementById('op-vto-wrap').style.display = 'none';

  actualizarConfirmar();
  renderHistory();
}

function seleccionarModo(modo) {
  opModo = modo;
  document.getElementById('op-tab-ret').classList.toggle('active', modo === 'retiro');
  document.getElementById('op-tab-rec').classList.toggle('active', modo === 'recepcion');
  const btn = document.getElementById('op-confirm-btn');
  const icon = document.getElementById('op-confirm-icon');
  const label = document.getElementById('op-confirm-label');
  const vtoWrap = document.getElementById('op-vto-wrap');
  if (modo === 'retiro') { btn.className = 'op-confirm-btn retiro'; icon.textContent = '📤'; label.textContent = 'Confirmar retiro'; vtoWrap.style.display = 'none'; }
  else { btn.className = 'op-confirm-btn recepcion'; icon.textContent = '📥'; label.textContent = 'Confirmar recepción'; vtoWrap.style.display = 'block'; }
  actualizarConfirmar();
}

function cambiarQty(d) { opQty = Math.max(1, opQty + d); document.getElementById('op-qty-display').value = opQty; actualizarConfirmar(); }
function setQty(n) { opQty = n; document.getElementById('op-qty-display').value = opQty; actualizarConfirmar(); }
function qtyManual(val) { const n = parseInt(val) || 1; opQty = Math.max(1, n); actualizarConfirmar(); }
function actualizarConfirmar() {
  const input = document.getElementById('op-qty-display');
  if (input) opQty = Math.max(1, parseInt(input.value) || 1);
  const btn = document.getElementById('op-confirm-btn');
  if (!opProd) { btn.disabled = true; return; }
  if (opModo === 'retiro' && opQty > stockTotal(opProd)) { btn.disabled = true; if (input) input.style.color = 'var(--danger)'; }
  else { btn.disabled = false; if (input) input.style.color = ''; }
}

function confirmar() {
  if (!opProd) return;
  const p = State.productos.find(x => x.id === opProd.id); if (!p) return;
  const nota = document.getElementById('op-nota').value.trim();
  if (opModo === 'retiro') {
    const st = stockTotal(p);
    if (opQty > st) { opToast('Stock insuficiente (' + st + ' disponibles)', 'error'); return; }
    const descontados = retirarFIFO(p, opQty);
    const vtosDescontados = descontados.filter(d => d.vto).map(d => `${d.cant}@${fmtFecha(d.vto)}`).join(', ');
    const hoy = todayStr().split('-'); const loteOp = 'Retiro operador ' + hoy[2] + '/' + hoy[1];
    State.movimientos.unshift({ prodId: p.id, nombre: p.nombre, tipo: 'salida', cant: opQty, motivo: nota || loteOp, fecha: todayStr(), ts: Date.now(), lote: loteOp, lotesDescontados: vtosDescontados });
    opToast('-' + opQty + ' · ' + p.nombre + (vtosDescontados ? ' (FIFO: ' + vtosDescontados + ')' : ''), 'success');
  } else {
    const vto = document.getElementById('op-vto-input').value || null;
    agregarLote(p, opQty, vto);
    const hoyR = todayStr().split('-'); const loteOpRec = 'Recepción operador ' + hoyR[2] + '/' + hoyR[1];
    State.movimientos.unshift({ prodId: p.id, nombre: p.nombre, tipo: 'entrada', cant: opQty, motivo: (nota || loteOpRec) + (vto ? ' (vto ' + fmtFecha(vto) + ')' : ''), fecha: todayStr(), ts: Date.now(), lote: loteOpRec });
    opToast('+' + opQty + ' · ' + p.nombre + (vto ? ' (vto ' + fmtFecha(vto) + ')' : ''), 'info');
  }
  App.guardarEnFirestore();
  opProd = p;
  mostrarProducto(p);
}

function nuevoEscaneo() {
  opProd = null;
  document.getElementById('op-busqueda-manual').value = '';
  document.getElementById('op-sug-manual').style.display = 'none';
  opEstado('idle');
}

function renderHistory() {
  const wrap = document.getElementById('op-history-wrap'), rows = document.getElementById('op-hist-rows');
  const rec = State.movimientos.slice(0, 6);
  if (!rec.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  rows.innerHTML = rec.map(m => `<div class="op-hist-row"><span class="op-hist-badge ${m.tipo === 'entrada' ? 'mov-entrada' : 'mov-salida'}">${m.tipo === 'entrada' ? '+' + m.cant : '-' + m.cant}</span><div style="flex:1"><div style="font-weight:600;font-size:13px">${m.nombre}</div><div style="font-size:11px;color:var(--text3)">${m.motivo || '—'}</div></div><div style="font-size:11px;color:var(--text3)">${m.fecha}</div></div>`).join('');
}

function opToast(msg, tipo = 'info') {
  const t = document.getElementById('op-toast');
  t.textContent = msg; t.className = `show ${tipo}`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#op-busqueda-manual') && !e.target.closest('#op-sug-manual')) {
    const s = document.getElementById('op-sug-manual'); if (s) s.style.display = 'none';
  }
});

window.Operador = {
  iniciarEscanerBarras, cerrarCamara, buscarPorCodigo, buscarManual,
  iniciarFotoIA, cerrarFotoIA, analizarFoto,
  mostrarProducto, seleccionarModo, cambiarQty, setQty, qtyManual, confirmar, nuevoEscaneo,
  renderHistory, opToast,
  getProd: () => opProd
};

// Atajos para onclick
window.iniciarEscanerBarras = iniciarEscanerBarras;
window.cerrarCamara = cerrarCamara;
window.iniciarFotoIA = iniciarFotoIA;
window.cerrarFotoIA = cerrarFotoIA;
window.opBuscarPorCodigo = buscarPorCodigo;
window.opBuscarManual = buscarManual;
window.opAnalizarFoto = analizarFoto;
window.opMostrarProducto = mostrarProducto;
window.opSeleccionarModo = seleccionarModo;
window.opCambiarQty = cambiarQty;
window.opSetQty = setQty;
window.opQtyManual = qtyManual;
window.opConfirmar = confirmar;
window.opNuevoEscaneo = nuevoEscaneo;
