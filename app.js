/* XR3 · Factibilidad FTTH · app de técnicos (PWA)
   Pide al servicio de Apps Script solo el resultado del caso. No guarda datos de clientes en el celular. */
'use strict';
const API = (window.XR3_CONFIG && window.XR3_CONFIG.API_URL || '').trim();
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fm = m => m == null ? '—' : (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km');
const fd = f => f ? f.slice(8, 10) + '-' + f.slice(5, 7) : '—';
const NIV = { A: 'Evidencia alta', M: 'Evidencia media', B: 'Evidencia baja' };
const COL = { A: '#1f7f45', M: '#e0a800', B: '#90a4ae' };
let GPS = null, IND = null, MAPA = null, ULT = null;

function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function estado(t, err) { const e = $('est'); e.textContent = t; e.classList.toggle('err', !!err); }

async function api(params) {
  if (!API) throw new Error('Falta configurar la URL del servicio (config.js).');
  const u = new URL(API); Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) u.searchParams.set(k, v); });
  const k = leer('xr3_clave'); if (k) u.searchParams.set('k', k);
  const r = await fetch(u.toString(), { redirect: 'follow' });
  if (!r.ok) throw new Error('El servicio respondió ' + r.status);
  const j = await r.json();
  if (!j.ok && j.error === 'clave') { pedirClave(j.msg); throw new Error(j.msg); }
  return j;
}

/* ---------- inicio ---------- */
async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try {
    const j = await api({ api: 'indice' });
    if (!j.ok) throw new Error(j.msg || 'Sin datos');
    IND = j;
    $('lcomunas').innerHTML = j.comunas.map(c => `<option value="${esc(c.comuna)}">${esc(c.czona)}</option>`).join('');
    const hi = (j.intradia || '').replace(/^Actividades-VTR_\d\d_\d\d_\d\d_(\d\d)(\d\d).*$/, '$1:$2');
    $('base').textContent = `Datos TOA del ${fd(j.desde)} al ${fd(j.hasta)}${hi && hi !== j.intradia ? ' y de hoy hasta las ' + hi : ''}`;
  } catch (e) { $('base').textContent = navigator.onLine ? 'Sin conexión con el servicio: ' + e.message : 'Sin señal: la búsqueda necesita internet.'; }
}
function pedirClave(msg) {
  $('cardClave').classList.remove('oculto'); $('cardForm').classList.add('oculto');
  if (msg && leer('xr3_clave')) $('estClave').textContent = msg;
}
$('btClave').onclick = () => { guardar('xr3_clave', $('clave').value.trim()); $('cardClave').classList.add('oculto'); $('cardForm').classList.remove('oculto'); $('estClave').textContent = ''; init(); };

