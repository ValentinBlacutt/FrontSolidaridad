/* Mapa con Leaflet: pins por tipo de institución, popups y círculo de "cerca de mí". */
const Mapa = (() => {
  let mapa, capaPines, capaUsuario;
  const pines = new Map(); // id de institución -> marcador

  function iniciar() {
    mapa = L.map('mapaLeaflet', { scrollWheelZoom: false }).setView([-34.65, -58.62], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);

    capaPines = L.layerGroup().addTo(mapa);

    // La rueda del mouse solo hace zoom cuando el mapa tiene el foco (no secuestra el scroll de la página)
    mapa.on('focus', () => mapa.scrollWheelZoom.enable());
    mapa.on('blur', () => mapa.scrollWheelZoom.disable());
  }

  function icono(tipo) {
    const t = Util.tipos[tipo] ?? Util.tipos.Otro;
    return L.divIcon({
      className: 'pin-solidario',
      html: `<span style="background:${t.color}"><i class="material-icons">${t.icono}</i></span>`
          + '<b><i class="material-icons">verified</i></b>',
      iconSize: [38, 46],
      iconAnchor: [19, 46],
      popupAnchor: [0, -42]
    });
  }

  function popupHtml(i) {
    const t = Util.tipos[i.tipo] ?? Util.tipos.Otro;
    return `<div class="popup-inst">
      <h6>${Util.esc(i.nombre)}</h6>
      <p style="color:${t.color}"><strong>${t.etiqueta}</strong>${i.barrio ? ' · ' + Util.esc(i.barrio) : ''}</p>
      <p>${Util.esc(i.direccion)}</p>
      <p>${Util.reputacion(i.reputacionPromedio, i.cantidadCalificaciones)}</p>
      <p>${i.necesidadesActivas} necesidad(es) activa(s)</p>
      <button type="button" class="btn btn-small waves-effect btn-detalle" data-id="${i.id}">Ver detalle</button>
    </div>`;
  }

  function mostrar(instituciones) {
    capaPines.clearLayers();
    pines.clear();
    const puntos = [];

    instituciones.forEach(i => {
      const posicion = [Number(i.latitud), Number(i.longitud)];
      const pin = L.marker(posicion, { icon: icono(i.tipo), title: i.nombre, riseOnHover: true })
        .bindPopup(popupHtml(i), { minWidth: 220 });
      pin.addTo(capaPines);
      pines.set(i.id, pin);
      puntos.push(posicion);
    });

    if (puntos.length) {
      mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
    }
  }

  function enfocar(id) {
    const pin = pines.get(id);
    if (!pin) return;
    document.getElementById('mapa').scrollIntoView({ behavior: 'smooth' });
    mapa.setView(pin.getLatLng(), 16);
    pin.openPopup();
  }

  function mostrarUsuario(lat, lng, radioKm) {
    quitarUsuario();
    capaUsuario = L.layerGroup([
      L.circle([lat, lng], { radius: radioKm * 1000, color: '#2e7d32', weight: 2, fillOpacity: 0.08 }),
      L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1565c0', fillOpacity: 1 })
        .bindTooltip('Estás acá')
    ]).addTo(mapa);
    mapa.fitBounds(L.latLng(lat, lng).toBounds(radioKm * 2000), { padding: [20, 20] });
  }

  function quitarUsuario() {
    if (capaUsuario) { mapa.removeLayer(capaUsuario); capaUsuario = null; }
  }

  function refrescar() { mapa.invalidateSize(); }

  return { iniciar, mostrar, enfocar, mostrarUsuario, quitarUsuario, refrescar };
})();