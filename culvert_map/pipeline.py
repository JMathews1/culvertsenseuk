"""
CulvertSense — High-Risk Culvert Crossing Pipeline
===================================================
Intersects OS Open Rivers with OS Open Roads, scores crossings against
EA Risk of Flooding from Surface Water, outputs a cleaned GeoJSON.

Usage
-----
# Validate with a single OS tile bounding box (Yorkshire):
python pipeline.py --region yorkshire

# Run England-wide (slow, ~4-8 GB RAM):
python pipeline.py --region england

# Resume after interruption (skips completed regions):
python pipeline.py --region england --resume

Data layout expected in data/
------------------------------
data/
  open_rivers/       oprvrs_gb.gpkg   (OS Open Rivers)
  open_roads/        oproad_gb.gpkg   (OS Open Roads)
  rofsw/             Risk_of_Flooding_from_Surface_Water.gpkg  (EA RoFSW)
                  OR Risk_of_Flooding_from_Surface_Water.shp

Output
------
output/culvert_crossings.geojson   — scored crossing points (WGS84)
output/culvert_crossings_{region}.geojson  — per-region intermediates
"""

import argparse
import json
import os
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from shapely.geometry import box, shape, Point
from shapely.ops import unary_union
from tqdm import tqdm

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE = Path(__file__).parent
DATA = BASE / "data"
OUTPUT = BASE / "output"
OUTPUT.mkdir(exist_ok=True)

RIVERS_GPKG  = DATA / "open_rivers" / "Data" / "oprvrs_gb.gpkg"
ROADS_GPKG   = DATA / "open_roads"  / "Data" / "oproad_gb.gpkg"
ROFST_GPKG   = DATA / "rofst" / "Risk_of_Flooding_from_Surface_Water.gpkg"
ROFST_SHP    = DATA / "rofst" / "Risk_of_Flooding_from_Surface_Water.shp"

# EA ArcGIS REST endpoint for RoFSW (used when bulk file not available)
ROFST_REST = "https://environment.data.gov.uk/arcgis/rest/services/ea/RiskOfFloodingFromSurfaceWater/MapServer/0/query"

# ── Region bounding boxes (EPSG:27700, British National Grid) ──────────────────
# Format: (minx, miny, maxx, maxy)
REGIONS = {
    # Yorkshire tiles — good validation set
    "yorkshire":   (380000, 390000, 540000, 490000),
    # Other regions for staged England-wide run
    "northeast":   (310000, 490000, 480000, 660000),
    "northwest":   (310000, 360000, 430000, 490000),
    "midlands":    (360000, 240000, 480000, 400000),
    "east":        (480000, 200000, 660000, 400000),
    "southeast":   (450000, 100000, 660000, 240000),
    "southwest":   (90000,  20000,  380000, 280000),
    "london":      (500000, 155000, 565000, 205000),
    "england":     (90000,  10000,  660000, 660000),   # full extent
}

# ── Risk score mapping ─────────────────────────────────────────────────────────
RISK_MAP = {
    "High":   3,
    "Medium": 2,
    "Low":    1,
}

# ── Watercourse buffer (metres) ────────────────────────────────────────────────
WATERCOURSE_BUFFER_M = 10

# ── Dedup distance (metres) ───────────────────────────────────────────────────
DEDUP_DISTANCE_M = 25

# ── Road classes to EXCLUDE when crossing a large watercourse (order <=3) ─────
LARGE_WATERCOURSE_EXCLUDE_ROAD_CLASSES = {"Motorway", "A Road"}

# ── Watercourse form codes that indicate large rivers ─────────────────────────
# OS Open Rivers: FORM = 'Inland Water' for rivers; filter by length as proxy
# for stream order. Watercourses < 1 km are classed as small.
LARGE_WATERCOURSE_MIN_LENGTH_M = 1000


def load_layer(path: Path, layer=None, bbox=None, simplify_m: float = 5.0) -> gpd.GeoDataFrame:
    """Load a GeoPackage or Shapefile, clip to bbox, reproject to BNG, simplify."""
    print(f"  Loading {path.name}" + (f" layer={layer}" if layer else "") + " ...", end=" ", flush=True)
    kwargs = {"filename": str(path)}
    if layer:
        kwargs["layer"] = layer
    if bbox:
        kwargs["bbox"] = bbox

    gdf = gpd.read_file(**kwargs)
    print(f"{len(gdf):,} features", end=" → ")

    # Reproject to British National Grid
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:27700")
    elif gdf.crs.to_epsg() != 27700:
        gdf = gdf.to_crs("EPSG:27700")

    # Clip to bbox (belt-and-braces after fiona bbox filter)
    if bbox:
        clip_geom = box(*bbox)
        gdf = gdf[gdf.geometry.intersects(clip_geom)].copy()

    # Simplify to reduce vertex count
    if simplify_m > 0:
        gdf["geometry"] = gdf.geometry.simplify(simplify_m, preserve_topology=True)

    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()
    print(f"{len(gdf):,} after clip/simplify")
    return gdf


