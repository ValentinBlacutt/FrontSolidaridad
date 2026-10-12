/* Utilidades compartidas: escape de HTML, etiquetas, estrellas, fechas. */
const Util = {
  // Los nombres y descripciones los cargan usuarios: SIEMPRE se escapan antes de armar HTML
  esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  tipos: {
    Comedor: { icono: 'restaurant', color: '#e65100', etiqueta: 'Comedor' },
    Escuela: { icono: 'school', color: '#1565c0', etiqueta: 'Escuela' },
    Refugio: { icono: 'home', color: '#6a1b9a', etiqueta: 'Refugio' },
    Otro: { icono: 'volunteer_activism', color: '#00695c', etiqueta: 'Institución' }
  },

  categorias: {
    Alimentos: 'Alimentos', Ropa: 'Ropa', Abrigo: 'Abrigo',
    Higiene: 'Higiene', UtilesEscolares: 'Útiles escolares', Otros: 'Otros'
  },

  urgencias: {
    Alta: { etiqueta: 'Urgente', clase: 'red' },
    Media: { etiqueta: 'Media', clase: 'orange' },
    Baja: { etiqueta: 'Baja', clase: 'green' }
  },

  // 4.5 -> ★★★★½
  estrellas(promedio) {
    let html = '<span class="estrellas">';
    for (let i = 1; i <= 5; i++) {
      const icono = promedio >= i ? 'star' : promedio >= i - 0.5 ? 'star_half' : 'star_border';
      html += `<i class="material-icons">${icono}</i>`;
    }
    return html + '</span>';
  },

  reputacion(promedio, cantidad) {
    if (promedio === null || promedio === undefined) {
      return '<span class="grey-text">Sin calificaciones aún</span>';
    }
    const txt = cantidad === 1 ? '1 calificación' : `${cantidad} calificaciones`;
    return `${Util.estrellas(promedio)} <strong>${promedio.toFixed(1)}</strong> <small class="grey-text">(${txt})</small>`;
  },

  fecha(valor) {
    return new Date(valor).toLocaleDateString('es-AR');
  },

  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
};