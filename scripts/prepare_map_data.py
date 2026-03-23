from __future__ import annotations

import gzip
import json
import shutil
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

import shapefile


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
SOURCE_DIR = DATA_DIR / "source"
SOURCE_JSON_IN_REPO = SOURCE_DIR / "clientes_por_etapa_comercial.json"
EXTERNAL_SOURCE_JSON = REPO_ROOT.parent / "Planilhas_Clientes" / "clientes_por_etapa_comercial.json"
CACHE_FILE = SOURCE_DIR / "neighborhood_geocode_cache.json"
CLIENTS_GEOJSON = DATA_DIR / "clients.geojson"
MINAS_GEOJSON = DATA_DIR / "minas-gerais.geojson"
DENSITY_GEOJSON = DATA_DIR / "municipal-density-ibge.geojson"
REPORT_JSON = DATA_DIR / "build-report.json"
OFFICIAL_MG_MUNICIPAL_ZIP = SOURCE_DIR / "MG_Municipios_2022.zip"
OFFICIAL_MG_MUNICIPAL_DIR = SOURCE_DIR / "MG_Municipios_2022"
OFFICIAL_MG_MUNICIPAL_SHP = OFFICIAL_MG_MUNICIPAL_DIR / "MG_Municipios_2022.shp"

MINAS_GEOJSON_URL = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/31?formato=application/vnd.geo+json&qualidade=minima"
IBGE_MG_MUNICIPAL_ZIP_URL = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/UFs/MG/MG_Municipios_2022.zip"
IBGE_SIDRA_DENSITY_URL = "https://apisidra.ibge.gov.br/values/t/4714/n3/31/n6/all/v/93,6318,614/p/2022"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "mapa-allcanci-mg/1.0 (github pages build)"
REQUEST_DELAY_SECONDS = 1.1
SIMPLIFY_TOLERANCE = 0.003
MOJIBAKE_MARKERS = ("Ã", "â", "�")

CITY_ALIASES = {
    "afenas": "Alfenas",
    "passo quatro": "Passa Quatro",
}

CATEGORY_CONFIG = [
    {
        "source_label": "Concluído",
        "id": "clientes",
        "display_label": "Clientes",
        "color": "#2F9E44",
    },
    {
        "source_label": "Assinatura de Contrato",
        "id": "assinatura",
        "display_label": "Assinatura de Contrato",
        "color": "#1C7ED6",
    },
    {
        "source_label": "Licitação/Publicação",
        "id": "licitacao",
        "display_label": "Licitação - Publicação",
        "color": "#E03131",
    },
    {
        "source_label": "Fechamento",
        "id": "fechamento",
        "display_label": "Fechamento",
        "color": "#7B2CBF",
    },
]


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)


def fix_mojibake_text(value: str) -> str:
    if not any(marker in value for marker in MOJIBAKE_MARKERS):
        return value
    try:
        return value.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def normalize_value(value: Any) -> Any:
    if isinstance(value, str):
        return fix_mojibake_text(value)
    if isinstance(value, list):
        return [normalize_value(item) for item in value]
    if isinstance(value, dict):
        return {
            normalize_value(key) if isinstance(key, str) else key: normalize_value(item)
            for key, item in value.items()
        }
    return value