def detect_rofst_path() -> tuple[Path, str | None]:
    """Return (path, layer_or_None) for the RoFSW dataset."""
    if ROFST_GPKG.exists():
        import fiona
        layers = fiona.listlayers(str(ROFST_GPKG))
        # Pick the first layer that looks like risk polygons
        for lyr in layers:
            if any(k in lyr.lower() for k in ("risk", "flood", "rofst", "rofsw")):
                return ROFST_GPKG, lyr
        return ROFST_GPKG, layers[0]
    if ROFST_SHP.exists():
        return ROFST_SHP, None
    raise FileNotFoundError(
        "RoFSW data not found. Expected:\n"
        f"  {ROFST_GPKG}\n  {ROFST_SHP}"
    )


def _wms_tile_sample(crossings_bng: gpd.GeoDataFrame,
                     bbox_27700: tuple,
                     layer: str) -> np.ndarray:
    """
    Download a NAFRA2 WMS layer as tiled rasters and return a boolean array
    indicating which crossing points fall in a coloured (flooded) pixel.

    Returns: bool array, shape (len(crossings_bng),)
    """
    from io import BytesIO
    from PIL import Image

    WMS     = ("https://environment.data.gov.uk/geoservices/datasets/"
               "b5aaa28d-6eb9-460e-8d6f-43caa71fbe0e/wms")
    PX_M    = 10      # metres per pixel (≤14m required by WMS MaxScaleDenominator)
    TILE_PX = 4096

    minx0, miny0, maxx0, maxy0 = bbox_27700
    tile_m = TILE_PX * PX_M
    x_starts = list(range(int(minx0), int(maxx0), tile_m))
    y_starts  = list(range(int(miny0), int(maxy0), tile_m))
    n_tiles   = len(x_starts) * len(y_starts)

    cx  = crossings_bng.geometry.x.values
    cy  = crossings_bng.geometry.y.values
    hit = np.zeros(len(crossings_bng), dtype=bool)

    print(f"    layer={layer} — {n_tiles} tiles at {PX_M}m/px", flush=True)

    for tx in x_starts:
        for ty in y_starts:
            t_minx = tx
            t_miny = ty
            t_maxx = min(tx + tile_m, int(maxx0))
            t_maxy = min(ty + tile_m, int(maxy0))
            t_w = max(1, int((t_maxx - t_minx) / PX_M))
            t_h = max(1, int((t_maxy - t_miny) / PX_M))

            in_tile = (cx >= t_minx) & (cx < t_maxx) & (cy >= t_miny) & (cy < t_maxy)
            if not in_tile.any():
                continue

            params = {
                "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
                "BBOX":    f"{t_minx},{t_miny},{t_maxx},{t_maxy}",
                "SRS":     "EPSG:27700",
                "WIDTH":   t_w, "HEIGHT": t_h,
                "LAYERS":  layer, "STYLES": "",
                "FORMAT":  "image/png", "TRANSPARENT": "TRUE",
            }
            try:
                resp = requests.get(WMS, params=params, timeout=60)
                resp.raise_for_status()
                arr  = np.array(Image.open(BytesIO(resp.content)).convert("RGBA"))
            except Exception as e:
                print(f"      tile ({t_minx},{t_miny}) SKIP: {e}", flush=True)
                continue

            px = np.clip(((cx[in_tile] - t_minx) / PX_M).astype(int), 0, t_w - 1)
            py = np.clip(((t_maxy - cy[in_tile]) / PX_M).astype(int), 0, t_h - 1)
            hit[in_tile] = arr[py, px, 3] > 10

    return hit


