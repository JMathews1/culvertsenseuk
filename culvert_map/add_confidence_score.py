"""
CulvertSense — Confidence Scoring
==================================
Post-processing script: adds confidence_score, confidence_tier, crossing_id,
and supporting signal fields to an existing culvert_crossings.geojson.

Confidence score (0–100) is an additive weighted model across independent
evidence layers.  It is NOT the same as risk_score or priority_score —
it measures how likely we are that this is a real, significant culvert crossing.

  Layer                          Pts    Status
  ─────────────────────────────  ────   ──────────────────────────────────────
  OS Open Rivers intersection     20    Always present (all our crossings)
  EA Recorded Flood Outlines      15    flooded_before — existing field
  EA Flood Incidents ≤200m     0–25    STUB — populate via enrich_flood_incidents()
  EA Flood Zone 2 / 3          0–15    STUB — populate via enrich_flood_zone()
  Flow accumulation corrobor.    10    STUB — populate after PySheds DTM run
  Road name water signal           5    Computed from OS OpenRoads name field

  S19 override: s19_mentioned = True → confidence_score floored at 85

Confidence tiers:
  confirmed  — score ≥ 70  AND  source_count ≥ 3
  probable   — score ≥ 40  AND  source_count ≥ 2
  candidate  — otherwise

Stub notes
----------
  flood_incidents_200m  → None until Defra Recorded Flood Incidents CSV downloaded.
                          Call enrich_flood_incidents(gdf, incidents_gdf) to populate.
                          Dataset: https://environment.data.gov.uk/dataset/recorded-flood-incidents

  flood_zone            → 'none' until EA Flood Map for Planning GPKG downloaded.
                          Call enrich_flood_zone(gdf, fz_gdf) to populate.
                          Dataset: https://environment.data.gov.uk/dataset/flood-map-for-planning

  flow_accumulation_corroborated → False until PySheds DTM run.
                          See flow_accumulation.py (future script).

Usage
-----
  # In-place update of culvert_crossings.geojson (default):
  python add_confidence_score.py

  # Custom paths:
  python add_confidence_score.py --input path/in.geojson --output path/out.geojson

  # Dry-run (print summary, don't write):
  python add_confidence_score.py --dry-run
"""

import argparse
import hashlib
import re
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE           = Path(__file__).parent
OUTPUT         = BASE / "output"
DEFAULT_INPUT  = OUTPUT / "culvert_crossings.geojson"
DEFAULT_OUTPUT = OUTPUT / "culvert_crossings.geojson"

# ── Road name water-related terms ─────────────────────────────────────────────
# From the build brief, extended with additional UK-relevant terms.
# Ordered most-specific first so the first match is the best label.
# Whole-word matched (see parse_road_name_water_signal).
WATER_TERMS = [
    # Brief-specified terms
    "culvert", "ford", "brook", "beck", "burn", "bourne", "mill", "bridge",
    "watery", "water",
    # Additional high-signal UK terms
    "river", "stream", "fleet", "ditch", "drain", "leat", "weir", "sluice",
    "gill",    # Northern English/Scottish watercourse term
    "sike",    # Northern English small stream
    "rhyne",   # Somerset drainage channel
    "rhine",   # Alternative spelling of rhyne
]

# ── Confidence scoring weights ─────────────────────────────────────────────────
W_OS_RIVERS        = 20   # baseline: always present for all our crossings
W_FLOOD_OUTLINES   = 15   # flooded_before (EA Recorded Flood Outlines)
W_FLOOD_INCIDENTS  = 25   # flood_incidents_200m ≥ 1 (Defra dataset — stub)
W_FLOOD_ZONE_3     = 15   # EA Flood Zone 3 overlap
W_FLOOD_ZONE_2     = 10   # EA Flood Zone 2 overlap
W_FLOW_ACCUM       = 10   # flow_accumulation_corroborated (PySheds — stub)
W_ROAD_NAME        = 5    # road name contains water-related term

