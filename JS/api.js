/* Conexión con la API y manejo de la sesión (JWT). Cambiá API_URL si la API corre en otro puerto. */
const API_URL = 'http://localhost:5080';

const Sesion = {
  _clave: 'mapaSolidario.sesion',

  guardar(auth) {
    localStorage.setItem(this._clave, JSON.stringify({
      token: auth.token, expira: auth.expiraEnUtc, usuario: auth.usuario
    }));
  },

  obtener() {
    try {
      const s = JSON.parse(localStorage.getItem(this._clave));
      if (!s?.token) return null;
      if (new Date(s.expira) <= new Date()) { this.cerrar(); return null; }
      return s;
    } catch { return null; }
  },

  cerrar() { localStorage.removeItem(this._clave); },

  get token() { return this.obtener()?.token ?? null; },
  get usuario() { return this.obtener()?.usuario ?? null; }
};

const Api = {
  async _pedir(metodo, ruta, { params, cuerpo, form } = {}) {
    const url = new URL(API_URL + ruta);
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const headers = {};
    const token = Sesion.token;
    if (token) headers.Authorization = `Bearer ${token}`;

    const opciones = { method: metodo, headers };
    if (form) {
      opciones.body = form; // el navegador agrega el Content-Type multipart con su boundary
    } else if (cuerpo !== undefined) {
      headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    return Api._procesar(await fetch(url, opciones), Boolean(token));
  },

  // Convierte cualquier error de la API en un Error con un mensaje legible
  async _procesar(respuesta, teniaSesion) {
    if (respuesta.ok) return respuesta.status === 204 ? null : respuesta.json();

    // Con sesión, un 401 significa que el token venció o es inválido
    if (respuesta.status === 401 && teniaSesion) {
      Sesion.cerrar();
      document.dispatchEvent(new CustomEvent('sesion-expirada'));
      const e = new Error('Tu sesión expiró. Ingresá de nuevo.');
      e.status = 401;
      throw e;
    }

    if (respuesta.status === 429) {
      const e = new Error('Hiciste demasiados intentos seguidos. Esperá un minuto y volvé a intentar.');
      e.status = 429;
      throw e;
    }

    let mensaje = null;
    try {
      const p = await respuesta.json();
      mensaje = p.detail
        || (p.errors ? Object.values(p.errors).flat().join(' ') : null)
        || p.title
        || null;
    } catch { /* la respuesta no tenía cuerpo JSON */ }

    if (!mensaje) {
      mensaje = respuesta.status === 403 ? 'No tenés permisos para realizar esta acción.'
        : respuesta.status === 401 ? 'Tenés que ingresar para realizar esta acción.'
        : 'Ocurrió un error inesperado.';
    }

    const error = new Error(mensaje);
    error.status = respuesta.status;
    throw error;
  },

  get: (ruta, params) => Api._pedir('GET', ruta, { params }),
  post: (ruta, cuerpo) => Api._pedir('POST', ruta, { cuerpo }),
  put: (ruta, cuerpo) => Api._pedir('PUT', ruta, { cuerpo }),
  patch: (ruta, cuerpo) => Api._pedir('PATCH', ruta, { cuerpo }),
  eliminar: (ruta) => Api._pedir('DELETE', ruta),
  postForm: (ruta, form) => Api._pedir('POST', ruta, { form }),

  // Las fotos del seeder son URLs absolutas; las subidas son rutas relativas (/uploads/...)
  urlArchivo(url) {
    return /^https?:\/\//i.test(url) ? url : API_URL + url;
  },

  // ----- Público -----
  instituciones: (filtros) => Api.get('/api/instituciones', filtros),
  institucion: (id) => Api.get(`/api/instituciones/${id}`),
  resenas: (id, params) => Api.get(`/api/instituciones/${id}/resenas`, params),
  contacto: (datos) => Api.post('/api/contacto', datos),

  // ----- Cuentas -----
  login: (email, password) => Api.post('/api/auth/login', { email, password }),
  registroDonante: (datos) => Api.post('/api/auth/registro', datos),
  registroInstitucion: (form) => Api.postForm('/api/instituciones/registro', form),

  // ----- Donante -----
  donar: (datos) => Api.post('/api/donaciones', datos),
  misDonaciones: (params) => Api.get('/api/donaciones/mias', params),
  cancelarDonacion: (id) => Api.post(`/api/donaciones/${id}/cancelar`),
  validarDonacion: (id, form) => Api.postForm(`/api/donaciones/${id}/validar`, form),

  // ----- Institución -----
  miInstitucion: () => Api.get('/api/instituciones/mia'),
  donacionesRecibidas: (params) => Api.get('/api/donaciones/recibidas', params),
  recibirDonacion: (id) => Api.post(`/api/donaciones/${id}/recibir`),
  misNecesidades: () => Api.get('/api/necesidades/mias'),
  crearNecesidad: (datos) => Api.post('/api/necesidades', datos),
  editarNecesidad: (id, datos) => Api.put(`/api/necesidades/${id}`, datos),
  cerrarNecesidad: (id) => Api.eliminar(`/api/necesidades/${id}`),

  // ----- Administrador -----
  adminInstituciones: (params) => Api.get('/api/admin/instituciones', params),
  aprobar: (id) => Api.patch(`/api/admin/instituciones/${id}/aprobar`),
  rechazar: (id, motivo) => Api.patch(`/api/admin/instituciones/${id}/rechazar`, { motivo })
};