def fetch_rofst_via_wms_raster(bbox_27700: tuple,
                               crossings: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Two-pass NAFRA2 WMS raster sampling for High / Medium flood risk bands.

    Pass 1 — 'rofsw' (any depth ≥0mm, 1-in-30yr event):
        Any flooding present → score 2 (Medium)

    Pass 2 — 'rofsw_0_3m_depth' (depth ≥0.3m, 1-in-30yr event):
        Deep flooding → score 3 (High), overrides Medium

    Crossings in neither layer are filtered out (score 0).

    bbox_27700: (minx, miny, maxx, maxy) in EPSG:27700
    crossings:  GeoDataFrame of points in EPSG:27700
    Returns crossings with risk_score and risk_label columns added.
    """
    print("  Pass 1: any surface water flooding (Medium risk) ...")
    hit_any   = _wms_tile_sample(crossings, bbox_27700, "rofsw")

    print("  Pass 2: deep flooding ≥0.3m (High risk) ...")
    hit_deep  = _wms_tile_sample(crossings, bbox_27700, "rofsw_0_3m_depth")

    scores = np.zeros(len(crossings), dtype=int)
    scores[hit_any]  = 2   # Medium
    scores[hit_deep] = 3   # High (overrides)

    label_map = {3: "High", 2: "Medium", 0: "No data"}
    labels = np.vectorize(label_map.get)(scores)

    crossings = crossings.copy()
    crossings["risk_score"] = scores
    crossings["risk_label"] = labels

    print(f"  Risk scores — High: {(scores==3).sum():,}  "
          f"Medium: {(scores==2).sum():,}  "
          f"None: {(scores==0).sum():,}")
    return crossings


def find_risk_column(gdf: gpd.GeoDataFrame) -> str:
    """Return the column name that holds risk category strings."""
    for col in gdf.columns:
        if col.lower() in ("risk", "risk_band", "riskband", "prob", "probability", "rv"):
            return col
        sample = gdf[col].dropna().head(20).astype(str)
        if sample.str.contains("High|Medium|Low", case=False, na=False).any():
            return col
    raise KeyError(f"Cannot find risk column in {list(gdf.columns)}")


def find_road_class_column(roads: gpd.GeoDataFrame) -> str:
    for col in roads.columns:
        if col.lower() in ("road_classification", "class", "road_class", "roadclass", "classifica", "classification"):
            return col
    # Fallback — look for column with values like 'A Road', 'Motorway'
    for col in roads.columns:
        sample = roads[col].dropna().head(50).astype(str)
        if sample.str.contains("Motorway|A Road|B Road|Minor Road", case=False, na=False).any():
            return col
    return None


def find_road_name_column(roads: gpd.GeoDataFrame) -> str:
    for col in roads.columns:
        if col.lower() in ("name_1", "name1", "name", "road_name", "roadname", "street_name"):
            return col
    return None


def find_watercourse_name_column(rivers: gpd.GeoDataFrame) -> str:
    for col in rivers.columns:
        if col.lower() in ("watercourse_name", "name1", "name", "wbname", "label"):
            return col
    return None


def intersect_roads_watercourses(
    rivers: gpd.GeoDataFrame,
    roads: gpd.GeoDataFrame,
    road_class_col: str | None,
) -> gpd.GeoDataFrame:
    """
    Buffer watercourses by WATERCOURSE_BUFFER_M, intersect with roads,
    extract centroids as candidate culvert crossing points.
    Returns a GeoDataFrame of points in EPSG:27700.
    """
    print("  Buffering watercourses ...")
    rivers_buf = rivers.copy()
    rivers_buf["geometry"] = rivers.geometry.buffer(WATERCOURSE_BUFFER_M)

    print("  Spatial intersect roads ∩ watercourse buffers ...")
    # sjoin gives us roads that overlap the buffered watercourses
    hits = gpd.sjoin(roads, rivers_buf, how="inner", predicate="intersects")
    print(f"    {len(hits):,} road segments cross a buffered watercourse")

    # For each hit, compute the actual intersection geometry and take its centroid
    print("  Computing crossing centroids ...")
    road_geoms  = roads.loc[hits.index, "geometry"].values
    river_geoms = rivers_buf.loc[hits["index_right"], "geometry"].values

    centroids = []
    for rg, wg in zip(road_geoms, river_geoms):
        try:
            ix = rg.intersection(wg)
            if ix.is_empty:
                continue
            centroids.append(ix.centroid)
        except Exception:
            centroids.append(rg.interpolate(0.5, normalized=True))

    hits = hits.iloc[: len(centroids)].copy()
    hits["geometry"] = centroids
    hits = hits[~hits.geometry.is_empty & hits.geometry.notna()].copy()
    hits = hits.set_geometry("geometry")

    print(f"    {len(hits):,} crossing points extracted")
    return hits


def apply_bridge_filter(
    crossings: gpd.GeoDataFrame,
    road_class_col: str | None,
    rivers: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Exclude motorway/A-road crossings over large watercourses (likely bridges).
    """
    if road_class_col is None:
        return crossings

    is_major_road = crossings[road_class_col].isin(LARGE_WATERCOURSE_EXCLUDE_ROAD_CLASSES)

    # Proxy for large watercourse: original river segment length > threshold
    large_wc_ids = rivers[rivers.geometry.length >= LARGE_WATERCOURSE_MIN_LENGTH_M].index
    # index_right links back to the rivers GeoDataFrame
    is_large_wc = crossings["index_right"].isin(large_wc_ids)

    exclude = is_major_road & is_large_wc
    n_excluded = exclude.sum()
    crossings = crossings[~exclude].copy()
    print(f"  Bridge filter: removed {n_excluded:,} likely bridges → {len(crossings):,} remain")
    return crossings


def dedup_points(gdf: gpd.GeoDataFrame, distance_m: float = DEDUP_DISTANCE_M) -> gpd.GeoDataFrame:
    """Remove duplicate points within distance_m of each other (keep highest risk)."""
    if len(gdf) == 0:
        return gdf

    print(f"  Deduplicating within {distance_m}m ...")
    gdf = gdf.sort_values("risk_score", ascending=False).copy()
    gdf["_geom_buf"] = gdf.geometry.buffer(distance_m)

    kept = []
    removed = set()
    for idx, row in gdf.iterrows():
        if idx in removed:
            continue
        kept.append(idx)
        # Mark nearby points as duplicates
        nearby = gdf[
            (~gdf.index.isin(removed)) &
            (gdf.index != idx) &
            gdf["_geom_buf"].intersects(row["_geom_buf"])
        ].index
        removed.update(nearby)

    result = gdf.loc[kept].drop(columns=["_geom_buf"]).copy()
    print(f"    {len(gdf):,} → {len(result):,} after dedup")
    return result


def score_flood_risk(
    crossings: gpd.GeoDataFrame,
    rofst_path: Path | None,
    rofst_layer: str | None,
    bbox: tuple,
) -> gpd.GeoDataFrame:
    """Spatial join crossings against RoFSW polygons to assign risk score."""
    if rofst_path is not None:
        print("  Loading RoFSW flood risk polygons from file ...")
        rofst = load_layer(rofst_path, layer=rofst_layer, bbox=bbox, simplify_m=10.0)
        risk_col = find_risk_column(rofst)
        print(f"    Risk column: '{risk_col}'")
        # Normalise risk labels
        rofst["_risk_label"] = rofst[risk_col].str.strip().str.title()
        rofst["_risk_score"] = rofst["_risk_label"].map(RISK_MAP).fillna(0).astype(int)

        print("  Spatial joining crossings → flood risk ...")
        joined = gpd.sjoin(
            crossings,
            rofst[["geometry", "_risk_label", "_risk_score"]],
            how="left",
            predicate="within",
        )
        joined = joined.sort_values("_risk_score", ascending=False)
        joined = joined[~joined.index.duplicated(keep="first")].copy()
        joined["risk_score"] = joined["_risk_score"].fillna(0).astype(int)
        joined["risk_label"] = joined["_risk_label"].fillna("No data")
        print(f"    High: {(joined.risk_score==3).sum():,}  "
              f"Medium: {(joined.risk_score==2).sum():,}  "
              f"Low: {(joined.risk_score==1).sum():,}  "
              f"No data: {(joined.risk_score==0).sum():,}")
        return joined

    else:
        # No local file — sample EA NAFRA2 WMS raster tiles
        return fetch_rofst_via_wms_raster(bbox, crossings)


def build_output(crossings: gpd.GeoDataFrame, road_class_col, road_name_col, wc_name_col):
    """Select and rename columns for the final GeoJSON output."""
    cols = {
        "geometry": "geometry",
        "risk_score": "risk_score",
        "risk_label": "risk_label",
        "priority_score": "priority_score",
        "nearby_critical": "nearby_critical",
        "nearby_housing": "nearby_housing",
        "flooded_before": "flooded_before",
        "in_s19_area": "in_s19_area",
    }
    if road_class_col and road_class_col in crossings.columns:
        cols[road_class_col] = "road_class"
    if road_name_col and road_name_col in crossings.columns:
        cols[road_name_col] = "road_name"
    if wc_name_col:
        # The watercourse name column got a suffix from sjoin
        for c in crossings.columns:
            if wc_name_col in c:
                cols[c] = "watercourse_name"
                break

    out = crossings[[c for c in cols if c in crossings.columns]].rename(columns=cols)

    # Add lat/lon in WGS84
    out_wgs = out.to_crs("EPSG:4326")
    out["lon"] = out_wgs.geometry.x.round(6)
    out["lat"] = out_wgs.geometry.y.round(6)
    out = out_wgs  # return in WGS84
    out["lon"] = out.geometry.x.round(6)
    out["lat"] = out.geometry.y.round(6)

    # Fill missing names
    if "road_name" not in out.columns:
        out["road_name"] = "Unknown road"
    if "watercourse_name" not in out.columns:
        out["watercourse_name"] = "Unknown watercourse"
    if "road_class" not in out.columns:
        out["road_class"] = "Unknown"

    out["road_name"] = out["road_name"].fillna("Unnamed road")
    out["watercourse_name"] = out["watercourse_name"].fillna("Unnamed watercourse")

    return out


# ── Infrastructure proximity scoring ──────────────────────────────────────────

# OSM tags treated as critical infrastructure
CRITICAL_INFRA_TAGS = {
    "amenity": ["hospital", "clinic", "doctors", "nursing_home", "care_home",
                "school", "college", "university", "fire_station", "police"],
    "building": ["hospital", "school", "fire_station"],
}

# EA Recorded Flood Outlines WMS — no scale limit, works at any zoom
FLOOD_OUTLINES_WMS   = "https://environment.data.gov.uk/spatialdata/recorded-flood-outlines/wms"
FLOOD_OUTLINES_LAYER = "Recorded_Flood_Outlines"

# Path to council_opportunities.csv from the culvert_scout run
COUNCIL_SCOUT_CSV = Path(__file__).parent.parent / "Downloads" / "council_opportunities.csv"
# Fallback relative path if running from culvert_map/
COUNCIL_SCOUT_CSV_ALT = Path.home() / "Downloads" / "council_opportunities.csv"

# S19 keyword signals in council scout data
S19_KEYWORDS = ["section 19", "s19", "culvert blockage", "culvert", "culverted",
                 "ordinary watercourse flood"]

ROAD_CLASS_BONUS = {
    "Motorway": 0,    # bridge, already filtered
    "A Road":   1,
    "B Road":   1,
    "Minor Road": 0,
    "Unclassified": 0,
}

HOUSING_RADIUS_M    = 100
INFRA_RADIUS_M      = 500


def fetch_osm_infrastructure(bbox_27700: tuple) -> gpd.GeoDataFrame:
    """
    Query OSM Overpass API for residential land use and critical infrastructure
    within the region bbox. Returns a GeoDataFrame of point/polygon centroids
    in EPSG:27700 with a 'infra_type' column.
    """
    from pyproj import Transformer

    # Convert BNG bbox → WGS84 for Overpass
    t = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    lon_min, lat_min = t.transform(bbox_27700[0], bbox_27700[1])
    lon_max, lat_max = t.transform(bbox_27700[2], bbox_27700[3])

    # Lightweight Overpass query:
    # - Critical infra nodes (sparse)
    # - Residential landuse polygons (not individual buildings — too many)
    amenities = "|".join(CRITICAL_INFRA_TAGS["amenity"])
    bbox_str = f"{lat_min},{lon_min},{lat_max},{lon_max}"

    query = f"""[out:json][timeout:90];
(
  node["amenity"~"{amenities}"]({bbox_str});
  way["amenity"~"{amenities}"]({bbox_str});
  node["building"~"hospital|fire_station|school"]({bbox_str});
  way["landuse"="residential"]({bbox_str});
);
out center;"""

    OVERPASS_MIRRORS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]

    print("  Querying OSM Overpass for housing + critical infrastructure ...")
    elements = []
    for mirror in OVERPASS_MIRRORS:
        try:
            resp = requests.post(mirror, data={"data": query}, timeout=120)
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
            break
        except Exception as e:
            print(f"    {mirror} failed: {e} — trying next mirror")
    if not elements:
        print("  WARNING: All Overpass mirrors failed — skipping infrastructure scoring")
        return gpd.GeoDataFrame()

    print(f"    {len(elements):,} OSM elements returned")

    rows = []
    t_inv = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)
    for el in elements:
        # nodes have lat/lon; ways have 'center'
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        elif el["type"] == "way" and "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        if lat is None or lon is None:
            continue

        tags = el.get("tags", {})
        amenity  = tags.get("amenity", "")
        landuse  = tags.get("landuse", "")
        building = tags.get("building", "")

        if amenity in CRITICAL_INFRA_TAGS.get("amenity", []) or \
           building in CRITICAL_INFRA_TAGS.get("building", []):
            infra_type = "critical"
        elif landuse == "residential":
            infra_type = "residential"
        else:
            infra_type = "critical"  # other matched amenity tags

        x, y = t_inv.transform(lon, lat)
        rows.append({"infra_type": infra_type, "geometry": Point(x, y)})

    if not rows:
        return gpd.GeoDataFrame()

    gdf = gpd.GeoDataFrame(rows, crs="EPSG:27700")
    critical_count = (gdf["infra_type"] == "critical").sum()
    residential_count = (gdf["infra_type"] == "residential").sum()
    print(f"    Critical infra: {critical_count:,}  Residential: {residential_count:,}")
    return gdf