def load_source_data() -> dict[str, Any]:
    if EXTERNAL_SOURCE_JSON.exists():
        shutil.copyfile(EXTERNAL_SOURCE_JSON, SOURCE_JSON_IN_REPO)
    if not SOURCE_JSON_IN_REPO.exists():
        raise FileNotFoundError(
            f"Source JSON not found in {EXTERNAL_SOURCE_JSON} or {SOURCE_JSON_IN_REPO}"
        )

    source_data = normalize_value(json.loads(SOURCE_JSON_IN_REPO.read_text(encoding="utf-8")))
    SOURCE_JSON_IN_REPO.write_text(
        json.dumps(source_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return source_data


def download_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def download_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=240) as response:
        return response.read()


def fetch_minas_geojson() -> dict[str, Any]:
    feature = download_json(MINAS_GEOJSON_URL)
    MINAS_GEOJSON.write_text(
        json.dumps(feature, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return feature


def load_cache() -> dict[str, Any]:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_city(value: str) -> str:
    cleaned = clean_text(value)
    return CITY_ALIASES.get(cleaned.lower(), cleaned)


def canonical_location_key(neighborhood: str, city: str) -> str:
    return f"{clean_text(neighborhood).lower()}|{normalize_city(city).lower()}"


def ensure_official_municipal_files() -> Path:
    if not OFFICIAL_MG_MUNICIPAL_ZIP.exists():
        OFFICIAL_MG_MUNICIPAL_ZIP.write_bytes(download_bytes(IBGE_MG_MUNICIPAL_ZIP_URL))

    if not OFFICIAL_MG_MUNICIPAL_SHP.exists():
        OFFICIAL_MG_MUNICIPAL_DIR.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(OFFICIAL_MG_MUNICIPAL_ZIP, "r") as zipped:
            zipped.extractall(OFFICIAL_MG_MUNICIPAL_DIR)

    return OFFICIAL_MG_MUNICIPAL_SHP


def load_sidra_density_rows() -> list[dict[str, Any]]:
    rows = download_json(IBGE_SIDRA_DENSITY_URL)
    return rows[1:]


def parse_sidra_value(value: Any) -> float:
    raw = str(value)
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    return float(raw)


def density_index() -> dict[str, dict[str, Any]]:
    rows = load_sidra_density_rows()
    metrics: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row.get("NC") != "6":
            continue

        code = str(row["D1C"])
        entry = metrics.setdefault(
            code,
            {
                "code": code,
                "name": str(row["D1N"]).replace(" (MG)", ""),
            },
        )

        variable = str(row["D2C"])
        value = parse_sidra_value(row["V"])
        if variable == "93":
            entry["population"] = int(round(value))
        elif variable == "6318":
            entry["areaKm2"] = float(value)
        elif variable == "614":
            entry["density"] = float(value)

    return metrics


def round_coordinates(coords: Any, decimals: int = 5) -> Any:
    if isinstance(coords, (list, tuple)):
        if coords and isinstance(coords[0], (int, float)):
            return [round(float(coords[0]), decimals), round(float(coords[1]), decimals)]
        return [round_coordinates(item, decimals) for item in coords]
    return coords


def perpendicular_distance(point: list[float], start: list[float], end: list[float]) -> float:
    if start == end:
        return ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5
    numerator = abs(
        (end[0] - start[0]) * (start[1] - point[1])
        - (start[0] - point[0]) * (end[1] - start[1])
    )
    denominator = ((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2) ** 0.5
    return numerator / denominator


def simplify_line(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 2:
        return points

    max_distance = -1.0
    index = -1
    start = points[0]
    end = points[-1]

    for current_index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[current_index], start, end)
        if distance > max_distance:
            max_distance = distance
            index = current_index

    if max_distance > tolerance:
        left = simplify_line(points[: index + 1], tolerance)
        right = simplify_line(points[index:], tolerance)
        return left[:-1] + right

    return [start, end]


def simplify_ring(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 4:
        return points

    closed = points[0] == points[-1]
    working = points[:-1] if closed else points[:]
    simplified = simplify_line(working, tolerance)

    if len(simplified) < 3:
        simplified = working[:3]

    if closed:
        simplified.append(simplified[0])

    return simplified


def simplify_geometry(geometry: dict[str, Any], tolerance: float) -> dict[str, Any]:
    geom_type = geometry["type"]
    coords = geometry["coordinates"]

    if geom_type == "Polygon":
        simplified = [simplify_ring(ring, tolerance) for ring in coords]
    elif geom_type == "MultiPolygon":
        simplified = [
            [simplify_ring(ring, tolerance) for ring in polygon]
            for polygon in coords
        ]
    else:
        simplified = coords

    return {
        "type": geom_type,
        "coordinates": round_coordinates(simplified, 5),
    }


def build_density_geojson() -> dict[str, Any]:
    shp_path = ensure_official_municipal_files()
    densities = density_index()

    reader = shapefile.Reader(str(shp_path), encoding="latin1")
    features: list[dict[str, Any]] = []
    density_values: list[float] = []
    area_values: list[float] = []
    population_values: list[int] = []

    try:
        for shape_record in reader.iterShapeRecords():
            record = shape_record.record.as_dict()
            code = str(record["CD_MUN"])
            data = densities.get(code)
            if not data:
                continue

            geometry = simplify_geometry(shape_record.shape.__geo_interface__, SIMPLIFY_TOLERANCE)

            density_values.append(float(data["density"]))
            area_values.append(float(data["areaKm2"]))
            population_values.append(int(data["population"]))

            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "code": code,
                        "name": record["NM_MUN"],
                        "uf": record["SIGLA_UF"],
                        "population": int(data["population"]),
                        "areaKm2": float(data["areaKm2"]),
                        "density": float(data["density"]),
                        "source": "IBGE Censo Demográfico 2022 / tabela 4714",
                    },
                    "geometry": geometry,
                }
            )
    finally:
        reader.close()

    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "sourceBoundary": IBGE_MG_MUNICIPAL_ZIP_URL,
            "sourceDensity": IBGE_SIDRA_DENSITY_URL,
            "municipalityCount": len(features),
            "densityMin": min(density_values),
            "densityMax": max(density_values),
            "populationMax": max(population_values),
            "areaMax": max(area_values),
            "year": 2022,
        },
        "features": features,
    }
    DENSITY_GEOJSON.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return collection


def query_nominatim(query: str) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode(
        {
            "q": query,
            "format": "jsonv2",
            "countrycodes": "br",
            "limit": 1,
            "addressdetails": 1,
            "accept-language": "pt-BR",
        }
    )
    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def geocode_location(location: dict[str, Any]) -> dict[str, Any] | None:
    neighborhood = clean_text(location["neighborhood"])
    city = clean_text(location["city"])
    street = clean_text(location["street_number"])

    candidate_queries = [
        ("neighborhood", f"{neighborhood}, {city}, Minas Gerais, Brasil"),
    ]
    if street:
        candidate_queries.append(
            ("address", f"{street}, {neighborhood}, {city}, Minas Gerais, Brasil")
        )
    candidate_queries.append(("city", f"{city}, Minas Gerais, Brasil"))

    for source, query in candidate_queries:
        try:
            results = query_nominatim(query)
        except Exception:
            results = []
        if results:
            match = results[0]
            return {
                "lat": float(match["lat"]),
                "lng": float(match["lon"]),
                "source": source,
                "query": query,
                "display_name": match.get("display_name"),
            }
        time.sleep(REQUEST_DELAY_SECONDS)
    return None


