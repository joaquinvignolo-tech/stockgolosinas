// ═══════════════════════════════════════════════════════════════════
// Admin — Dashboard, Productos, Lotes, Marcas, Proveedores,
//         Alertas, Vencimientos, Reporte, Retiros, Recepciones,
//         Ranking, Precios, Configuración, Backup semanal
// ═══════════════════════════════════════════════════════════════════

// ── NAVEGACIÓN ──────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar'),
        ov = document.getElementById('sidebar-overlay'),
        hb = document.getElementById('hamburger-btn');
  sb.classList.toggle('open');
  ov.classList.toggle('active');
  hb.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
  document.getElementById('hamburger-btn').classList.remove('open');
}
function showSectionMobile(id, btn) {
  closeSidebar();
  const navBtn = document.querySelector('.nav-item[onclick*="\'' + id + '\'"]');
  showSection(id, navBtn);
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('sec-' + id); if (!el) return;
  el.classList.add('active');
  if (btn) btn.classList.add('active');
  closeSidebar();
  const fn = {
    dashboard: renderDashboard,
    productos: () => { renderTabla(); renderSelectMarca(); renderSelectProv(); renderFiltroMarca(); },
    marcas: renderMarcas,
    proveedores: renderProveedores,
    alertas: renderAlertas,
    vencimientos: renderVencimientos,
    reporte: renderReporte,
    ranking: renderRanking,
    recepcion: populateRecProv,
    precios: renderHistorialPrecios,
    configuracion: renderConfig
  };
  if (fn[id]) fn[id]();
}

// ── HELPERS ─────────────────────────────────────────────────────────
const { fmt$, todayStr, fmtFecha, margen, margenCls, sha256,
        stockTotal, lotesFIFO, proxVencimiento, diasHastaVto, estadoVencimiento,
        retirarFIFO, agregarLote, estadoProd, getAllBarcodes, findByBarcode, notify } = window.Utils;

function getMarca(id) { return State.marcas.find(m => m.id === id) || null; }

// ── DASHBOARD ───────────────────────────────────────────────────────
function renderStats() {
  const total = State.productos.length;
  const ok = State.productos.filter(p => estadoProd(p).key === 'ok').length;
  const bajo = State.productos.filter(p => estadoProd(p).key === 'bajo').length;
  const ag = State.productos.filter(p => estadoProd(p).key === 'agotado').length;
  const val = State.productos.reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0);
  const cs = 'cursor:pointer;transition:all .15s';
  document.getElementById('stats-row').innerHTML =
    `<div class="stat-card" style="${cs}" onclick="Admin.filtrarPorEstado('')"><div class="stat-label">Productos</div><div class="stat-val accent">${total}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">Ver todos ›</div></div>` +
    `<div class="stat-card" style="${cs}" onclick="Admin.filtrarPorEstado('ok')"><div class="stat-label">Estado OK</div><div class="stat-val green">${ok}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">Ver lista ›</div></div>` +
    `<div class="stat-card" style="${cs}" onclick="Admin.filtrarPorEstado('bajo')"><div class="stat-label">Stock bajo</div><div class="stat-val warn">${bajo}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">Ver lista ›</div></div>` +
    `<div class="stat-card" style="${cs}" onclick="Admin.filtrarPorEstado('agotado')"><div class="stat-label">Agotados</div><div class="stat-val danger">${ag}</div><div style="font-size:10px;color:var(--text3);margin-top:4px">Ver lista ›</div></div>` +
    `<div class="stat-card"><div class="stat-label">Valor inventario</div><div class="stat-val accent" style="font-size:17px">${fmt$(val)}</div></div>`;

  // Badge en sidebar "Vencimientos" con count
  actualizarBadgeVencimientos();
}

function actualizarBadgeVencimientos() {
  const porVencer = State.productos.filter(p => {
    const ev = estadoVencimiento(p);
    return ev && (ev.key === 'vencido' || ev.key === 'por-vencer');
  }).length;
  const badge = document.getElementById('nav-badge-vencimientos');
  if (badge) {
    badge.textContent = porVencer;
    badge.style.display = porVencer > 0 ? 'inline-block' : 'none';
  }
}

function filtrarPorEstado(e) {
  const s = document.getElementById('fil-estado'); if (s) s.value = e;
  const b = document.getElementById('buscar-prod'); if (b) b.value = '';
  const btn = document.querySelector('.nav-item[onclick*="\'productos\'"]');
  showSection('productos', btn);
}

const CAT_COLORS = { 'Chocolates': '#8b4513', 'Caramelos': '#e91e63', 'Chicles': '#4caf50', 'Alfajores': '#d4a574', 'Otros': '#6b8e8e' };

function renderCharts() {
  const cats = [...new Set(State.productos.map(p => p.cat))].filter(Boolean);
  const ctxC = document.getElementById('chart-categorias');
  if (ctxC) {
    if (State.chartCat) State.chartCat.destroy();
    State.chartCat = new Chart(ctxC, {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{
          data: cats.map(c => State.productos.filter(p => p.cat === c).reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0)),
          backgroundColor: cats.map(c => CAT_COLORS[c] || '#888'),
          borderWidth: 0, hoverOffset: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: true, position: 'right', labels: { color: '#64748b', font: { size: 10 }, boxWidth: 10, padding: 8 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt$(c.raw)}` } } } }
    });
  }

  const mUsadas = State.marcas.filter(m => State.productos.some(p => p.marcaId === m.id));
  const mData = mUsadas.map(m => ({ n: m.nombre, v: State.productos.filter(p => p.marcaId === m.id).reduce((a, p) => a + stockTotal(p), 0) })).sort((a, b) => b.v - a.v).slice(0, 10);
  const ctxM = document.getElementById('chart-marcas');
  if (ctxM) {
    if (State.chartMar) State.chartMar.destroy();
    State.chartMar = new Chart(ctxM, {
      type: 'bar',
      data: {
        labels: mData.map(m => m.n),
        datasets: [{ data: mData.map(m => m.v), backgroundColor: 'rgba(190,24,93,0.7)', borderRadius: 5, borderWidth: 0, hoverBackgroundColor: 'rgba(190,24,93,1)' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw.toLocaleString('es-AR')} uds` } } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 35 } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } } } }
    });
  }
}

function renderDashboard() {
  renderStats();

  const alertas = State.productos.filter(p => estadoProd(p).key !== 'ok').sort((a, b) => stockTotal(a) - stockTotal(b));
  document.getElementById('dash-alertas').innerHTML = alertas.length
    ? alertas.slice(0, 10).map(p => {
        const e = estadoProd(p), m = getMarca(p.marcaId);
        return `<div class="alert-row"><div class="alert-dot" style="background:${stockTotal(p) === 0 ? 'var(--danger)' : 'var(--warn)'}"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">${p.nombre}</div><div style="font-size:11px;color:var(--text3)">${m ? m.nombre + ' · ' : ''}${p.variedad || ''} — Stock: ${stockTotal(p)}</div></div><span class="badge ${e.cls}">${e.label}</span></div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--green);padding:8px 0">✓ Sin alertas activas.</div>';

  // Movimientos agrupados
  const grupos = []; const vistos = new Set();
  [...State.movimientos].forEach(m => {
    if (m.lote) {
      if (!vistos.has(m.lote)) {
        vistos.add(m.lote);
        const delLote = State.movimientos.filter(x => x.lote === m.lote);
        const totalUds = delLote.reduce((s, x) => s + x.cant, 0);
        grupos.push({ tipo: 'lote', lote: m.lote, fecha: m.fecha, items: delLote, totalUds, movTipo: m.tipo });
      }
    } else {
      grupos.push({ tipo: 'individual', ...m });
    }
  });
  const primeros = grupos.slice(0, 8);
  document.getElementById('dash-movs').innerHTML = State.movimientos.length ? primeros.map(g => {
    if (g.tipo === 'lote') {
      const icono = g.movTipo === 'entrada' ? '📥' : '📤';
      const color = g.movTipo === 'entrada' ? 'var(--green)' : 'var(--danger)';
      const signo = g.movTipo === 'entrada' ? '+' : '-';
      const itemsHtml = g.items.map(it => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--text2)">${it.nombre}</span><span style="font-weight:700;color:${color}">${signo}${it.cant}</span></div>`).join('');
      return `<div style="border-bottom:1px solid var(--border)"><div onclick="const det=this.nextElementSibling;const abre=det.style.display==='none';det.style.display=abre?'block':'none';this.querySelector('.arr').textContent=abre?'▼':'▶';if(abre)setTimeout(()=>det.scrollIntoView({behavior:'smooth',block:'nearest'}),50)" style="display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer;user-select:none"><span style="font-size:18px">${icono}</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${g.lote}</div><div style="font-size:11px;color:var(--text3)">${g.items.length} productos · ${signo}${g.totalUds} uds · ${g.fecha}</div></div><span class="arr" style="color:var(--text3);font-size:12px">▶</span></div><div style="display:none;padding:0 0 10px 28px">${itemsHtml}</div></div>`;
    } else {
      const color = g.tipo === 'entrada' ? 'mov-entrada' : 'mov-salida';
      const signo = g.tipo === 'entrada' ? '+' + g.cant : '-' + g.cant;
      return `<div class="mov-row"><span class="mov-type ${color}">${signo}</span><div style="flex:1"><div style="font-size:13px">${g.nombre}</div><div style="font-size:11px;color:var(--text3)">${g.motivo || ''} ${g.fecha}</div></div></div>`;
    }
  }).join('') : '<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin movimientos aún.</div>';

  document.getElementById('dash-marcas').innerHTML = State.marcas.filter(mr => State.productos.some(p => p.marcaId === mr.id)).map(mr => {
    const ps = State.productos.filter(p => p.marcaId === mr.id);
    return `<div class="marca-card"><div class="marca-card-name">${mr.nombre}</div><div class="marca-card-sub">${ps.length} variedad${ps.length !== 1 ? 'es' : ''}</div><div class="marca-card-stock">${ps.reduce((a, p) => a + stockTotal(p), 0)}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">unidades</div></div>`;
  }).join('');

  setTimeout(renderCharts, 50);
}