/* ---------- GPS ---------- */
$('btGps').onclick = () => {
  const b = $('btGps'), t = $('gpsTxt');
  if (!navigator.geolocation) { t.textContent = 'Este celular no permite obtener la ubicación.'; return; }
  b.disabled = true; t.textContent = 'Obteniendo ubicación…';
  navigator.geolocation.getCurrentPosition(p => {
    GPS = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
    b.disabled = false; b.classList.add('ok'); b.textContent = '✓ Ubicación tomada';
    t.textContent = `${GPS.lat.toFixed(5)}, ${GPS.lon.toFixed(5)} · precisión ±${Math.round(GPS.acc)} m` + (GPS.acc > 50 ? '. Precisión baja: sal a un lugar abierto y vuelve a tomarla.' : '');
  }, err => {
    b.disabled = false;
    t.textContent = err.code === 1 ? 'Permiso de ubicación denegado: actívalo en el navegador para esta página.' : 'No se pudo obtener la ubicación. Intenta de nuevo.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
};

/* ---------- búsqueda ---------- */
$('f').addEventListener('submit', async ev => {
  ev.preventDefault();
  const p = { api: 'buscar', ot: $('ot').value.trim().toUpperCase(), comuna: $('comuna').value.trim(), dir: $('dir').value.trim(), prob: $('prob').value };
  if (GPS) Object.assign(p, { lat: GPS.lat.toFixed(6), lon: GPS.lon.toFixed(6), acc: Math.round(GPS.acc) });
  if (!p.ot && !GPS && !p.dir) { estado('Ingresa la OT, usa tu ubicación o busca por dirección.', 1); return; }
  if (p.dir && !p.comuna && !p.ot && !GPS) { estado('Indica la comuna de la dirección.', 1); $('otra').open = true; $('comuna').focus(); return; }
  $('bt').disabled = true; estado('Buscando… puede tardar unos segundos.');
  try {
    const r = await api(p);
    if (!r.ok) { estado(r.msg || 'No se encontró información.', 1); return; }
    ULT = r; estado(''); mostrar(r);
  } catch (e) { estado(navigator.onLine ? 'No se pudo buscar: ' + e.message : 'Sin señal: intenta de nuevo cuando tengas conexión.', 1); }
  finally { $('bt').disabled = false; }
});

/* ---------- presentación ---------- */
function tira(a) {
  const v = a.vecino; let s = [], cap = 8, ley = '';
  if (v) {
    cap = v.cap || 8;
    for (let i = 0; i < v.ocup; i++) s.push('oc'); for (let i = 0; i < v.res; i++) s.push('rs'); for (let i = 0; i < (v.post || 0); i++) s.push('nv');
    while (s.length < cap) s.push('li'); s = s.slice(0, cap);
    ley = `Consulta Vecino ${fd(v.fecha)}: ${v.ocup} ocupados${v.res ? ', ' + v.res + ' reservados' : ''}${v.post ? ', ' + v.post + ' instalados después' : ''}. ${v.lib === 0 ? 'Sin puertos libres estimados.' : '~' + v.lib + ' libre' + (v.lib === 1 ? '' : 's') + ' (en verde).'}`;
  } else {
    const act = new Set(a.puertosAct || []); for (let i = 1; i <= 8; i++) s.push(act.has(i) ? 'ac' : 'nd');
    ley = act.size ? 'Sin Consulta Vecino. Puertos con actividad en 30 días: ' + [...act].sort((x, y) => x - y).join(', ') + '.' : 'Sin datos de ocupación de puertos.';
  }
  return `<div class="tira" role="img" aria-label="${esc(ley)}">${s.map(c => `<span class="pt ${c}"></span>`).join('')}</div><div class="tira-ley">${esc(ley)}</div>`;
}
function rutaTxt(a) {
  const r = a.ruta;
  if (!r) return a.lat == null ? 'sin posición de la CTO' : 'calculando…';
  if (r.cerca) return 'la CTO está prácticamente frente al domicilio';
  if (!r.ok) return 'no disponible';
  return `${fm(r.m)} (${esc(r.fuente)}, a pie)`;
}
function datos(a) {
  return `<dl class="datos">
    <div><dt>Línea recta</dt><dd>${fm(a.dCto)}</dd></div>
    <div><dt>Por calles</dt><dd data-ruta="${a.rank}${a.esAsig ? 'a' : ''}">${rutaTxt(a)}</dd></div>
    <div><dt>Nodo / subnodo</dt><dd>${esc(a.nodo || '—')} / ${esc(a.subnodo || '—')}</dd></div>
    <div><dt>Instalaciones 30 días</dt><dd>${a.inst30}${a.ultInst ? ' (últ. ' + fd(a.ultInst) + ')' : ''}</dd></div>
  </dl>`;
}
function ev(a) { return `<ul class="ev">${a.ev.map(x => `<li>${esc(x)}</li>`).join('')}${a.neg.map(x => `<li class="neg">${esc(x)}</li>`).join('')}</ul>`; }
function irA(a) { return a.lat == null ? '' : `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=walking`; }

function mostrar(r) {
  const c = r.consulta, alts = r.alternativas, m = alts[0];
  let h = `<section class="card consulta">
    <div><b>${esc(c.dir || 'Ubicación GPS')}</b>, ${esc(c.comuna)}${c.ot ? ' · OT ' + esc(c.ot) : ''}</div>
    <div class="mut small">${esc(c.probTxt)}${c.otEstado ? ` · OT ${esc(c.otEstado.tipo)}, ${esc(c.otEstado.estado)}${c.otEstado.hoy ? ' hoy' : ' el ' + fd(c.otEstado.fecha)}` : ''}</div>
    <div class="mut small">Ubicación: ${esc(c.metodo || '—')}${c.detalle ? ' · ' + esc(c.detalle) : ''}</div>
    ${c.aviso ? `<div class="av gris">${esc(c.aviso)}</div>` : ''}
    ${c.alertas.map(a => `<div class="av ${esc(a.tipo)}">${esc(a.txt)}</div>`).join('')}
  </section>`;
  if (!m) h += `<section class="card"><div class="av rojo">No hay CTO con instalaciones cerca (hasta 300 m, últimos 30 días). Puede ser una zona sin red FTTH cercana: avisa a tu coordinador.</div></section>`;
  else {
    const cop = m.vecino && m.vecino.lib === 0;
    h += `<section class="card mejor ${m.nivel}">
      <span class="etq">Mejor opción</span>
      <div class="nombre">${esc(m.nombre)} <small>${m.cto_n != null ? 'CTO ' + m.cto_n : ''}</small></div>
      <span class="nivel ${cop ? 'R' : m.nivel}">${cop ? 'Posible copada' : NIV[m.nivel]} · ${m.pts} pts</span>
      ${m.resumen ? `<p class="resumen">${esc(m.resumen)}</p>` : ''}
      <div class="puerto"><div class="k">Puerto NAP (TOA)</div><div class="v">${esc(m.puerto_nap || '—')}</div></div>
      ${datos(m)}
      ${m.ruta && m.ruta.img ? `<figure class="foto"><img src="${m.ruta.img}" alt="Ruta del domicilio a la CTO"><figcaption>Ruta a pie del domicilio (D) a la CTO (C)</figcaption></figure>` : ''}
      ${tira(m)}
      ${ev(m)}
      <div class="acc2">${irA(m) ? `<a class="btn sec" href="${irA(m)}" target="_blank" rel="noopener">🧭 Cómo llegar</a>` : '<span></span>'}<button class="btn sec" id="btShare" type="button">Compartir</button></div>
    </section>`;
    if (alts.length > 1) h += `<section class="card"><h2>Otras alternativas</h2>${alts.slice(1).map(a => `
      <details class="alt ${a.nivel}"><summary><span class="r">${a.rank}</span><span><span class="n">${esc(a.nombre)}</span><br><span class="d">${NIV[a.nivel]} · ${fm(a.dCto)} · Puerto ${esc(a.puerto_nap || '—')}</span></span></summary>
        ${datos(a)}${tira(a)}${ev(a)}${irA(a) ? `<div class="acc2"><a class="btn sec" href="${irA(a)}" target="_blank" rel="noopener">🧭 Cómo llegar</a><span></span></div>` : ''}
      </details>`).join('')}</section>`;
  }
  if (r.asignada) { const a = r.asignada; a.esAsig = true;
    h += `<section class="card"><h2>${a.fuente === 'historial' ? 'CTO registrada para esta dirección' : 'CTO asignada'}</h2>
      <div class="nombre" style="font-size:19px">${esc(a.nombre)} <small>${a.cto_n != null ? 'CTO ' + a.cto_n : ''}</small></div>
      <div class="puerto"><div class="k">Puerto NAP (TOA)</div><div class="v" style="font-size:21px">${esc(a.puerto_nap || '—')}</div></div>
      ${a.sinPosicion ? '<p class="mut small">TOA solo la ubica por este mismo domicilio: no se puede medir distancia.</p>' : datos(a)}${tira(a)}${ev(a)}</section>`; }
  h += `<section class="card"><h2>Mapa</h2><div id="mapa"></div>
    <div class="ley"><span><i style="background:#d32f2f"></i>Domicilio</span>${alts.map(a => `<span><i style="background:${COL[a.nivel]}"></i>Alternativa ${a.rank}</span>`).join('')}${r.asignada && !r.asignada.sinPosicion ? '<span><i style="background:#6a1b9a"></i>CTO asignada</span>' : ''}</div></section>`;
  h += `<section class="card"><h2>Qué hacer</h2><ol class="que">${r.acciones.map(a => `<li>${esc(a)}</li>`).join('')}</ol></section>`;
  $('res').innerHTML = h;
  if ($('btShare')) $('btShare').onclick = compartir;
  mapa(r); rutasFaltantes(r);
  $('res').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- mapa ---------- */
function decodePoly(str) { let i = 0, lat = 0, lng = 0; const out = []; while (i < str.length) { let b, sh = 0, r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += (r & 1) ? ~(r >> 1) : (r >> 1);
  sh = 0; r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); lng += (r & 1) ? ~(r >> 1) : (r >> 1); out.push([lat / 1e5, lng / 1e5]); } return out; }
function mapa(r) {
  const c = r.consulta, box = $('mapa'); if (!box) return;
  if (typeof L === 'undefined' || c.lat == null) { box.outerHTML = '<p class="mut small">Mapa no disponible.</p>'; return; }
  if (MAPA) { MAPA.remove(); MAPA = null; }
  MAPA = L.map(box, { scrollWheelZoom: false, tap: true }).setView([c.lat, c.lon], 17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(MAPA);
  L.circle([c.lat, c.lon], { radius: r.radio, color: '#12263f', weight: 1.5, fill: false }).addTo(MAPA);
  const bb = L.latLng(c.lat, c.lon).toBounds(r.radio * 2 + 40);
  const capa = L.layerGroup().addTo(MAPA); MAPA._rutas = capa;
  r.alternativas.forEach(a => { if (a.lat == null) return; bb.extend([a.lat, a.lon]); dibRuta(a, COL[a.nivel]);
    L.circleMarker([a.lat, a.lon], { radius: 11, color: '#fff', weight: 2, fillColor: COL[a.nivel], fillOpacity: 1 }).addTo(MAPA)
      .bindTooltip(String(a.rank), { permanent: true, direction: 'center', className: 'nro' }).bindPopup(`<b>${esc(a.nombre)}</b><br>Puerto ${esc(a.puerto_nap)}<br>${fm(a.dCto)} en línea recta`); });
  const s = r.asignada; if (s && !s.sinPosicion && s.lat != null) { L.circleMarker([s.lat, s.lon], { radius: 9, color: '#fff', weight: 2, fillColor: '#6a1b9a', fillOpacity: 1 }).addTo(MAPA).bindPopup('CTO asignada: ' + esc(s.nombre)); dibRuta(s, '#6a1b9a'); }
  MAPA.createPane('dom'); MAPA.getPane('dom').style.zIndex = 660;
  L.circleMarker([c.lat, c.lon], { pane: 'dom', radius: 17, color: '#d32f2f', weight: 3, fill: false }).addTo(MAPA);
  L.circleMarker([c.lat, c.lon], { pane: 'dom', radius: 9, color: '#fff', weight: 3, fillColor: '#d32f2f', fillOpacity: 1 }).addTo(MAPA).bindPopup('Domicilio');
  setTimeout(() => { MAPA.invalidateSize(); MAPA.fitBounds(bb, { padding: [20, 20] }); }, 150);
}
function dibRuta(a, col) {
  if (!MAPA || !a.ruta || !a.ruta.ok) return;
  const pts = a.ruta.coords || (a.ruta.poly ? decodePoly(a.ruta.poly) : null); if (!pts) return;
  L.polyline(pts, { color: col, weight: 4, opacity: .85 }).addTo(MAPA._rutas);
}
// si Google Maps no entregó la ruta, se pide a OpenStreetMap (OSRM) desde el celular
async function rutasFaltantes(r) {
  const c = r.consulta; if (c.lat == null) return;
  const lst = r.alternativas.concat(r.asignada && !r.asignada.sinPosicion ? [r.asignada] : []).filter(a => a.lat != null && (!a.ruta || (!a.ruta.ok && !a.ruta.cerca)));
  await Promise.all(lst.map(async a => {
    try { const u = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${c.lon},${c.lat};${a.lon},${a.lat}?overview=full&geometries=geojson`;
      const j = await (await fetch(u)).json();
      a.ruta = j.code === 'Ok' && j.routes.length ? { ok: true, m: j.routes[0].distance, fuente: 'OpenStreetMap', coords: j.routes[0].geometry.coordinates.map(p => [p[1], p[0]]) } : { ok: false };
    } catch (e) { a.ruta = { ok: false }; }
    const el = document.querySelectorAll(`[data-ruta="${a.rank}${a.esAsig ? 'a' : ''}"]`); el.forEach(x => x.innerHTML = rutaTxt(a));
    dibRuta(a, a.esAsig ? '#6a1b9a' : COL[a.nivel]);
  }));
}

/* ---------- compartir (WhatsApp u otra app) ---------- */
function compartir() {
  const r = ULT; if (!r) return; const c = r.consulta, m = r.alternativas[0];
  const L1 = [`Factibilidad FTTH XR3 · ${c.dir || 'ubicación GPS'}, ${c.comuna}${c.ot ? ' · OT ' + c.ot : ''}`, `Problema: ${c.probTxt}`];
  r.alternativas.forEach(a => L1.push(`${a.rank}) ${a.nombre}${a.cto_n != null ? ' (CTO ' + a.cto_n + ')' : ''} · Puerto NAP ${a.puerto_nap || '—'} · ${NIV[a.nivel]} · ${fm(a.dCto)} línea recta${a.ruta && a.ruta.ok ? ', ' + fm(a.ruta.m) + ' por calles' : ''}${a.vecino ? ' · ~' + a.vecino.lib + ' libres (CV ' + fd(a.vecino.fecha) + ')' : ''}`));
  if (r.asignada) L1.push(`CTO asignada: ${r.asignada.nombre} · Puerto NAP ${r.asignada.puerto_nap || '—'}`);
  if (m && m.lat != null) L1.push('Mejor opción en mapa: ' + `https://maps.google.com/?q=${m.lat},${m.lon}`);
  const txt = L1.join('\n');
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

init();