S19_FLOOR          = 85   # if s19_mentioned, floor confidence at this value

# Tier thresholds
# PROBABLE_SCORE = 35 (not 40) so that FZ3 + OS Rivers (35 pts, 2 sources)
# correctly resolves as "probable" — a crossing in a known flood zone is
# worth investigating even without flood incident or flow accumulation data.
CONFIRMED_SCORE    = 70
CONFIRMED_SOURCES  = 3
PROBABLE_SCORE     = 35
PROBABLE_SOURCES   = 2


# ── Identifier ────────────────────────────────────────────────────────────────

def make_crossing_id(lat: float, lon: float) -> str:
    """
    Deterministic 8-char hex ID from WGS84 coordinates.
    Stable across re-runs: same point → same ID.
    Format: CS_XXXXXXXX
    """
    raw = f"{round(lat, 6):.6f},{round(lon, 6):.6f}"
    h = hashlib.md5(raw.encode()).hexdigest()[:8].upper()
    return f"CS_{h}"


# ── Road name signal ──────────────────────────────────────────────────────────

def parse_road_name_water_signal(name) -> tuple[bool, str]:
    """
    Return (True, matched_term) if the road name contains a water-related term.

    Uses whole-word regex matching to avoid false positives:
      "Waterloo Road"   → no match ('water' not a standalone word here)
      "Water Lane"      → match ('water')
      "Millbrook Road"  → no match
      "Mill Road"       → match ('mill')
      "Cambridge Road"  → no match
    """
    if not name or not isinstance(name, str):
        return False, ""
    name_stripped = name.strip().lower()
    if name_stripped in ("unnamed road", "unknown road", ""):
        return False, ""

    for term in WATER_TERMS:
        pattern = r"(?<![a-z])" + re.escape(term) + r"(?![a-z])"
        if re.search(pattern, name_stripped):
            return True, term
    return False, ""


# ── Core confidence calculation ───────────────────────────────────────────────

def compute_confidence(row: dict) -> tuple[int, int]:
    """
    Compute (confidence_score 0–100, source_count).

    source_count = number of independent evidence layers that fired.
    Used alongside score to assign the confidence tier.

    All stub fields contribute 0 points until populated by enrichment scripts.
    """
    pts     = W_OS_RIVERS   # 20 — always present
    sources = 1             # OS Rivers = 1 source

    # ── EA Recorded Flood Outlines (existing proxy) ────────────────────────────
    if row.get("flooded_before"):
        pts     += W_FLOOD_OUTLINES
        sources += 1

    # ── EA Flood Incidents ≤200m (Defra dataset) ──────────────────────────────
    # Stub: null until enrich_flood_incidents() is called.
    # When populated: ≥3 incidents → full 25pts; 1–2 → partial 15pts.
    raw_incidents = row.get("flood_incidents_200m")
    if raw_incidents is not None:
        try:
            incidents = int(raw_incidents)
            if incidents >= 3:
                pts     += W_FLOOD_INCIDENTS
                sources += 1
            elif incidents >= 1:
                pts     += int(W_FLOOD_INCIDENTS * 0.6)   # 15 pts
                sources += 1
        except (TypeError, ValueError):
            pass

    # ── EA Flood Zone 2 / 3 (EA Flood Map for Planning) ──────────────────────
    # Populated by enrich_flood_zone.py — stored as 'FZ2', 'FZ3', or 'none'.
    fz = str(row.get("flood_zone", "none") or "none").strip().upper().replace("FZ", "")
    if fz == "3":
        pts     += W_FLOOD_ZONE_3
        sources += 1
    elif fz == "2":
        pts     += W_FLOOD_ZONE_2
        sources += 1

    # ── Flow accumulation corroboration (PySheds DTM) ────────────────────────
    # Stub: False until flow_accumulation.py is run.
    if row.get("flow_accumulation_corroborated"):
        pts     += W_FLOW_ACCUM
        sources += 1

    # ── Road name water signal ────────────────────────────────────────────────
    if row.get("road_name_water_signal"):
        pts     += W_ROAD_NAME
        sources += 1

    # ── S19 override ─────────────────────────────────────────────────────────
    # S19 mention is strong external corroboration — floor confidence at S19_FLOOR.
    if row.get("s19_mentioned") or row.get("in_s19_area"):
        pts     = max(pts, S19_FLOOR)
        sources = max(sources, CONFIRMED_SOURCES)

    return int(np.clip(pts, 0, 100)), sources


