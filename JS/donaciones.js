/* Donante: registrar donación, mis donaciones, validar entrega con PIN + estrellas + evidencia. */

// Compartido con el panel de la institución
const ESTADOS_DONACION = {
  Registrada: { etiqueta: 'Esperando entrega', clase: 'grey' },
  Recibida: { etiqueta: 'Recibida · falta validar', clase: 'blue' },
  Confirmada: { etiqueta: 'Confirmada', clase: 'green' },
  Vencida: { etiqueta: 'PIN vencido', clase: 'orange' },
  Cancelada: { etiqueta: 'Cancelada', clase: 'grey' }
};
const fechaHora = (v) => new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

const PanelDonante = (() => {
  const $ = (id) => document.getElementById(id);
  // Acepta "123456" o el contenido completo del QR: MAPASOLIDARIO:12:123456
  const PIN = /^(?:MAPASOLIDARIO:\d+:)?(\d{6})$/i;
  const IMAGENES = ['.jpg', '.jpeg', '.png', '.webp'];
  let modalDonar, modalValidar, vDonar, vValidar, estrellas;

  document.addEventListener('DOMContentLoaded', () => {
    modalDonar = M.Modal.init($('modalDonar'));
    modalValidar = M.Modal.init($('modalValidar'));
    estrellas = crearEstrellas($('validarEstrellas'), $('validar-estrellas'));

    vDonar = Formulario.vincular({
      'donar-descripcion': v => (v.length >= 5 && v.length <= 500) || 'Describí qué vas a donar (mínimo 5 caracteres).'
    });
    vValidar = Formulario.vincular({
      'validar-pin': v => PIN.test(v) || 'Ingresá el PIN de 6 dígitos (o el contenido del QR).',
      'validar-estrellas': v => Number(v) >= 1 || 'Elegí cuántas estrellas le das.',
      'validar-foto': f => Formulario.archivoValido(f, IMAGENES)
    });

    $('formDonar').addEventListener('submit', enviarDonacion);
    $('formValidar').addEventListener('submit', enviarValidacion);
    document.addEventListener('click', alHacerClic, true);
    document.addEventListener('sesion-cambio', actualizar);
    actualizar();
  });

  function actualizar() {
    const esDonante = Sesion.usuario?.rol === 'Donante';
    $('panelDonante').hidden = !esDonante;
    if (esDonante) cargar();
  }

  // ------------------------------------------------------------ estrellas

  function crearEstrellas(contenedor, input) {
    contenedor.innerHTML = [1, 2, 3, 4, 5].map(n => `
      <button type="button" class="estrella" data-valor="${n}" role="radio" aria-checked="false"
              aria-label="${n} estrella${n > 1 ? 's' : ''}"><i class="material-icons">star_border</i></button>`).join('');

    const pintar = () => contenedor.querySelectorAll('.estrella').forEach(b => {
      const n = Number(b.dataset.valor);
      b.querySelector('i').textContent = n <= Number(input.value) ? 'star' : 'star_border';
      b.setAttribute('aria-checked', String(n === Number(input.value)));
    });

    contenedor.addEventListener('click', (e) => {
      const b = e.target.closest('.estrella');
      if (!b) return;
      input.value = b.dataset.valor;
      pintar();
      input.dispatchEvent(new Event('input')); // limpia el error si lo había
    });

    return { reiniciar() { input.value = ''; pintar(); } };
  }

  // ------------------------------------------------------- clics delegados

  async function alHacerClic(e) {
    const donar = e.target.closest('.btn-donar');
    if (donar) {
      e.preventDefault();
      return iniciarDonacion(Number(donar.dataset.id), donar.dataset.nombre);
    }

    const validar = e.target.closest('.btn-validar');
    if (validar) { e.preventDefault(); return abrirValidar(Number(validar.dataset.id), validar.dataset.institucion); }

    const cancelar = e.target.closest('.btn-cancelar-don');
    if (cancelar) { e.preventDefault(); return cancelarDonacion(Number(cancelar.dataset.id)); }
  }

  async function cerrarDetalle() {
    const detalle = M.Modal.getInstance($('modalDetalle'));
    if (detalle?.isOpen) {
      detalle.close();
      await new Promise(r => setTimeout(r, 320)); // espera la animación antes de abrir otro modal
    }
  }

  // --------------------------------------------------------------- donar

  async function iniciarDonacion(institucionId, nombre) {
    await cerrarDetalle();

    const u = Sesion.usuario;
    if (!u) { Auth.abrirLogin('Para donar necesitás ingresar o crear una cuenta de donante.'); return; }
    if (u.rol !== 'Donante') {
      M.toast({ html: 'Solo las cuentas de donante pueden registrar donaciones.', classes: 'orange darken-3' });
      return;
    }

    try {
      const inst = await Api.institucion(institucionId); // trae las necesidades activas
      $('formDonar').reset();
      vDonar.limpiar();
      $('donarInstitucion').textContent = nombre;
      $('donar-institucionId').value = institucionId;

      const sel = $('donar-necesidad');
      sel.innerHTML = '<option value="" selected>Ninguna en particular</option>'
        + inst.necesidades.map(n => `<option value="${n.id}">${Util.esc(n.titulo)}</option>`).join('');
      Formulario.reiniciarSelect(sel);

      M.updateTextFields();
      modalDonar.open();
    } catch (error) { Formulario.toastError(error); }
  }

  async function enviarDonacion(e) {
    e.preventDefault();
    if (!vDonar.validarTodos()) return;

    const datos = {
      institucionId: Number($('donar-institucionId').value),
      descripcion: $('donar-descripcion').value.trim()
    };
    const necesidad = $('donar-necesidad').value;
    if (necesidad) datos.necesidadId = Number(necesidad);

    await Formulario.enviar($('btnDonar'), 'Registrando…', async () => {
      try {
        await Api.donar(datos);
        modalDonar.close();
        M.toast({ html: 'Donación registrada. Cuando la entregues, la institución te dará un PIN.', classes: 'green darken-2', displayLength: 6000 });
        cargar();
        $('panel').scrollIntoView({ behavior: 'smooth' });
      } catch (error) { Formulario.toastError(error); }
    });
  }

  // ------------------------------------------------------ mis donaciones

  async function cargar() {
    const cont = $('listaMisDonaciones');
    cont.innerHTML = Formulario.progreso;
    try {
      const r = await Api.misDonaciones({ tamano: 50 });
      cont.innerHTML = r.items.length
        ? `<ul class="collection">${r.items.map(htmlDonacion).join('')}</ul>`
        : Formulario.vacio('favorite_border', 'Todavía no registraste donaciones. Explorá el mapa, elegí una institución y tocá "Quiero donar".');
    } catch (error) {
      cont.innerHTML = `<p class="red-text">${Util.esc(Formulario.mensaje(error))}</p>`;
    }
  }

  function htmlDonacion(d) {
    const est = ESTADOS_DONACION[d.estado] ?? ESTADOS_DONACION.Registrada;
    const cancelar = `<button type="button" class="btn btn-small btn-flat red-text btn-cancelar-don" data-id="${d.id}">Cancelar donación</button>`;
    let detalle = '';
    let acciones = '';

    switch (d.estado) {
      case 'Registrada':
        detalle = 'Esperando que la institución confirme que recibió tu donación.';
        acciones = cancelar;
        break;
      case 'Recibida':
        detalle = `La institución confirmó la recepción. Pedile el PIN y validá la entrega antes del ${fechaHora(d.pinExpiraEn)}.`;
        acciones = `<button type="button" class="btn btn-small green darken-2 btn-validar"
                      data-id="${d.id}" data-institucion="${Util.esc(d.institucionNombre)}">
                      <i class="material-icons left">verified</i>Validar entrega</button>${cancelar}`;
        break;
      case 'Vencida':
        detalle = 'El PIN venció. Pedile a la institución que genere uno nuevo para poder validar.';
        acciones = cancelar;
        break;
      case 'Confirmada':
        detalle = `Entrega confirmada el ${fechaHora(d.confirmadaEn)}. ¡Gracias por tu ayuda!`;
        acciones = d.estrellas ? `Tu calificación: ${Util.estrellas(d.estrellas)}` : '';
        break;
    }

    return `<li class="collection-item">
      <span class="chip ${est.clase} white-text right">${est.etiqueta}</span>
      <strong>${Util.esc(d.institucionNombre)}</strong>
      <p>${Util.esc(d.descripcion)}</p>
      <small class="grey-text">Registrada el ${fechaHora(d.creadoEn)}${d.necesidadTitulo ? ' · Necesidad: ' + Util.esc(d.necesidadTitulo) : ''}</small>
      ${detalle ? `<p>${detalle}</p>` : ''}
      ${acciones ? `<div class="acciones">${acciones}</div>` : ''}
    </li>`;
  }

  async function cancelarDonacion(id) {
    if (!confirm('¿Querés cancelar esta donación?')) return;
    try {
      await Api.cancelarDonacion(id);
      M.toast({ html: 'Donación cancelada.' });
      cargar();
    } catch (error) { Formulario.toastError(error); }
  }

  // -------------------------------------------------------------- validar

  function abrirValidar(id, institucion) {
    $('formValidar').reset();
    vValidar.limpiar();
    estrellas.reiniciar();
    $('validar-id').value = id;
    $('validarInfo').textContent = `Donación a ${institucion}. Ingresá el PIN que te dio la institución, calificá la experiencia y subí una foto de la entrega.`;
    M.updateTextFields();
    modalValidar.open();
  }

  async function enviarValidacion(e) {
    e.preventDefault();
    if (!vValidar.validarTodos()) return;

    const fd = new FormData();
    fd.append('Pin', $('validar-pin').value.trim().match(PIN)[1]);
    fd.append('Estrellas', $('validar-estrellas').value);
    const comentario = $('validar-comentario').value.trim();
    if (comentario) fd.append('Comentario', comentario);
    fd.append('Foto', $('validar-foto').files[0]);

    await Formulario.enviar($('btnValidar'), 'Validando…', async () => {
      try {
        await Api.validarDonacion(Number($('validar-id').value), fd);
        modalValidar.close();
        M.toast({ html: '¡Gracias! Tu validación quedó registrada y suma a la reputación de la institución.', classes: 'green darken-2', displayLength: 6000 });
        cargar();
      } catch (error) { Formulario.toastError(error); }
    });
  }
})();