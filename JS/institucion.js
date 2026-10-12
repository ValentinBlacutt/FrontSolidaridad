/* Institución: registro (con mapa y archivos), estado de la solicitud, donaciones recibidas con PIN/QR y necesidades. */
const PanelInstitucion = (() => {
  const $ = (id) => document.getElementById(id);
  const DOCUMENTOS = ['.pdf', '.jpg', '.jpeg', '.png'];
  const IMAGENES = ['.jpg', '.jpeg', '.png', '.webp'];
  const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  let modalReg, modalNec, vReg, vNec, mapaReg, pinReg;
  let necesidades = [];

  document.addEventListener('DOMContentLoaded', () => {
    modalReg = M.Modal.init($('modalRegInstitucion'), { onOpenEnd: iniciarMapa });
    modalNec = M.Modal.init($('modalNecesidad'));

    vReg = Formulario.vincular({
      'inst-email': v => Formulario.email.test(v) || 'Ingresá un email válido.',
      'inst-password': v => (v.length >= 8 && v.length <= 100) || 'La contraseña debe tener entre 8 y 100 caracteres.',
      'inst-nombre': v => (v.length >= 3 && v.length <= 150) || 'Ingresá el nombre (3 a 150 caracteres).',
      'inst-tipo': v => v !== '' || 'Elegí el tipo de institución.',
      'inst-descripcion': v => (v.length >= 20 && v.length <= 1000) || 'La descripción debe tener entre 20 y 1000 caracteres.',
      'inst-cuit': v => Formulario.cuitValido(v) || 'El CUIT no es válido (11 dígitos). Ej.: 30-71234567-1.',
      'inst-telefono': v => v === '' || Formulario.telefono.test(v) || 'Teléfono inválido.',
      'inst-direccion': v => (v.length >= 5 && v.length <= 250) || 'Ingresá la dirección.',
      'inst-emailContacto': v => v === '' || Formulario.email.test(v) || 'Email de contacto inválido.',
      'inst-latitud': v => v !== '' || 'Marcá la ubicación en el mapa.',
      'inst-personeria': f => Formulario.archivoValido(f, DOCUMENTOS),
      'inst-foto': f => Formulario.archivoValido(f, IMAGENES)
    });

    vNec = Formulario.vincular({
      'nec-titulo': v => (v.length >= 3 && v.length <= 150) || 'El título debe tener entre 3 y 150 caracteres.',
      'nec-descripcion': v => (v.length >= 10 && v.length <= 1000) || 'La descripción debe tener entre 10 y 1000 caracteres.',
      'nec-categoria': v => v !== '' || 'Elegí una categoría.',
      'nec-cantidad': v => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000)
        || 'La cantidad debe ser un número entre 1 y 100000.',
      'nec-fecha': v => v === '' || v >= hoy() || 'La fecha límite no puede estar en el pasado.'
    });

    $('formRegInstitucion').addEventListener('submit', enviarRegistro);
    $('formNecesidad').addEventListener('submit', enviarNecesidad);
    $('btnNuevaNecesidad').addEventListener('click', () => abrirNecesidad(null));
    $('btnMiUbicacion').addEventListener('click', usarMiUbicacion);
    document.addEventListener('click', alHacerClic);
    document.addEventListener('sesion-cambio', actualizar);
    actualizar();
  });

  function actualizar() {
    const esInstitucion = Sesion.usuario?.rol === 'Institucion';
    $('panelInstitucion').hidden = !esInstitucion;
    if (esInstitucion) cargar();
  }

  // ================================================== REGISTRO DE INSTITUCIÓN

  function abrirRegistro() {
    $('formRegInstitucion').reset();
    vReg.limpiar();
    Formulario.reiniciarSelect($('inst-tipo'));
    quitarPin();
    M.updateTextFields();
    modalReg.open();
  }

  function iniciarMapa() {
    if (mapaReg) { mapaReg.invalidateSize(); return; }
    mapaReg = L.map('mapaRegistro', { scrollWheelZoom: false }).setView([-34.65, -58.62], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapaReg);
    mapaReg.on('click', (e) => marcar(e.latlng.lat, e.latlng.lng));
  }

  function marcar(lat, lng) {
    if (pinReg) pinReg.setLatLng([lat, lng]);
    else pinReg = L.marker([lat, lng]).addTo(mapaReg);

    $('inst-latitud').value = lat.toFixed(6);
    $('inst-longitud').value = lng.toFixed(6);
    $('coordsTexto').textContent = `Ubicación elegida: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    $('inst-latitud').dispatchEvent(new Event('input')); // limpia el error si lo había
  }

  function quitarPin() {
    if (pinReg) { pinReg.remove(); pinReg = null; }
    $('inst-latitud').value = '';
    $('inst-longitud').value = '';
    $('coordsTexto').textContent = 'Todavía no marcaste la ubicación.';
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      M.toast({ html: 'Tu navegador no permite obtener la ubicación.', classes: 'red darken-2' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        iniciarMapa();
        marcar(pos.coords.latitude, pos.coords.longitude);
        mapaReg.setView([pos.coords.latitude, pos.coords.longitude], 16);
      },
      () => M.toast({ html: 'No pudimos obtener tu ubicación. Marcala en el mapa.', classes: 'red darken-2' }),
      { timeout: 10000 }
    );
  }

  async function enviarRegistro(e) {
    e.preventDefault();
    if (!vReg.validarTodos()) return;

    const email = $('inst-email').value.trim();
    const password = $('inst-password').value;

    // Los nombres de los campos coinciden con las propiedades del DTO del backend
    const fd = new FormData();
    fd.append('Email', email);
    fd.append('Password', password);
    fd.append('Nombre', $('inst-nombre').value.trim());
    fd.append('Tipo', $('inst-tipo').value);
    fd.append('Descripcion', $('inst-descripcion').value.trim());
    fd.append('Cuit', $('inst-cuit').value.trim());
    fd.append('Direccion', $('inst-direccion').value.trim());
    fd.append('Latitud', $('inst-latitud').value);
    fd.append('Longitud', $('inst-longitud').value);
    [['Barrio', 'inst-barrio'], ['Telefono', 'inst-telefono'], ['EmailContacto', 'inst-emailContacto']]
      .forEach(([campo, id]) => { const v = $(id).value.trim(); if (v) fd.append(campo, v); });
    fd.append('Personeria', $('inst-personeria').files[0]);
    fd.append('Foto', $('inst-foto').files[0]);

    await Formulario.enviar($('btnRegInstitucion'), 'Enviando…', async () => {
      try {
        const r = await Api.registroInstitucion(fd);
        const auth = await Api.login(email, password); // queda logueada para ver el estado de su solicitud
        modalReg.close();
        Auth.iniciarSesion(auth);
        M.toast({ html: Util.esc(r.mensaje), classes: 'green darken-2', displayLength: 9000 });
      } catch (error) { Formulario.toastError(error); }
    });
  }

  // ====================================================== PANEL DE LA INSTITUCIÓN

  async function cargar() {
    const estado = $('estadoInstitucion');
    estado.innerHTML = Formulario.progreso;
    $('gestionInstitucion').hidden = true;

    try {
      const mia = await Api.miInstitucion();
      estado.innerHTML = htmlEstado(mia);
      if (mia.estado === 'Aprobada') {
        $('gestionInstitucion').hidden = false;
        await Promise.all([cargarRecibidas(), cargarNecesidades()]);
      }
    } catch (error) {
      estado.innerHTML = `<p class="red-text">${Util.esc(Formulario.mensaje(error))}</p>`;
    }
  }

  function htmlEstado(m) {
    const nombre = Util.esc(m.nombre);
    if (m.estado === 'Aprobada') {
      return `<div class="card-panel green lighten-4"><i class="material-icons left green-text text-darken-2">verified</i>
        <strong>${nombre}</strong> está verificada y visible en el mapa con la Insignia Verde.</div>`;
    }
    if (m.estado === 'Rechazada') {
      return `<div class="card-panel red lighten-4"><i class="material-icons left red-text">error_outline</i>
        La solicitud de <strong>${nombre}</strong> fue rechazada.<br>
        <strong>Motivo:</strong> ${Util.esc(m.motivoRechazo ?? 'No se indicó un motivo.')}<br>
        Escribinos desde el formulario de contacto para regularizar tu situación.</div>`;
    }
    return `<div class="card-panel orange lighten-4"><i class="material-icons left orange-text text-darken-3">hourglass_top</i>
      La solicitud de <strong>${nombre}</strong> está en revisión. Un administrador está auditando tu documentación;
      cuando la apruebe vas a poder publicar necesidades y recibir donaciones.</div>`;
  }

  // ---------------------------------------------------------- donaciones recibidas

  async function cargarRecibidas() {
    const cont = $('listaRecibidas');
    cont.innerHTML = Formulario.progreso;
    try {
      const r = await Api.donacionesRecibidas({ tamano: 50 });
      cont.innerHTML = r.items.length
        ? `<ul class="collection">${r.items.map(htmlRecibida).join('')}</ul>`
        : Formulario.vacio('inbox', 'Todavía no hay donaciones dirigidas a tu institución.');

      if (typeof QRCode !== 'undefined') {
        cont.querySelectorAll('.qr').forEach(el =>
          new QRCode(el, { text: el.dataset.payload, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M }));
      }
    } catch (error) {
      cont.innerHTML = `<p class="red-text">${Util.esc(Formulario.mensaje(error))}</p>`;
    }
  }

  function htmlRecibida(d) {
    const est = ESTADOS_DONACION[d.estado] ?? ESTADOS_DONACION.Registrada;
    const boton = (texto, nuevo) => `<button type="button" class="btn btn-small green darken-2 btn-recibir"
      data-id="${d.id}" data-nuevo="${nuevo}"><i class="material-icons left">pin</i>${texto}</button>`;
    let acciones = '';

    switch (d.estado) {
      case 'Registrada':
        acciones = boton('Confirmar recepción y generar PIN', false);
        break;
      case 'Recibida':
        acciones = `<div class="pin-bloque">
          <div class="qr" data-payload="${Util.esc(d.qrPayload ?? '')}"></div>
          <div>
            <div class="pin-numero">${Util.esc(d.codigoPin ?? '')}</div>
            <small>Válido hasta el ${fechaHora(d.pinExpiraEn)}. Entregáselo al donante.</small><br>
            ${boton('Generar PIN nuevo', true)}
          </div></div>`;
        break;
      case 'Vencida':
        acciones = `<small>El PIN venció.</small> ${boton('Generar PIN nuevo', true)}`;
        break;
      case 'Confirmada':
        acciones = d.estrellas ? `Calificación recibida: ${Util.estrellas(d.estrellas)}` : '';
        break;
    }

    return `<li class="collection-item">
      <span class="chip ${est.clase} white-text right">${est.etiqueta}</span>
      <strong>${Util.esc(d.donanteNombre)}</strong>
      <p>${Util.esc(d.descripcion)}</p>
      <small class="grey-text">Registrada el ${fechaHora(d.creadoEn)}${d.necesidadTitulo ? ' · Necesidad: ' + Util.esc(d.necesidadTitulo) : ''}</small>
      ${acciones ? `<div class="acciones">${acciones}</div>` : ''}
    </li>`;
  }

  // ------------------------------------------------------------------ necesidades

  async function cargarNecesidades() {
    const cont = $('listaNecesidades');
    cont.innerHTML = Formulario.progreso;
    try {
      necesidades = await Api.misNecesidades();
      cont.innerHTML = necesidades.length
        ? `<ul class="collection">${necesidades.map(htmlNecesidad).join('')}</ul>`
        : Formulario.vacio('playlist_add', 'Todavía no publicaste necesidades. Tocá "Nueva necesidad" para que los donantes sepan cómo ayudarte.');
    } catch (error) {
      cont.innerHTML = `<p class="red-text">${Util.esc(Formulario.mensaje(error))}</p>`;
    }
  }

  function htmlNecesidad(n) {
    const u = Util.urgencias[n.urgencia] ?? Util.urgencias.Media;
    return `<li class="collection-item">
      <span class="chip ${n.activa ? 'green' : 'grey'} white-text right">${n.activa ? 'Activa' : 'Cerrada'}</span>
      <strong>${Util.esc(n.titulo)}</strong>
      <span class="new badge ${u.clase}" data-badge-caption="${u.etiqueta}"></span>
      <p>${Util.esc(Util.categorias[n.categoria] ?? n.categoria)} · ${Util.esc(n.descripcion)}</p>
      <small class="grey-text">${n.cantidadRequerida ? 'Cantidad: ' + n.cantidadRequerida : ''}${n.fechaLimite ? ' · Hasta el ' + Util.fecha(n.fechaLimite) : ''}</small>
      ${n.activa ? `<div class="acciones">
        <button type="button" class="btn btn-small btn-editar-nec" data-id="${n.id}">Editar</button>
        <button type="button" class="btn btn-small btn-flat red-text btn-cerrar-nec" data-id="${n.id}">Cerrar necesidad</button>
      </div>` : ''}
    </li>`;
  }

  function abrirNecesidad(n) {
    $('formNecesidad').reset();
    vNec.limpiar();
    $('nec-id').value = n ? n.id : '';
    $('tituloModalNec').textContent = n ? 'Editar necesidad' : 'Nueva necesidad';

    if (n) {
      $('nec-titulo').value = n.titulo;
      $('nec-descripcion').value = n.descripcion;
      $('nec-categoria').value = n.categoria;
      $('nec-urgencia').value = n.urgencia;
      $('nec-cantidad').value = n.cantidadRequerida ?? '';
      $('nec-fecha').value = n.fechaLimite ? n.fechaLimite.slice(0, 10) : '';
    }

    ['nec-categoria', 'nec-urgencia'].forEach(id => Formulario.reiniciarSelect($(id)));
    M.updateTextFields();
    M.textareaAutoResize($('nec-descripcion'));
    modalNec.open();
  }

  async function enviarNecesidad(e) {
    e.preventDefault();
    if (!vNec.validarTodos()) return;

    const id = $('nec-id').value;
    const cantidad = $('nec-cantidad').value.trim();
    const fecha = $('nec-fecha').value;
    const datos = {
      titulo: $('nec-titulo').value.trim(),
      descripcion: $('nec-descripcion').value.trim(),
      categoria: $('nec-categoria').value,
      urgencia: $('nec-urgencia').value,
      cantidadRequerida: cantidad ? Number(cantidad) : null,
      fechaLimite: fecha ? `${fecha}T00:00:00` : null
    };

    await Formulario.enviar($('btnNecesidad'), 'Guardando…', async () => {
      try {
        if (id) await Api.editarNecesidad(Number(id), datos);
        else await Api.crearNecesidad(datos);
        modalNec.close();
        M.toast({ html: id ? 'Necesidad actualizada.' : 'Necesidad publicada.', classes: 'green darken-2' });
        cargarNecesidades();
      } catch (error) { Formulario.toastError(error); }
    });
  }

  // ------------------------------------------------------------------ clics

  async function alHacerClic(e) {
    const recibir = e.target.closest('.btn-recibir');
    if (recibir) {
      e.preventDefault();
      const nuevo = recibir.dataset.nuevo === 'true';
      const aviso = nuevo
        ? '¿Generar un PIN nuevo? El anterior dejará de funcionar.'
        : '¿Confirmás que recibiste esta donación? Se va a generar un PIN para que el donante la valide.';
      if (!confirm(aviso)) return;
      try {
        await Api.recibirDonacion(Number(recibir.dataset.id));
        M.toast({ html: 'PIN generado. Entregáselo al donante.', classes: 'green darken-2' });
        cargarRecibidas();
      } catch (error) { Formulario.toastError(error); }
      return;
    }

    const editar = e.target.closest('.btn-editar-nec');
    if (editar) {
      e.preventDefault();
      abrirNecesidad(necesidades.find(n => n.id === Number(editar.dataset.id)));
      return;
    }

    const cerrar = e.target.closest('.btn-cerrar-nec');
    if (cerrar) {
      e.preventDefault();
      if (!confirm('¿Cerrar esta necesidad? Dejará de mostrarse en el mapa.')) return;
      try {
        await Api.cerrarNecesidad(Number(cerrar.dataset.id));
        M.toast({ html: 'Necesidad cerrada.' });
        cargarNecesidades();
      } catch (error) { Formulario.toastError(error); }
    }
  }

  return { abrirRegistro };
})();