def assign_tier(score: int, sources: int) -> str:
    """
    confirmed  — score ≥ 70 AND ≥3 independent sources
    probable   — score ≥ 40 AND ≥2 sources
    candidate  — otherwise (single source, or low confidence)
    """
    if score >= CONFIRMED_SCORE and sources >= CONFIRMED_SOURCES:
        return "confirmed"
    if score >= PROBABLE_SCORE and sources >= PROBABLE_SOURCES:
        return "probable"
    return "candidate"


# ── Future enrichment stubs ───────────────────────────────────────────────────
# Call these functions after downloading the relevant datasets,
# then re-run compute_confidence() to refresh scores.

def enrich_flood_incidents(gdf: gpd.GeoDataFrame,
                            incidents_gdf: gpd.GeoDataFrame,
                            radius_m: float = 200) -> gpd.GeoDataFrame:
    """
    Populate flood_incidents_200m for each crossing.

    incidents_gdf: GeoDataFrame of EA Recorded Flood Incidents point locations.
                   Download from Defra Data Services Platform (OGL):
                   https://environment.data.gov.uk/dataset/recorded-flood-incidents

    Spatial join: count incidents within radius_m of each crossing.
    Returns updated GDF with flood_incidents_200m populated.
    """
    print(f"  Enriching flood incidents (radius={radius_m}m) ...")
    gdf_bng = gdf.to_crs("EPSG:27700")
    inc_bng = incidents_gdf.to_crs("EPSG:27700")

    buffers = gdf_bng.copy()
    buffers["geometry"] = gdf_bng.geometry.buffer(radius_m)

    joined = gpd.sjoin(buffers[["geometry"]], inc_bng[["geometry"]],
                       how="left", predicate="intersects")
    counts = joined.groupby(joined.index).size()
    gdf = gdf.copy()
    gdf["flood_incidents_200m"] = counts.reindex(gdf.index).fillna(0).astype(int)

    n_with = (gdf["flood_incidents_200m"] > 0).sum()
    print(f"    {n_with:,} crossings have ≥1 incident within {radius_m}m")
    return gdf