// ── PRODUCTOS (con lotes) ───────────────────────────────────────────
function onBarcodeInput(val) {
  if (val.length < 6) { document.getElementById('barcode-fb').textContent = ''; return; }
  const p = findByBarcode(val, State.productos), fb = document.getElementById('barcode-fb');
  if (p) { fb.style.color = 'var(--green)'; fb.textContent = '✓ ' + p.nombre; cargarEnForm(p); }
  else { fb.style.color = 'var(--accent)'; fb.textContent = 'Código nuevo — completá los datos.'; }
}

function cargarEnForm(p) {
  const fields = {
    'p-nombre': p.nombre || '',
    'p-cat': p.cat || 'Chocolates',
    'p-marca': p.marcaId || '',
    'p-variedad': p.variedad || '',
    'p-presentacion': p.presentacion || 'Unidad',
    'p-min': p.min || 5,
    'p-costo': p.costo || '',
    'p-venta': p.venta || '',
    'p-ubic': p.ubic || '',
    'p-notas': p.notas || '',
    'p-prov': p.provId || ''
  };
  for (const id in fields) {
    const el = document.getElementById(id); if (el) el.value = fields[id];
  }
  const extraInput = document.getElementById('p-barcodes-extra');
  if (extraInput) extraInput.value = (p.barcodes && p.barcodes.length > 0) ? p.barcodes.join(', ') : '';

  const ult = State.historialPrecios.filter(h => h.prodId === p.id).sort((a, b) => b.ts - a.ts)[0];
  document.getElementById('p-costo-prev').textContent = ult && ult.costoAnterior ? `Anterior: ${fmt$(ult.costoAnterior)} (${ult.fecha})` : '';
  document.getElementById('p-venta-prev').textContent = ult && ult.ventaAnterior ? `Anterior: ${fmt$(ult.ventaAnterior)} (${ult.fecha})` : '';

  State.editingId = p.id;
  document.getElementById('btn-guardar').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar').style.display = 'inline-flex';

  // Mostrar lotes del producto
  renderLotesForm(p);
}

function renderLotesForm(p) {
  const wrap = document.getElementById('lotes-form-wrap');
  if (!wrap) return;
  wrap.style.display = 'block';

  const lotes = lotesFIFO(p);
  const listEl = document.getElementById('lotes-list');

  if (!lotes.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Sin lotes. Usá el form de abajo para agregar uno.</div>';
  } else {
    listEl.innerHTML = lotes.map(l => {
      const dias = diasHastaVto(l.vto);
      let cls = '', etiqueta = '';
      if (l.vto) {
        if (dias < 0) { cls = 'vencido'; etiqueta = `<span style="color:var(--danger);font-weight:700">Vencido hace ${-dias}d</span>`; }
        else if (dias <= 30) { cls = 'por-vencer'; etiqueta = `<span style="color:var(--warn);font-weight:700">Vence en ${dias}d</span>`; }
        else etiqueta = `<span style="color:var(--text3)">Vence en ${dias}d</span>`;
      }
      return `<div class="lote-item ${cls}"><span class="lote-qty">${l.cant} uds</span><div style="flex:1"><div class="lote-fecha">${l.vto ? 'Vto: ' + fmtFecha(l.vto) : 'Sin vencimiento'}</div><div style="font-size:10px;color:var(--text3)">Recepción: ${fmtFecha(l.fechaRecepcion) || '—'} ${etiqueta ? '· ' + etiqueta : ''}</div></div><button class="btn btn-sm btn-danger" onclick="Admin.eliminarLote(${p.id}, '${l.id}')">✕</button></div>`;
    }).join('');
  }
}

function eliminarLote(prodId, loteId) {
  const p = State.productos.find(x => x.id === prodId); if (!p) return;
  if (!confirm('¿Eliminar este lote? El stock del producto se ajustará.')) return;
  p.lotes = p.lotes.filter(l => l.id !== loteId);
  p.stock = stockTotal(p);
  renderLotesForm(p);
  renderTabla();
  renderStats();
  App.guardarEnFirestore();
  notify('Lote eliminado.');
}

function agregarLoteAlForm() {
  if (!State.editingId) { notify('Primero seleccioná un producto existente o guardá uno nuevo.'); return; }
  const cant = parseInt(document.getElementById('lote-cant').value) || 0;
  const vto = document.getElementById('lote-vto').value || null;
  if (cant <= 0) { notify('Ingresá una cantidad válida.'); return; }
  const p = State.productos.find(x => x.id === State.editingId); if (!p) return;
  agregarLote(p, cant, vto);
  State.movimientos.unshift({ prodId: p.id, nombre: p.nombre, tipo: 'entrada', cant, motivo: 'Nuevo lote' + (vto ? ' (vto ' + fmtFecha(vto) + ')' : ''), fecha: todayStr(), ts: Date.now() });
  document.getElementById('lote-cant').value = '';
  document.getElementById('lote-vto').value = '';
  renderLotesForm(p);
  renderTabla();
  renderStats();
  App.guardarEnFirestore();
  notify('Lote agregado: +' + cant + ' uds.');
}

