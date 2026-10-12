/* Parte 2: carrusel de destacadas, collapsible, video y formulario de contacto con validación. */
(() => {
  const AUTOPLAY_MS = 4500;

  document.addEventListener('DOMContentLoaded', () => {
    M.Collapsible.init(document.querySelectorAll('.collapsible'), { accordion: true });
    iniciarVideo();
    iniciarFormulario();
    cargarDestacadas();
  });

  // ================================================================ CARRUSEL

  async function cargarDestacadas() {
    const carrusel = document.getElementById('carruselDestacadas');
    const estado = document.getElementById('destacadasEstado');

    try {
      const r = await Api.instituciones({ tamanoPagina: 50 });

      // Mejor valoradas primero; las que todavía no tienen calificaciones van al final
      const top = [...r.items]
        .sort((a, b) =>
          (b.reputacionPromedio ?? -1) - (a.reputacionPromedio ?? -1)
          || b.cantidadCalificaciones - a.cantidadCalificaciones)
        .slice(0, 6);

      if (!top.length) {
        carrusel.innerHTML = '';
        estado.textContent = 'Todavía no hay instituciones para destacar.';
        return;
      }

      carrusel.innerHTML = top.map(htmlItem).join('');
      const instancia = M.Carousel.init(carrusel, {
        dist: -50,
        padding: 30,
        numVisible: window.innerWidth < 600 ? 3 : 5
      });

      document.getElementById('carruselPrev').addEventListener('click', () => instancia.prev());
      document.getElementById('carruselNext').addEventListener('click', () => instancia.next());

      // Avance automático; se pausa al pasar el mouse, al enfocar, o si el usuario prefiere menos movimiento
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      let timer;
      const iniciarAuto = () => { detenerAuto(); timer = setInterval(() => instancia.next(), AUTOPLAY_MS); };
      const detenerAuto = () => clearInterval(timer);

      const wrap = carrusel.closest('.carrusel-wrap');
      wrap.addEventListener('mouseenter', detenerAuto);
      wrap.addEventListener('mouseleave', iniciarAuto);
      wrap.addEventListener('focusin', detenerAuto);
      wrap.addEventListener('focusout', iniciarAuto);
      iniciarAuto();
    } catch (error) {
      carrusel.innerHTML = '';
      estado.textContent = error instanceof TypeError
        ? `No pudimos conectar con el servidor (${API_URL}).`
        : error.message;
    }
  }

  function htmlItem(i) {
    const t = Util.tipos[i.tipo] ?? Util.tipos.Otro;
    const valoracion = i.reputacionPromedio !== null && i.reputacionPromedio !== undefined
      ? `${Util.estrellas(i.reputacionPromedio)} <strong>${i.reputacionPromedio.toFixed(1)}</strong>`
      : '<span class="grey-text">Nueva en la red</span>';

    return `<div class="carousel-item destacada">
      <img src="${Util.esc(Api.urlArchivo(i.fotoUrl))}" alt="Foto de ${Util.esc(i.nombre)}"
           onerror="this.style.visibility='hidden'">
      <div class="destacada-cuerpo">
        <strong>${Util.esc(i.nombre)}</strong>
        <div>${valoracion}</div>
        <small style="color:${t.color}">${t.etiqueta}${i.barrio ? ' · ' + Util.esc(i.barrio) : ''}</small>
        <br>
        <button type="button" class="btn btn-small waves-effect green darken-2 btn-detalle" data-id="${i.id}">Ver detalle</button>
      </div>
    </div>`;
  }

  // ===================================================================== VIDEO

  function iniciarVideo() {
    const video = document.getElementById('videoDonar');
    const aviso = document.getElementById('videoAviso');
    const fuente = video.querySelector('source');

    // Si el archivo no existe o no se puede reproducir, mostramos un aviso en lugar de un reproductor roto
    fuente.addEventListener('error', () => {
      video.hidden = true;
      aviso.hidden = false;
    });
  }

  // ================================================================ FORMULARIO

  function iniciarFormulario() {
    const form = document.getElementById('formContacto');
    const boton = document.getElementById('btnEnviar');
    const textoBoton = document.getElementById('btnEnviarTxt');
    const exito = document.getElementById('contactoOk');
    const contador = document.getElementById('contadorComentarios');
    const comentarios = document.getElementById('comentarios');

    // Cada regla devuelve true si el valor es válido, o el mensaje de error
    const nombrePersona = /^\p{L}[\p{L}\s'’-]{1,99}$/u;
    const reglas = {
      nombre: v => nombrePersona.test(v) || 'Ingresá tu nombre (solo letras, mínimo 2).',
      apellido: v => nombrePersona.test(v) || 'Ingresá tu apellido (solo letras, mínimo 2).',
      telefono: v => (/^[0-9+()\-\s]{8,20}$/.test(v) && v.replace(/\D/g, '').length >= 8)
        || 'Ingresá un teléfono válido, por ejemplo 11 5555-0123.',
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        || 'Ingresá un email válido, por ejemplo nombre@correo.com.',
      comentarios: v => (v.length >= 10 && v.length <= 2000)
        || 'Escribí un comentario de al menos 10 caracteres.'
    };
    const ids = Object.keys(reglas);

    function validar(id) {
      const input = document.getElementById(id);
      const valor = input.value.trim();
      const resultado = reglas[id](valor);
      const mensaje = resultado === true ? '' : resultado;

      input.classList.toggle('invalid', Boolean(mensaje));
      input.classList.toggle('valid', !mensaje && valor !== '');
      input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      document.getElementById('error-' + id).textContent = mensaje;
      return !mensaje;
    }

    ids.forEach(id => {
      const input = document.getElementById(id);
      input.addEventListener('blur', () => validar(id));
      // Una vez marcado el error, se corrige en vivo mientras el usuario escribe
      input.addEventListener('input', () => { if (input.classList.contains('invalid')) validar(id); });
    });

    comentarios.addEventListener('input', () => {
      contador.textContent = `${comentarios.value.length} / 2000`;
    });

    function limpiar() {
      form.reset();
      ids.forEach(id => {
        const input = document.getElementById(id);
        input.classList.remove('valid', 'invalid');
        input.removeAttribute('aria-invalid');
        document.getElementById('error-' + id).textContent = '';
      });
      contador.textContent = '0 / 2000';
      M.updateTextFields();
      M.textareaAutoResize(comentarios);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      exito.hidden = true;

      // Se validan todos los campos (no se corta en el primero) para marcar todos los errores juntos
      const resultados = ids.map(id => validar(id));
      if (resultados.includes(false)) {
        form.querySelector('.invalid')?.focus();
        return;
      }

      const datos = Object.fromEntries(ids.map(id => [id, document.getElementById(id).value.trim()]));

      boton.disabled = true;
      textoBoton.textContent = 'Enviando…';

      try {
        await Api.post('/api/contacto', datos);
        limpiar();
        exito.hidden = false;
        M.toast({ html: 'Mensaje enviado correctamente.', classes: 'green darken-2' });
      } catch (error) {
        const mensaje = error instanceof TypeError
          ? `No pudimos conectar con el servidor (${API_URL}). Intentá de nuevo en unos minutos.`
          : error.message;
        M.toast({ html: Util.esc(mensaje), classes: 'red darken-2', displayLength: 6000 });
      } finally {
        boton.disabled = false;
        textoBoton.textContent = 'Enviar mensaje';
      }
    });
  }
})();