def enrich_flood_zone(gdf: gpd.GeoDataFrame,
                       fz_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Populate flood_zone for each crossing from EA Flood Map for Planning polygons.

    fz_gdf: GeoDataFrame of EA Flood Zone polygons with a 'Zone' or 'flood_zone'
            column containing values '1', '2', '3'.
            Download from EA (OGL):
            https://environment.data.gov.uk/dataset/flood-map-for-planning

    Assigns the highest flood zone present at each crossing point.
    Returns updated GDF with flood_zone populated ('1'/'2'/'3'/'none').
    """
    print("  Enriching flood zones ...")

    # Find the zone column
    zone_col = next(
        (c for c in fz_gdf.columns
         if c.lower() in ("zone", "flood_zone", "floodzone", "fz")),
        None
    )
    if zone_col is None:
        print("  WARNING: could not identify flood zone column — skipping")
        return gdf

    fz_bng = fz_gdf.to_crs("EPSG:27700")
    pts    = gdf.to_crs("EPSG:27700")

    joined = gpd.sjoin(
        pts[["geometry"]],
        fz_bng[["geometry", zone_col]],
        how="left", predicate="within"
    )
    # Keep highest zone per crossing (3 > 2 > 1)
    zone_order = {"3": 3, "2": 2, "1": 1}
    joined["_zone_rank"] = joined[zone_col].astype(str).map(zone_order).fillna(0)
    best = joined.sort_values("_zone_rank", ascending=False)
    best = best[~best.index.duplicated(keep="first")]

    gdf = gdf.copy()
    gdf["flood_zone"] = best[zone_col].reindex(gdf.index).fillna("none").astype(str)

    counts = gdf["flood_zone"].value_counts()
    print(f"    FZ3: {counts.get('3', 0):,}  FZ2: {counts.get('2', 0):,}  FZ1: {counts.get('1', 0):,}  none: {counts.get('none', 0):,}")
    return gdf


# ── Schema builder ────────────────────────────────────────────────────────────

def build_schema(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Add all new fields to the GeoDataFrame, compute confidence scores,
    and return the enriched GeoDataFrame.

    Existing fields are preserved (not renamed or dropped) for web UI
    backwards-compatibility. New fields are added alongside.
    """
    today = date.today().isoformat()
    out   = gdf.copy()

    print("  Adding crossing_id ...")
    if "crossing_id" not in out.columns:
        lats = out.geometry.y.values
        lons = out.geometry.x.values
        out["crossing_id"] = [make_crossing_id(lat, lon) for lat, lon in zip(lats, lons)]

    print("  Parsing road name water signals ...")
    road_names = out.get("road_name", pd.Series([""] * len(out), index=out.index))
    results = [parse_road_name_water_signal(n) for n in road_names]
    out["road_name_water_signal"] = [r[0] for r in results]
    out["road_name_matched_term"] = [r[1] for r in results]

    print("  Adding s19_mentioned (alias for in_s19_area) ...")
    out["s19_mentioned"] = out.get("in_s19_area", pd.Series([False] * len(out))).fillna(False).astype(bool)

    print("  Adding upstream_catchment_km2 stub ...")
    # Stub: null until PySheds flow accumulation is run.
    # Fallowfield classification is deprioritised and not used as a proxy.
    if "upstream_catchment_km2" not in out.columns:
        out["upstream_catchment_km2"] = None

    print("  Adding os_open_rivers_match ...")
    out["os_open_rivers_match"] = True  # by definition: all crossings found via OS Rivers

    print("  Adding ea_main_river_excluded ...")
    # Reflects likely_ea_managed — always False until main river filter is wired up.
    # data/main_rivers/Statutory_Main_River_Map.gpkg exists and is ready to use.
    out["ea_main_river_excluded"] = out.get(
        "likely_ea_managed", pd.Series([False] * len(out))
    ).fillna(False).astype(bool)

    print("  Adding stub fields ...")
    if "flood_incidents_200m" not in out.columns:
        out["flood_incidents_200m"] = None     # int — null until Defra dataset loaded
    if "flood_zone" not in out.columns:
        out["flood_zone"] = "none"             # str — 'none' until EA FMfP loaded
    if "flow_accumulation_corroborated" not in out.columns:
        out["flow_accumulation_corroborated"] = False
    if "sensor_deployed" not in out.columns:
        out["sensor_deployed"] = False

    print("  Computing confidence scores ...")
    rows = out.to_dict(orient="records")
    scores_sources = [compute_confidence(r) for r in rows]
    out["confidence_score"] = [s for s, _ in scores_sources]
    out["confidence_tier"]  = [assign_tier(s, c) for s, c in scores_sources]

    out["last_updated"] = today

    return out


# ── Summary reporting ─────────────────────────────────────────────────────────

def print_summary(gdf: gpd.GeoDataFrame):
    print(f"\n{'─'*50}")
    print(f"  Total crossings: {len(gdf):,}")

    print(f"\n  Confidence tiers:")
    tiers = gdf["confidence_tier"].value_counts()
    for tier in ("confirmed", "probable", "candidate"):
        n = tiers.get(tier, 0)
        pct = 100 * n / len(gdf)
        bar = "█" * int(pct / 2)
        print(f"    {tier:12s} {n:6,}  ({pct:4.1f}%)  {bar}")

    scores = gdf["confidence_score"]
    print(f"\n  Score distribution:")
    print(f"    median   {scores.median():.0f}")
    print(f"    mean     {scores.mean():.1f}")
    print(f"    ≥ 70     {(scores >= 70).sum():,}   (confirmed threshold)")
    print(f"    40–69    {((scores >= 40) & (scores < 70)).sum():,}   (probable range)")
    print(f"    < 40     {(scores < 40).sum():,}   (candidate)")

    water_n = gdf["road_name_water_signal"].sum()
    print(f"\n  Road name water signal: {water_n:,} crossings")
    if water_n > 0:
        top_terms = gdf[gdf["road_name_water_signal"]]["road_name_matched_term"].value_counts().head(5)
        for term, count in top_terms.items():
            print(f"    '{term}': {count:,}")

    s19_n = gdf["s19_mentioned"].sum()
    print(f"\n  S19 override applied: {s19_n:,} crossings (floored at {S19_FLOOR})")

    print(f"\n  Active signals (out of 7 layers):")
    active = {
        "os_open_rivers_match":         gdf["os_open_rivers_match"].sum(),
        "flooded_before":               gdf.get("flooded_before", pd.Series([False]*len(gdf))).sum(),
        "flood_incidents_200m ≥ 1":     (gdf["flood_incidents_200m"].notna() & (gdf["flood_incidents_200m"] > 0)).sum(),
        "flood_zone 2/3":               gdf["flood_zone"].isin(["2", "3", "FZ2", "FZ3"]).sum(),
        "flow_accum_corroborated":      gdf["flow_accumulation_corroborated"].sum(),
        "road_name_water_signal":       gdf["road_name_water_signal"].sum(),
        "s19_mentioned":                gdf["s19_mentioned"].sum(),
    }
    for sig, n in active.items():
        stub = " [STUB]" if n == 0 and sig not in ("flood_incidents_200m ≥ 1", "flow_accum_corroborated") else ""
        print(f"    {sig:35s} {n:6,}{stub}")

    null_inc = gdf["flood_incidents_200m"].isna().sum()
    none_fz  = (gdf["flood_zone"] == "none").sum()
    stub_fa  = (~gdf["flow_accumulation_corroborated"]).sum()
    print(f"\n  Stub fields pending enrichment:")
    print(f"    flood_incidents_200m      {null_inc:,} null  → run enrich_flood_incidents()")
    print(f"    flood_zone                {none_fz:,} 'none' → run enrich_flood_zone()")
    print(f"    flow_accum_corroborated   {stub_fa:,} False  → run flow_accumulation.py")
    print(f"\n  Max possible score with all stubs populated: 100 pts")
    current_max = W_OS_RIVERS + W_FLOOD_OUTLINES + W_CATCHMENT_BONUS + W_ROAD_NAME
    print(f"  Max possible score with current data only:   {current_max} pts")
    print(f"{'─'*50}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Add confidence scoring fields to culvert_crossings.geojson"
    )
    parser.add_argument("--input",   default=str(DEFAULT_INPUT),
                        help="Input GeoJSON (default: output/culvert_crossings.geojson)")
    parser.add_argument("--output",  default=str(DEFAULT_OUTPUT),
                        help="Output GeoJSON (default: same as input — in-place update)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary without writing output")
    args = parser.parse_args()

    in_path  = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        print(f"ERROR: input file not found: {in_path}")
        raise SystemExit(1)

    print(f"Reading {in_path} ...")
    gdf = gpd.read_file(str(in_path))
    print(f"  {len(gdf):,} features, {len(gdf.columns)} fields")

    print(f"\nBuilding confidence schema ...")
    gdf = build_schema(gdf)

    print_summary(gdf)

    if args.dry_run:
        print("\nDry run — not writing output.")
        return

    print(f"\nWriting {out_path} ...")
    gdf.to_file(str(out_path), driver="GeoJSON")
    print(f"  Done — {len(gdf):,} features, {len(gdf.columns)} fields")


if __name__ == "__main__":
    main()
