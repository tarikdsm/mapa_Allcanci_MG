const CATEGORY_CONFIG = {
  clientes: {
    label: "Clientes",
    color: "#2F9E44",
    markerClass: "school-marker--clientes",
    clusterClass: "cluster-badge--clientes",
    active: true,
  },
  assinatura: {
    label: "Assinatura de Contrato",
    color: "#1C7ED6",
    markerClass: "school-marker--assinatura",
    clusterClass: "cluster-badge--assinatura",
    active: true,
  },
  licitacao: {
    label: "Licitação - Publicação",
    color: "#E03131",
    markerClass: "school-marker--licitacao",
    clusterClass: "cluster-badge--licitacao",
    active: true,
  },
  fechamento: {
    label: "Fechamento",
    color: "#7B2CBF",
    markerClass: "school-marker--fechamento",
    clusterClass: "cluster-badge--fechamento",
    active: true,
  },
};

const ui = {
  map: null,
  groups: {},
  counts: {},
  loading: document.getElementById("loading"),
  toggleList: document.getElementById("toggle-list"),
  stats: document.getElementById("stats"),
  sidebar: document.getElementById("sidebar"),
  mobileOpen: document.getElementById("mobile-open"),
  mobileClose: document.getElementById("mobile-close"),
};

function titleCase(value) {
  return (value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createMap() {
  const map = L.map("map", {
    zoomControl: true,
    minZoom: 6,
    maxZoom: 18,
    zoomSnap: 0.5,
  });

  const baseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  });

  const labelLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
    attribution: "",
    subdomains: "abcd",
    pane: "shadowPane",
    maxZoom: 20,
  });

  baseLayer.addTo(map);
  labelLayer.addTo(map);

  ui.map = map;
}

