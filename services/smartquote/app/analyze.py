"""
Smart Quote v1 — JSON wrapper around the POC STEP parser.

This runs exactly the same pipeline as poc_parsing.process_step_file(),
but returns a structured, JSON-safe result instead of printing to the
terminal. The detection logic in poc_parsing.py is used unchanged.
"""

import math
import os

import cadquery as cq

from . import poc_parsing as P

ANALYSIS_VERSION = "smartquote-v1"


# ------------------------------------------------------------------
# JSON sanitising
# ------------------------------------------------------------------

def _clean(value, depth=0):
    """Convert parser output (tuples, OCC-free dicts, floats) to JSON-safe data."""
    if depth > 12:
        return None
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return round(value, 6)
    if isinstance(value, dict):
        return {
            str(k): _clean(v, depth + 1)
            for k, v in value.items()
            # "source_features" repeats full hole records inside the
            # drilling operation; the holes are already listed in section 8.
            if k != "source_features"
        }
    if isinstance(value, (list, tuple, set)):
        return [_clean(v, depth + 1) for v in value]
    try:
        return _clean(float(value), depth + 1)
    except Exception:
        return str(value)


def _feature_json(feature):
    return _clean({
        "type": feature.get("type"),
        "body_id": feature.get("body_id"),
        "section": feature.get("section"),
        "confidence": feature.get("confidence"),
        "orientation": feature.get("orientation"),
        "faces": feature.get("faces", []),
        "axis": feature.get("axis"),
        "position": feature.get("position"),
        "details": feature.get("details", {}),
        "accessibility": feature.get("accessibility"),
    })


SECTION_TITLES = {
    8: "Holes & hole variants",
    9: "Pockets",
    10: "Slots / keyways",
    11: "Bosses",
    12: "Steps / fillets / chamfers",
    13: "Turning features",
    14: "Thin walls / floors / undercuts",
    15: "Freeform / pocket islands",
    16: "Cross / radial / angled features",
}


# ------------------------------------------------------------------
# Main entry point
# ------------------------------------------------------------------

