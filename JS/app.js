/* Lógica principal: filtros, cards, geolocalización y modal de detalle. */
(() => {
  const el = {};
  const estado = { ubicacion: null, peticion: 0 };
  let modal;

  document.addEventListener('DOMContentLoaded', () => {
    Object.assign(el, {
      busqueda: document.getElementById('busqueda'),
      tipo: document.getElementById('filtroTipo'),
      categoria: document.getElementById('filtroCategoria'),
      radio: document.getElementById('filtroRadio'),
      btnCerca: document.getElementById('btnCerca'),
      btnLimpiar: document.getElementById('btnLimpiar'),
      lista: document.getElementById('lista'),
      resumen: document.getElementById('resumen'),
      detalle: document.getElementById('detalleContenido')
    });

    M.Sidenav.init(document.querySelectorAll('.sidenav'));
    M.FormSelect.init(document.querySelectorAll('select'));
    modal = M.Modal.init(document.getElementById('modalDetalle'));

    Mapa.iniciar();
    registrarEventos();
    cargar();
  });

  window.addEventListener('load', () => Mapa.refrescar());

  // ---------------------------------------------------------------- eventos

  function registrarEventos() {
    el.busqueda.addEventListener('input', Util.debounce(cargar, 400));
    el.tipo.addEventListener('change', cargar);
    el.categoria.addEventListener('change', cargar);
    el.radio.addEventListener('change', () => { if (estado.ubicacion) cargar(); });
    el.btnCerca.addEventListener('click', ubicarUsuario);
    el.btnLimpiar.addEventListener('click', limpiarFiltros);

    // Delegación de clics. Fase de captura (true): los popups de Leaflet frenan la propagación.
    document.addEventListener('click', (e) => {
      const verMapa = e.target.closest('.btn-ver-mapa');
      if (verMapa) { e.preventDefault(); Mapa.enfocar(Number(verMapa.dataset.id)); return; }

      const verDetalle = e.target.closest('.btn-detalle');
      if (verDetalle) { e.preventDefault(); abrirDetalle(Number(verDetalle.dataset.id)); return; }

      if (e.target.closest('.btn-reintentar')) { e.preventDefault(); cargar(); }
    }, true);
  }

  function refrescarSelects() {
    document.querySelectorAll('select').forEach(s => {
      const instancia = M.FormSelect.getInstance(s);
      if (instancia) instancia.destroy();
      M.FormSelect.init(s);
    });
  }

  function limpiarFiltros() {
    el.busqueda.value = '';
    el.tipo.value = '';
    el.categoria.value = '';
    el.radio.value = '5';
    refrescarSelects();
    M.updateTextFields();

    estado.ubicacion = null;
    Mapa.quitarUsuario();
    cargar();
  }

  function ubicarUsuario() {
    if (!navigator.geolocation) {
      M.toast({ html: 'Tu navegador no permite obtener la ubicación.', classes: 'red darken-2' });
      return;
    }

    el.btnCerca.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        el.btnCerca.disabled = false;
        estado.ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cargar();
      },
      () => {
        el.btnCerca.disabled = false;
        M.toast({
          html: 'No pudimos obtener tu ubicación. Revisá los permisos del navegador.',
          classes: 'red darken-2'
        });
      },
      { timeout: 10000 }
    );
  }

  // ------------------------------------------------------------------ datos

  async function cargar() {
    const turno = ++estado.peticion; // descarta respuestas viejas si el usuario sigue filtrando

    const params = {
      tipo: el.tipo.value,
      categoria: el.categoria.value,
      busqueda: el.busqueda.value.trim(),
      tamanoPagina: 50
    };
    if (estado.ubicacion) {
      params.lat = estado.ubicacion.lat;
      params.lng = estado.ubicacion.lng;
      params.radioKm = el.radio.value;
    }

    el.lista.innerHTML = '<div class="col s12"><div class="progress"><div class="indeterminate"></div></div></div>';

    try {
      const r = await Api.instituciones(params);
      if (turno !== estado.peticion) return;

      Mapa.mostrar(r.items);
      if (estado.ubicacion) {
        Mapa.mostrarUsuario(estado.ubicacion.lat, estado.ubicacion.lng, Number(el.radio.value));
      }
      renderCards(r.items);
      renderResumen(r);
    } catch (error) {
      if (turno !== estado.peticion) return;
      mostrarError(error);
    }
  }

  function renderResumen(r) {
    let txt = r.total === 1 ? '1 institución verificada' : `${r.total} instituciones verificadas`;
    if (estado.ubicacion) txt += ` a menos de ${el.radio.value} km de vos`;
    if (r.total > r.items.length) txt += ` (mostrando las primeras ${r.items.length})`;
    el.resumen.textContent = txt;
  }

  function mostrarError(error) {
    const sinConexion = error instanceof TypeError; // fetch falla con TypeError si no hay conexión
    const mensaje = sinConexion
      ? `No pudimos conectar con el servidor. Verificá que la API esté corriendo en ${API_URL}.`
      : error.message;

    el.resumen.textContent = 'No se pudieron cargar las instituciones.';
    el.lista.innerHTML = `<div class="col s12 estado-vacio">
      <i class="material-icons">cloud_off</i>
      <p>${Util.esc(mensaje)}</p>
      <a href="#!" class="btn waves-effect green darken-2 btn-reintentar">Reintentar</a>
    </div>`;
  }

  // ------------------------------------------------------------------ cards

  function renderCards(items) {
    if (!items.length) {
      el.lista.innerHTML = `<div class="col s12 estado-vacio">
        <i class="material-icons">search_off</i>
        <p>No encontramos instituciones con esos filtros.${estado.ubicacion ? ' Probá ampliando el radio.' : ''}</p>
      </div>`;
      return;
    }
    el.lista.innerHTML = items.map(htmlCard).join('');
  }

  function htmlCard(i) {
    const t = Util.tipos[i.tipo] ?? Util.tipos.Otro;
    const distancia = i.distanciaKm !== null && i.distanciaKm !== undefined
      ? ` · a ${i.distanciaKm.toFixed(1)} km` : '';

    return `<div class="col s12 m6 xl4">
      <div class="card hoverable institucion-card">
        <div class="card-image">
          <img src="${Util.esc(Api.urlArchivo(i.fotoUrl))}" alt="Foto de ${Util.esc(i.nombre)}"
               loading="lazy" onerror="this.style.visibility='hidden'">
          <span class="chip insignia"><i class="material-icons">verified</i>Insignia Verde</span>
        </div>
        <div class="card-content">
          <span class="card-title">${Util.esc(i.nombre)}</span>
          <p style="color:${t.color}"><i class="material-icons tiny">${t.icono}</i>
            <strong>${t.etiqueta}</strong>${i.barrio ? ' · ' + Util.esc(i.barrio) : ''}</p>
          <p class="grey-text text-darken-1">${Util.esc(i.direccion)}</p>
          <p>${Util.reputacion(i.reputacionPromedio, i.cantidadCalificaciones)}</p>
          <p>${i.necesidadesActivas} necesidad(es) activa(s)${distancia}</p>
        </div>
        <div class="card-action">
          <a href="#!" class="btn-ver-mapa" data-id="${i.id}">Ver en el mapa</a>
          <a href="#!" class="btn-detalle" data-id="${i.id}">Ver detalle</a>
        </div>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- detalle

  async function abrirDetalle(id) {
    el.detalle.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';
    modal.open();

    try {
      const [d, resenas] = await Promise.all([
        Api.institucion(id),
        Api.resenas(id, { pagina: 1, tamano: 3 })
      ]);
      el.detalle.innerHTML = htmlDetalle(d, resenas.items);
    } catch (error) {
      el.detalle.innerHTML = `<p class="red-text">${Util.esc(error.message)}</p>`;
    }
  }

  function htmlDetalle(d, resenas) {
    const t = Util.tipos[d.tipo] ?? Util.tipos.Otro;

    const necesidades = d.necesidades.length
      ? `<ul class="collection">${d.necesidades.map(n => {
          const u = Util.urgencias[n.urgencia] ?? Util.urgencias.Media;
          return `<li class="collection-item">
            <span class="new badge ${u.clase}" data-badge-caption="${u.etiqueta}"></span>
            <strong>${Util.esc(n.titulo)}</strong><br>
            <span class="grey-text text-darken-1">${Util.esc(Util.categorias[n.categoria] ?? n.categoria)} · ${Util.esc(n.descripcion)}</span>
            ${n.cantidadRequerida ? `<br><small>Cantidad requerida: ${n.cantidadRequerida}</small>` : ''}
            ${n.fechaLimite ? `<br><small>Hasta el ${Util.fecha(n.fechaLimite)}</small>` : ''}
          </li>`;
        }).join('')}</ul>`
      : '<p class="grey-text">Por ahora no tiene necesidades activas publicadas.</p>';

    const resenasHtml = resenas.length
      ? resenas.map(r => `<div class="resena">
          <div>${Util.estrellas(r.estrellas)} <strong>${Util.esc(r.donante)}</strong>
            <small class="grey-text">${Util.fecha(r.fecha)}</small></div>
          ${r.comentario ? `<p>${Util.esc(r.comentario)}</p>` : ''}
          ${r.evidenciaUrl
            ? `<a href="${Util.esc(Api.urlArchivo(r.evidenciaUrl))}" target="_blank" rel="noopener">
                 <img class="evidencia-mini" src="${Util.esc(Api.urlArchivo(r.evidenciaUrl))}" alt="Evidencia de la entrega">
               </a>`
            : ''}
        </div>`).join('')
      : '<p class="grey-text">Todavía no hay reseñas verificadas.</p>';

    return `
      <img class="detalle-foto" src="${Util.esc(Api.urlArchivo(d.fotoUrl))}" alt="Foto de ${Util.esc(d.nombre)}"
           onerror="this.style.display='none'">
      <h4>${Util.esc(d.nombre)} <i class="material-icons green-text text-darken-2" title="Institución verificada">verified</i></h4>
      <p style="color:${t.color}"><strong>${t.etiqueta}</strong>${d.barrio ? ' · ' + Util.esc(d.barrio) : ''}</p>
      <p>${Util.reputacion(d.reputacionPromedio, d.cantidadCalificaciones)}</p>
      <p>${Util.esc(d.descripcion)}</p>
      <a href="#!" class="btn waves-effect waves-light green darken-2 btn-donar"
         data-id="${d.id}" data-nombre="${Util.esc(d.nombre)}">
        <i class="material-icons left">volunteer_activism</i>Quiero donar
      </a>
      <p><i class="material-icons tiny">place</i> ${Util.esc(d.direccion)}</p>
      ${d.telefono ? `<p><i class="material-icons tiny">phone</i> <a href="tel:${Util.esc(d.telefono)}">${Util.esc(d.telefono)}</a></p>` : ''}
      ${d.emailContacto ? `<p><i class="material-icons tiny">email</i> <a href="mailto:${Util.esc(d.emailContacto)}">${Util.esc(d.emailContacto)}</a></p>` : ''}
      <h5>Qué necesitan</h5>
      ${necesidades}
      <h5>Reseñas verificadas</h5>
      ${resenasHtml}`;
  }
})();