function limpiarForm() {
  ['p-barcode', 'p-nombre', 'p-variedad', 'p-min', 'p-costo', 'p-venta', 'p-ubic', 'p-notas', 'p-barcodes-extra'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('p-cat').value = 'Chocolates';
  document.getElementById('p-marca').value = '';
  document.getElementById('p-presentacion').value = 'Unidad';
  document.getElementById('p-prov').value = '';
  document.getElementById('barcode-fb').textContent = '';
  document.getElementById('p-costo-prev').textContent = '';
  document.getElementById('p-venta-prev').textContent = '';
  State.editingId = null;
  document.getElementById('btn-guardar').textContent = '+ Agregar';
  document.getElementById('btn-cancelar').style.display = 'none';
  const wrap = document.getElementById('lotes-form-wrap'); if (wrap) wrap.style.display = 'none';
}

function guardarProducto() {
  const nombre = document.getElementById('p-nombre').value.trim();
  if (!nombre) { notify('Ingresá un nombre.'); return; }
  const nc = parseFloat(document.getElementById('p-costo').value) || 0;
  const nv = parseFloat(document.getElementById('p-venta').value) || 0;
  const extraRaw = document.getElementById('p-barcodes-extra').value.trim();
  const barcodesExtra = extraRaw ? extraRaw.split(',').map(b => b.trim()).filter(b => b.length > 0) : [];
  const data = {
    barcode: document.getElementById('p-barcode').value.trim() || null,
    barcodes: barcodesExtra,
    nombre,
    cat: document.getElementById('p-cat').value,
    marcaId: parseInt(document.getElementById('p-marca').value) || null,
    variedad: document.getElementById('p-variedad').value.trim() || null,
    presentacion: document.getElementById('p-presentacion').value,
    min: parseInt(document.getElementById('p-min').value) || 5,
    costo: nc,
    venta: nv,
    ubic: document.getElementById('p-ubic').value.trim() || null,
    provId: parseInt(document.getElementById('p-prov').value) || null,
    notas: document.getElementById('p-notas').value.trim() || null
  };

  if (State.editingId) {
    const po = State.productos.find(p => p.id === State.editingId);
    if (po && (po.costo !== nc || po.venta !== nv)) {
      State.historialPrecios.unshift({ prodId: State.editingId, nombre: po.nombre, fecha: todayStr(), ts: Date.now(), costoAnterior: po.costo, costoNuevo: nc, ventaAnterior: po.venta, ventaNuevo: nv });
    }
    Object.assign(po, data);
    notify('Actualizado.');
    renderLotesForm(po);
  } else {
    // Nuevo producto: stock inicial opcional
    const stockInicial = parseInt(document.getElementById('p-stock-inicial').value) || 0;
    const vtoInicial = document.getElementById('p-vto-inicial').value || null;
    const nuevo = { id: State.nextProdId++, ...data, stock: 0, lotes: [] };
    if (stockInicial > 0) {
      agregarLote(nuevo, stockInicial, vtoInicial);
      State.movimientos.unshift({ prodId: nuevo.id, nombre: nuevo.nombre, tipo: 'entrada', cant: stockInicial, motivo: 'Stock inicial', fecha: todayStr(), ts: Date.now() });
    }
    State.productos.push(nuevo);
    State.editingId = nuevo.id;
    document.getElementById('btn-guardar').textContent = 'Guardar cambios';
    document.getElementById('btn-cancelar').style.display = 'inline-flex';
    renderLotesForm(nuevo);
    notify('Producto agregado. Podés agregar más lotes abajo.');
  }
  renderTabla();
  renderStats();
  App.guardarEnFirestore();
}

function eliminarProducto(id) {
  if (!confirm('¿Eliminar producto?')) return;
  State.productos = State.productos.filter(p => p.id !== id);
  renderTabla(); renderStats();
  notify('Eliminado.');
  App.guardarEnFirestore();
}

function editarProducto(id) {
  const p = State.productos.find(x => x.id === id);
  if (p) {
    document.getElementById('p-barcode').value = p.barcode || '';
    cargarEnForm(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderTabla() {
  const bus = (document.getElementById('buscar-prod')?.value || '').toLowerCase();
  const fc = document.getElementById('fil-cat')?.value || '';
  const fm = document.getElementById('fil-marca')?.value || '';
  const fe = document.getElementById('fil-estado')?.value || '';
  const lista = State.productos.filter(p => {
    const m = getMarca(p.marcaId);
    return (!bus || p.nombre.toLowerCase().includes(bus) || getAllBarcodes(p).some(b => b.includes(bus)) || (p.variedad || '').toLowerCase().includes(bus) || (m && m.nombre.toLowerCase().includes(bus)))
      && (!fc || p.cat === fc)
      && (!fm || String(p.marcaId) === fm)
      && (!fe || estadoProd(p).key === fe);
  });
  const tb = document.getElementById('tabla-productos');
  if (!lista.length) { tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:20px">Sin resultados.</td></tr>'; return; }
  tb.innerHTML = lista.map(p => {
    const e = estadoProd(p), m = getMarca(p.marcaId);
    const ev = estadoVencimiento(p);
    const nLotes = Array.isArray(p.lotes) ? p.lotes.length : 0;
    return `<tr>
      <td class="mono col-hide-mob" title="${getAllBarcodes(p).join(', ')}">${p.barcode || '—'}${p.barcodes && p.barcodes.length > 0 ? '<span style="font-size:9px;color:var(--accent);margin-left:3px">+' + p.barcodes.length + '</span>' : ''}</td>
      <td style="font-weight:600;max-width:160px;white-space:normal;line-height:1.3">${p.nombre}</td>
      <td class="col-hide-mob"><span class="badge badge-cat">${p.cat}</span></td>
      <td>${m ? `<span class="badge badge-marca">${m.nombre}</span>` : '—'}</td>
      <td class="col-hide-mob" style="color:var(--text2);font-size:12px">${p.variedad || '—'}</td>
      <td class="col-hide-mob" style="color:var(--text2);font-size:12px">${p.presentacion || '—'}</td>
      <td style="font-weight:600">${stockTotal(p)}${nLotes > 1 ? `<span style="font-size:9px;color:var(--accent);margin-left:3px">${nLotes}L</span>` : ''}</td>
      <td class="col-hide-mob">${ev ? `<span class="badge ${ev.cls}" style="font-size:10px">${ev.label}</span>` : '—'}</td>
      <td class="col-hide-mob">${p.costo ? fmt$(p.costo) : '—'}</td>
      <td class="col-hide-mob">${p.venta ? fmt$(p.venta) : '—'}</td>
      <td class="col-hide-mob" ${margenCls(p.costo, p.venta)}>${margen(p.costo, p.venta)}</td>
      <td><span class="badge ${e.cls}">${e.label}</span></td>
      <td><div class="btn-row"><button class="btn btn-sm" onclick="Admin.editarProducto(${p.id})">Editar</button><button class="btn btn-sm btn-danger" onclick="Admin.eliminarProducto(${p.id})">✕</button></div></td>
    </tr>`;
  }).join('');
}

function renderSelectMarca() {
  document.getElementById('p-marca').innerHTML = '<option value="">— Sin marca —</option>' + State.marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}
function renderSelectProv() {
  const s = document.getElementById('p-prov'); if (s) s.innerHTML = '<option value="">— Sin proveedor —</option>' + State.proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
}
function renderFiltroMarca() {
  const s = document.getElementById('fil-marca'); if (s) s.innerHTML = '<option value="">Todas las marcas</option>' + State.marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

// ── MARCAS ──────────────────────────────────────────────────────────
function agregarMarca() {
  const n = document.getElementById('mr-nombre').value.trim();
  if (!n) { notify('Ingresá un nombre.'); return; }
  State.marcas.push({ id: State.nextMarcaId++, nombre: n, cat: document.getElementById('mr-cat').value });
  document.getElementById('mr-nombre').value = '';
  renderMarcas(); renderSelectMarca(); renderFiltroMarca();
  notify('Marca agregada.');
  App.guardarEnFirestore();
}
function eliminarMarca(id) {
  if (State.productos.some(p => p.marcaId === id)) { notify('No se puede: tiene productos asociados.'); return; }
  if (!confirm('¿Eliminar marca?')) return;
  State.marcas = State.marcas.filter(m => m.id !== id);
  renderMarcas(); renderSelectMarca(); renderFiltroMarca();
  notify('Eliminada.');
  App.guardarEnFirestore();
}
function renderMarcas() {
  const el = document.getElementById('lista-marcas');
  if (!State.marcas.length) { el.innerHTML = '<div style="font-size:13px;color:var(--text3)">Sin marcas.</div>'; return; }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">` + State.marcas.map(m => {
    const ps = State.productos.filter(p => p.marcaId === m.id);
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px"><div style="font-weight:700;font-size:14px;margin-bottom:2px">${m.nombre}</div><div style="font-size:11px;color:var(--text3);margin-bottom:8px">${m.cat} · ${ps.length} producto${ps.length !== 1 ? 's' : ''}</div>${ps.map(p => `<div style="font-size:11px;color:var(--text2);padding:2px 0;border-bottom:1px solid var(--border)">${p.variedad || p.nombre} — <span style="color:var(--accent)">${stockTotal(p)}</span></div>`).join('')}<div style="margin-top:8px"><button class="btn btn-sm btn-danger" onclick="Admin.eliminarMarca(${m.id})">✕ Eliminar</button></div></div>`;
  }).join('') + '</div>';
}

// ── PROVEEDORES ─────────────────────────────────────────────────────
function agregarProveedor() {
  const n = document.getElementById('pv-nombre').value.trim();
  if (!n) { notify('Ingresá el nombre.'); return; }
  State.proveedores.push({ id: State.nextProvId++, nombre: n, contacto: document.getElementById('pv-contacto').value.trim(), tel: document.getElementById('pv-tel').value.trim(), email: document.getElementById('pv-email').value.trim(), dia: document.getElementById('pv-dia').value });
  ['pv-nombre', 'pv-contacto', 'pv-tel', 'pv-email'].forEach(id => document.getElementById(id).value = '');
  renderProveedores(); renderSelectProv();
  notify('Proveedor agregado.');
  App.guardarEnFirestore();
}
function eliminarProveedor(id) {
  if (!confirm('¿Eliminar?')) return;
  State.proveedores = State.proveedores.filter(p => p.id !== id);
  renderProveedores(); renderSelectProv();
  notify('Eliminado.');
  App.guardarEnFirestore();
}
function renderProveedores() {
  const el = document.getElementById('lista-proveedores');
  el.innerHTML = State.proveedores.length ? State.proveedores.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);flex-wrap:wrap"><div><div style="font-weight:700;font-size:14px">${p.nombre}</div><div style="font-size:12px;color:var(--text2)">${p.contacto ? p.contacto + ' · ' : ''} ${p.tel || ''} ${p.email ? '· ' + p.email : ''}</div></div><div style="display:flex;align-items:center;gap:10px">${p.dia ? `<span class="badge badge-marca">${p.dia}</span>` : ''}<button class="btn btn-sm btn-danger" onclick="Admin.eliminarProveedor(${p.id})">✕</button></div></div>`).join('') : '<div style="font-size:13px;color:var(--text3)">Sin proveedores.</div>';
}

// ── ALERTAS ─────────────────────────────────────────────────────────
function renderAlertas() {
  const lista = State.productos.filter(p => estadoProd(p).key !== 'ok').sort((a, b) => stockTotal(a) - stockTotal(b));
  document.getElementById('alertas-lista').innerHTML = lista.length ? lista.map(p => {
    const e = estadoProd(p), m = getMarca(p.marcaId);
    return `<div class="alert-row"><div class="alert-dot" style="background:${stockTotal(p) === 0 ? 'var(--danger)' : 'var(--warn)'}"></div><div style="flex:1"><div style="font-size:14px;font-weight:700">${p.nombre}</div><div style="font-size:12px;color:var(--text2)">${m ? m.nombre + ' — ' : ''}${p.variedad || p.cat} — ${p.presentacion}</div><div style="font-size:11px;color:var(--text3)">Stock: ${stockTotal(p)} / Mínimo: ${p.min} · Ubicación: ${p.ubic || '—'}</div></div><span class="badge ${e.cls}">${e.label}</span></div>`;
  }).join('') : '<div style="font-size:14px;color:var(--green);padding:12px 0;font-weight:600">✓ Todos los productos tienen stock suficiente.</div>';
}

// ── VENCIMIENTOS ────────────────────────────────────────────────────
function renderVencimientos() {
  const lista = [];
  State.productos.forEach(p => {
    if (Array.isArray(p.lotes)) {
      p.lotes.forEach(l => {
        if (l.vto && l.cant > 0) {
          const dias = diasHastaVto(l.vto);
          lista.push({ p, lote: l, dias });
        }
      });
    }
  });
  lista.sort((a, b) => a.dias - b.dias);

  const vencidos = lista.filter(x => x.dias < 0);
  const proximos = lista.filter(x => x.dias >= 0 && x.dias <= 30);
  const futuros = lista.filter(x => x.dias > 30);

  const html = [];

  html.push(`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Vencidos</div><div class="stat-val danger">${vencidos.length}</div><div style="font-size:11px;color:var(--text3)">Lotes a dar de baja</div></div>
    <div class="stat-card"><div class="stat-label">Por vencer (30d)</div><div class="stat-val warn">${proximos.length}</div><div style="font-size:11px;color:var(--text3)">Priorizar venta</div></div>
    <div class="stat-card"><div class="stat-label">Con vencimiento</div><div class="stat-val accent">${lista.length}</div><div style="font-size:11px;color:var(--text3)">Total lotes</div></div>
  </div>`);

  if (vencidos.length) {
    html.push(`<div class="card"><div class="card-title" style="color:var(--danger);margin-bottom:12px">⚠ Vencidos (${vencidos.length})</div>`);
    vencidos.forEach(x => {
      const m = getMarca(x.p.marcaId);
      html.push(`<div class="alert-row"><div class="alert-dot" style="background:var(--danger)"></div><div style="flex:1"><div style="font-size:14px;font-weight:700">${x.p.nombre}</div><div style="font-size:12px;color:var(--text2)">${m ? m.nombre + ' · ' : ''}${x.lote.cant} uds · Venció ${fmtFecha(x.lote.vto)}</div></div><button class="btn btn-sm btn-danger" onclick="Admin.darDeBajaLote(${x.p.id}, '${x.lote.id}')">Dar de baja</button></div>`);
    });
    html.push(`</div>`);
  }

  if (proximos.length) {
    html.push(`<div class="card"><div class="card-title" style="color:var(--warn);margin-bottom:12px">📅 Por vencer en los próximos 30 días (${proximos.length})</div>`);
    proximos.forEach(x => {
      const m = getMarca(x.p.marcaId);
      html.push(`<div class="alert-row"><div class="alert-dot" style="background:var(--warn)"></div><div style="flex:1"><div style="font-size:14px;font-weight:700">${x.p.nombre}</div><div style="font-size:12px;color:var(--text2)">${m ? m.nombre + ' · ' : ''}${x.lote.cant} uds · Vence en ${x.dias} día${x.dias !== 1 ? 's' : ''} (${fmtFecha(x.lote.vto)})</div></div><span class="badge badge-por-vencer">${x.dias}d</span></div>`);
    });
    html.push(`</div>`);
  }

  if (!vencidos.length && !proximos.length) {
    html.push(`<div class="card"><div style="padding:20px 0;text-align:center;color:var(--green);font-weight:600">✓ No hay productos próximos a vencer.</div></div>`);
  }

  if (futuros.length) {
    html.push(`<div class="card"><div class="card-title" style="margin-bottom:12px">✓ Con stock y vencimiento futuro (${futuros.length})</div><div style="max-height:300px;overflow-y:auto">`);
    futuros.forEach(x => {
      const m = getMarca(x.p.marcaId);
      html.push(`<div class="rep-row"><div style="flex:1"><div style="font-size:13px;font-weight:600">${x.p.nombre}</div><div style="font-size:11px;color:var(--text3)">${m ? m.nombre + ' · ' : ''}${x.lote.cant} uds</div></div><div style="font-size:12px;color:var(--text2);font-family:'DM Mono',monospace">${fmtFecha(x.lote.vto)}</div></div>`);
    });
    html.push(`</div></div>`);
  }

  document.getElementById('sec-vencimientos').innerHTML = html.join('');
}

function darDeBajaLote(prodId, loteId) {
  const p = State.productos.find(x => x.id === prodId); if (!p) return;
  const lote = p.lotes.find(l => l.id === loteId); if (!lote) return;
  if (!confirm(`¿Dar de baja ${lote.cant} uds de ${p.nombre} (vencidas)?`)) return;
  const cant = lote.cant;
  p.lotes = p.lotes.filter(l => l.id !== loteId);
  p.stock = stockTotal(p);
  State.movimientos.unshift({ prodId: p.id, nombre: p.nombre, tipo: 'salida', cant, motivo: 'Baja por vencimiento (' + fmtFecha(lote.vto) + ')', fecha: todayStr(), ts: Date.now() });
  renderVencimientos();
  renderStats();
  App.guardarEnFirestore();
  notify(`Dadas de baja ${cant} uds.`);
}

// ── REPORTE ─────────────────────────────────────────────────────────
function renderReporte() {
  const tc = State.productos.reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0);
  const tv = State.productos.reduce((a, p) => a + stockTotal(p) * (p.venta || 0), 0);
  document.getElementById('rep-stats').innerHTML = `<div class="stat-card"><div class="stat-label">Valor a costo</div><div class="stat-val accent" style="font-size:18px">${fmt$(tc)}</div></div><div class="stat-card"><div class="stat-label">Valor a precio venta</div><div class="stat-val accent" style="font-size:18px">${fmt$(tv)}</div></div><div class="stat-card"><div class="stat-label">Ganancia potencial</div><div class="stat-val green" style="font-size:18px">${fmt$(tv - tc)}</div></div>`;

  const cats = [...new Set(State.productos.map(p => p.cat))];
  const maxC = Math.max(...cats.map(c => State.productos.filter(p => p.cat === c).reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0)), 1);
  document.getElementById('rep-cats').innerHTML = cats.map(c => { const v = State.productos.filter(p => p.cat === c).reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0); return `<div class="rep-row"><span style="font-size:13px;font-weight:600;min-width:140px">${c}</span><div class="prog-bg" style="flex:1"><div class="prog-fill" style="width:${Math.round(v / maxC * 100)}%"></div></div><span style="font-size:12px;color:var(--text2);min-width:80px;text-align:right">${fmt$(v)}</span></div>`; }).join('');

  const mrc = State.marcas.filter(m => State.productos.some(p => p.marcaId === m.id));
  const maxM = Math.max(...mrc.map(m => State.productos.filter(p => p.marcaId === m.id).reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0)), 1);
  document.getElementById('rep-marcas').innerHTML = mrc.map(m => { const ps = State.productos.filter(p => p.marcaId === m.id); const v = ps.reduce((a, p) => a + stockTotal(p) * (p.costo || 0), 0); const u = ps.reduce((a, p) => a + stockTotal(p), 0); return `<div class="rep-row"><div style="min-width:130px"><div style="font-size:13px;font-weight:600">${m.nombre}</div><div style="font-size:11px;color:var(--text3)">${u} uds · ${ps.length} var.</div></div><div class="prog-bg" style="flex:1"><div class="prog-fill" style="width:${Math.round(v / maxM * 100)}%;background:var(--accent)"></div></div><span style="font-size:12px;color:var(--text2);min-width:80px;text-align:right">${fmt$(v)}</span></div>`; }).join('');

  document.getElementById('tabla-reporte').innerHTML = State.productos.map(p => { const m = getMarca(p.marcaId); return `<tr><td class="mono col-hide-mob" title="${getAllBarcodes(p).join(', ')}">${p.barcode || '—'}${p.barcodes && p.barcodes.length > 0 ? '<span style="font-size:9px;color:var(--accent);margin-left:3px">+' + p.barcodes.length + '</span>' : ''}</td><td style="font-weight:600">${p.nombre}</td><td class="col-hide-mob"><span class="badge badge-cat">${p.cat}</span></td><td>${m ? `<span class="badge badge-marca">${m.nombre}</span>` : '—'}</td><td class="col-hide-mob" style="color:var(--text2);font-size:12px">${p.variedad || '—'}</td><td class="col-hide-mob" style="color:var(--text2);font-size:12px">${p.presentacion || '—'}</td><td style="font-weight:600">${stockTotal(p)}</td><td class="col-hide-mob">${p.costo ? fmt$(p.costo) : '—'}</td><td class="col-hide-mob">${p.venta ? fmt$(p.venta) : '—'}</td><td class="col-hide-mob" ${margenCls(p.costo, p.venta)}>${margen(p.costo, p.venta)}</td><td style="font-weight:600">${fmt$(stockTotal(p) * (p.costo || 0))}</td></tr>`; }).join('');
  document.getElementById('tfoot-reporte').innerHTML = `<tr style="background:var(--surface2)"><td colspan="10" style="font-weight:700;font-size:13px;text-transform:uppercase">Total</td><td style="font-weight:700">${fmt$(tc)}</td></tr>`;
}

