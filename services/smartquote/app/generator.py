"""
2D Profile-First Turning B-Rep Generator & Closed-Loop STEP Verification.
Implements the canonical TurningDocument -> OpenCASCADE/CadQuery revolution pipeline.
"""

import base64
import math
import os
import tempfile
import cadquery as cq
from .thumbnail import render_thumbnail_png


def build_turned_solid_from_plan(plan: dict) -> dict:
    """
    Construct a watertight B-Rep solid from a canonical TurnedPartDocument JSON,
    verify STEP round-trip volume fidelity, and return base64 STEP + PNG thumbnail.
    """
    segments = plan.get("segments") or []
    if not segments:
        raise ValueError("At least one axial OD segment is required.")

    bore = plan.get("bore") or {}
    bore_enabled = bool(bore.get("enabled"))
    bore_dia = float(bore.get("diameter_mm") or 0.0)
    bore_through = bool(bore.get("is_through", True))
    bore_depth = float(bore.get("depth_mm") or 0.0)

    # Tier 3: Fast 2D X-R Crossover Validation
    total_length = 0.0
    for seg in segments:
        d = float(seg.get("diameter_mm") or 0.0)
        l = float(seg.get("length_mm") or 0.0)
        if d <= 0 or l <= 0:
            raise ValueError("All segment diameters and lengths must be positive.")
        if bore_enabled and bore_dia >= d:
            raise ValueError(
                f"OD/ID crossover: internal bore (Ø{bore_dia} mm) >= segment OD (Ø{d} mm)."
            )
        total_length += l

    # Tier 4: Build 3D Solid along Z-Spindle Axis
    solid_wp = None
    z_cursor = 0.0
    for idx, seg in enumerate(segments):
        radius = float(seg["diameter_mm"]) / 2.0
        length = float(seg["length_mm"])
        cyl = cq.Workplane("XY").workplane(offset=z_cursor).circle(radius).extrude(length)
        solid_wp = cyl if solid_wp is None else solid_wp.union(cyl)
        z_cursor += length

    if bore_enabled and bore_dia > 0:
        cut_depth = total_length if bore_through else min(total_length, bore_depth)
        solid_wp = solid_wp.faces(">Z").workplane().hole(bore_dia, cut_depth)

    shape = solid_wp.val()
    orig_volume = float(shape.Volume())
    orig_area = float(shape.Area())

    # Tier 7: Closed-Loop STEP Export & Round-Trip Verification
    with tempfile.TemporaryDirectory() as tmp:
        step_path = os.path.join(tmp, "generated_part.step")
        cq.exporters.export(solid_wp, step_path)

        reimported = cq.importers.importStep(step_path).val()
        re_volume = float(reimported.Volume())
        vol_delta = abs(orig_volume - re_volume) / max(1e-6, orig_volume)
        roundtrip_passed = vol_delta <= 1e-3

        with open(step_path, "rb") as fh:
            step_b64 = base64.b64encode(fh.read()).decode("ascii")

    try:
        thumb_b64 = render_thumbnail_png([shape], (0.0, 0.0, 1.0))
    except Exception:
        thumb_b64 = None

    return {
        "valid": True,
        "volume_mm3": round(orig_volume, 3),
        "surface_area_mm2": round(orig_area, 3),
        "total_length_mm": round(total_length, 3),
        "step_roundtrip_verified": roundtrip_passed,
        "volume_delta_ratio": round(vol_delta, 7),
        "step_base64": step_b64,
        "thumbnail_png_base64": thumb_b64,
    }