function createMarkerIcon(categoryId) {
  const config = CATEGORY_CONFIG[categoryId];
  return L.divIcon({
    className: "",
    html: `<div class="school-marker ${config.markerClass}"><i class="fa-solid fa-school"></i></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function createClusterIcon(categoryId, childCount) {
  const config = CATEGORY_CONFIG[categoryId];
  return L.divIcon({
    className: "",
    html: `<div class="cluster-badge ${config.clusterClass}">${childCount}</div>`,
    iconSize: [42, 42],
  });
}

function categoryPill(categoryId, label) {
  const color = CATEGORY_CONFIG[categoryId].color;
  return `<span class="client-popup__pill" style="background:${color}">${label}</span>`;
}

function createPopupHtml(feature) {
  const props = feature.properties;
  const address = `${props.streetNumber}, ${titleCase(props.neighborhood)}, ${titleCase(props.city)}`;
  return `
    <div class="client-popup">
      ${categoryPill(props.category, props.categoryLabel)}
      <h3>${props.clientName}</h3>
      <p><strong>Endereço:</strong> ${address}</p>
      <p><strong>Precisão do ponto:</strong> centro aproximado do bairro</p>
      <p><strong>Negócios de origem:</strong> ${props.dealIds.join(", ")}</p>
    </div>
  `;
}

function createClusterGroup(categoryId) {
  return L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 48,
    disableClusteringAtZoom: 14,
    chunkedLoading: true,
    iconCreateFunction(cluster) {
      return createClusterIcon(categoryId, cluster.getChildCount());
    },
  });
}

function renderToggles() {
  ui.toggleList.innerHTML = "";
  Object.entries(CATEGORY_CONFIG).forEach(([categoryId, config]) => {
    const wrapper = document.createElement("label");
    wrapper.className = "toggle-card";
    wrapper.innerHTML = `
      <span class="toggle-card__swatch" style="background:${config.color}"></span>
      <span>
        <span class="toggle-card__title">${config.label}</span>
        <span class="toggle-card__meta" id="meta-${categoryId}">0 clientes</span>
      </span>
      <span class="switch">
        <input type="checkbox" data-category="${categoryId}" ${config.active ? "checked" : ""}>
        <span class="slider"></span>
      </span>
    `;
    ui.toggleList.appendChild(wrapper);
  });

  ui.toggleList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const categoryId = target.dataset.category;
    CATEGORY_CONFIG[categoryId].active = target.checked;
    if (target.checked) {
      ui.groups[categoryId].addTo(ui.map);
    } else {
      ui.map.removeLayer(ui.groups[categoryId]);
    }
    updateStats();
  });
}

function renderStats(totalFeatures) {
  ui.stats.innerHTML = `
    <div>
      <dt>Pontos no mapa</dt>
      <dd>${totalFeatures}</dd>
    </div>
    <div>
      <dt>Camadas ativas</dt>
      <dd id="stat-active-layers">4</dd>
    </div>
    <div>
      <dt>Clientes visíveis</dt>
      <dd id="stat-visible">0</dd>
    </div>
    <div>
      <dt>Organização</dt>
      <dd>Clusters</dd>
    </div>
  `;
}

function updateStats() {
  const activeCategories = Object.entries(CATEGORY_CONFIG).filter(([, config]) => config.active);
  const visibleCount = activeCategories.reduce((sum, [categoryId]) => sum + (ui.counts[categoryId] || 0), 0);
  document.getElementById("stat-active-layers").textContent = String(activeCategories.length);
  document.getElementById("stat-visible").textContent = String(visibleCount);

  Object.keys(CATEGORY_CONFIG).forEach((categoryId) => {
    const meta = document.getElementById(`meta-${categoryId}`);
    if (meta) {
      meta.textContent = `${ui.counts[categoryId] || 0} clientes`;
    }
  });
}

function addBoundary(boundaryFeature) {
  const boundary = L.geoJSON(boundaryFeature, {
    style: {
      color: "#1f5b63",
      weight: 2.2,
      opacity: 0.9,
      fillColor: "#74c69d",
      fillOpacity: 0.08,
    },
  }).addTo(ui.map);

  ui.map.fitBounds(boundary.getBounds().pad(0.04));
  ui.map.setMaxBounds(boundary.getBounds().pad(0.28));
}

function attachMarkers(featureCollection) {
  Object.keys(CATEGORY_CONFIG).forEach((categoryId) => {
    ui.groups[categoryId] = createClusterGroup(categoryId);
    ui.counts[categoryId] = 0;
  });

  featureCollection.features.forEach((feature) => {
    const categoryId = feature.properties.category;
    const marker = L.marker(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      { icon: createMarkerIcon(categoryId), riseOnHover: true }
    );
    marker.bindPopup(createPopupHtml(feature), { maxWidth: 320 });
    marker.bindTooltip(titleCase(feature.properties.city), {
      direction: "top",
      offset: [0, -24],
      opacity: 0.88,
      className: "city-tooltip",
    });
    ui.groups[categoryId].addLayer(marker);
    ui.counts[categoryId] += 1;
  });

  Object.entries(CATEGORY_CONFIG).forEach(([categoryId, config]) => {
    if (config.active) {
      ui.groups[categoryId].addTo(ui.map);
    }
  });
}

function setupMobileSidebar() {
  ui.mobileOpen.addEventListener("click", () => ui.sidebar.classList.add("is-open"));
  ui.mobileClose.addEventListener("click", () => ui.sidebar.classList.remove("is-open"));
  ui.map.on("click", () => ui.sidebar.classList.remove("is-open"));
}

async function loadData() {
  const [clientsResponse, boundaryResponse] = await Promise.all([
    fetch("./data/clients.geojson"),
    fetch("./data/minas-gerais.geojson"),
  ]);
  const clients = await clientsResponse.json();
  const boundary = await boundaryResponse.json();
  return { clients, boundary };
}

async function init() {
  createMap();
  renderToggles();
  setupMobileSidebar();

  try {
    const { clients, boundary } = await loadData();
    addBoundary(boundary);
    attachMarkers(clients);
    renderStats(clients.metadata.totalFeatures);
    updateStats();
  } catch (error) {
    console.error(error);
    ui.loading.querySelector("p").textContent = "Não foi possível carregar os dados do mapa.";
    return;
  }

  ui.loading.classList.add("is-hidden");
}

init();