// ── HISTORIAL PRECIOS ───────────────────────────────────────────────
function renderHistorialPrecios() {
  const el = document.getElementById('historial-precios-container');
  const bus = (document.getElementById('buscar-precios')?.value || '').toLowerCase();
  const lista = State.historialPrecios.filter(h => !bus || h.nombre.toLowerCase().includes(bus));
  if (!lista.length) { el.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:20px 0;text-align:center">Sin cambios de precios registrados.<br><span style="font-size:12px">Se registran automáticamente al editar.</span></div>'; return; }
  const pp = {};
  lista.forEach(h => { if (!pp[h.prodId]) pp[h.prodId] = { nombre: h.nombre, cambios: [] }; pp[h.prodId].cambios.push(h); });
  el.innerHTML = Object.values(pp).map(({ nombre, cambios }) => {
    const rows = cambios.sort((a, b) => b.ts - a.ts).map(h => {
      const dc = h.costoNuevo - h.costoAnterior, dv = h.ventaNuevo - h.ventaAnterior;
      const cc = dc > 0 ? 'var(--danger)' : dc < 0 ? 'var(--green)' : 'var(--text3)';
      const cv = dv > 0 ? 'var(--warn)' : dv < 0 ? 'var(--green)' : 'var(--text3)';
      return `<div class="precio-hist-row"><span style="color:var(--text3)">${h.fecha}</span><div style="flex:1;margin:0 16px"><span style="font-size:11px;color:var(--text3)">Costo: </span>${fmt$(h.costoAnterior)}<span style="color:var(--text3);margin:0 4px">→</span><b>${fmt$(h.costoNuevo)}</b><span style="color:${cc};margin-left:4px;font-weight:700">${dc > 0 ? '↑' : '↓'} ${Math.abs(dc) ? fmt$(Math.abs(dc)) : ''}</span></div><div><span style="font-size:11px;color:var(--text3)">Venta: </span>${fmt$(h.ventaAnterior)}<span style="color:var(--text3);margin:0 4px">→</span><b>${fmt$(h.ventaNuevo)}</b><span style="color:${cv};margin-left:4px;font-weight:700">${dv > 0 ? '↑' : '↓'} ${Math.abs(dv) ? fmt$(Math.abs(dv)) : ''}</span></div></div>`;
    }).join('');
    return `<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden"><div style="background:var(--surface2);padding:10px 16px;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between"><span>${nombre}</span><span style="font-size:11px;color:var(--text3);font-weight:400">${cambios.length} cambio${cambios.length !== 1 ? 's' : ''}</span></div><div style="padding:0 16px">${rows}</div></div>`;
  }).join('');
}

// ── RETIROS EN LOTE (usa FIFO) ──────────────────────────────────────
let retCart = [], retProd = null;
function retBuscar(val) {
  const sug = document.getElementById('ret-sug');
  if (!val) { sug.style.display = 'none'; return; }
  const v = val.toLowerCase();
  const hits = State.productos.filter(p => p.nombre.toLowerCase().includes(v) || getAllBarcodes(p).some(b => b.includes(v))).slice(0, 12);
  if (!hits.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = hits.map(p => { const m = getMarca(p.marcaId); return '<div onclick="Admin.retSel(' + p.id + ')" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px"><span style="font-weight:600">' + p.nombre + '</span><span style="color:var(--text2);font-size:11px;margin-left:8px">' + (m ? m.nombre : '') + '</span><span style="float:right;color:' + (stockTotal(p) > 0 ? 'var(--green)' : 'var(--danger)') + ';font-size:11px">' + stockTotal(p) + ' uds</span></div>'; }).join('');
  sug.style.display = 'block';
}
function retSel(id) {
  retProd = State.productos.find(p => p.id === id);
  document.getElementById('ret-buscar').value = retProd.nombre;
  document.getElementById('ret-sug').style.display = 'none';
  const c = document.getElementById('ret-cant'); c.focus(); c.select();
}
function retAgregar() {
  if (!retProd) { notify('Seleccioná un producto primero.'); return; }
  const cant = parseInt(document.getElementById('ret-cant').value) || 1;
  const ex = retCart.find(x => x.id === retProd.id);
  if (ex) ex.cant += cant;
  else retCart.push({ id: retProd.id, nombre: retProd.nombre, marcaId: retProd.marcaId, stock: stockTotal(retProd), cant });
  retProd = null;
  document.getElementById('ret-buscar').value = '';
  document.getElementById('ret-cant').value = 1;
  document.getElementById('ret-buscar').focus();
  retRender();
}
function retQuit(id) { retCart = retCart.filter(x => x.id !== id); retRender(); }
function retCant(id, val) { const it = retCart.find(x => x.id === id); if (it) it.cant = Math.max(1, parseInt(val) || 1); retRender(); }
function retRender() {
  const wrap = document.getElementById('ret-tabla-wrap'), vacio = document.getElementById('ret-vacio'), badge = document.getElementById('ret-badge'), tot = document.getElementById('ret-total');
  if (!retCart.length) { wrap.style.display = 'none'; vacio.style.display = 'block'; badge.textContent = 'vacío'; if (tot) tot.textContent = '0'; return; }
  wrap.style.display = 'block'; vacio.style.display = 'none';
  const sum = retCart.reduce((s, x) => s + x.cant, 0);
  badge.textContent = retCart.length + ' producto(s) · ' + sum + ' uds';
  if (tot) tot.textContent = sum;
  document.getElementById('ret-tbody').innerHTML = retCart.map(it => {
    const fin = it.stock - it.cant;
    const col = fin < 0 ? 'var(--danger)' : fin <= it.stock * 0.1 ? 'var(--warn)' : 'var(--green)';
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 6px;font-weight:600">' + it.nombre + '</td><td style="padding:8px 6px;text-align:right">' + it.stock + '</td><td style="padding:8px 6px;text-align:right"><input type="number" min="1" value="' + it.cant + '" onchange="Admin.retCant(' + it.id + ',this.value)" style="width:60px;text-align:right"></td><td style="padding:8px 6px;text-align:right;font-weight:700;color:' + col + '">' + fin + '</td><td style="padding:8px 6px;text-align:right"><button onclick="Admin.retQuit(' + it.id + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:20px">×</button></td></tr>';
  }).join('');
}
function retLimpiar() { retCart = []; retProd = null; document.getElementById('ret-buscar').value = ''; document.getElementById('ret-nombre').value = ''; document.getElementById('ret-nota').value = ''; retRender(); }
function retConfirmar() {
  if (!retCart.length) { notify('El carrito está vacío.'); return; }
  const nombre = document.getElementById('ret-nombre').value.trim() || ('Retiro ' + todayStr());
  const nota = document.getElementById('ret-nota').value.trim();
  const neg = retCart.filter(x => x.stock - x.cant < 0);
  if (neg.length) { notify('Stock insuficiente en ' + neg.length + ' producto(s).'); return; }
  retCart.forEach(it => {
    const p = State.productos.find(x => x.id === it.id);
    if (p) {
      retirarFIFO(p, it.cant); // descuenta del lote más próximo a vencer
      State.movimientos.unshift({ id: Date.now() + Math.random(), prodId: it.id, nombre: it.nombre, tipo: 'salida', cant: it.cant, motivo: nombre + (nota ? ' — ' + nota : ''), fecha: todayStr(), lote: nombre });
    }
  });
  notify('Retiro confirmado: ' + retCart.length + ' productos.');
  retLimpiar(); renderStats(); renderDashboard(); renderAlertas();
  App.guardarEnFirestore();
}

// ── RECEPCIONES (crea lotes con vencimiento) ────────────────────────
let recCart = [], recProd = null;
function populateRecProv() {
  const s = document.getElementById('rec-prov');
  if (s) s.innerHTML = '<option value="">— Sin proveedor —</option>' + State.proveedores.map(p => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
}
function recBuscar(val) {
  const sug = document.getElementById('rec-sug');
  if (!val) { sug.style.display = 'none'; return; }
  const v = val.toLowerCase();
  const hits = State.productos.filter(p => p.nombre.toLowerCase().includes(v) || getAllBarcodes(p).some(b => b.includes(v))).slice(0, 12);
  if (!hits.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = hits.map(p => { const m = getMarca(p.marcaId); return '<div onclick="Admin.recSel(' + p.id + ')" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px"><span style="font-weight:600">' + p.nombre + '</span><span style="color:var(--text2);font-size:11px;margin-left:8px">' + (m ? m.nombre : '') + '</span><span style="float:right;color:var(--text2);font-size:11px">' + stockTotal(p) + ' uds</span></div>'; }).join('');
  sug.style.display = 'block';
}
function recSel(id) {
  recProd = State.productos.find(p => p.id === id);
  document.getElementById('rec-buscar').value = recProd.nombre;
  document.getElementById('rec-sug').style.display = 'none';
  const c = document.getElementById('rec-cant'); c.focus(); c.select();
}
function recAgregar() {
  if (!recProd) { notify('Seleccioná un producto primero.'); return; }
  const cant = parseInt(document.getElementById('rec-cant').value) || 1;
  const vto  = document.getElementById('rec-vto').value || null;
  recCart.push({ id: recProd.id, nombre: recProd.nombre, marcaId: recProd.marcaId, stock: stockTotal(recProd), cant, vto });
  recProd = null;
  document.getElementById('rec-buscar').value = '';
  document.getElementById('rec-cant').value = 1;
  document.getElementById('rec-vto').value = '';
  document.getElementById('rec-buscar').focus();
  recRender();
}
function recQuit(i) { recCart.splice(i, 1); recRender(); }
function recRender() {
  const wrap = document.getElementById('rec-tabla-wrap'), vacio = document.getElementById('rec-vacio'), badge = document.getElementById('rec-badge'), tot = document.getElementById('rec-total');
  if (!recCart.length) { wrap.style.display = 'none'; vacio.style.display = 'block'; badge.textContent = 'vacío'; if (tot) tot.textContent = '0'; return; }
  wrap.style.display = 'block'; vacio.style.display = 'none';
  const sum = recCart.reduce((s, x) => s + x.cant, 0);
  badge.textContent = recCart.length + ' lote(s) · ' + sum + ' uds';
  if (tot) tot.textContent = sum;
  document.getElementById('rec-tbody').innerHTML = recCart.map((it, i) => {
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 6px;font-weight:600">' + it.nombre + '</td><td style="padding:8px 6px;text-align:right">' + it.stock + '</td><td style="padding:8px 6px;text-align:right">' + it.cant + '</td><td style="padding:8px 6px;text-align:center;font-size:11px;color:var(--text2)">' + (it.vto ? fmtFecha(it.vto) : '—') + '</td><td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--green)">' + (it.stock + it.cant) + '</td><td style="padding:8px 6px;text-align:right"><button onclick="Admin.recQuit(' + i + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:20px">×</button></td></tr>';
  }).join('');
}
function recLimpiar() { recCart = []; recProd = null; document.getElementById('rec-buscar').value = ''; document.getElementById('rec-nombre').value = ''; recRender(); }
function recConfirmar() {
  if (!recCart.length) { notify('El pedido está vacío.'); return; }
  const nombre = document.getElementById('rec-nombre').value.trim() || ('Recepción ' + todayStr());
  recCart.forEach(it => {
    const p = State.productos.find(x => x.id === it.id);
    if (p) {
      agregarLote(p, it.cant, it.vto);
      State.movimientos.unshift({ id: Date.now() + Math.random(), prodId: it.id, nombre: it.nombre, tipo: 'entrada', cant: it.cant, motivo: nombre + (it.vto ? ' (vto ' + fmtFecha(it.vto) + ')' : ''), fecha: todayStr(), lote: nombre });
    }
  });
  notify('Recepción confirmada.');
  recLimpiar(); renderStats(); renderDashboard(); renderAlertas();
  App.guardarEnFirestore();
}

// ── RANKING ─────────────────────────────────────────────────────────
const RK_COLORS = { 'Chocolates': '#8b4513', 'Caramelos': '#e91e63', 'Chicles': '#4caf50', 'Alfajores': '#d4a574', 'Otros': '#6b8e8e', 'General': '#9a7ac8' };
function renderRanking() {
  const cEl = document.getElementById('rk-cats'), cont = document.getElementById('rk-contenido'); if (!cEl || !cont) return;
  const dias = document.getElementById('rk-periodo')?.value || 'todo';
  let movs = State.movimientos.filter(m => m.tipo === 'salida');
  if (dias !== 'todo') { const cut = new Date(); cut.setDate(cut.getDate() - parseInt(dias)); movs = movs.filter(m => m.fecha >= cut.toISOString().split('T')[0]); }
  const cats = [...new Set(State.productos.map(p => p.cat))].filter(Boolean);
  cEl.innerHTML = cats.map(c => '<button onclick="Admin.rkScroll(\'' + c.replace(/[^a-zA-Z0-9]/g, '_') + '\')" style="font-size:12px;padding:5px 14px;border-radius:20px;border:1px solid ' + (RK_COLORS[c] || 'var(--border2)') + ';background:transparent;color:' + (RK_COLORS[c] || 'var(--text2)') + ';cursor:pointer;font-family:inherit">' + c + '</button>').join('');
  try { Chart.helpers.each(Chart.instances, c => c.destroy()); } catch (e) { }
  cont.innerHTML = '';
  if (movs.length > 0) {
    const all = State.productos.map(p => ({ n: p.nombre, cat: p.cat, t: movs.filter(m => m.prodId === p.id || m.nombre === p.nombre).reduce((s, m) => s + m.cant, 0) })).filter(x => x.t > 0).sort((a, b) => b.t - a.t);
    const se = document.createElement('div');
    se.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px';
    se.innerHTML = '<div style="background:var(--surface2);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Total retirado</div><div style="font-size:22px;font-weight:700;color:var(--accent)">' + all.reduce((s, x) => s + x.t, 0).toLocaleString('es-AR') + '</div></div><div style="background:var(--surface2);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Más retirado</div><div style="font-size:15px;font-weight:700">' + (all[0] ? all[0].n : '—') + '</div></div><div style="background:var(--surface2);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Con movimientos</div><div style="font-size:22px;font-weight:700">' + all.length + '</div></div>';
    cont.appendChild(se);
  }
  cats.forEach(cat => {
    const ps = State.productos.filter(p => p.cat === cat); if (!ps.length) return;
    const vs = ps.map(p => ({ n: p.nombre, t: movs.filter(m => m.prodId === p.id || m.nombre === p.nombre).reduce((s, m) => s + m.cant, 0), s: stockTotal(p) })).filter(x => x.t > 0).sort((a, b) => b.t - a.t).slice(0, 10);
    const col = RK_COLORS[cat] || '#888', cid = 'rk-c-' + cat.replace(/[^a-zA-Z0-9]/g, '_');
    const card = document.createElement('div');
    card.id = 'rk-cat-' + cat.replace(/\s+/g, '_');
    card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px';
    card.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span style="width:10px;height:10px;border-radius:50%;background:' + col + ';display:inline-block"></span><span style="font-size:15px;font-weight:700">' + cat.toUpperCase() + '</span></div>' + (vs.length === 0 ? '<div style="font-size:13px;color:var(--text3)">Sin movimientos.</div>' : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px"><div style="position:relative;height:' + (Math.max(200, vs.length * 34 + 60)) + 'px"><canvas id="' + cid + '"></canvas></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid var(--border2)"><th style="text-align:left;padding:6px 4px;color:var(--text3);font-size:11px">#</th><th style="text-align:left;padding:6px 4px;color:var(--text3);font-size:11px">PRODUCTO</th><th style="text-align:right;padding:6px 4px;color:var(--text3);font-size:11px">SALIDAS</th><th style="text-align:right;padding:6px 4px;color:var(--text3);font-size:11px">STOCK</th></tr></thead><tbody>' + vs.map((v, i) => '<tr><td style="padding:7px 4px;color:var(--text3);font-size:11px">' + (i + 1) + '</td><td style="padding:7px 4px;font-weight:' + (i < 3 ? 700 : 500) + '">' + v.n + '</td><td style="padding:7px 4px;text-align:right;font-weight:700;color:' + col + '">' + v.t + '</td><td style="padding:7px 4px;text-align:right;color:var(--text2)">' + v.s + '</td></tr>').join('') + '</tbody></table></div>');
    cont.appendChild(card);
    if (vs.length > 0) {
      (function(cid, vd, c) {
        requestAnimationFrame(() => {
          const ctx = document.getElementById(cid); if (!ctx) return;
          try { const ex = Chart.getChart(ctx); if (ex) ex.destroy(); } catch (e) { }
          new Chart(ctx, { type: 'bar', data: { labels: vd.map(v => v.n.length > 22 ? v.n.substring(0, 20) + '…' : v.n), datasets: [{ data: vd.map(v => v.t), backgroundColor: vd.map((v, i) => i === 0 ? c : c + '70'), borderRadius: 5, borderWidth: 0 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } }, y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } } } } });
        });
      })(cid, vs, col);
    }
  });
}
function rkScroll(cat) { const el = document.getElementById('rk-cat-' + cat); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

// ── CONFIGURACIÓN ───────────────────────────────────────────────────
function renderConfig() {
  const ultBackup = localStorage.getItem('sg_last_backup');
  const backupInfo = ultBackup
    ? `Último backup: <b>${new Date(parseInt(ultBackup)).toLocaleString('es-AR')}</b>`
    : 'Sin backups previos.';

  document.getElementById('sec-configuracion').innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">Cambiar contraseñas</div>
      <div class="form-grid fg2" style="margin-bottom:14px">
        <div class="field">
          <label>Nueva contraseña Admin</label>
          <input type="password" id="cfg-pass-admin" placeholder="Dejar vacío para no cambiar">
        </div>
        <div class="field">
          <label>Repetir Admin</label>
          <input type="password" id="cfg-pass-admin2" placeholder="Repetir nueva">
        </div>
      </div>
      <div class="form-grid fg2" style="margin-bottom:14px">
        <div class="field">
          <label>Nueva contraseña Operador</label>
          <input type="password" id="cfg-pass-op" placeholder="Dejar vacío para no cambiar">
        </div>
        <div class="field">
          <label>Repetir Operador</label>
          <input type="password" id="cfg-pass-op2" placeholder="Repetir nueva">
        </div>
      </div>
      <button class="btn btn-accent" onclick="Admin.cambiarPasswords()">Guardar contraseñas</button>
      <div style="font-size:11px;color:var(--text3);margin-top:10px">Las contraseñas se guardan hasheadas en Firebase. Aunque alguien abra el código fuente, no las puede ver.</div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px">Backup de datos</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${backupInfo}</div>
      <div class="btn-row">
        <button class="btn btn-accent" onclick="Admin.hacerBackupManual()">💾 Descargar backup ahora</button>
        <button class="btn" onclick="Admin.checkBackupSemanal(true)">🔔 Ver recordatorio</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:10px">
        El backup es un archivo Excel con todo el inventario y movimientos. Se recomienda hacerlo al menos una vez por semana.
        La app te avisa automáticamente cada 7 días.
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px">Información del sistema</div>
      <div style="font-size:13px;line-height:1.8">
        <div><b>Productos cargados:</b> ${State.productos.length}</div>
        <div><b>Marcas:</b> ${State.marcas.length}</div>
        <div><b>Proveedores:</b> ${State.proveedores.length}</div>
        <div><b>Movimientos registrados:</b> ${State.movimientos.length}</div>
        <div><b>Base de datos:</b> Firebase Firestore · Colección <code style="background:var(--surface2);padding:2px 6px;border-radius:4px">inventarioGolosinas</code></div>
        <div><b>Autenticación:</b> Firebase Anonymous Auth <span style="color:var(--green)">✓ activa</span></div>
      </div>
    </div>

    <div class="card" style="border-color:var(--danger)">
      <div class="card-title" style="margin-bottom:14px;color:var(--danger)">⚠ Zona peligrosa</div>
      <button class="btn btn-danger" onclick="Admin.restablecerPasswords()">Restablecer contraseñas por defecto</button>
      <div style="font-size:11px;color:var(--text3);margin-top:10px">Si olvidaste tus contraseñas, esto las vuelve a <code>${App.DEFAULT_PASSWORDS.admin}</code> y <code>${App.DEFAULT_PASSWORDS.operador}</code>.</div>
    </div>
  `;
}

async function cambiarPasswords() {
  const pa = document.getElementById('cfg-pass-admin').value;
  const pa2 = document.getElementById('cfg-pass-admin2').value;
  const po = document.getElementById('cfg-pass-op').value;
  const po2 = document.getElementById('cfg-pass-op2').value;

  const updates = {};
  if (pa || pa2) {
    if (pa !== pa2) { notify('Las contraseñas admin no coinciden.'); return; }
    if (pa.length < 4) { notify('La contraseña admin debe tener al menos 4 caracteres.'); return; }
    updates.admin = await sha256(pa);
  }
  if (po || po2) {
    if (po !== po2) { notify('Las contraseñas operador no coinciden.'); return; }
    if (po.length < 4) { notify('La contraseña operador debe tener al menos 4 caracteres.'); return; }
    updates.operador = await sha256(po);
  }

  if (!Object.keys(updates).length) { notify('No cambiaste ninguna contraseña.'); return; }

  const currentAuth = { ...State.authHashes, ...updates };
  await window._fb.setConfig({ auth: currentAuth });
  State.authHashes = currentAuth;
  notify('✓ Contraseñas actualizadas.');
  ['cfg-pass-admin', 'cfg-pass-admin2', 'cfg-pass-op', 'cfg-pass-op2'].forEach(id => document.getElementById(id).value = '');
}

async function restablecerPasswords() {
  if (!confirm('¿Restablecer contraseñas por defecto? ESTO CUALQUIERA QUE SEPA LAS CONTRASEÑAS ORIGINALES VA A PODER ENTRAR.')) return;
  const hashAdmin = await sha256(App.DEFAULT_PASSWORDS.admin);
  const hashOp    = await sha256(App.DEFAULT_PASSWORDS.operador);
  await window._fb.setConfig({ auth: { admin: hashAdmin, operador: hashOp } });
  State.authHashes = { admin: hashAdmin, operador: hashOp };
  notify('✓ Contraseñas restablecidas.');
}

// ── BACKUP ──────────────────────────────────────────────────────────
function checkBackupSemanal(forzar = false) {
  const last = parseInt(localStorage.getItem('sg_last_backup') || '0');
  const ahora = Date.now();
  const diasDesdeUlt = (ahora - last) / (1000 * 60 * 60 * 24);

  if (forzar || diasDesdeUlt >= 7) {
    setTimeout(() => {
      if (confirm(`${last ? 'Pasaron ' + Math.floor(diasDesdeUlt) + ' días desde tu último backup.' : 'Hora de hacer el primer backup de tus datos.'}\n\n¿Descargar backup Excel ahora?`)) {
        hacerBackupManual();
      }
    }, 1500);
  }
}

function hacerBackupManual() {
  exportarExcel(true);
  localStorage.setItem('sg_last_backup', Date.now().toString());
  notify('✓ Backup descargado.');
}

function exportarExcel(esBackup = false) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Código', 'Producto', 'Categoría', 'Marca', 'Variedad', 'Presentación', 'Stock', 'Mínimo', 'Costo', 'Venta', 'Margen%', 'Valor', 'Ubicación', 'Próx.Vto', 'Lotes'],
    ...State.productos.map(p => {
      const m = getMarca(p.marcaId);
      const pv = proxVencimiento(p);
      const lotesStr = Array.isArray(p.lotes) ? p.lotes.map(l => `${l.cant}@${l.vto || 'sin vto'}`).join('; ') : '';
      return [p.barcode || '', p.nombre, p.cat, m ? m.nombre : '', p.variedad || '', p.presentacion || '', stockTotal(p), p.min, p.costo || 0, p.venta || 0, p.costo && p.venta ? Math.round((p.venta - p.costo) / p.costo * 100) + '%' : '', stockTotal(p) * (p.costo || 0), p.ubic || '', pv ? fmtFecha(pv) : '', lotesStr];
    })
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  if (State.movimientos.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Lote'], ...State.movimientos.map(m => [m.fecha, m.nombre, m.tipo, m.cant, m.motivo || '', m.lote || ''])]), 'Movimientos');
  const nombreArchivo = esBackup ? `StockGolosinas_Backup_${todayStr()}.xlsx` : 'StockGolosinas_Inventario.xlsx';
  XLSX.writeFile(wb, nombreArchivo);
  if (!esBackup) notify('Excel exportado.');
}

function importarDesdeExcel(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { notify('Archivo vacío.'); return; }
      const col = (row, ...keys) => { for (const k of keys) for (const rk of Object.keys(row)) if (rk.trim().toLowerCase() === k.toLowerCase()) return row[rk]; return ''; };
      const mm = {}; State.marcas.forEach(m => mm[m.nombre.toUpperCase()] = m.id);
      const nuevos = []; let maxId = Math.max(0, ...State.productos.map(p => p.id));
      rows.forEach(row => {
        const nombre = String(col(row, 'Producto', 'Nombre') || '').trim(); if (!nombre) return;
        const mn = String(col(row, 'Marca') || '').trim().toUpperCase();
        let marcaId = null;
        if (mn) { if (!mm[mn]) { const nid = State.nextMarcaId++; State.marcas.push({ id: nid, nombre: mn, cat: 'General' }); mm[mn] = nid; } marcaId = mm[mn]; }
        const barcode = String(col(row, 'Código', 'Codigo') || '').trim();
        const ex = barcode ? State.productos.find(p => p.barcode === barcode) : State.productos.find(p => p.nombre.toUpperCase() === nombre.toUpperCase());
        const stockImportado = parseInt(col(row, 'Stock', 'Cantidad')) || 0;
        const datos = {
          barcode, nombre,
          cat: String(col(row, 'Categoría', 'Categoria') || 'Chocolates').trim(),
          marcaId,
          variedad: String(col(row, 'Variedad') || '').trim(),
          presentacion: String(col(row, 'Presentación', 'Presentacion') || '').trim(),
          min: parseInt(col(row, 'Mínimo', 'Minimo')) || 0,
          costo: parseFloat(col(row, 'Costo', 'Precio costo')) || 0,
          venta: parseFloat(col(row, 'Venta', 'Precio venta')) || 0,
          ubic: String(col(row, 'Ubicación') || '').trim(),
          provId: null
        };
        if (ex) {
          Object.assign(ex, datos);
        } else {
          maxId++;
          const nuevoProd = { id: maxId, ...datos, stock: 0, lotes: [] };
          if (stockImportado > 0) agregarLote(nuevoProd, stockImportado, null);
          nuevos.push(nuevoProd);
        }
      });
      State.productos.push(...nuevos);
      State.nextProdId = Math.max(State.nextProdId, maxId + 1);
      renderDashboard(); renderTabla(); renderMarcas(); renderSelectMarca(); renderFiltroMarca(); renderSelectProv(); renderAlertas(); renderReporte();
      notify(nuevos.length ? `Importado: ${rows.length - nuevos.length} actualizados, ${nuevos.length} nuevos.` : `Importado: ${rows.length} actualizados.`);
      App.guardarEnFirestore();
    } catch (err) {
      notify('Error al leer el Excel.');
      console.error(err);
    }
    input.value = '';
  };
  r.readAsArrayBuffer(file);
}

// ── MIGRACIÓN LOTES ─────────────────────────────────────────────────
function normalizarFechasLotes() {
  State.movimientos.forEach(m => {
    if (!m.lote || !m.fecha) return;
    const f = m.fecha;
    const fechaFmt = f.length === 10 && f[4] === '-' && f[7] === '-'
      ? f.substring(8, 10) + '/' + f.substring(5, 7) + '/' + f.substring(0, 4)
      : f;
    if (!m.lote.includes('/')) m.lote = m.lote.trim() + ' ' + fechaFmt;
  });
  // Migrar productos viejos sin `lotes` a tener un lote inicial con su stock
  State.productos.forEach(p => {
    if (!Array.isArray(p.lotes)) {
      p.lotes = [];
      if (p.stock > 0) {
        p.lotes.push({ id: 'L' + p.id + '_init', cant: p.stock, vto: null, fechaRecepcion: todayStr() });
      }
    }
  });
}

function migrarLotes() {
  let cambiados = 0;
  State.movimientos.forEach(m => {
    const tipo = m.tipo === 'salida' ? 'Retiro operador' : 'Recepción operador';
    const fechaFmt = fmtFecha(m.fecha);
    if (m.lote && m.lote.match(/\d{4}-\d{2}-\d{2}/)) {
      m.lote = m.lote.replace(/\d{4}-\d{2}-\d{2}/, (match) => fmtFecha(match));
      cambiados++;
    } else if (!m.lote) {
      m.lote = tipo + ' ' + fechaFmt;
      cambiados++;
    }
  });
  App.guardarEnFirestore();
  renderDashboard();
  notify('✓ ' + cambiados + ' movimientos agrupados');
  const btn = document.getElementById('btn-migrar'); if (btn) btn.style.display = 'none';
}

// ── CLICK/KEY HANDLERS ──────────────────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('#ret-buscar') && !e.target.closest('#ret-sug')) { const s = document.getElementById('ret-sug'); if (s) s.style.display = 'none'; }
  if (!e.target.closest('#rec-buscar') && !e.target.closest('#rec-sug')) { const s = document.getElementById('rec-sug'); if (s) s.style.display = 'none'; }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const a = document.activeElement; if (!a) return;
  if (a.id === 'ret-buscar' || a.id === 'ret-cant') { retAgregar(); e.preventDefault(); }
  if (a.id === 'rec-buscar' || a.id === 'rec-cant') { recAgregar(); e.preventDefault(); }
});

// ── EXPORT ──────────────────────────────────────────────────────────
window.Admin = {
  toggleSidebar, closeSidebar, showSection, showSectionMobile, filtrarPorEstado,
  renderDashboard, renderStats, renderTabla, renderSelectMarca, renderSelectProv, renderFiltroMarca,
  onBarcodeInput, cargarEnForm, limpiarForm, guardarProducto, editarProducto, eliminarProducto,
  agregarLoteAlForm, eliminarLote, renderLotesForm,
  agregarMarca, eliminarMarca, renderMarcas,
  agregarProveedor, eliminarProveedor, renderProveedores,
  renderAlertas, renderVencimientos, darDeBajaLote,
  renderReporte, renderHistorialPrecios,
  populateRecProv,
  retBuscar, retSel, retAgregar, retQuit, retCant, retLimpiar, retConfirmar,
  recBuscar, recSel, recAgregar, recQuit, recLimpiar, recConfirmar,
  renderRanking, rkScroll,
  renderConfig, cambiarPasswords, restablecerPasswords,
  checkBackupSemanal, hacerBackupManual, exportarExcel, importarDesdeExcel,
  migrarLotes, normalizarFechasLotes
};
// Atajos para onclick en HTML
Object.assign(window, Admin);
