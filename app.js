const LAYER_CONFIG = {
  clientes: {
    label: "Clientes",
    color: "#2F9E44",
    markerClass: "school-marker--clientes",
    clusterClass: "cluster-badge--clientes",
    active: true,
    type: "clients",
  },
  assinatura: {
    label: "Assinatura de Contrato",
    color: "#1C7ED6",
    markerClass: "school-marker--assinatura",
    clusterClass: "cluster-badge--assinatura",
    active: true,
    type: "clients",
  },
  licitacao: {
    label: "Licitação - Publicação",
    color: "#E03131",
    markerClass: "school-marker--licitacao",
    clusterClass: "cluster-badge--licitacao",
    active: true,
    type: "clients",
  },
  fechamento: {
    label: "Fechamento",
    color: "#7B2CBF",
    markerClass: "school-marker--fechamento",
    clusterClass: "cluster-badge--fechamento",
    active: true,
    type: "clients",
  },
  densidade: {
    label: "Densidade populacional",
    color: "#FF9F1C",
    active: false,
    type: "density",
    meta: "IBGE | Censo 2022",
  },
};

const TOGGLE_ORDER = ["clientes", "assinatura", "licitacao", "fechamento", "densidade"];
const DENSITY_BREAKS = [0, 15, 30, 60, 120, 250, 500, 1000, 2500, 5000];
const DENSITY_COLORS = [
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#ea580c",
  "#dc2626",
  "#a21caf",
  "#6b21a8",
  "#3b0764",
];

const ui = {
  map: null,
  clientGroups: {},
  counts: {},
  loading: document.getElementById("loading"),
  toggleList: document.getElementById("toggle-list"),
  stats: document.getElementById("stats"),
  sidebar: document.getElementById("sidebar"),
  mobileOpen: document.getElementById("mobile-open"),
  mobileClose: document.getElementById("mobile-close"),
  densityLayer: null,
  densityMetadata: null,
  densityLegend: null,
};

