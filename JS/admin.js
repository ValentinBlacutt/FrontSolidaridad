/* Administrador: auditoría de instituciones (Etapa 1): aprobar o rechazar. */
const PanelAdmin = (() => {
  const $ = (id) => document.getElementById(id);
  const CLASES = { Pendiente: 'orange', Aprobada: 'green', Rechazada: 'red' };
  let modalRechazo, vRechazo;

  document.addEventListener('DOMContentLoaded', () => {
    modalRechazo = M.Modal.init($('modalRechazo'));

    vRechazo = Formulario.vincular({
      'rechazo-motivo': v => (v.length >= 5 && v.length <= 500) || 'Indicá el motivo (entre 5 y 500 caracteres).'
    });

    $('adminEstado').addEventListener('change', cargar);
    $('formRechazo').addEventListener('submit', enviarRechazo);
    document.addEventListener('click', alHacerClic);
    document.addEventListener('sesion-cambio', actualizar);
    actualizar();
  });

  function actualizar() {
    const esAdmin = Sesion.usuario?.rol === 'Admin';
    $('panelAdmin').hidden = !esAdmin;
    if (esAdmin) cargar();
  }

  async function cargar() {
    const cont = $('listaAdmin');
    cont.innerHTML = Formulario.progreso;
    try {
      const r = await Api.adminInstituciones({ estado: $('adminEstado').value, tamano: 50 });
      cont.innerHTML = r.items.length
        ? `<ul class="collection">${r.items.map(html).join('')}</ul>`
        : Formulario.vacio('inbox', 'No hay instituciones con ese estado.');
    } catch (error) {
      cont.innerHTML = `<p class="red-text">${Util.esc(Formulario.mensaje(error))}</p>`;
    }
  }

  function html(i) {
    const t = Util.tipos[i.tipo] ?? Util.tipos.Otro;
    const cuit = i.cuit.replace(/^(\d{2})(\d{8})(\d)$/, '$1-$2-$3');
    const mapa = `https://www.openstreetmap.org/?mlat=${i.latitud}&mlon=${i.longitud}#map=17/${i.latitud}/${i.longitud}`;
    const foto = Util.esc(Api.urlArchivo(i.fotoUrl));
    const personeria = Util.esc(Api.urlArchivo(i.personeriaJuridicaUrl));

    const revision = i.revisadaEn
      ? `<small class="grey-text">Revisada el ${fechaHora(i.revisadaEn)}${i.revisadaPorEmail ? ' por ' + Util.esc(i.revisadaPorEmail) : ''}</small>`
      : '';
    const motivo = i.motivoRechazo ? `<p class="red-text"><strong>Motivo del rechazo:</strong> ${Util.esc(i.motivoRechazo)}</p>` : '';

    return `<li class="collection-item admin-item">
      <img class="admin-foto" src="${foto}" alt="Foto de ${Util.esc(i.nombre)}" onerror="this.style.visibility='hidden'">
      <div class="admin-datos">
        <span class="chip ${CLASES[i.estado] ?? 'grey'} white-text right">${i.estado}</span>
        <strong>${Util.esc(i.nombre)}</strong> <small style="color:${t.color}">${t.etiqueta}</small>
        <p><strong>CUIT:</strong> ${cuit} · <strong>Cuenta:</strong> ${Util.esc(i.emailCuenta)}<br>
           ${Util.esc(i.direccion)}${i.barrio ? ', ' + Util.esc(i.barrio) : ''}</p>
        <p>${Util.esc(i.descripcion)}</p>
        <p>
          <a href="${personeria}" target="_blank" rel="noopener">Ver personería jurídica</a> ·
          <a href="${foto}" target="_blank" rel="noopener">Ver foto del lugar</a> ·
          <a href="${mapa}" target="_blank" rel="noopener">Ver ubicación</a>
        </p>
        ${motivo}${revision}
        <div class="acciones">
          ${i.estado !== 'Aprobada' ? `<button type="button" class="btn btn-small green darken-2 btn-aprobar" data-id="${i.id}" data-nombre="${Util.esc(i.nombre)}"><i class="material-icons left">check</i>Aprobar</button>` : ''}
          ${i.estado !== 'Rechazada' ? `<button type="button" class="btn btn-small red darken-2 btn-rechazar" data-id="${i.id}" data-nombre="${Util.esc(i.nombre)}"><i class="material-icons left">close</i>Rechazar</button>` : ''}
        </div>
      </div>
    </li>`;
  }

  async function alHacerClic(e) {
    const aprobar = e.target.closest('.btn-aprobar');
    if (aprobar) {
      e.preventDefault();
      if (!confirm(`¿Aprobar "${aprobar.dataset.nombre}"? Se activará su pin con la Insignia Verde en el mapa.`)) return;
      try {
        await Api.aprobar(Number(aprobar.dataset.id));
        M.toast({ html: 'Institución aprobada.', classes: 'green darken-2' });
        cargar();
      } catch (error) { Formulario.toastError(error); }
      return;
    }

    const rechazar = e.target.closest('.btn-rechazar');
    if (rechazar) {
      e.preventDefault();
      $('formRechazo').reset();
      vRechazo.limpiar();
      $('rechazo-id').value = rechazar.dataset.id;
      $('rechazoNombre').textContent = rechazar.dataset.nombre;
      M.updateTextFields();
      modalRechazo.open();
    }
  }

  async function enviarRechazo(e) {
    e.preventDefault();
    if (!vRechazo.validarTodos()) return;

    await Formulario.enviar($('btnRechazo'), 'Rechazando…', async () => {
      try {
        await Api.rechazar(Number($('rechazo-id').value), $('rechazo-motivo').value.trim());
        modalRechazo.close();
        M.toast({ html: 'Solicitud rechazada.' });
        cargar();
      } catch (error) { Formulario.toastError(error); }
    });
  }
})();