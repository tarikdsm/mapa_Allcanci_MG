from __future__ import annotations

import json
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
SOURCE_DIR = DATA_DIR / "source"
SOURCE_JSON_IN_REPO = SOURCE_DIR / "clientes_por_etapa_comercial.json"
EXTERNAL_SOURCE_JSON = REPO_ROOT.parent / "Planilhas_Clientes" / "clientes_por_etapa_comercial.json"
CACHE_FILE = SOURCE_DIR / "neighborhood_geocode_cache.json"
CLIENTS_GEOJSON = DATA_DIR / "clients.geojson"
MINAS_GEOJSON = DATA_DIR / "minas-gerais.geojson"
REPORT_JSON = DATA_DIR / "build-report.json"

MINAS_GEOJSON_URL = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "mapa-allcanci-mg/1.0 (github pages build)"
REQUEST_DELAY_SECONDS = 1.1

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


def load_source_data() -> dict[str, Any]:
    if EXTERNAL_SOURCE_JSON.exists():
        shutil.copyfile(EXTERNAL_SOURCE_JSON, SOURCE_JSON_IN_REPO)
    if not SOURCE_JSON_IN_REPO.exists():
        raise FileNotFoundError(
            f"Source JSON not found in {EXTERNAL_SOURCE_JSON} or {SOURCE_JSON_IN_REPO}"
        )
    return json.loads(SOURCE_JSON_IN_REPO.read_text(encoding="utf-8"))


def download_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def fetch_minas_geojson() -> dict[str, Any]:
    collection = download_json(MINAS_GEOJSON_URL)
    for feature in collection["features"]:
        name = (
            feature.get("properties", {}).get("name")
            or feature.get("properties", {}).get("nome")
            or ""
        )
        if name == "Minas Gerais":
            MINAS_GEOJSON.write_text(
                json.dumps(feature, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return feature
    raise RuntimeError("Could not find Minas Gerais feature in boundary GeoJSON")


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
    geocode_index, unresolved = build_geocode_index(source_data)
    geojson = build_clients_geojson(source_data, geocode_index)

    print(f"Features written: {geojson['metadata']['totalFeatures']}")
    print(f"Unresolved locations: {len(unresolved)}")
    print(f"Skipped rows: {geojson['metadata']['skippedCount']}")
    print(f"GeoJSON: {CLIENTS_GEOJSON}")
    print(f"Boundary: {MINAS_GEOJSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