function titleCase(value) {
  return (value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatOneDecimal(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function densityColor(value) {
  for (let index = DENSITY_BREAKS.length - 1; index >= 0; index -= 1) {
    if (value >= DENSITY_BREAKS[index]) {
      return DENSITY_COLORS[index];
    }
  }
  return DENSITY_COLORS[0];
}

function createMap() {
  const map = L.map("map", {
    zoomControl: true,
    minZoom: 6,
    maxZoom: 18,
    zoomSnap: 0.5,
  });

  map.createPane("densityPane");
  map.getPane("densityPane").style.zIndex = 330;
  map.createPane("markerPaneCustom");
  map.getPane("markerPaneCustom").style.zIndex = 650;

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
  const config = LAYER_CONFIG[categoryId];
  return L.divIcon({
    className: "",
    html: `<div class="school-marker ${config.markerClass}"><i class="fa-solid fa-school"></i></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function createClusterIcon(categoryId, childCount) {
  const config = LAYER_CONFIG[categoryId];
  return L.divIcon({
    className: "",
    html: `<div class="cluster-badge ${config.clusterClass}">${childCount}</div>`,
    iconSize: [42, 42],
  });
}

function categoryPill(categoryId, label) {
  const color = LAYER_CONFIG[categoryId].color;
  return `<span class="client-popup__pill" style="background:${color}">${label}</span>`;
}

function createClientPopupHtml(feature) {
  const props = feature.properties;
  const address = `${props.streetNumber}, ${titleCase(props.neighborhood)}, ${titleCase(props.city)}`;
  const dealIds = Array.isArray(props.dealIds) && props.dealIds.length > 0 ? props.dealIds.join(", ") : "Não informado";

  return `
    <div class="client-popup">
      ${categoryPill(props.category, props.categoryLabel)}
      <h3>${props.clientName}</h3>
      <p><strong>Endereço:</strong> ${address}</p>
      <p><strong>Precisão do ponto:</strong> centro aproximado do bairro</p>
      <p><strong>Negócios de origem:</strong> ${dealIds}</p>
    </div>
  `;
}

function createDensityPopupHtml(feature) {
  const props = feature.properties;
  return `
    <div class="client-popup">
      <span class="client-popup__pill" style="background:${densityColor(props.density)}; color:#111827;">
        Densidade IBGE
      </span>
      <h3>${props.name}</h3>
      <p><strong>Densidade demográfica:</strong> ${formatOneDecimal(props.density)} hab./km²</p>
      <p><strong>População residente:</strong> ${formatNumber(props.population)}</p>
      <p><strong>Área territorial:</strong> ${formatOneDecimal(props.areaKm2)} km²</p>
      <p><strong>Fonte:</strong> IBGE, Censo 2022, tabela 4714</p>
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

  TOGGLE_ORDER.forEach((layerId) => {
    const config = LAYER_CONFIG[layerId];
    const wrapper = document.createElement("label");
    wrapper.className = "toggle-card";
    const meta = config.type === "density" ? config.meta : "0 clientes";
    const swatchStyle =
      config.type === "density"
        ? "background: linear-gradient(135deg, #fde68a, #dc2626);"
        : `background:${config.color};`;

    wrapper.innerHTML = `
      <span class="toggle-card__swatch" style="${swatchStyle}"></span>
      <span>
        <span class="toggle-card__title">${config.label}</span>
        <span class="toggle-card__meta" id="meta-${layerId}">${meta}</span>
      </span>
      <span class="switch">
        <input type="checkbox" data-layer="${layerId}" ${config.active ? "checked" : ""}>
        <span class="slider"></span>
      </span>
    `;
    ui.toggleList.appendChild(wrapper);
  });

  ui.toggleList.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const layerId = target.dataset.layer;
    if (!layerId || !LAYER_CONFIG[layerId]) return;

    LAYER_CONFIG[layerId].active = target.checked;

    if (LAYER_CONFIG[layerId].type === "density") {
      await toggleDensityLayer(target.checked);
    } else if (target.checked) {
      ui.clientGroups[layerId].addTo(ui.map);
    } else {
      ui.map.removeLayer(ui.clientGroups[layerId]);
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
      <dt>Densidade oficial</dt>
      <dd id="stat-density">IBGE</dd>
    </div>
  `;
}

function updateStats() {
  const activeLayers = Object.entries(LAYER_CONFIG).filter(([, config]) => config.active);
  const visibleCount = activeLayers
    .filter(([, config]) => config.type === "clients")
    .reduce((sum, [layerId]) => sum + (ui.counts[layerId] || 0), 0);

  document.getElementById("stat-active-layers").textContent = String(activeLayers.length);
  document.getElementById("stat-visible").textContent = String(visibleCount);

  Object.keys(LAYER_CONFIG).forEach((layerId) => {
    const meta = document.getElementById(`meta-${layerId}`);
    if (!meta) return;

    if (LAYER_CONFIG[layerId].type === "density") {
      if (ui.densityMetadata) {
        meta.textContent = `${ui.densityMetadata.municipalityCount} municípios | IBGE 2022`;
      }
      return;
    }

    meta.textContent = `${ui.counts[layerId] || 0} clientes`;
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

function attachClientMarkers(featureCollection) {
  Object.keys(LAYER_CONFIG)
    .filter((layerId) => LAYER_CONFIG[layerId].type === "clients")
    .forEach((layerId) => {
      ui.clientGroups[layerId] = createClusterGroup(layerId);
      ui.counts[layerId] = 0;
    });

  featureCollection.features.forEach((feature) => {
    const categoryId = feature.properties.category;
    const marker = L.marker(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      { icon: createMarkerIcon(categoryId), riseOnHover: true, pane: "markerPaneCustom" }
    );

    marker.bindPopup(createClientPopupHtml(feature), { maxWidth: 320 });
    marker.bindTooltip(titleCase(feature.properties.city), {
      direction: "top",
      offset: [0, -24],
      opacity: 0.88,
      className: "city-tooltip",
    });

    ui.clientGroups[categoryId].addLayer(marker);
    ui.counts[categoryId] += 1;
  });

  Object.entries(LAYER_CONFIG)
    .filter(([, config]) => config.type === "clients" && config.active)
    .forEach(([layerId]) => {
      ui.clientGroups[layerId].addTo(ui.map);
    });
}

function buildDensityLegend() {
  const control = L.control({ position: "bottomright" });

  control.onAdd = () => {
    const div = L.DomUtil.create("div", "legend-card");
    const rows = DENSITY_BREAKS.map((start, index) => {
      const end = DENSITY_BREAKS[index + 1];
      const label = end ? `${start}-${end}` : `${start}+`;
      return `
        <div class="legend-row">
          <span class="legend-swatch" style="background:${DENSITY_COLORS[index]}"></span>
          <span>${label} hab./km²</span>
        </div>
      `;
    }).join("");

    div.innerHTML = `
      <div class="legend-title">Densidade demográfica</div>
      <div class="legend-subtitle">IBGE, Censo 2022</div>
      ${rows}
    `;
    return div;
  };

  return control;
}

function styleDensityFeature(feature) {
  return {
    pane: "densityPane",
    color: "rgba(88, 59, 12, 0.25)",
    weight: 0.7,
    fillOpacity: 0.72,
    fillColor: densityColor(feature.properties.density),
  };
}

function onEachDensityFeature(feature, layer) {
  layer.bindPopup(createDensityPopupHtml(feature), { maxWidth: 340 });
  layer.on({
    mouseover() {
      layer.setStyle({
        weight: 1.4,
        color: "#1f2937",
        fillOpacity: 0.9,
      });
      layer.bringToFront();
    },
    mouseout() {
      ui.densityLayer.resetStyle(layer);
    },
  });
}

async function loadDensityLayer() {
  if (ui.densityLayer) return;

  const response = await fetch("./data/municipal-density-ibge.geojson");
  const densityData = await response.json();

  ui.densityMetadata = densityData.metadata;
  ui.densityLayer = L.geoJSON(densityData, {
    style: styleDensityFeature,
    onEachFeature: onEachDensityFeature,
    pane: "densityPane",
  });
  ui.densityLegend = buildDensityLegend();
}

async function toggleDensityLayer(isActive) {
  if (isActive) {
    ui.loading.classList.remove("is-hidden");
    ui.loading.querySelector("p").textContent = "Carregando densidade populacional oficial do IBGE...";
    try {
      await loadDensityLayer();
      ui.densityLayer.addTo(ui.map);
      ui.densityLegend.addTo(ui.map);
    } finally {
      ui.loading.classList.add("is-hidden");
      ui.loading.querySelector("p").textContent = "Carregando mapa e clientes...";
    }
    return;
  }

  if (ui.densityLayer && ui.map.hasLayer(ui.densityLayer)) {
    ui.map.removeLayer(ui.densityLayer);
  }
  if (ui.densityLegend) {
    ui.densityLegend.remove();
  }
}

function setupMobileSidebar() {
  ui.mobileOpen.addEventListener("click", () => ui.sidebar.classList.add("is-open"));
  ui.mobileClose.addEventListener("click", () => ui.sidebar.classList.remove("is-open"));
  ui.map.on("click", () => ui.sidebar.classList.remove("is-open"));
}

async function loadBaseData() {
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
    const { clients, boundary } = await loadBaseData();
    addBoundary(boundary);
    attachClientMarkers(clients);
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