def build_locations_index(source_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    locations: dict[str, dict[str, Any]] = {}
    for category in CATEGORY_CONFIG:
        rows = source_data["sheets"][category["source_label"]]
        for row in rows:
            neighborhood = clean_text(row["neighborhood"])
            city = clean_text(row["city"])
            key = canonical_location_key(neighborhood, city)
            if key not in locations:
                locations[key] = {
                    "neighborhood": neighborhood,
                    "city": normalize_city(city),
                    "street_number": clean_text(row["street_number"]),
                }
    return locations


def build_geocode_index(source_data: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    locations = build_locations_index(source_data)
    cache = load_cache()
    unresolved: list[str] = []
    total = len(locations)

    pending_keys = [key for key in locations if key not in cache]
    print(f"Unique neighborhood/city pairs: {total}")
    print(f"Cached geocodes available: {total - len(pending_keys)}")

    for index, key in enumerate(pending_keys, start=1):
        print(f"[{index}/{len(pending_keys)}] Geocoding {locations[key]['neighborhood']} / {locations[key]['city']}")
        result = geocode_location(locations[key])
        if result is None:
            unresolved.append(key)
            cache[key] = {
                "status": "unresolved",
                "neighborhood": locations[key]["neighborhood"],
                "city": locations[key]["city"],
            }
        else:
            cache[key] = {
                "status": "ok",
                "neighborhood": locations[key]["neighborhood"],
                "city": locations[key]["city"],
                **result,
            }
        save_cache(cache)
        time.sleep(REQUEST_DELAY_SECONDS)

    for key, value in cache.items():
        if key not in locations:
            continue
        if value.get("status") != "ok":
            unresolved.append(key)

    return cache, sorted(set(unresolved))


def feature_for_row(
    row: dict[str, Any],
    category: dict[str, Any],
    geocode: dict[str, Any],
) -> dict[str, Any]:
    return {
        "type": "Feature",
        "properties": {
            "category": category["id"],
            "categoryLabel": category["display_label"],
            "color": category["color"],
            "clientName": clean_text(row["name"]),
            "streetNumber": clean_text(row["street_number"]),
            "neighborhood": clean_text(row["neighborhood"]),
            "city": normalize_city(row["city"]),
            "companyId": row.get("company_id"),
            "dealIds": row.get("deal_ids") or [],
            "geocodeSource": geocode["source"],
            "geocodeDisplayName": geocode.get("display_name"),
        },
        "geometry": {
            "type": "Point",
            "coordinates": [geocode["lng"], geocode["lat"]],
        },
    }


def build_clients_geojson(source_data: dict[str, Any], geocode_index: dict[str, Any]) -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    category_counts: dict[str, int] = {}

    for category in CATEGORY_CONFIG:
        category_count = 0
        for row in source_data["sheets"][category["source_label"]]:
            key = canonical_location_key(row["neighborhood"], row["city"])
            geocode = geocode_index.get(key)
            if not geocode or geocode.get("status") != "ok":
                skipped.append(
                    {
                        "category": category["display_label"],
                        "clientName": clean_text(row["name"]),
                        "neighborhood": clean_text(row["neighborhood"]),
                        "city": clean_text(row["city"]),
                    }
                )
                continue
            features.append(feature_for_row(row, category, geocode))
            category_count += 1
        category_counts[category["id"]] = category_count

    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "categoryCounts": category_counts,
            "totalFeatures": len(features),
            "skippedCount": len(skipped),
        },
        "features": features,
    }
    CLIENTS_GEOJSON.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_JSON.write_text(
        json.dumps(
            {
                "generatedAt": collection["metadata"]["generatedAt"],
                "categoryCounts": category_counts,
                "totalFeatures": len(features),
                "skipped": skipped,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return collection


def main() -> int:
    ensure_dirs()
    source_data = load_source_data()
    fetch_minas_geojson()
    density_geojson = build_density_geojson()
    geocode_index, unresolved = build_geocode_index(source_data)
    geojson = build_clients_geojson(source_data, geocode_index)

    print(f"Features written: {geojson['metadata']['totalFeatures']}")
    print(f"Municipal density polygons: {density_geojson['metadata']['municipalityCount']}")
    print(f"Unresolved locations: {len(unresolved)}")
    print(f"Skipped rows: {geojson['metadata']['skippedCount']}")
    print(f"GeoJSON: {CLIENTS_GEOJSON}")
    print(f"Density layer: {DENSITY_GEOJSON}")
    print(f"Boundary: {MINAS_GEOJSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