def sample_recorded_flood_outlines(crossings: gpd.GeoDataFrame,
                                    bbox_27700: tuple) -> np.ndarray:
    """
    Sample EA Recorded Flood Outlines WMS for each crossing.
    Returns bool array: True where a crossing falls within a historical flood outline.
    No scale limit on this WMS — use coarser resolution to keep tile count low.
    """
    print("  Sampling EA Recorded Flood Outlines ...")
    # Use 20m/px — this WMS has no scale limit so we can go coarser
    PX_M    = 20
    TILE_PX = 4096
    WMS     = FLOOD_OUTLINES_WMS

    minx0, miny0, maxx0, maxy0 = bbox_27700
    tile_m   = TILE_PX * PX_M
    x_starts = list(range(int(minx0), int(maxx0), tile_m))
    y_starts  = list(range(int(miny0), int(maxy0), tile_m))
    n_tiles   = len(x_starts) * len(y_starts)

    cx  = crossings.geometry.x.values
    cy  = crossings.geometry.y.values
    hit = np.zeros(len(crossings), dtype=bool)

    from io import BytesIO
    from PIL import Image

    print(f"    {n_tiles} tiles at {PX_M}m/px", flush=True)
    for tx in x_starts:
        for ty in y_starts:
            t_minx = tx;  t_miny = ty
            t_maxx = min(tx + tile_m, int(maxx0))
            t_maxy = min(ty + tile_m, int(maxy0))
            t_w = max(1, int((t_maxx - t_minx) / PX_M))
            t_h = max(1, int((t_maxy - t_miny) / PX_M))

            in_tile = (cx >= t_minx) & (cx < t_maxx) & (cy >= t_miny) & (cy < t_maxy)
            if not in_tile.any():
                continue

            params = {
                "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
                "BBOX":    f"{t_minx},{t_miny},{t_maxx},{t_maxy}",
                "SRS":     "EPSG:27700", "WIDTH": t_w, "HEIGHT": t_h,
                "LAYERS":  FLOOD_OUTLINES_LAYER, "STYLES": "",
                "FORMAT":  "image/png", "TRANSPARENT": "TRUE",
            }
            try:
                resp = requests.get(WMS, params=params, timeout=60)
                resp.raise_for_status()
                arr  = np.array(Image.open(BytesIO(resp.content)).convert("RGBA"))
            except Exception as e:
                print(f"      tile ({t_minx},{t_miny}) SKIP: {e}")
                continue

            px = np.clip(((cx[in_tile] - t_minx) / PX_M).astype(int), 0, t_w - 1)
            py = np.clip(((t_maxy - cy[in_tile]) / PX_M).astype(int), 0, t_h - 1)
            hit[in_tile] = arr[py, px, 3] > 10

    n_hit = hit.sum()
    print(f"    {n_hit:,} crossings fall within a recorded flood outline")
    return hit


