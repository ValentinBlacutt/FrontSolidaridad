/* Sesión de usuario: login, registro de donante, salir y estado de la navbar / sidebar. */
const Auth = (() => {
  const $ = (id) => document.getElementById(id);
  const ROLES = { Donante: 'Donante', Institucion: 'Institución', Admin: 'Administrador' };
  let modal, tabs, vLogin, vRegistro;

  document.addEventListener('DOMContentLoaded', () => {
    tabs = M.Tabs.init($('tabsAuth'));
    // Los tabs miden su ancho al abrirse el modal (antes están ocultos)
    modal = M.Modal.init($('modalAuth'), { onOpenEnd: () => tabs.updateTabIndicator() });

    vLogin = Formulario.vincular({
      'login-email': v => Formulario.email.test(v) || 'Ingresá un email válido.',
      'login-password': v => v !== '' || 'Ingresá tu contraseña.'
    });

    vRegistro = Formulario.vincular({
      'reg-nombre': v => Formulario.nombrePersona.test(v) || 'Ingresá tu nombre (solo letras, mínimo 2).',
      'reg-apellido': v => Formulario.nombrePersona.test(v) || 'Ingresá tu apellido (solo letras, mínimo 2).',
      'reg-email': v => Formulario.email.test(v) || 'Ingresá un email válido.',
      'reg-telefono': v => v === '' || Formulario.telefono.test(v) || 'Teléfono inválido, por ejemplo 11 5555-0123.',
      'reg-password': v => (v.length >= 8 && v.length <= 100) || 'La contraseña debe tener entre 8 y 100 caracteres.',
      'reg-password2': v => v === $('reg-password').value.trim() || 'Las contraseñas no coinciden.'
    });

    $('formLogin').addEventListener('submit', enviarLogin);
    $('formRegistro').addEventListener('submit', enviarRegistro);

    document.addEventListener('click', (e) => {
      if (e.target.closest('.abrir-login')) { e.preventDefault(); abrirLogin(); }
      if (e.target.closest('.btn-salir')) { e.preventDefault(); salir(); }
      if (e.target.closest('#linkRegInstitucion')) {
        e.preventDefault();
        modal.close();
        setTimeout(() => PanelInstitucion.abrirRegistro(), 320); // espera a que termine de cerrarse
      }
    });

    document.addEventListener('sesion-expirada', () => {
      refrescarUI(true);
      abrirLogin('Tu sesión expiró. Ingresá nuevamente para continuar.');
    });

    refrescarUI(false);
  });

  function refrescarUI(notificar) {
    const u = Sesion.usuario;
    const logueado = Boolean(u);

    ['navIngresar', 'sideIngresar'].forEach(id => { $(id).hidden = logueado; });
    ['navPanel', 'navSalir', 'sidePanel', 'sideSalir', 'sideUsuario'].forEach(id => { $(id).hidden = !logueado; });
    $('panel').hidden = !logueado;

    if (u) {
      const nombre = u.rol === 'Institucion' ? u.nombre : `${u.nombre} ${u.apellido}`;
      $('sideUsuarioTxt').textContent = `${nombre} · ${ROLES[u.rol] ?? u.rol}`;
      $('panelRol').textContent = ROLES[u.rol] ?? u.rol;
    }

    // Avisa a los paneles (donante / institución / admin) para que se muestren u oculten
    if (notificar) document.dispatchEvent(new CustomEvent('sesion-cambio', { detail: u }));
  }

  function abrirLogin(mensaje = '') {
    const aviso = $('authMensaje');
    aviso.textContent = mensaje;
    aviso.hidden = !mensaje;
    tabs.select('tabLogin');
    modal.open();
  }

  function iniciarSesion(auth) {
    Sesion.guardar(auth);
    modal.close();
    vLogin.limpiar();
    vRegistro.limpiar();
    $('formLogin').reset();
    $('formRegistro').reset();
    refrescarUI(true);
    M.toast({ html: `Hola, ${Util.esc(auth.usuario.nombre)}`, classes: 'green darken-2' });
    $('panel').scrollIntoView({ behavior: 'smooth' });
  }

  function salir() {
    Sesion.cerrar();
    refrescarUI(true);
    M.toast({ html: 'Cerraste sesión.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviarLogin(e) {
    e.preventDefault();
    if (!vLogin.validarTodos()) return;

    await Formulario.enviar($('btnLogin'), 'Ingresando…', async () => {
      try {
        iniciarSesion(await Api.login($('login-email').value.trim(), $('login-password').value));
      } catch (error) { Formulario.toastError(error); }
    });
  }

  async function enviarRegistro(e) {
    e.preventDefault();
    if (!vRegistro.validarTodos()) return;

    const datos = {
      nombre: $('reg-nombre').value.trim(),
      apellido: $('reg-apellido').value.trim(),
      email: $('reg-email').value.trim(),
      password: $('reg-password').value
    };
    const telefono = $('reg-telefono').value.trim();
    if (telefono) datos.telefono = telefono;

    await Formulario.enviar($('btnRegistro'), 'Creando cuenta…', async () => {
      try {
        iniciarSesion(await Api.registroDonante(datos)); // el registro devuelve el token: ya queda logueado
      } catch (error) { Formulario.toastError(error); }
    });
  }

  return { abrirLogin, iniciarSesion };
})();