def analyze_step(step_file, include_faces=False):
    """Run the full v1 pipeline on one STEP file and return a dict."""
    model = P.load_step_file(step_file)
    solids = P.extract_solids(model)

    section_1 = P.build_section_1_report(step_file, model, solids)
    primitive_faces = P.extract_all_primitive_geometry(solids)

    coordinate_system = P.build_local_coordinate_system(primitive_faces)
    body_coordinate_systems = P.build_body_coordinate_systems(
        solids, primitive_faces, fallback_system=coordinate_system
    )
    alignment = P.calculate_axis_alignment(coordinate_system)
    basic_geometry = P._aggregate_multi_solid_geometry(solids)

    local_boxes = [
        P.calculate_local_bounding_box(solid, coordinate_system)
        for solid in solids
    ]
    local_bbox = {
        k: (min if k.endswith("min") else max)(b[k] for b in local_boxes)
        for k in ("xmin", "xmax", "ymin", "ymax", "zmin", "zmax")
    }
    for axis in "xyz":
        local_bbox[f"{axis}_length"] = local_bbox[f"{axis}max"] - local_bbox[f"{axis}min"]

    # Sections 6-7, per body (same as process_step_file).
    cylindrical_features, planar_features = [], []
    for body_id, solid in enumerate(solids, start=1):
        body_faces = [f for f in primitive_faces if f.get("solid_id") == body_id]
        cs = body_coordinate_systems[body_id]
        topology = P.build_topology_for_solid(solid)

        cylinders = P.classify_cylindrical_groups(
            P.group_cylindrical_faces(body_faces, cs), cs
        )
        for f in cylinders:
            f["body_id"] = body_id
        cylindrical_features.extend(cylinders)

        planes = P.identify_planar_relationships(
            P.classify_planar_faces(body_faces, cs), topology
        )
        for f in planes:
            f["body_id"] = body_id
        planar_features.extend(planes)

    # Sections 8-16 + turning analysis.
    section_features, relationships, turning_analyses = P.run_remaining_poc_features(
        primitive_faces, solids, body_coordinate_systems,
        fallback_coordinate_system=coordinate_system,
    )

    counts = P.primitive_geometry_summary(primitive_faces)
    unit = section_1["length_unit"]

    warnings = []
    if unit.get("symbol") not in (None, "mm"):
        warnings.append(
            f"STEP declares units of {unit.get('name')}; all values below are in "
            "the file's own units, labelled mm."
        )
    if unit.get("status") != "DETECTED":
        warnings.append("Length unit not found in the STEP file; millimetres assumed.")
    for body in section_1["bodies"]:
        if body["validity"].get("is_valid") is False:
            warnings.append(f"Body {body['body_id']} failed the B-Rep validity check.")
        if any(s.get("closed") is False for s in body["shells"]):
            warnings.append(f"Body {body['body_id']} has an open shell (not watertight).")

    turning = []
    for a in turning_analyses:
        ops = []
        for o in a.get("operation_sequence", []):
            d = o.get("details") or {}
            idx = o.get("feature_index")
            if not d and idx is not None and idx < len(a["features"]):
                d = a["features"][idx].get("details", {})
            ops.append({
                "feature": o.get("feature"),
                "tool_family": o.get("tool_family"),
                "path": o.get("path"),
                "machinability": d.get("machinability", "MACHINABLE"),
                "machinability_reason": d.get("machinability_reason"),
                "quantity": d.get("quantity"),
                "diameter_mm": d.get("diameter_mm"),
                "depth_mm": d.get("depth_mm"),
            })
        fully = all(str(o["machinability"]).startswith("MACHINABLE") for o in ops)
        turning.append({
            "body_id": a["body_id"],
            "axis_definition": a["axis_definition"],
            "coordinate_validation": a["coordinate_validation"],
            "stock": a["stock"],
            "footprint": a["footprint"],
            "finished_surface_area_mm2": a["finished_surface_area_mm2"],
            "operations": ops,
            "overall_machinability": (
                "MACHINABLE WITH CURRENT PLANNED CAPABILITIES" if fully
                else "NOT FULLY MACHINABLE WITH CURRENT PLAN"
            ),
            "toolpath_preview": a.get("toolpath_preview", []),
        })

    result = {
        "analysis_version": ANALYSIS_VERSION,
        "file_name": os.path.basename(step_file),
        "units": unit,
        "warnings": warnings,
        "summary": {
            "solid_count": len(solids),
            "global_bbox": basic_geometry["bounding_box"],
            "local_bbox": local_bbox,
            "volume_mm3": basic_geometry["volume"],
            "surface_area_mm2": basic_geometry["surface_area"],
            "center_of_mass": basic_geometry["center_of_mass"],
            "face_type_counts": counts,
            "primary_axis": coordinate_system["local_z"],
        },
        "bodies": [
            {
                "body_id": b["body_id"],
                "topology_counts": b["topology_counts"],
                "shell_count": b["shell_count"],
                "valid": b["validity"].get("is_valid"),
                "geometry": b["geometry"],
                "axis": body_coordinate_systems[b["body_id"]]["local_z"],
            }
            for b in section_1["bodies"]
        ],
        "orientation": {
            "local_x": coordinate_system["local_x"],
            "local_y": coordinate_system["local_y"],
            "local_z": coordinate_system["local_z"],
            "alignment": alignment,
        },
        "cylindrical_groups": cylindrical_features,
        "planar_faces_count": len(planar_features),
        "feature_sections": [
            {
                "section": n,
                "title": SECTION_TITLES[n],
                "features": [_feature_json(f) for f in section_features[n]],
            }
            for n in range(8, 17)
        ],
        "relationships": [
            {
                "relation": rel,
                "parent": {"type": p.get("type"), "faces": p.get("faces", [])},
                "child": {"type": c.get("type"), "faces": c.get("faces", [])},
            }
            for p, c, rel in relationships
        ],
        "turning": turning,
    }
    result["feature_count"] = sum(len(s["features"]) for s in result["feature_sections"])

    if include_faces:
        result["faces"] = primitive_faces

    return _clean(result)