def load_s19_councils() -> set[str] | None:
    """
    Load council names that have active S19 / culvert investigations from the
    council_opportunities.csv produced by culvert_scout.py.
    Returns a set of council name strings, or None if file not found.
    """
    csv_path = COUNCIL_SCOUT_CSV if COUNCIL_SCOUT_CSV.exists() else COUNCIL_SCOUT_CSV_ALT
    if not csv_path.exists():
        return None

    import csv
    councils = set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            issue = row.get("issue_type", "").lower()
            if any(kw in issue for kw in S19_KEYWORDS):
                councils.add(row.get("council", "").strip())
    print(f"  Loaded {len(councils)} councils with S19/culvert investigations from scout CSV")
    return councils


def build_s19_lookup(bbox_27700: tuple, s19_councils: set[str]) -> gpd.GeoDataFrame | None:
    """
    Query OSM for council/LLFA boundaries within bbox, then mark which ones
    have active S19 investigations.  Returns GeoDataFrame of S19-active areas,
    or None if no data / no matches.
    """
    if not s19_councils:
        return None

    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    lon_min, lat_min = t.transform(bbox_27700[0], bbox_27700[1])
    lon_max, lat_max = t.transform(bbox_27700[2], bbox_27700[3])
    bbox_str = f"{lat_min},{lon_min},{lat_max},{lon_max}"

    # Query OSM for district/county admin boundaries
    query = f"""[out:json][timeout:60];
(
  relation["boundary"="administrative"]["admin_level"~"^(6|7|8)$"]({bbox_str});
);
out geom;"""

    print("  Fetching council boundaries from OSM for S19 lookup ...")
    for mirror in ["https://overpass-api.de/api/interpreter",
                    "https://overpass.kumi.systems/api/interpreter"]:
        try:
            resp = requests.post(mirror, data={"data": query}, timeout=90)
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
            break
        except Exception as e:
            print(f"    {mirror}: {e}")
            elements = []

    if not elements:
        return None

    from shapely.geometry import Polygon, MultiPolygon
    t_inv = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)

    matched_geoms = []
    for el in elements:
        name = el.get("tags", {}).get("name", "")
        # Fuzzy match: check if any S19 council name appears in the OSM name
        matched = any(
            s19.lower().replace(" council", "").replace(" borough", "").replace(" city", "")
            in name.lower()
            for s19 in s19_councils
        )
        if not matched:
            continue

        # Reconstruct outer polygon from OSM relation geometry
        members = el.get("members", [])
        outer_ways = [m for m in members if m.get("role") == "outer" and "geometry" in m]
        if not outer_ways:
            continue
        try:
            coords = [(t_inv.transform(pt["lon"], pt["lat"])) for pt in outer_ways[0]["geometry"]]
            if len(coords) >= 3:
                matched_geoms.append(Polygon(coords))
        except Exception:
            continue

    if not matched_geoms:
        return None

    gdf = gpd.GeoDataFrame(geometry=matched_geoms, crs="EPSG:27700")
    print(f"    {len(gdf)} S19-active council boundaries found in region")
    return gdf


