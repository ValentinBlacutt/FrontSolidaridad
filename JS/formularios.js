/* Utilidades de formularios: validación en vivo, CUIT, archivos, selects y envío con estado "ocupado". */
const Formulario = {
  nombrePersona: /^\p{L}[\p{L}\s'’-]{1,99}$/u,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  telefono: /^[0-9+()\-\s]{8,20}$/,
  progreso: '<div class="progress"><div class="indeterminate"></div></div>',

  vacio(icono, texto) {
    return `<div class="estado-vacio"><i class="material-icons">${icono}</i><p>${Util.esc(texto)}</p></div>`;
  },

  /**
   * reglas: { idDelCampo: valor => true | 'mensaje de error' }
   * Cada campo necesita un <span id="error-idDelCampo"> para mostrar el mensaje.
   */
  vincular(reglas) {
    const ids = Object.keys(reglas);
    const leer = (campo) => (campo.type === 'file' ? (campo.files[0] ?? null) : campo.value.trim());

    function validar(id) {
      const campo = document.getElementById(id);
      const valor = leer(campo);
      const resultado = reglas[id](valor);
      const mensaje = resultado === true ? '' : resultado;

      campo.classList.toggle('invalid', Boolean(mensaje));
      campo.classList.toggle('valid', !mensaje && Boolean(valor));
      campo.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      const error = document.getElementById('error-' + id);
      if (error) error.textContent = mensaje;
      return !mensaje;
    }

    ids.forEach((id) => {
      const campo = document.getElementById(id);
      // Una vez marcado el error, se corrige en vivo mientras el usuario escribe
      const revalidar = () => { if (campo.type === 'file' || campo.classList.contains('invalid')) validar(id); };
      campo.addEventListener('blur', () => validar(id));
      campo.addEventListener('input', revalidar);
      campo.addEventListener('change', revalidar);
    });

    return {
      // Valida todos los campos (no corta en el primero) para marcar los errores juntos
      validarTodos() {
        const resultados = ids.map(validar);
        const primero = ids.find((id, i) => !resultados[i]);
        if (primero) document.getElementById(primero).focus();
        return primero === undefined;
      },
      limpiar() {
        ids.forEach((id) => {
          const campo = document.getElementById(id);
          campo.classList.remove('valid', 'invalid');
          campo.removeAttribute('aria-invalid');
          const error = document.getElementById('error-' + id);
          if (error) error.textContent = '';
        });
      }
    };
  },

  // Algoritmo oficial del dígito verificador del CUIT/CUIL
  cuitValido(texto) {
    const cuit = texto.replace(/\D/g, '');
    if (cuit.length !== 11) return false;
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const suma = pesos.reduce((acc, p, i) => acc + p * Number(cuit[i]), 0);
    const resto = suma % 11;
    const verificador = resto === 0 ? 0 : 11 - resto;
    return verificador !== 10 && verificador === Number(cuit[10]);
  },

  archivoValido(archivo, extensiones, maxMb = 5) {
    if (!archivo) return 'Tenés que adjuntar un archivo.';
    const ext = '.' + archivo.name.split('.').pop().toLowerCase();
    if (!extensiones.includes(ext)) return `Formato no permitido. Usá: ${extensiones.join(', ')}.`;
    if (archivo.size > maxMb * 1024 * 1024) return `El archivo supera los ${maxMb} MB.`;
    return true;
  },

  // Los <select> de Materialize hay que reconstruirlos cuando cambian sus opciones o su valor
  reiniciarSelect(select) {
    M.FormSelect.getInstance(select)?.destroy();
    M.FormSelect.init(select);
  },

  mensaje(error) {
    return error instanceof TypeError
      ? `No pudimos conectar con el servidor (${API_URL}). Verificá que la API esté corriendo.`
      : error.message;
  },

  toastError(error) {
    M.toast({ html: Util.esc(Formulario.mensaje(error)), classes: 'red darken-2', displayLength: 6000 });
  },

  async enviar(boton, textoOcupado, accion) {
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = textoOcupado;
    try { return await accion(); }
    finally { boton.disabled = false; boton.innerHTML = original; }
  }
};