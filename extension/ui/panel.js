export function createPanel({ onPreference, onContinue, onRetry, onRefresh, onResume }) {
  let renderedMinimum;
  const host = document.createElement('aside');
  host.id = 'wallapop-seller-filters';
  host.setAttribute('aria-label', 'Filtros de reputación del vendedor');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host{display:block;margin:16px 0;color:#173c38;font:14px/1.45 system-ui,sans-serif;color-scheme:light}
      *{box-sizing:border-box}.panel{background:#f3f8f6;border:1px solid #bbd9cf;border-radius:14px;padding:16px 18px}
      header,.options,.actions,.counts{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
      header{justify-content:space-between}h2{font-size:17px;line-height:1.3;margin:0}small,.help{font-size:12px;color:#516b65}
      .options{margin:14px 0;gap:14px 24px}label{display:flex;align-items:center;gap:8px;cursor:pointer}
      input[type=checkbox]{width:17px;height:17px;accent-color:#116c58}input[type=number]{width:82px;padding:7px;border:1px solid #9fbfb3;border-radius:6px;font:inherit;color:inherit;background:white}
      .counts{gap:8px;margin:10px 0}.count{padding:4px 8px;border-radius:5px;background:#e3ede8;font-size:12px}.match{background:#ccebdc}
      progress{display:block;width:100%;height:6px;margin:10px 0;accent-color:#116c58}.actions{margin:10px 0 6px}
      button{font:600 12px system-ui;padding:8px 12px;border:1px solid #abc9bc;background:white;border-radius:6px;color:#173c38;cursor:pointer}
      button.primary{background:#116c58;color:white;border-color:#116c58}button:disabled{opacity:.5;cursor:default}
      [hidden]{display:none!important}p{margin:8px 0 0}.notice{color:#7b3a21;font-size:13px}.help{margin-top:6px}
      :focus-visible{outline:3px solid #b67420;outline-offset:3px}
    </style>
    <section class="panel">
      <header><div><h2>Reputación del vendedor</h2><small>Reseñas del perfil · solo resultados cargados</small></div>
        <label><input id="enabled" type="checkbox"> Filtrado activo</label></header>
      <div class="options">
        <label>Mínimo de reseñas <input id="minimumReviews" type="number" min="0" max="999999" step="1" value="5" required></label>
        <label><input id="verifiedOnly" type="checkbox"> Solo identidad verificada</label>
        <label><input id="showUnchecked" type="checkbox"> Mostrar sin comprobar</label>
      </div>
      <div class="counts" aria-live="polite" aria-atomic="true">
        <span class="count match" id="match"></span><span class="count" id="excluded"></span>
        <span class="count" id="pending"></span><span class="count" id="unchecked"></span>
        <span class="count" id="unknown"></span><span class="count" id="errors"></span>
      </div>
      <progress id="progress" aria-label="Procesamiento de los anuncios cargados" value="0" max="1"></progress>
      <div class="actions">
        <button id="continue" class="primary">Comprobar 10 más</button>
        <button id="retry" hidden>Reintentar errores (hasta 10)</button>
        <button id="refresh">Actualizar datos (lote de 10)</button>
        <button id="resume" hidden>Reanudar consultas</button>
        <small id="processed"></small>
      </div>
      <p id="status" class="notice" role="status" aria-live="polite"></p>
      <p class="help">Identidad: solo evidencia explícita de un perfil particular. La verificación comercial no acredita identidad personal; la ausencia de insignia queda como desconocida.</p>
      <p class="help">Los huecos de anuncios ocultos conservan su espacio para evitar cargas por scroll. No se reordena la búsqueda ni se analiza todo el catálogo.</p>
    </section>`;
  for (const name of ['enabled', 'minimumReviews', 'verifiedOnly', 'showUnchecked']) {
    root.getElementById(name).addEventListener('change', event => {
      if (name === 'minimumReviews' && !event.target.reportValidity()) return;
      onPreference(name, name === 'minimumReviews' ? Number(event.target.value) : event.target.checked);
    });
  }
  root.getElementById('continue').addEventListener('click', onContinue);
  root.getElementById('retry').addEventListener('click', onRetry);
  root.getElementById('refresh').addEventListener('click', onRefresh);
  root.getElementById('resume').addEventListener('click', onResume);
  return {
    host,
    update({ preferences, counts, busy, gate, message = '' }) {
      for (const name of ['enabled', 'minimumReviews', 'verifiedOnly', 'showUnchecked']) {
        const control = root.getElementById(name);
        if (name === 'minimumReviews') {
          if (root.activeElement !== control || renderedMinimum !== preferences.minimumReviews) control.value = String(preferences[name]);
        } else control.checked = preferences[name];
      }
      renderedMinimum = preferences.minimumReviews;
      for (const [id, label] of [['match', 'Cumplen'], ['excluded', 'Descartados'], ['pending', 'Pendientes'], ['unchecked', 'Sin comprobar'], ['unknown', 'Datos desconocidos'], ['errors', 'Errores']]) {
        root.getElementById(id).textContent = `${label}: ${counts[id]}`;
      }
      root.getElementById('progress').max = Math.max(1, counts.total);
      root.getElementById('progress').value = counts.processed;
      root.getElementById('processed').textContent = `${counts.processed} de ${counts.total} procesados${counts.errors ? ` · ${counts.errors} errores` : ''}`;
      root.getElementById('continue').disabled = busy || !preferences.enabled || !counts.unprocessed || !!gate;
      root.getElementById('continue').title = !counts.unprocessed
        ? 'Todos los anuncios cargados ya se han intentado comprobar. Los datos desconocidos y los errores se indican aparte.'
        : busy ? 'Hay un lote en curso.' : gate ? 'Consultas detenidas hasta reanudar manualmente.' : 'Comprobar hasta diez anuncios que aún no se han intentado consultar.';
      const retry = root.getElementById('retry');
      retry.hidden = !counts.errors;
      retry.disabled = busy || !preferences.enabled || !!gate;
      retry.title = 'Vuelve a consultar solo los anuncios con errores, sin borrar la caché de los comprobados.';
      root.getElementById('refresh').disabled = busy || !preferences.enabled || !counts.total || !!gate;
      const resume = root.getElementById('resume');
      resume.hidden = !gate;
      resume.disabled = !!gate?.retryAt && Date.now() < gate.retryAt;
      let notice = message;
      if (gate) {
        if (gate.code === 'rate_limit') notice = `Consultas pausadas por límite 429. Reanuda manualmente después de ${new Date(gate.retryAt).toLocaleTimeString('es-ES')}.`;
        else notice = `Consultas detenidas (${gate.code === 'challenge' ? 'comprobación de acceso o CAPTCHA' : gate.code.replace('http_', 'HTTP ')}). Comprueba el acceso a Wallapop en una pestaña y reanuda manualmente.`;
      } else if (!notice && preferences.enabled && !counts.match && counts.total) {
        notice = counts.unchecked + counts.pending + counts.unknown + counts.errors > 0
          ? '0 coincidencias comprobadas. Hay anuncios sin comprobar, datos desconocidos o errores; todavía pueden existir vendedores que cumplan.'
          : 'Ninguno de los anuncios comprobados y cargados cumple los filtros actuales.';
      } else if (!notice && !counts.total) notice = 'Esperando tarjetas de resultados. Si Wallapop ha cambiado, revisa la guía de mantenimiento.';
      else if (!notice && !busy && !counts.unprocessed && !counts.pending) {
        notice = 'Todos los anuncios cargados ya se han intentado comprobar. Carga más resultados en Wallapop para comprobar otros anuncios.';
      }
      if (!gate && counts.identityUnknown) notice += `${notice ? ' ' : ''}Identidad sin confirmar en ${counts.identityUnknown} anuncios: Wallapop no aporta una señal válida para este filtro.`;
      if (!gate && !busy && counts.errors) notice += `${notice ? ' ' : ''}Puedes reintentar los errores por separado.`;
      root.getElementById('status').textContent = notice;
    },
  };
}