def score_infrastructure(crossings: gpd.GeoDataFrame,
                          infra: gpd.GeoDataFrame,
                          road_class_col: str | None,
                          flooded_before: np.ndarray | None = None,
                          in_s19_area: np.ndarray | None = None) -> gpd.GeoDataFrame:
    """
    Compute priority_score (1–5) combining all risk signals:

      priority_score = min(5,
          risk_score                          (2 or 3)
          + road_class_bonus                  (0 or 1)
          + 1 if any critical infra ≤500m
          + 1 if any residential ≤100m
          + 1 if within EA recorded flood outline  ← NEW
          + 1 if in S19-active council area        ← NEW
      )

    Capped at 5 ("Critical").
    """
    crossings = crossings.copy()

    # Defaults for new signal arrays
    if flooded_before is None:
        flooded_before = np.zeros(len(crossings), dtype=bool)
    if in_s19_area is None:
        in_s19_area = np.zeros(len(crossings), dtype=bool)

    if infra.empty:
        near_critical    = np.zeros(len(crossings), dtype=bool)
        near_residential = np.zeros(len(crossings), dtype=bool)
    else:
        critical    = infra[infra["infra_type"] == "critical"]
        residential = infra[infra["infra_type"] == "residential"]

        def has_nearby(points_gdf, features_gdf, radius_m):
            if features_gdf.empty:
                return np.zeros(len(points_gdf), dtype=bool)
            buf = points_gdf.copy()
            buf["geometry"] = points_gdf.geometry.buffer(radius_m)
            joined = gpd.sjoin(buf[["geometry"]], features_gdf[["geometry"]],
                               how="left", predicate="intersects")
            matched = set(joined.index[joined["index_right"].notna()])
            return np.array([i in matched for i in points_gdf.index], dtype=bool)

        print("  Scoring infrastructure proximity ...")
        near_critical    = has_nearby(crossings, critical,    INFRA_RADIUS_M)
        near_residential = has_nearby(crossings, residential, HOUSING_RADIUS_M)

    road_bonus = np.zeros(len(crossings), dtype=int)
    if road_class_col and road_class_col in crossings.columns:
        road_bonus = crossings[road_class_col].map(ROAD_CLASS_BONUS).fillna(0).astype(int).values

    priority = (
        crossings["risk_score"].values
        + road_bonus
        + near_critical.astype(int)
        + near_residential.astype(int)
        + flooded_before.astype(int)
        + in_s19_area.astype(int)
    )
    crossings["priority_score"]    = np.clip(priority, 1, 5).astype(int)
    crossings["nearby_critical"]   = near_critical
    crossings["nearby_housing"]    = near_residential
    crossings["flooded_before"]    = flooded_before
    crossings["in_s19_area"]       = in_s19_area

    p_counts = {s: int((crossings["priority_score"] == s).sum()) for s in range(1, 6)}
    print(f"  Priority distribution: {p_counts}")
    print(f"  Flooded before: {flooded_before.sum():,}  In S19 area: {in_s19_area.sum():,}")
    return crossings


