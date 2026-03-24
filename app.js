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
const DENSITY_PRESETS = {
  all: { label: "Sem recorte (todas)", min: 0, max: Infinity },
  high: { label: "Alta densidade (>= 120)", min: 120, max: Infinity },
  veryHigh: { label: "Muito alta (>= 500)", min: 500, max: Infinity },
  extreme: { label: "Extrema (>= 1000)", min: 1000, max: Infinity },
};

const ui = {
  map: null,
  clientGroups: {},
  clientEntriesByCategory: {},
  counts: {},
  visibleCounts: {},
  clientsFeatureCollection: null,
  loading: document.getElementById("loading"),
  toggleList: document.getElementById("toggle-list"),
  stats: document.getElementById("stats"),
  sidebar: document.getElementById("sidebar"),
  mobileOpen: document.getElementById("mobile-open"),
  mobileClose: document.getElementById("mobile-close"),
  densityDecisionPanel: null,
  densityPresetSelect: null,
  densityMinInput: null,
  densityMaxInput: null,
  densityApplyToClients: null,
  densitySummary: null,
  densityCityUfIndex: new Map(),
  densityCityIndex: new Map(),
  densityLayer: null,
  densityMetadata: null,
  densityLegend: null,
  densityFilter: {
    preset: "all",
    min: 0,
    max: Infinity,
    applyToClients: true,
  },
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

function normalizeGeoText(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function municipalityKey(city, state = "") {
  return `${normalizeGeoText(city)}|${(state || "").toUpperCase().trim()}`;
}

function cityKey(city) {
  return normalizeGeoText(city);
}

function getActiveDensityRange() {
  const { preset, min, max } = ui.densityFilter;
  if (preset !== "custom") {
    return DENSITY_PRESETS[preset] || DENSITY_PRESETS.all;
  }
  return { min: Number(min) || 0, max: Number(max) || Infinity, label: "Faixa personalizada" };
}

function isDensityInRange(value, range = getActiveDensityRange()) {
  if (typeof value !== "number" || Number.isNaN(value)) return false;
  return value >= range.min && value <= range.max;
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
  const cityWithState = props.state ? `${titleCase(props.city)} - ${props.state}` : titleCase(props.city);
  const address = `${props.streetNumber}, ${titleCase(props.neighborhood)}, ${cityWithState}`;
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
  const municipalityLabel = props.uf ? `${props.name} - ${props.uf}` : props.name;
  return `
    <div class="client-popup">
      <span class="client-popup__pill" style="background:${densityColor(props.density)}; color:#111827;">
        Densidade IBGE
      </span>
      <h3>${municipalityLabel}</h3>
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

function renderDensityDecisionPanel() {
  const panel = document.createElement("section");
  panel.className = "sidebar__panel decision-panel";
  panel.innerHTML = `
    <h2>Decisão por densidade</h2>
    <p class="decision-hint">Priorize municípios com maior concentração populacional para aumentar potencial comercial por território.</p>
    <div class="decision-controls">
      <label for="density-preset">Estratégia</label>
      <select id="density-preset">
        <option value="all">Sem recorte (todas)</option>
        <option value="high">Alta densidade (>= 120 hab./km²)</option>
        <option value="veryHigh">Muito alta (>= 500 hab./km²)</option>
        <option value="extreme">Extrema (>= 1000 hab./km²)</option>
        <option value="custom">Faixa personalizada</option>
      </select>
      <div class="decision-range">
        <div>
          <label for="density-min">Mínimo</label>
          <input id="density-min" type="number" min="0" step="1" value="120" disabled>
        </div>
        <div>
          <label for="density-max">Máximo</label>
          <input id="density-max" type="number" min="0" step="1" placeholder="Sem limite" disabled>
        </div>
      </div>
      <label class="decision-check">
        <input id="density-apply-clients" type="checkbox" checked>
        <span>Aplicar recorte também aos clientes</span>
      </label>
    </div>
    <dl class="decision-kpis" id="density-summary">
      <div><dt>Municípios alvo</dt><dd>-</dd></div>
      <div><dt>População alvo</dt><dd>-</dd></div>
      <div><dt>Clientes no alvo</dt><dd>-</dd></div>
      <div><dt>Densidade média</dt><dd>-</dd></div>
    </dl>
  `;

  const targetPanel = ui.stats?.closest(".sidebar__panel");
  targetPanel?.insertAdjacentElement("afterend", panel);

  ui.densityDecisionPanel = panel;
  ui.densityPresetSelect = panel.querySelector("#density-preset");
  ui.densityMinInput = panel.querySelector("#density-min");
  ui.densityMaxInput = panel.querySelector("#density-max");
  ui.densityApplyToClients = panel.querySelector("#density-apply-clients");
  ui.densitySummary = panel.querySelector("#density-summary");

  const onDecisionChange = async () => {
    ui.densityFilter.preset = ui.densityPresetSelect.value;
    const isCustom = ui.densityFilter.preset === "custom";
    ui.densityMinInput.disabled = !isCustom;
    ui.densityMaxInput.disabled = !isCustom;
    ui.densityFilter.min = Number(ui.densityMinInput.value || 0);
    ui.densityFilter.max = ui.densityMaxInput.value === "" ? Infinity : Number(ui.densityMaxInput.value);
    ui.densityFilter.applyToClients = ui.densityApplyToClients.checked;
    await applyDensityDecisionFilter();
  };

  ui.densityPresetSelect.addEventListener("change", onDecisionChange);
  ui.densityMinInput.addEventListener("input", onDecisionChange);
  ui.densityMaxInput.addEventListener("input", onDecisionChange);
  ui.densityApplyToClients.addEventListener("change", onDecisionChange);
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
    .reduce((sum, [layerId]) => sum + (ui.visibleCounts[layerId] || 0), 0);

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

function resolveClientDensity(city, state = "") {
  if (!city) return null;
  const fullKey = municipalityKey(city, state);
  if (state && ui.densityCityUfIndex.has(fullKey)) {
    return ui.densityCityUfIndex.get(fullKey).density;
  }
  const fallbackKey = cityKey(city);
  if (ui.densityCityIndex.has(fallbackKey)) {
    return ui.densityCityIndex.get(fallbackKey).density;
  }
  return null;
}

function clientEntryPassesDensity(entry, range = getActiveDensityRange()) {
  if (!ui.densityFilter.applyToClients) return true;
  if (ui.densityFilter.preset === "all") return true;
  if (entry.density == null) return true;
  return isDensityInRange(entry.density, range);
}

function refreshClientLayers() {
  const range = getActiveDensityRange();
  Object.keys(ui.clientGroups).forEach((layerId) => {
    const group = ui.clientGroups[layerId];
    const entries = ui.clientEntriesByCategory[layerId] || [];
    group.clearLayers();

    let visible = 0;
    entries.forEach((entry) => {
      if (clientEntryPassesDensity(entry, range)) {
        group.addLayer(entry.marker);
        visible += 1;
      }
    });
    ui.visibleCounts[layerId] = visible;

    if (LAYER_CONFIG[layerId].active) {
      group.addTo(ui.map);
    } else {
      ui.map.removeLayer(group);
    }
  });
}

function attachClientMarkers(featureCollection) {
  ui.clientsFeatureCollection = featureCollection;
  Object.keys(LAYER_CONFIG)
    .filter((layerId) => LAYER_CONFIG[layerId].type === "clients")
    .forEach((layerId) => {
      ui.clientGroups[layerId] = createClusterGroup(layerId);
      ui.clientEntriesByCategory[layerId] = [];
      ui.counts[layerId] = 0;
      ui.visibleCounts[layerId] = 0;
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

    ui.clientEntriesByCategory[categoryId].push({
      marker,
      city: feature.properties.city,
      state: feature.properties.state || "",
      density: null,
    });
    ui.counts[categoryId] += 1;
  });

  refreshClientLayers();
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
  const densityValue = feature.properties.density;
  const inRange = isDensityInRange(densityValue);
  return {
    pane: "densityPane",
    color: inRange ? "rgba(88, 59, 12, 0.25)" : "rgba(107, 114, 128, 0.18)",
    weight: inRange ? 0.7 : 0.35,
    fillOpacity: inRange ? 0.72 : 0.1,
    fillColor: densityColor(feature.properties.density),
  };
}

function onEachDensityFeature(feature, layer) {
  layer.bindPopup(createDensityPopupHtml(feature), { maxWidth: 340 });
  layer.on({
    mouseover() {
      if (!isDensityInRange(feature.properties.density)) return;
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

function indexDensityData(densityData) {
  ui.densityCityUfIndex = new Map();
  const byCity = new Map();

  densityData.features.forEach((feature) => {
    const { name, uf, density, population } = feature.properties;
    const byUfKey = municipalityKey(name, uf);
    ui.densityCityUfIndex.set(byUfKey, { density, population });

    const cityOnlyKey = cityKey(name);
    if (!byCity.has(cityOnlyKey)) {
      byCity.set(cityOnlyKey, []);
    }
    byCity.get(cityOnlyKey).push({ density, population, uf });
  });

  ui.densityCityIndex = new Map();
  byCity.forEach((items, key) => {
    if (items.length === 1) {
      ui.densityCityIndex.set(key, items[0]);
    }
  });
}

function updateClientDensityBindings() {
  Object.values(ui.clientEntriesByCategory).forEach((entries) => {
    entries.forEach((entry) => {
      entry.density = resolveClientDensity(entry.city, entry.state);
    });
  });
}

function updateDensityStyles() {
  if (!ui.densityLayer) return;
  ui.densityLayer.setStyle((feature) => styleDensityFeature(feature));
}

function updateDecisionSummary() {
  if (!ui.densitySummary) return;
  if (!ui.densityLayer) {
    const totalClients = Object.values(ui.counts).reduce((sum, value) => sum + value, 0);
    const values = ["-", "-", String(totalClients), "-"];
    ui.densitySummary.querySelectorAll("dd").forEach((node, index) => {
      node.textContent = values[index];
    });
    return;
  }
  const range = getActiveDensityRange();

  let municipalityCount = 0;
  let populationSum = 0;
  let densitySum = 0;

  ui.densityLayer.eachLayer((layer) => {
    const density = layer.feature?.properties?.density;
    if (!isDensityInRange(density, range)) return;
    municipalityCount += 1;
    populationSum += Number(layer.feature.properties.population || 0);
    densitySum += Number(density || 0);
  });

  let clientsInScope = 0;
  const rangeIsAll = ui.densityFilter.preset === "all";
  Object.values(ui.clientEntriesByCategory).forEach((entries) => {
    entries.forEach((entry) => {
      if (rangeIsAll) {
        clientsInScope += 1;
        return;
      }
      if (entry.density != null && isDensityInRange(entry.density, range)) {
        clientsInScope += 1;
      }
    });
  });

  const avgDensity = municipalityCount > 0 ? densitySum / municipalityCount : 0;
  const values = [
    String(municipalityCount),
    formatNumber(populationSum),
    String(clientsInScope),
    municipalityCount > 0 ? `${formatOneDecimal(avgDensity)} hab./km²` : "-",
  ];

  ui.densitySummary.querySelectorAll("dd").forEach((node, index) => {
    node.textContent = values[index];
  });
}

async function applyDensityDecisionFilter() {
  const shouldLoadDensity =
    LAYER_CONFIG.densidade.active || ui.densityFilter.preset !== "all";

  if (shouldLoadDensity) {
    await loadDensityLayer();
    updateClientDensityBindings();
    updateDensityStyles();
  }

  refreshClientLayers();
  updateDecisionSummary();
  updateStats();
}

async function loadDensityLayer() {
  if (ui.densityLayer) return;

  const response = await fetch("./data/municipal-density-ibge.geojson");
  const densityData = await response.json();

  ui.densityMetadata = densityData.metadata;
  indexDensityData(densityData);
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
      updateClientDensityBindings();
      updateDensityStyles();
      ui.densityLayer.addTo(ui.map);
      ui.densityLegend.addTo(ui.map);
      updateDecisionSummary();
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
  updateDecisionSummary();
}

function setupMobileSidebar() {
  ui.mobileOpen.addEventListener("click", () => ui.sidebar.classList.add("is-open"));
  ui.mobileClose.addEventListener("click", () => ui.sidebar.classList.remove("is-open"));
  ui.map.on("click", () => ui.sidebar.classList.remove("is-open"));
}

async function loadBaseData() {
  const clientsResponse = await fetch("./data/clients.geojson");
  let boundaryResponse = await fetch("./data/brasil.geojson");
  if (!boundaryResponse.ok) {
    boundaryResponse = await fetch("./data/minas-gerais.geojson");
  }

  const clients = await clientsResponse.json();
  const boundary = await boundaryResponse.json();
  return { clients, boundary };
}

async function init() {
  createMap();
  renderToggles();
  renderDensityDecisionPanel();
  setupMobileSidebar();

  try {
    const { clients, boundary } = await loadBaseData();
    addBoundary(boundary);
    attachClientMarkers(clients);
    renderStats(clients.metadata.totalFeatures);
    refreshClientLayers();
    updateDecisionSummary();
    updateStats();
  } catch (error) {
    console.error(error);
    ui.loading.querySelector("p").textContent = "Não foi possível carregar os dados do mapa.";
    return;
  }

  ui.loading.classList.add("is-hidden");
}

init();