def process_region(region_name: str, bbox: tuple, resume: bool = False) -> Path:
    """Run the full pipeline for one region. Returns path to output GeoJSON."""
    out_path = OUTPUT / f"culvert_crossings_{region_name}.geojson"

    if resume and out_path.exists():
        print(f"\n[{region_name}] Already processed — skipping (--resume)")
        return out_path

    print(f"\n{'='*60}")
    print(f"Processing region: {region_name.upper()}")
    print(f"Bounding box (BNG): {bbox}")
    print(f"{'='*60}")

    # ── 1. Load data ──────────────────────────────────────────────
    print("\n[1/5] Loading datasets")
    rivers = load_layer(RIVERS_GPKG, layer="watercourse_link", bbox=bbox)
    roads  = load_layer(ROADS_GPKG,  layer="road_link",        bbox=bbox)

    road_class_col = find_road_class_column(roads)
    road_name_col  = find_road_name_column(roads)
    wc_name_col    = find_watercourse_name_column(rivers)

    print(f"  Road class column: {road_class_col}")
    print(f"  Road name column:  {road_name_col}")
    print(f"  Watercourse name:  {wc_name_col}")

    # ── 2. Find intersections ─────────────────────────────────────
    print("\n[2/5] Finding road/watercourse intersections")
    crossings = intersect_roads_watercourses(rivers, roads, road_class_col)

    # ── 3. Bridge filter ──────────────────────────────────────────
    print("\n[3/5] Applying bridge filter")
    crossings = apply_bridge_filter(crossings, road_class_col, rivers)

    # ── 4. Score flood risk ───────────────────────────────────────
    print("\n[4/5] Scoring flood risk")
    try:
        rofst_path, rofst_layer = detect_rofst_path()
    except FileNotFoundError:
        rofst_path, rofst_layer = None, None
        print("  No local RoFSW file — will use EA NAFRA2 WMS raster sampling")
    crossings = score_flood_risk(crossings, rofst_path, rofst_layer, bbox)

    # Filter: keep High (3) and Medium (2); when using WMS raster only High (3) exists
    crossings = crossings[crossings["risk_score"] >= 2].copy()
    print(f"  After risk filter: {len(crossings):,} crossings")

    # ── 5. Historical flood + S19 signals ────────────────────────
    print("\n[5/6] Scoring historical signals")
    flooded_before = sample_recorded_flood_outlines(crossings, bbox)

    s19_councils = load_s19_councils()
    s19_bounds   = build_s19_lookup(bbox, s19_councils) if s19_councils else None
    if s19_bounds is not None and not s19_bounds.empty:
        def in_s19(points_gdf, s19_gdf):
            buf = points_gdf.copy()
            joined = gpd.sjoin(buf[["geometry"]], s19_gdf[["geometry"]],
                               how="left", predicate="within")
            matched = set(joined.index[joined["index_right"].notna()])
            return np.array([i in matched for i in points_gdf.index], dtype=bool)
        in_s19_area = in_s19(crossings, s19_bounds)
    else:
        in_s19_area = np.zeros(len(crossings), dtype=bool)

    # ── 6. Infrastructure proximity scoring ───────────────────────
    print("\n[6/7] Scoring infrastructure proximity")
    infra = fetch_osm_infrastructure(bbox)
    crossings = score_infrastructure(crossings, infra, road_class_col,
                                      flooded_before=flooded_before,
                                      in_s19_area=in_s19_area)

    # ── 7. Dedup and output ───────────────────────────────────────
    print("\n[7/7] Deduplicating and writing output")
    crossings = dedup_points(crossings)

    out = build_output(crossings, road_class_col, road_name_col, wc_name_col)
    out.to_file(str(out_path), driver="GeoJSON")
    print(f"\n  Written: {out_path}  ({len(out):,} crossings)")
    return out_path


def merge_regions(region_paths: list[Path]) -> Path:
    """Merge per-region GeoJSONs into one England-wide output."""
    print("\nMerging regions ...")
    gdfs = []
    for p in region_paths:
        if p.exists():
            gdfs.append(gpd.read_file(str(p)))
    if not gdfs:
        raise RuntimeError("No region files to merge")
    merged = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs="EPSG:4326")
    merged = merged.drop_duplicates(subset=["lat", "lon"])
    out = OUTPUT / "culvert_crossings.geojson"
    merged.to_file(str(out), driver="GeoJSON")
    print(f"Merged: {len(merged):,} crossings → {out}")
    return out


def validate_data_files():
    missing = []
    if not RIVERS_GPKG.exists():
        missing.append(f"OS Open Rivers:  {RIVERS_GPKG}")
    if not ROADS_GPKG.exists():
        missing.append(f"OS Open Roads:   {ROADS_GPKG}")
    if missing:
        print("\nERROR — missing data files:")
        for m in missing:
            print(f"  {m}")
        print("\nDownload instructions:")
        print("  OS Open Rivers:  https://osdatahub.os.uk/downloads/open/OpenRivers")
        print("  OS Open Roads:   https://osdatahub.os.uk/downloads/open/OpenRoads")
        print("  EA RoFSW:        https://environment.data.gov.uk/dataset/risk-of-flooding-from-surface-water")
        print("\nPlace downloaded files under culvert_map/data/ as shown in the README.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="CulvertSense culvert crossing pipeline")
    parser.add_argument(
        "--region",
        default="yorkshire",
        choices=list(REGIONS.keys()),
        help="Region to process (default: yorkshire for validation)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip regions that already have output files",
    )
    parser.add_argument(
        "--list-regions",
        action="store_true",
        help="List available regions and exit",
    )
    args = parser.parse_args()

    if args.list_regions:
        print("Available regions:")
        for name, bbox in REGIONS.items():
            print(f"  {name:12s}  BNG bbox: {bbox}")
        return

    validate_data_files()

    if args.region == "england":
        # Process region by region to keep memory manageable
        sub_regions = [r for r in REGIONS if r != "england"]
        paths = []
        for name in sub_regions:
            p = process_region(name, REGIONS[name], resume=args.resume)
            paths.append(p)
        final = merge_regions(paths)
    else:
        final = process_region(args.region, REGIONS[args.region], resume=args.resume)

    print(f"\nDone. Output: {final}")
    print("Next step: open output/culvert_map.html in a browser")


if __name__ == "__main__":
    main()
