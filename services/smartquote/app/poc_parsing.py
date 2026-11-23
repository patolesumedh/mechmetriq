import cadquery as cq
import math
import os
import re

from OCP.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.GeomAbs import (
    GeomAbs_Plane,
    GeomAbs_Cylinder,
    GeomAbs_Cone,
    GeomAbs_Sphere,
    GeomAbs_Torus,
    GeomAbs_BezierSurface,
    GeomAbs_BSplineSurface
)
from OCP.TopAbs import (
    TopAbs_FORWARD,
    TopAbs_REVERSED,
    TopAbs_INTERNAL,
    TopAbs_EXTERNAL
)


# ============================================================
# SETTINGS
# ============================================================

# Keep the project directory unchanged.
# The STEP file is expected beside this Python file.
STEP_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "lid.STEP"
)

DIAMETER_TOL = 0.01       # mm
AXIS_LOCATION_TOL = 0.05  # mm
AXIS_DIRECTION_TOL = 0.01
BOUNDARY_TOL = 0.15       # mm
GEOMETRY_TOL = 1e-9

# Freeform sampling is intentionally modest for the POC.
FREEFORM_U_SAMPLES = 5
FREEFORM_V_SAMPLES = 5


# ============================================================
# VECTOR / NUMERIC HELPERS
# ============================================================

# ============================================================
# INTERNAL POC CAPABILITY REGISTRY
# ============================================================
# Kept internal so the terminal output remains the existing
# feature-by-feature format. These are the capabilities the parser
# is expected to extract whenever the STEP geometry actually contains
# evidence for them.
POC_CAPABILITY_REGISTRY = {
    1: ("STEP / SOLID EXTRACTION",),
    2: ("PRIMITIVE GEOMETRY", "PLANE", "CYLINDER", "CONE", "SPHERE", "TORUS", "BSPLINE", "BEZIER"),
    3: ("TOPOLOGY", "FACE-EDGE-VERTEX", "ADJACENCY", "BOUNDARY LOOPS"),
    4: ("GLOBAL GEOMETRY", "BOUNDING BOX", "DIMENSIONS", "VOLUME", "SURFACE AREA", "CENTER OF MASS"),
    5: ("AXIS / ORIENTATION", "PRIMARY AXIS", "AXIS ALIGNMENT", "LOCAL COORDINATES", "ORIENTED BOUNDING BOX"),
    6: ("CYLINDRICAL FEATURES", "INTERNAL/EXTERNAL", "DIAMETER", "RADIUS", "AXIS", "AXIAL SPAN"),
    7: ("PLANAR FEATURES", "NORMAL", "ORIENTATION", "BOUNDARY", "ADJACENCY"),
    8: ("HOLES", "THROUGH", "BLIND", "BORE", "COUNTERBORE", "STEPPED HOLE", "COUNTERSINK", "THREAD CANDIDATE"),
    9: ("POCKETS", "CIRCULAR", "RECTANGULAR", "IRREGULAR", "OPEN/CLOSED", "MULTI-LEVEL"),
    10: ("SLOTS / KEYWAYS", "SLOT", "KEYWAY", "ROUND-ENDED CANDIDATE"),
    11: ("BOSSES", "CIRCULAR", "RECTANGULAR/IRREGULAR"),
    12: ("STEPS / FILLETS / CHAMFERS", "PLANAR STEP", "FILLET", "CHAMFER"),
    13: ("TURNING", "OD", "ID", "FACE", "SHOULDER", "GROOVE", "TAPER", "PARTING"),
    14: ("THIN / UNDERCUT", "THIN WALL", "THIN FLOOR", "UNDERCUT"),
    15: ("FREEFORM / ISLANDS", "FREEFORM FINISH REGION", "POCKET ISLAND"),
    16: ("CROSS / RADIAL / ANGLED", "CROSS HOLE", "ANGLED HOLE"),
}


def normalize(v):
    mag = math.sqrt(
        v[0] ** 2 +
        v[1] ** 2 +
        v[2] ** 2
    )

    if mag < GEOMETRY_TOL:
        return (0.0, 0.0, 0.0)

    return (
        v[0] / mag,
        v[1] / mag,
        v[2] / mag
    )


def dot(a, b):
    return (
        a[0] * b[0] +
        a[1] * b[1] +
        a[2] * b[2]
    )


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    )


def vector_length(v):
    return math.sqrt(
        v[0] ** 2 +
        v[1] ** 2 +
        v[2] ** 2
    )


def subtract(a, b):
    return (
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    )


def multiply(v, scalar):
    return (
        v[0] * scalar,
        v[1] * scalar,
        v[2] * scalar
    )


def point_to_tuple(point):
    if hasattr(point, "X") and callable(point.X):
        return (
            point.X(),
            point.Y(),
            point.Z()
        )

    return (
        point.x,
        point.y,
        point.z
    )


def direction_to_tuple(direction):
    return (
        direction.X(),
        direction.Y(),
        direction.Z()
    )


def vector_from_gp(vector):
    return (
        vector.X(),
        vector.Y(),
        vector.Z()
    )


def angle_degrees(a, b):
    a = normalize(a)
    b = normalize(b)

    if vector_length(a) < GEOMETRY_TOL:
        return 0.0

    if vector_length(b) < GEOMETRY_TOL:
        return 0.0

    value = max(
        -1.0,
        min(
            1.0,
            dot(a, b)
        )
    )

    return math.degrees(
        math.acos(value)
    )


def safe_float(value):
    try:
        value = float(value)
        if math.isfinite(value):
            return value
    except Exception:
        pass

    return None


def round_value(value, digits=9):
    value = safe_float(value)

    if value is None:
        return None

    return round(value, digits)


# ============================================================
# STEP UNIT DETECTION
# ============================================================

def detect_step_length_unit(step_file):
    """
    Read the STEP text header/data for the declared length unit.

    This is kept independent of the B-Rep geometry because STEP unit
    entities are stored in the STEP representation itself.
    """

    result = {
        "name": "UNKNOWN",
        "symbol": None,
        "source": "STEP_UNIT_ENTITY",
        "status": "NOT_DETECTED"
    }

    try:
        with open(
            step_file,
            "r",
            encoding="utf-8",
            errors="ignore"
        ) as file:

            content = file.read()

    except Exception as e:

        result["status"] = "READ_ERROR"
        result["error"] = str(e)

        return result

    # SI length unit, e.g.:
    # SI_UNIT ( .MILLI., .METRE. )
    match = re.search(
        r"SI_UNIT\s*\(\s*\.([A-Z]+)\.\s*,\s*\.METRE\.\s*\)",
        content,
        flags=re.IGNORECASE
    )

    if match:

        prefix = match.group(1).upper()

        prefix_map = {
            "MILLI": ("millimetre", "mm"),
            "CENTI": ("centimetre", "cm"),
            "DECI": ("decimetre", "dm"),
            "KILO": ("kilometre", "km"),
            "MICRO": ("micrometre", "um"),
            "NANO": ("nanometre", "nm"),
            "NONE": ("metre", "m")
        }

        if prefix in prefix_map:

            name, symbol = prefix_map[prefix]

            result.update({
                "name": name,
                "symbol": symbol,
                "status": "DETECTED"
            })

            return result

    # Some STEP files use conversion-based units.
    conversion_match = re.search(
        r"CONVERSION_BASED_UNIT\s*\([^;]*?'([^']+)'",
        content,
        flags=re.IGNORECASE | re.DOTALL
    )

    if conversion_match:

        name = conversion_match.group(1).strip()

        result.update({
            "name": name,
            "status": "DETECTED"
        })

        return result

    return result


# ============================================================
# SECTION 1 - STEP / SOLID EXTRACTION
# ============================================================

def load_step_file(step_file):
    if not os.path.isfile(step_file):

        raise FileNotFoundError(
            f"STEP file not found: {step_file}"
        )

    try:

        model = cq.importers.importStep(
            step_file
        )

    except Exception as e:

        raise RuntimeError(
            f"STEP file could not be loaded: {e}"
        )

    return model


def extract_solids(model):
    solids = model.solids().vals()

    if not solids:

        raise ValueError(
            "No solid body found in STEP file."
        )

    return solids


def get_face_orientation(face):
    orientation = face.wrapped.Orientation()

    if orientation == TopAbs_FORWARD:
        return "FORWARD"

    if orientation == TopAbs_REVERSED:
        return "REVERSED"

    if orientation == TopAbs_INTERNAL:
        return "INTERNAL"

    if orientation == TopAbs_EXTERNAL:
        return "EXTERNAL"

    return "UNKNOWN"


def get_solid_validity(solid):
    """
    Validate the B-Rep using OpenCascade's BRepCheck_Analyzer.
    """

    try:

        analyzer = BRepCheck_Analyzer(
            solid.wrapped
        )

        return {
            "is_valid": bool(
                analyzer.IsValid()
            ),
            "status": "CHECKED"
        }

    except Exception as e:

        return {
            "is_valid": None,
            "status": "CHECK_ERROR",
            "error": str(e)
        }


def get_shell_information(solid):
    """
    Extract shell count and closed/open state.
    """

    shells = solid.Shells()

    shell_data = []

    for index, shell in enumerate(
        shells,
        start=1
    ):

        try:
            is_closed = bool(
                shell.Closed()
            )

        except Exception:

            is_closed = None

        shell_data.append({
            "shell_id": index,
            "closed": is_closed,
            "face_count": len(
                shell.Faces()
            )
        })

    return shell_data


def get_solid_geometry_summary(solid):
    bb = solid.BoundingBox()

    center_of_mass = None

    try:

        props = GProp_GProps()

        BRepGProp.VolumeProperties_s(
            solid.wrapped,
            props
        )

        center = props.CentreOfMass()

        center_of_mass = point_to_tuple(
            center
        )

    except Exception:
        pass

    return {
        "bounding_box": {
            "xmin": bb.xmin,
            "xmax": bb.xmax,
            "ymin": bb.ymin,
            "ymax": bb.ymax,
            "zmin": bb.zmin,
            "zmax": bb.zmax,
            "x_length": bb.xlen,
            "y_length": bb.ylen,
            "z_length": bb.zlen
        },
        "volume_mm3": solid.Volume(),
        "surface_area_mm2": solid.Area(),
        "center_of_mass": center_of_mass
    }


def build_section_1_report(
    step_file,
    model,
    solids
):
    """
    Complete Section 1:
    STEP loading, solids/bodies, topology counts,
    shell status, validity, units and global geometry.
    """

    report = {
        "step_file": os.path.abspath(
            step_file
        ),
        "step_loaded": True,
        "solid_count": len(solids),
        "length_unit": detect_step_length_unit(
            step_file
        ),
        "bodies": []
    }

    for index, solid in enumerate(
        solids,
        start=1
    ):

        topology = {
            "faces": len(
                solid.Faces()
            ),
            "edges": len(
                solid.Edges()
            ),
            "vertices": len(
                solid.Vertices()
            )
        }

        validity = get_solid_validity(
            solid
        )

        shells = get_shell_information(
            solid
        )

        report["bodies"].append({
            "body_id": index,
            "solid_index": index,
            "topology_counts": topology,
            "shell_count": len(shells),
            "shells": shells,
            "validity": validity,
            "geometry": get_solid_geometry_summary(
                solid
            )
        })

    return report


# ============================================================
# SECTION 2 - PRIMITIVE GEOMETRY
# ============================================================

def get_surface_type(adaptor):
    surface_type = adaptor.GetType()

    if surface_type == GeomAbs_Plane:
        return "PLANE"

    if surface_type == GeomAbs_Cylinder:
        return "CYLINDER"

    if surface_type == GeomAbs_Cone:
        return "CONE"

    if surface_type == GeomAbs_Sphere:
        return "SPHERE"

    if surface_type == GeomAbs_Torus:
        return "TORUS"

    if surface_type == GeomAbs_BezierSurface:
        return "BEZIER"

    if surface_type == GeomAbs_BSplineSurface:
        return "BSPLINE"

    return "OTHER"


def get_face_center(face):
    return point_to_tuple(
        face.Center()
    )


def get_face_normal(face):
    """
    Representative outward B-Rep normal at the face center.
    """

    try:

        center = face.Center()

        normal = face.normalAt(
            center
        )

        return normalize((
            normal.x,
            normal.y,
            normal.z
        ))

    except Exception:
        # [service fix] A full 360-degree cylinder/cone has its area
        # centroid ON the axis, so projecting it onto the surface fails.
        # Fall back to the face's parametric mid-point.
        sample = _surface_sample(face)
        return sample[1] if sample else None


def _surface_sample(face):
    """[service fix] (point, normal) at the face's UV mid-point.

    Used only when the centroid-based evaluation is invalid, i.e. for
    seam-closed (full 360-degree) cylinders and cones as exported by
    Onshape, Fusion, FreeCAD, OCC and others. Orientation-aware.
    """
    try:
        u0, u1, v0, v1 = face._uvBounds()
        normal, point = face.normalAt(0.5 * (u0 + u1), 0.5 * (v0 + v1))
        return (
            (point.x, point.y, point.z),
            normalize((normal.x, normal.y, normal.z))
        )
    except Exception:
        return None


def _radial_probe_point(face, axis_origin, axis_dir):
    """[service fix] A point on the face that is NOT on the axis.

    Returns the centroid when it is usable (split cylinders, as before);
    otherwise the UV mid-point of the surface.
    """
    point = point_to_tuple(face.Center())
    rel = subtract(point, axis_origin)
    radial = subtract(rel, multiply(axis_dir, dot(rel, axis_dir)))
    if vector_length(radial) > 1e-6:
        return point
    sample = _surface_sample(face)
    return sample[0] if sample else point


def get_parameter_ranges(adaptor):
    values = {
        "u_min": adaptor.FirstUParameter(),
        "u_max": adaptor.LastUParameter(),
        "v_min": adaptor.FirstVParameter(),
        "v_max": adaptor.LastVParameter()
    }

    return values


def extract_plane_info(
    face,
    adaptor
):
    plane = adaptor.Plane()

    axis = plane.Axis()

    normal = canonical_direction(
        direction_to_tuple(
            axis.Direction()
        )
    )

    location = point_to_tuple(
        axis.Location()
    )

    return {
        "normal": normal,
        "location": location,
        "orientation": get_face_orientation(
            face
        )
    }


def canonical_direction(direction):
    """
    +axis and -axis represent the same infinite axis.
    """

    d = normalize(direction)

    if (
        d[2] < 0
        or (
            abs(d[2]) < 1e-9
            and d[1] < 0
        )
        or (
            abs(d[2]) < 1e-9
            and abs(d[1]) < 1e-9
            and d[0] < 0
        )
    ):

        d = (
            -d[0],
            -d[1],
            -d[2]
        )

    return d


def closest_point_on_axis_to_origin(
    location,
    direction
):
    d = normalize(direction)

    projection = dot(
        location,
        d
    )

    return subtract(
        location,
        multiply(
            d,
            projection
        )
    )


def extract_cylinder_info(
    face,
    adaptor
):
    cylinder = adaptor.Cylinder()

    radius = cylinder.Radius()
    diameter = 2.0 * radius

    axis = cylinder.Axis()

    direction = canonical_direction(
        direction_to_tuple(
            axis.Direction()
        )
    )

    location = point_to_tuple(
        axis.Location()
    )

    axis_position = (
        closest_point_on_axis_to_origin(
            location,
            direction
        )
    )

    v_min = adaptor.FirstVParameter()
    v_max = adaptor.LastVParameter()

    axial_start = min(
        v_min,
        v_max
    )

    axial_end = max(
        v_min,
        v_max
    )

    return {
        "radius": radius,
        "diameter": diameter,
        "axis_direction": direction,
        "axis_location": location,
        "axis_position": axis_position,
        "v_min": v_min,
        "v_max": v_max,
        "axial_start": axial_start,
        "axial_end": axial_end,
        "axial_length": abs(
            v_max - v_min
        )
    }


def classify_cylinder_face(
    face,
    cylinder_info
):
    """
    Classify a cylindrical face as internal/external by
    comparing the B-Rep normal with the radial direction.
    """

    try:

        axis_origin = cylinder_info[
            "axis_position"
        ]

        axis_dir = cylinder_info[
            "axis_direction"
        ]

        point = _radial_probe_point(
            face, axis_origin, axis_dir
        )

        axis_to_point = subtract(
            point,
            axis_origin
        )

        axial_component = multiply(
            axis_dir,
            dot(
                axis_to_point,
                axis_dir
            )
        )

        radial = normalize(
            subtract(
                axis_to_point,
                axial_component
            )
        )

        normal = get_face_normal(
            face
        )

        if normal is None:
            return "UNKNOWN", None

        orientation_value = dot(
            normal,
            radial
        )

        if orientation_value > 0.20:
            return (
                "EXTERNAL",
                orientation_value
            )

        if orientation_value < -0.20:
            return (
                "INTERNAL",
                orientation_value
            )

        return (
            "UNCERTAIN",
            orientation_value
        )

    except Exception:

        return "UNKNOWN", None


def extract_cone_info(
    face,
    adaptor
):
    cone = adaptor.Cone()

    axis = cone.Axis()

    direction = canonical_direction(
        direction_to_tuple(
            axis.Direction()
        )
    )

    location = point_to_tuple(
        axis.Location()
    )

    semi_angle = cone.SemiAngle()
    reference_radius = cone.RefRadius()

    v_min = adaptor.FirstVParameter()
    v_max = adaptor.LastVParameter()

    radius_min = abs(
        reference_radius +
        v_min * math.sin(semi_angle)
    )

    radius_max = abs(
        reference_radius +
        v_max * math.sin(semi_angle)
    )

    axial_span = abs(
        (v_max - v_min) *
        math.cos(semi_angle)
    )

    # Classify the conical surface from its representative normal.
    # This is intentionally conservative: a cone without a reliable
    # radial normal is left UNKNOWN rather than guessed.
    internal_external = "UNKNOWN"
    orientation_score = None

    try:
        axis_position = closest_point_on_axis_to_origin(
            location,
            direction
        )

        point = _radial_probe_point(face, axis_position, direction)

        axis_to_point = subtract(
            point,
            axis_position
        )

        axial_component = multiply(
            direction,
            dot(axis_to_point, direction)
        )

        radial = normalize(
            subtract(
                axis_to_point,
                axial_component
            )
        )

        normal = get_face_normal(face)

        if normal is not None and vector_length(radial) > GEOMETRY_TOL:
            orientation_score = dot(normal, radial)

            if orientation_score > 0.20:
                internal_external = "EXTERNAL"
            elif orientation_score < -0.20:
                internal_external = "INTERNAL"
            else:
                internal_external = "UNCERTAIN"

    except Exception:
        pass

    return {
        "axis_direction": direction,
        "axis_location": location,
        "axis_position": closest_point_on_axis_to_origin(
            location,
            direction
        ),
        "semi_angle_radians": abs(semi_angle),
        "semi_angle_degrees": abs(
            math.degrees(semi_angle)
        ),
        # Compatibility aliases used by Section 13.
        "semi_angle_deg": abs(
            math.degrees(semi_angle)
        ),
        "taper_direction": (
            "DECREASING_RADIUS"
            if radius_max < radius_min
            else "INCREASING_RADIUS"
            if radius_max > radius_min
            else "CONSTANT_RADIUS"
        ),
        "reference_radius": reference_radius,
        "start_radius": radius_min,
        "end_radius": radius_max,
        "start_diameter": 2.0 * radius_min,
        "end_diameter": 2.0 * radius_max,
        "v_min": v_min,
        "v_max": v_max,
        "axial_span": axial_span,
        "axial_length": axial_span,
        "internal_external": internal_external,
        "orientation_score": orientation_score
    }

def extract_sphere_info(
    adaptor
):
    sphere = adaptor.Sphere()

    return {
        "center": point_to_tuple(
            sphere.Location()
        ),
        "radius": sphere.Radius(),
        "diameter": 2.0 * sphere.Radius()
    }


def extract_torus_info(
    adaptor
):
    torus = adaptor.Torus()

    axis = torus.Axis()

    return {
        "axis_direction": canonical_direction(
            direction_to_tuple(
                axis.Direction()
            )
        ),
        "axis_location": point_to_tuple(
            axis.Location()
        ),
        "major_radius": torus.MajorRadius(),
        "minor_radius": torus.MinorRadius(),
        "major_diameter": 2.0 * torus.MajorRadius(),
        "minor_diameter": 2.0 * torus.MinorRadius()
    }


def sample_parameter_values(
    minimum,
    maximum,
    count
):
    if not math.isfinite(minimum):
        return []

    if not math.isfinite(maximum):
        return []

    if maximum <= minimum:
        return [
            minimum
        ]

    if count < 2:
        return [
            (minimum + maximum) / 2.0
        ]

    # Avoid exact singular boundaries when possible.
    margin = 0.02 * (
        maximum - minimum
    )

    start = minimum + margin
    end = maximum - margin

    if start >= end:
        start = minimum
        end = maximum

    step = (
        end - start
    ) / (count - 1)

    return [
        start + i * step
        for i in range(count)
    ]


def get_surface_normal_and_curvature(
    adaptor,
    u,
    v
):
    """
    Compute a surface normal and approximate principal curvatures
    from first/second parametric derivatives.

    Returns:
        normal, k1, k2
    """

    from OCP.gp import gp_Pnt, gp_Vec

    point = gp_Pnt()
    du = gp_Vec()
    dv = gp_Vec()

    adaptor.D1(
        u,
        v,
        point,
        du,
        dv
    )

    du_vec = vector_from_gp(
        du
    )

    dv_vec = vector_from_gp(
        dv
    )

    normal_raw = cross(
        du_vec,
        dv_vec
    )

    normal = normalize(
        normal_raw
    )

    if vector_length(normal) < GEOMETRY_TOL:
        return None, None, None

    duu = adaptor.DN(
        u,
        v,
        2,
        0
    )

    duv = adaptor.DN(
        u,
        v,
        1,
        1
    )

    dvv = adaptor.DN(
        u,
        v,
        0,
        2
    )

    duu_vec = vector_from_gp(
        duu
    )

    duv_vec = vector_from_gp(
        duv
    )

    dvv_vec = vector_from_gp(
        dvv
    )

    # First fundamental form.
    E = dot(
        du_vec,
        du_vec
    )

    F = dot(
        du_vec,
        dv_vec
    )

    G = dot(
        dv_vec,
        dv_vec
    )

    denominator = (
        E * G - F * F
    )

    if abs(denominator) < GEOMETRY_TOL:
        return normal, None, None

    # Second fundamental form.
    e = dot(
        normal,
        duu_vec
    )

    f = dot(
        normal,
        duv_vec
    )

    g = dot(
        normal,
        dvv_vec
    )

    # Shape operator = I^-1 * II.
    s11 = (
        G * e - F * f
    ) / denominator

    s12 = (
        G * f - F * g
    ) / denominator

    s21 = (
        E * f - F * e
    ) / denominator

    s22 = (
        E * g - F * f
    ) / denominator

    trace = s11 + s22
    determinant = (
        s11 * s22 -
        s12 * s21
    )

    discriminant = (
        trace * trace -
        4.0 * determinant
    )

    if discriminant < 0:
        discriminant = 0.0

    root = math.sqrt(
        discriminant
    )

    k1 = (
        trace + root
    ) / 2.0

    k2 = (
        trace - root
    ) / 2.0

    return normal, k1, k2


def analyze_freeform_surface(
    adaptor,
    surface_type
):
    """
    Analyze BSpline/Bezier surfaces using bounded parametric sampling.

    The result reports normal variation and curvature variation.
    """

    u_min = adaptor.FirstUParameter()
    u_max = adaptor.LastUParameter()
    v_min = adaptor.FirstVParameter()
    v_max = adaptor.LastVParameter()

    u_values = sample_parameter_values(
        u_min,
        u_max,
        FREEFORM_U_SAMPLES
    )

    v_values = sample_parameter_values(
        v_min,
        v_max,
        FREEFORM_V_SAMPLES
    )

    normals = []
    curvature_values = []

    for u in u_values:

        for v in v_values:

            try:

                normal, k1, k2 = (
                    get_surface_normal_and_curvature(
                        adaptor,
                        u,
                        v
                    )
                )

                if normal is not None:

                    normals.append(
                        normal
                    )

                if (
                    k1 is not None
                    and k2 is not None
                ):

                    curvature_values.extend([
                        abs(k1),
                        abs(k2)
                    ])

            except Exception:
                continue

    normal_variation = 0.0

    if len(normals) >= 2:

        reference = normals[0]

        normal_variation = max(
            angle_degrees(
                reference,
                normal
            )
            for normal in normals
        )

    curvature_range = None
    curvature_min = None
    curvature_max = None

    if curvature_values:

        curvature_min = min(
            curvature_values
        )

        curvature_max = max(
            curvature_values
        )

        curvature_range = (
            curvature_max -
            curvature_min
        )

    return {
        "surface_family": surface_type,
        "u_min": u_min,
        "u_max": u_max,
        "v_min": v_min,
        "v_max": v_max,
        "sample_count": len(normals),
        "normal_variation_degrees": (
            normal_variation
        ),
        "curvature_min": curvature_min,
        "curvature_max": curvature_max,
        "curvature_range": curvature_range,
        "analysis_status": (
            "COMPLETED"
            if normals
            else "NO_VALID_SAMPLES"
        )
    }


def extract_primitive_face(
    face,
    face_number,
    solid_id
):
    """
    Complete Section 2 dispatcher.

    Every face is classified into exactly one primitive family.
    """

    adaptor = BRepAdaptor_Surface(
        face.wrapped
    )

    surface_type = get_surface_type(
        adaptor
    )

    face_data = {
        "face_id": face_number,
        "solid_id": solid_id,
        "surface_type": surface_type,
        "area": face.Area(),
        "center": get_face_center(
            face
        ),
        "normal": get_face_normal(
            face
        ),
        "face_orientation": get_face_orientation(
            face
        ),
        "parameter_range": get_parameter_ranges(
            adaptor
        ),
        "status": "SUPPORTED",
        "geometry": {}
    }

    try:

        if surface_type == "PLANE":

            face_data["geometry"] = (
                extract_plane_info(
                    face,
                    adaptor
                )
            )

        elif surface_type == "CYLINDER":

            cylinder = (
                extract_cylinder_info(
                    face,
                    adaptor
                )
            )

            classification, score = (
                classify_cylinder_face(
                    face,
                    {
                        "axis_position":
                            cylinder[
                                "axis_position"
                            ],
                        "axis_direction":
                            cylinder[
                                "axis_direction"
                            ]
                    }
                )
            )

            cylinder[
                "internal_external"
            ] = classification

            cylinder[
                "orientation_score"
            ] = score

            face_data[
                "geometry"
            ] = cylinder

        elif surface_type == "CONE":

            face_data[
                "geometry"
            ] = extract_cone_info(
                face,
                adaptor
            )

        elif surface_type == "SPHERE":

            face_data[
                "geometry"
            ] = extract_sphere_info(
                adaptor
            )

        elif surface_type == "TORUS":

            face_data[
                "geometry"
            ] = extract_torus_info(
                adaptor
            )

        elif surface_type in (
            "BSPLINE",
            "BEZIER"
        ):

            face_data[
                "geometry"
            ] = analyze_freeform_surface(
                adaptor,
                surface_type
            )

        else:

            face_data[
                "status"
            ] = "UNSUPPORTED_OR_UNCERTAIN"

            face_data[
                "geometry"
            ] = {
                "surface_type": surface_type
            }

    except Exception as e:

        face_data[
            "status"
        ] = "UNSUPPORTED_OR_UNCERTAIN"

        face_data[
            "error"
        ] = str(e)

    return face_data


def extract_all_primitive_geometry(
    solids
):
    """
    Classify every face of every solid.
    """

    all_faces = []

    for solid_id, solid in enumerate(
        solids,
        start=1
    ):

        for face_id, face in enumerate(
            solid.Faces(),
            start=1
        ):

            all_faces.append(
                extract_primitive_face(
                    face,
                    face_id,
                    solid_id
                )
            )

    return all_faces


def primitive_geometry_summary(
    faces
):
    counts = {
        "PLANE": 0,
        "CYLINDER": 0,
        "CONE": 0,
        "SPHERE": 0,
        "TORUS": 0,
        "BSPLINE": 0,
        "BEZIER": 0,
        "OTHER": 0
    }

    for face in faces:

        surface_type = face[
            "surface_type"
        ]

        if surface_type in counts:

            counts[
                surface_type
            ] += 1

        else:

            counts["OTHER"] += 1

    return counts


# ============================================================
# CONSOLE REPORTING
# ============================================================

def print_section_1_report(section_1):
    """Compact model/body summary; detection data is unchanged."""
    print("\n================ MODEL / BODY SUMMARY ================")
    print(f"STEP: {section_1['step_file']}")
    print(f"Loaded: {section_1['step_loaded']} | Solids/Bodies: {section_1['solid_count']}")
    unit = section_1["length_unit"]
    print(f"Units: {unit['name']}" + (f" ({unit['symbol']})" if unit['symbol'] else ""))
    for body in section_1["bodies"]:
        t = body["topology_counts"]
        g = body["geometry"]
        bb = g["bounding_box"]
        validity = body["validity"]
        shell_states = ",".join(
            "CLOSED" if s["closed"] else "OPEN" if s["closed"] is False else "UNKNOWN"
            for s in body["shells"]
        )
        print(
            f"Body {body['body_id']}: "
            f"Faces={t['faces']} | Edges={t['edges']} | Vertices={t['vertices']} | "
            f"Shells={body['shell_count']} [{shell_states}] | Valid={validity['is_valid']} | "
            f"BBox={bb['x_length']:.3f}x{bb['y_length']:.3f}x{bb['z_length']:.3f} mm | "
            f"Vol={g['volume_mm3']:.3f} mm³ | Area={g['surface_area_mm2']:.3f} mm²"
        )

def print_section_2_report(faces):
    """Compact primitive summary while retaining face-level detection."""
    counts = primitive_geometry_summary(faces)
    order = ("PLANE", "CYLINDER", "CONE", "SPHERE", "TORUS", "BSPLINE", "BEZIER", "OTHER")
    print("\n================ PRIMITIVE GEOMETRY ================")
    print("Counts: " + " | ".join(f"{k}={counts[k]}" for k in order))
    print("Face details:")
    for face in faces:
        b = face.get("solid_id", 1)
        g = face.get("geometry", {})
        line = f"B{b} F{face['face_id']}: {face['surface_type']} | A={face['area']:.3f} mm²"
        if face["surface_type"] == "CYLINDER":
            line += f" | Ø={g.get('diameter', 0):.3f} | Axial={g.get('axial_length', 0):.3f} | {g.get('internal_external', 'UNKNOWN')}"
        elif face["surface_type"] == "CONE":
            line += f" | R={g.get('start_radius', 0):.3f}->{g.get('end_radius', 0):.3f} | Axial={g.get('axial_span', 0):.3f}"
        elif face["surface_type"] == "SPHERE":
            line += f" | R={g.get('radius', 0):.3f}"
        elif face["surface_type"] == "TORUS":
            line += f" | R={g.get('major_radius', 0):.3f}/{g.get('minor_radius', 0):.3f}"
        print(line)

def shape_hash(shape):
    return hash(shape)


def get_orientation_name(shape):
    try:
        orientation = shape.Orientation()
        if orientation == TopAbs_FORWARD:
            return "FORWARD"
        if orientation == TopAbs_REVERSED:
            return "REVERSED"
    except Exception:
        pass
    return "UNKNOWN"


def get_edge_geometry_type(edge):
    try:
        adaptor = BRepAdaptor_Curve(edge.wrapped)
        curve_type = int(adaptor.GetType())
        names = {
            0: "LINE",
            1: "CIRCLE",
            2: "ELLIPSE",
            3: "HYPERBOLA",
            4: "PARABOLA",
            5: "BEZIER",
            6: "BSPLINE",
            7: "OFFSET"
        }
        return names.get(curve_type, "OTHER")
    except Exception:
        return "OTHER"


def get_edge_length(edge):
    try:
        return edge.Length()
    except Exception:
        return None


def build_topology_for_solid(solid):
    """
    Build:
        Face -> Edge
        Face -> Vertex
        Edge -> Face
        Edge -> Vertex
        Vertex -> Edge
        Vertex -> Face
        Face -> adjacent Face
        Face -> boundary loops
    """

    faces = solid.Faces()
    edges = solid.Edges()
    vertices = solid.Vertices()

    edge_lookup = {}
    vertex_lookup = {}

    def edge_id(edge):
        key = shape_hash(edge.wrapped)
        if key not in edge_lookup:
            edge_lookup[key] = len(edge_lookup) + 1
        return edge_lookup[key]

    def vertex_id(vertex):
        key = shape_hash(vertex.wrapped)
        if key not in vertex_lookup:
            vertex_lookup[key] = len(vertex_lookup) + 1
        return vertex_lookup[key]

    edge_records = {}
    vertex_records = {}
    face_records = {}

    for edge in edges:
        eid = edge_id(edge)
        vids = [vertex_id(v) for v in edge.Vertices()]
        edge_records[eid] = {
            "edge_id": eid,
            "geometry_type": get_edge_geometry_type(edge),
            "length": get_edge_length(edge),
            "orientation": get_orientation_name(edge.wrapped),
            "vertex_ids": vids,
            "face_ids": []
        }

    for vertex in vertices:
        vid = vertex_id(vertex)
        p = vertex.toTuple()
        vertex_records[vid] = {
            "vertex_id": vid,
            "coordinates": (p[0], p[1], p[2]),
            "edge_ids": [],
            "face_ids": []
        }

    for fid, face in enumerate(faces, start=1):

        f_edges = []
        f_vertices = []

        for edge in face.Edges():
            eid = edge_id(edge)

            if eid not in f_edges:
                f_edges.append(eid)

            if fid not in edge_records[eid]["face_ids"]:
                edge_records[eid]["face_ids"].append(fid)

            for vertex in edge.Vertices():
                vid = vertex_id(vertex)

                if vid not in f_vertices:
                    f_vertices.append(vid)

                if fid not in vertex_records[vid]["face_ids"]:
                    vertex_records[vid]["face_ids"].append(fid)

                if eid not in vertex_records[vid]["edge_ids"]:
                    vertex_records[vid]["edge_ids"].append(eid)

        loops = []

        try:
            for lid, wire in enumerate(
                face.Wires(),
                start=1
            ):
                loop_edges = [
                    edge_id(edge)
                    for edge in wire.Edges()
                ]

                loops.append({
                    "loop_id": lid,
                    "edge_ids": loop_edges,
                    "edge_count": len(loop_edges)
                })

        except Exception:
            loops = []

        face_records[fid] = {
            "face_id": fid,
            "surface_type": face.geomType(),
            "orientation": get_orientation_name(face.wrapped),
            "edge_ids": f_edges,
            "vertex_ids": f_vertices,
            "boundary_loops": loops,
            "boundary_loop_count": len(loops),
            "adjacent_face_ids": []
        }

    # Faces sharing the same edge are adjacent.
    for edge_data in edge_records.values():

        connected_faces = sorted(
            set(edge_data["face_ids"])
        )

        for fid in connected_faces:

            for other in connected_faces:

                if other != fid:
                    face_records[
                        fid
                    ][
                        "adjacent_face_ids"
                    ].append(other)

    for record in face_records.values():

        record[
            "adjacent_face_ids"
        ] = sorted(
            set(
                record[
                    "adjacent_face_ids"
                ]
            )
        )

    return {
        "face_records": face_records,
        "edge_records": edge_records,
        "vertex_records": vertex_records
    }


def print_topology_report(topology):
    """Compact topology report: preserve counts without printing every relation."""
    faces = topology["face_records"]
    edges = topology["edge_records"]
    vertices = topology["vertex_records"]
    print("\n================ TOPOLOGY SUMMARY ================")
    print(f"Faces={len(faces)} | Edges={len(edges)} | Vertices={len(vertices)}")
    surface_counts = {}
    for face in faces.values():
        key = face.get("surface_type", "OTHER")
        surface_counts[key] = surface_counts.get(key, 0) + 1
    print("Face types: " + " | ".join(f"{k}={v}" for k, v in sorted(surface_counts.items())))

# ============================================================
# SECTION 4
# BASIC / GLOBAL GEOMETRY
# ============================================================

def calculate_basic_geometry(
    solid,
    solid_count,
    body_count,
    coordinate_system=None
):

    bb = solid.BoundingBox()
    com = cq.Shape.centerOfMass(solid)

    result = {
        "solid_count": solid_count,
        "body_count": body_count,

        "bounding_box": {
            "xmin": bb.xmin,
            "xmax": bb.xmax,
            "ymin": bb.ymin,
            "ymax": bb.ymax,
            "zmin": bb.zmin,
            "zmax": bb.zmax,
            "x_length": bb.xlen,
            "y_length": bb.ylen,
            "z_length": bb.zlen
        },

        "volume": solid.Volume(),

        "surface_area": solid.Area(),

        "center_of_mass": (
            com.x,
            com.y,
            com.z
        )
    }

    if coordinate_system is not None:

        result[
            "local_bounding_box"
        ] = calculate_local_bounding_box(
            solid,
            coordinate_system
        )

        result[
            "local_center_of_mass"
        ] = global_to_local_point(
            (
                com.x,
                com.y,
                com.z
            ),
            (
                0.0,
                0.0,
                0.0
            ),
            coordinate_system
        )

    return result


def print_basic_geometry_report(geometry):
    bb = geometry["bounding_box"]
    print("\n================ SECTION 4: GLOBAL GEOMETRY ================")
    print(f"Solids={geometry['solid_count']} | Bodies={geometry['body_count']} | "
          f"BBox={bb['x_length']:.3f}x{bb['y_length']:.3f}x{bb['z_length']:.3f} mm | "
          f"Volume={geometry['volume']:.3f} mm³ | Surface area={geometry['surface_area']:.3f} mm²")
    if geometry.get("center_of_mass") is not None:
        print(f"Center of mass={tuple(round(x,4) for x in geometry['center_of_mass'])}")
    if geometry.get("local_bounding_box") is not None:
        lb = geometry["local_bounding_box"]
        print(f"Local BBox={lb['x_length']:.3f}x{lb['y_length']:.3f}x{lb['z_length']:.3f} mm | "
              f"Local COM={tuple(round(x,4) for x in geometry.get('local_center_of_mass', (0,0,0)))}")

# ============================================================
# SECTION 5
# AXIS & ORIENTATION ANALYSIS
# ============================================================

def axis_angle_degrees(a, b):
    """
    Smallest angle between two normalized directions.
    Treats parallel and anti-parallel directions as the same axis.
    """

    a = normalize(a)
    b = normalize(b)

    value = abs(dot(a, b))
    value = max(-1.0, min(1.0, value))

    return math.degrees(
        math.acos(value)
    )


def choose_dominant_axis_from_cylinders(
    primitive_faces
):
    """
    Determine the dominant model/machining axis from cylindrical
    primitive faces.

    Cylindrical faces are weighted by their area so the main
    cylindrical surfaces have more influence than tiny holes.
    """

    candidates = []

    for face in primitive_faces:

        if face[
            "surface_type"
        ] != "CYLINDER":
            continue

        geometry = face[
            "geometry"
        ]

        direction = geometry[
            "axis_direction"
        ]

        weight = max(
            face["area"],
            GEOMETRY_TOL
        )

        candidates.append(
            (
                direction,
                weight
            )
        )

    if not candidates:
        # Fallback for parts without cylindrical faces:
        # use the largest planar face normal as the primary datum.
        plane_candidates = []

        for face in primitive_faces:

            if face["surface_type"] != "PLANE":
                continue

            normal = face["normal"]

            if normal is None:
                continue

            plane_candidates.append(
                (
                    normalize(normal),
                    max(face["area"], GEOMETRY_TOL)
                )
            )

        if not plane_candidates:
            return None

        plane_candidates.sort(
            key=lambda item: item[1],
            reverse=True
        )

        return plane_candidates[0][0]

    groups = []

    for direction, weight in candidates:

        placed = False

        for group in groups:

            reference = group[
                "direction"
            ]

            if axis_angle_degrees(
                direction,
                reference
            ) <= 1.0:

                group[
                    "weighted_directions"
                ].append(
                    (
                        direction,
                        weight
                    )
                )

                group[
                    "weight"
                ] += weight

                placed = True
                break

        if not placed:

            groups.append({
                "direction": direction,
                "weight": weight,
                "weighted_directions": [
                    (
                        direction,
                        weight
                    )
                ]
            })

    groups.sort(
        key=lambda x: x["weight"],
        reverse=True
    )

    selected = groups[0]

    weighted = selected[
        "weighted_directions"
    ]

    result = (
        0.0,
        0.0,
        0.0
    )

    for direction, weight in weighted:

        # All directions in a group describe the same
        # undirected axis. Align their signs first.
        if dot(
            direction,
            selected["direction"]
        ) < 0:

            direction = (
                -direction[0],
                -direction[1],
                -direction[2]
            )

        result = (
            result[0] + direction[0] * weight,
            result[1] + direction[1] * weight,
            result[2] + direction[2] * weight
        )

    return normalize(result)


def choose_local_x_axis(
    primary_axis,
    primitive_faces
):
    """
    Select a stable local X direction perpendicular to the
    primary machining axis.

    Preference:
        1. A plane normal perpendicular to primary axis.
        2. A global axis projected onto the plane normal to Z.

    This avoids assuming that global Z is the model axis.
    """

    best = None
    best_score = -1.0

    for face in primitive_faces:

        if face[
            "surface_type"
        ] != "PLANE":

            continue

        normal = face.get(
            "normal"
        )

        if normal is None:
            continue

        perpendicularity = (
            1.0
            - abs(
                dot(
                    normalize(normal),
                    primary_axis
                )
            )
        )

        if perpendicularity > best_score:

            best_score = perpendicularity
            best = normal

    if best is not None:

        # Project candidate normal onto the plane
        # perpendicular to primary axis.
        projected = subtract(
            best,
            multiply(
                primary_axis,
                dot(
                    best,
                    primary_axis
                )
            )
        )

        projected = normalize(
            projected
        )

        if vector_length(
            projected
        ) > GEOMETRY_TOL:

            return projected

    # Fallback: project global X.
    global_x = (
        1.0,
        0.0,
        0.0
    )

    projected = subtract(
        global_x,
        multiply(
            primary_axis,
            dot(
                global_x,
                primary_axis
            )
        )
    )

    if vector_length(
        projected
    ) > GEOMETRY_TOL:

        return normalize(
            projected
        )

    # Final fallback: project global Y.
    global_y = (
        0.0,
        1.0,
        0.0
    )

    projected = subtract(
        global_y,
        multiply(
            primary_axis,
            dot(
                global_y,
                primary_axis
            )
        )
    )

    return normalize(
        projected
    )


def build_local_coordinate_system(
    primitive_faces
):
    """
    Build a right-handed model coordinate system:

        Local Z = dominant machining axis
        Local X = stable perpendicular reference
        Local Y = Z cross X

    The resulting basis is orthonormal.
    """

    local_z = (
        choose_dominant_axis_from_cylinders(
            primitive_faces
        )
    )

    if local_z is None:
        raise ValueError(
            "Could not determine a primary model axis."
        )

    local_x = choose_local_x_axis(
        local_z,
        primitive_faces
    )

    local_y = normalize(
        cross(
            local_z,
            local_x
        )
    )

    # Re-orthogonalize X to remove accumulated numerical error.
    local_x = normalize(
        cross(
            local_y,
            local_z
        )
    )

    # Make the basis deterministic.
    # Prefer local X to point generally in +global X.
    if dot(
        local_x,
        (1.0, 0.0, 0.0)
    ) < 0:

        local_x = (
            -local_x[0],
            -local_x[1],
            -local_x[2]
        )

        local_y = (
            -local_y[0],
            -local_y[1],
            -local_y[2]
        )

    # Recompute Y to preserve a right-handed frame.
    local_y = normalize(
        cross(
            local_z,
            local_x
        )
    )

    return {
        "local_x": local_x,
        "local_y": local_y,
        "local_z": local_z
    }


def _choose_body_axis_reference(faces, local_z, solid=None):
    """Return a point known to lie on the detected spindle axis.

    The previous implementation implicitly treated the global origin as an
    axis point. That is not mathematically valid unless the STEP spindle axis
    actually passes through (0, 0, 0). Prefer the OCC cylinder axis location
    from the largest coaxial cylinder instead.
    """
    candidates = []
    for face in faces:
        if face.get("surface_type") != "CYLINDER":
            continue
        geom = face.get("geometry", {})
        axis = geom.get("axis_direction")
        point = geom.get("axis_location")
        diameter = geom.get("diameter")
        if axis is None or point is None or diameter is None:
            continue
        if axis_is_parallel(axis, local_z, TURNING_AXIS_TOL_DEG):
            candidates.append((float(diameter), tuple(point)))
    if candidates:
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]
    if solid is not None:
        c = cq.Shape.centerOfMass(solid)
        return (c.x, c.y, c.z)
    return (0.0, 0.0, 0.0)


def build_body_coordinate_systems(solids, primitive_faces, fallback_system=None):
    """Build an independent machining frame and axis reference for every solid."""
    systems = {}
    for body_id, solid in enumerate(solids, start=1):
        faces = [f for f in primitive_faces if f.get("solid_id") == body_id]
        try:
            system = build_local_coordinate_system(faces)
            system["axis_point_global"] = _choose_body_axis_reference(
                faces, system["local_z"], solid
            )
            systems[body_id] = system
        except Exception:
            if fallback_system is None:
                raise
            # Copy the fallback so one body's metadata cannot mutate another.
            systems[body_id] = dict(fallback_system)
            systems[body_id]["axis_point_global"] = _choose_body_axis_reference(
                faces, systems[body_id]["local_z"], solid
            )
    return systems


def global_to_local_vector(
    vector,
    coordinate_system
):
    """
    Transform a direction/vector from global coordinates
    into the model coordinate system.
    """

    x = coordinate_system[
        "local_x"
    ]

    y = coordinate_system[
        "local_y"
    ]

    z = coordinate_system[
        "local_z"
    ]

    return (
        dot(vector, x),
        dot(vector, y),
        dot(vector, z)
    )


def global_to_local_point(
    point,
    origin,
    coordinate_system
):
    """
    Transform a global point into local coordinates.

    The origin is currently chosen as the global origin unless
    a feature-based datum is available. A later feature section
    can define a manufacturing datum.
    """

    relative = subtract(
        point,
        origin
    )

    return global_to_local_vector(
        relative,
        coordinate_system
    )


def calculate_axis_alignment(
    coordinate_system
):
    """
    Calculate each local axis' angle to the global axes.
    """

    global_x = (
        1.0,
        0.0,
        0.0
    )

    global_y = (
        0.0,
        1.0,
        0.0
    )

    global_z = (
        0.0,
        0.0,
        1.0
    )

    result = {}

    for name, axis in (
        (
            "local_x",
            coordinate_system[
                "local_x"
            ]
        ),
        (
            "local_y",
            coordinate_system[
                "local_y"
            ]
        ),
        (
            "local_z",
            coordinate_system[
                "local_z"
            ]
        )
    ):

        result[name] = {
            "angle_to_global_x":
                axis_angle_degrees(
                    axis,
                    global_x
                ),

            "angle_to_global_y":
                axis_angle_degrees(
                    axis,
                    global_y
                ),

            "angle_to_global_z":
                axis_angle_degrees(
                    axis,
                    global_z
                )
        }

    return result


def calculate_local_bounding_box(
    solid,
    coordinate_system
):
    """
    Calculate an oriented bounding box by projecting a tessellated
    representation into the model coordinate system.

    Using only B-Rep vertices is not sufficient for circular/
    cylindrical geometry because the true extrema can occur
    between B-Rep vertices. Tessellation captures those extrema
    much more reliably for this POC.
    """

    # CadQuery tessellation can update the source shape's cached
    # bounding box. Work on a copy so the exact global B-Rep
    # measurements remain unchanged for Section 4.
    mesh_source = solid.copy()

    try:
        tessellation = mesh_source.tessellate(
            tolerance=0.05
        )

        mesh_vertices = tessellation[0]

    except Exception:
        mesh_vertices = []

    # Fallback if tessellation is unavailable.
    if not mesh_vertices:
        mesh_vertices = [
            vertex.toTuple()
            for vertex in solid.Vertices()
        ]

    points = []

    for point in mesh_vertices:

        if hasattr(point, "toTuple"):
            point = point.toTuple()

        global_point = (
            point[0],
            point[1],
            point[2]
        )

        local_point = global_to_local_point(
            global_point,
            (
                0.0,
                0.0,
                0.0
            ),
            coordinate_system
        )

        points.append(
            local_point
        )

    if not points:
        raise ValueError(
            "No geometry points available for local bounding box."
        )

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]

    return {
        "xmin": min(xs),
        "xmax": max(xs),
        "ymin": min(ys),
        "ymax": max(ys),
        "zmin": min(zs),
        "zmax": max(zs),

        "x_length":
            max(xs) - min(xs),

        "y_length":
            max(ys) - min(ys),

        "z_length":
            max(zs) - min(zs)
    }


def print_axis_orientation_report(coordinate_system, alignment, local_bbox):
    print("\n================ SECTION 5: AXIS / ORIENTATION ================")
    print("Local basis: " + " | ".join(
        f"{name.upper()}={tuple(round(x,4) for x in coordinate_system[name])}"
        for name in ("local_x", "local_y", "local_z")
    ))
    x, y, z = coordinate_system["local_x"], coordinate_system["local_y"], coordinate_system["local_z"]
    print(f"Orthogonality: XY={dot(x,y):.2e} | XZ={dot(x,z):.2e} | YZ={dot(y,z):.2e}")
    print("Global alignment (deg): " + " | ".join(
        f"{name.upper()}=({alignment[name]['angle_to_global_x']:.2f},{alignment[name]['angle_to_global_y']:.2f},{alignment[name]['angle_to_global_z']:.2f})"
        for name in ("local_x", "local_y", "local_z")
    ))
    print(f"Local ranges: X={local_bbox['xmin']:.3f}..{local_bbox['xmax']:.3f} | "
          f"Y={local_bbox['ymin']:.3f}..{local_bbox['ymax']:.3f} | "
          f"Z={local_bbox['zmin']:.3f}..{local_bbox['zmax']:.3f} mm")

# ============================================================
# SECTION 6
# CYLINDRICAL FEATURE RECOGNITION
# ============================================================

def axis_is_parallel(
    axis_a,
    axis_b,
    tolerance_degrees=1.0
):
    if axis_a is None or axis_b is None:
        return False

    return (
        axis_angle_degrees(
            axis_a,
            axis_b
        )
        <= tolerance_degrees
    )


def group_cylindrical_faces(
    primitive_faces,
    coordinate_system
):
    """
    Group cylindrical faces by coaxial direction and diameter.

    The grouping is deliberately conservative:
    - same/parallel axis direction
    - similar diameter
    - similar axis location

    A B-Rep cylindrical surface is not automatically treated as
    one machining feature. Feature semantics are assigned only
    after topology/depth evidence is available.
    """

    groups = []

    for face in primitive_faces:

        if face[
            "surface_type"
        ] != "CYLINDER":

            continue

        geometry = face[
            "geometry"
        ]

        radius = geometry.get(
            "radius"
        )

        diameter = geometry.get(
            "diameter"
        )

        axis = geometry.get(
            "axis_direction"
        )

        axis_location = geometry.get(
            "axis_position",
            geometry.get("axis_location")
        )

        if radius is None or axis is None:
            continue

        placed = False

        for group in groups:

            reference_axis = group[
                "axis_direction"
            ]

            reference_diameter = group[
                "diameter"
            ]

            reference_location = group[
                "axis_location"
            ]

            diameter_tolerance = max(
                1e-5,
                abs(reference_diameter) * 1e-5
            )

            location_tolerance = max(
                1e-4,
                abs(
                    reference_diameter
                ) * 1e-4
            )

            same_axis = axis_is_parallel(
                axis,
                reference_axis,
                tolerance_degrees=1.0
            )

            same_diameter = (
                abs(
                    diameter
                    - reference_diameter
                )
                <= diameter_tolerance
            )

            same_location = True

            if (
                axis_location is not None
                and reference_location is not None
            ):

                location_delta = (
                    (
                        axis_location[0]
                        - reference_location[0]
                    ),
                    (
                        axis_location[1]
                        - reference_location[1]
                    ),
                    (
                        axis_location[2]
                        - reference_location[2]
                    )
                )

                same_location = (
                    vector_length(
                        location_delta
                    )
                    <= location_tolerance
                )

            if (
                same_axis
                and same_diameter
                and same_location
            ):

                group[
                    "face_ids"
                ].append(
                    face["face_id"]
                )

                group[
                    "areas"
                ].append(
                    face["area"]
                )

                group[
                    "axial_spans"
                ].append(
                    geometry.get(
                        "axial_length",
                        geometry.get("axial_span")
                    )
                )

                placed = True
                break

        if not placed:

            groups.append({
                "group_id":
                    len(groups) + 1,

                "face_ids": [
                    face["face_id"]
                ],

                "diameter":
                    diameter,

                "radius":
                    radius,

                "axis_direction":
                    axis,

                "axis_location":
                    axis_location,

                "internal_external":
                    geometry.get(
                        "internal_external"
                    ),

                "areas": [
                    face["area"]
                ],

                "axial_spans": [
                    geometry.get(
                        "axial_length",
                        geometry.get("axial_span")
                    )
                ]
            })

    return groups


def classify_cylindrical_groups(
    groups,
    coordinate_system
):
    """
    Assign a conservative cylindrical-family label.

    INTERNAL:
        Candidate bore/internal cylindrical feature.

    EXTERNAL:
        Candidate OD/external cylindrical feature.

    The result intentionally uses 'candidate' because a cylinder
    alone cannot distinguish all CNC feature families.
    """

    results = []

    for group in groups:

        axis = group[
            "axis_direction"
        ]

        local_axis = (
            global_to_local_vector(
                axis,
                coordinate_system
            )
        )

        internal_external = group[
            "internal_external"
        ]

        if internal_external == "INTERNAL":

            family = (
                "INTERNAL_CYLINDER_CANDIDATE"
            )

        elif internal_external == "EXTERNAL":

            family = (
                "EXTERNAL_CYLINDER_CANDIDATE"
            )

        else:

            family = (
                "CYLINDER_CANDIDATE"
            )

        spans = [
            value
            for value in group[
                "axial_spans"
            ]
            if value is not None
        ]

        results.append({
            "group_id":
                group["group_id"],

            "feature_family":
                family,

            "face_ids":
                group["face_ids"],

            "diameter":
                group["diameter"],

            "radius":
                group["radius"],

            "axis_global":
                group["axis_direction"],

            "axis_local":
                local_axis,

            "axis_location":
                group["axis_location"],

            "axial_span":
                max(spans)
                if spans
                else None,

            "internal_external":
                internal_external,

            "face_count":
                len(
                    group["face_ids"]
                )
        })

    return results


def print_cylindrical_feature_report(features):
    print("\n================ SECTION 6: CYLINDRICAL FEATURES ================")
    print(f"Candidate groups: {len(features)}")
    for f in features:
        d = "UNKNOWN" if f["diameter"] is None else f"Ø{f['diameter']:.3f}"
        span = "UNKNOWN" if f["axial_span"] is None else f"L={f['axial_span']:.3f}"
        print(f"B{f.get('body_id',1)} G{f['group_id']}: {f['feature_family']} | {d} | {span} | "
              f"Faces={f['face_ids']} | {f['internal_external']} | AxisLocal={tuple(round(x,3) for x in f['axis_local'])}")

def classify_planar_faces(
    primitive_faces,
    coordinate_system
):
    """
    Classify individual planar faces using their normals and
    area. This is the first planar-feature layer.

    It deliberately does not yet claim a pocket/step/facing
    feature without topology/depth evidence.
    """

    results = []

    local_z = coordinate_system[
        "local_z"
    ]

    for face in primitive_faces:

        if face[
            "surface_type"
        ] != "PLANE":

            continue

        normal = face[
            "normal"
        ]

        if normal is None:
            continue

        local_normal = (
            global_to_local_vector(
                normal,
                coordinate_system
            )
        )

        z_alignment = axis_angle_degrees(
            normal,
            local_z
        )

        if z_alignment <= 1.0:

            orientation_class = (
                "PERPENDICULAR_TO_LOCAL_Z"
            )

        elif abs(
            z_alignment - 90.0
        ) <= 1.0:

            orientation_class = (
                "PARALLEL_TO_LOCAL_Z"
            )

        else:

            orientation_class = (
                "ANGLED_TO_LOCAL_Z"
            )

        results.append({
            "face_id":
                face["face_id"],

            "area":
                face["area"],

            "center":
                face["center"],

            "normal_global":
                normal,

            "normal_local":
                local_normal,

            "orientation":
                face.get("face_orientation", face.get("orientation", "UNKNOWN")),

            "orientation_class":
                orientation_class
        })

    return results


def identify_planar_relationships(
    planar_faces,
    topology
):
    """
    Connect planar faces to their B-Rep neighbors.

    This creates the evidence needed later for:
        - facing surfaces
        - shoulders/steps
        - pocket floors
        - hole bottoms
    """

    face_records = topology[
        "face_records"
    ]

    results = []

    for face in planar_faces:

        fid = face[
            "face_id"
        ]

        topo = face_records.get(
            fid,
            {}
        )

        results.append({
            **face,

            "edge_ids":
                topo.get(
                    "edge_ids",
                    []
                ),

            "adjacent_face_ids":
                topo.get(
                    "adjacent_face_ids",
                    []
                ),

            "boundary_loop_count":
                topo.get(
                    "boundary_loop_count",
                    0
                )
        })

    return results


def print_planar_feature_report(features):
    print("\n================ SECTION 7: PLANAR FEATURES ================")
    print(f"Planar faces: {len(features)}")
    for f in features:
        print(f"F{f['face_id']}: A={f['area']:.3f} mm² | {f['orientation_class']} | "
              f"Loops={f['boundary_loop_count']} | Adj={f['adjacent_face_ids']} | Edges={f['edge_ids']}")

def select_step_files():
    from tkinter import Tk, filedialog  # desktop-only; imported lazily so the API container needs no GUI
    """
    Open the Windows file picker and allow one or more STEP/STP files.
    The picker is intentionally kept outside the parser logic so all
    existing analysis functions continue to operate on explicit paths.
    """
    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    try:
        selected = filedialog.askopenfilenames(
            title="Select STEP/STP file(s)",
            filetypes=[
                ("STEP files", "*.step *.stp *.STEP *.STP"),
                ("All files", "*.*"),
            ],
        )
    finally:
        root.destroy()

    return list(selected)


# ============================================================
# MAIN
# ============================================================


# ============================================================
# SECTIONS 8-16 - REMAINING POC FEATURE RECOGNITION
# ============================================================
# IMPORTANT:
# Sections 1-7 above are intentionally retained. The functions
# below only consume their existing geometry/topology results.
# No JSON output is produced.
# ============================================================

FEATURE_ANGLE_TOL = 5.0
FEATURE_DISTANCE_TOL = 0.20
FEATURE_DIAMETER_TOL = 0.01
THIN_WALL_TOL = 2.0


def _face_map(solids):
    result = {}
    for solid_index, solid in enumerate(solids, start=1):
        for face_id, face in enumerate(solid.Faces(), start=1):
            result[(solid_index, face_id)] = face
    return result


def _primitive_map(primitive_faces):
    """Map faces by local face id within the supplied body.

    Recognizers in Sections 8-16 receive one body at a time, so the
    local face_id is safe here. The solid_id is retained on each record
    for reporting and downstream relationship checks.
    """
    return {f["face_id"]: f for f in primitive_faces}


def _topology_face(topology, face_id):
    return topology["face_records"].get(face_id, {})


def _distance(a, b):
    return vector_length(subtract(a, b))


def _parallel(a, b, tol=1.0):
    return axis_angle_degrees(a, b) <= tol


def _feature_orientation(axis, coordinate_system):
    if axis is None:
        return "UNKNOWN"
    local = global_to_local_vector(axis, coordinate_system)
    x, y, z = abs(local[0]), abs(local[1]), abs(local[2])
    limit = math.cos(math.radians(FEATURE_ANGLE_TOL))
    if z >= limit:
        return "AXIAL"
    if x >= limit or y >= limit:
        return "RADIAL"
    return "ANGLED"


def _new_feature(feature_type, details, faces=None, axis=None, position=None,
                 confidence=None, parent=None, section=None):
    return {
        "type": feature_type,
        "details": details,
        "faces": list(faces or []),
        "axis": axis,
        "position": position,
        "confidence": confidence,
        "parent": parent,
        "section": section,
    }


def _cylinder_face_ids_by_group(cylinders):
    return [c["face_ids"] for c in cylinders]


def _group_cap_evidence(cylinder, primitive_by_id, topology):
    """Find planar caps whose area is close to the cylinder opening area."""
    radius = cylinder["radius"]
    opening_area = math.pi * radius * radius
    caps = []
    adjacent_planes = []

    for fid in cylinder["face_ids"]:
        record = _topology_face(topology, fid)
        for aid in record.get("adjacent_face_ids", []):
            other = primitive_by_id.get(aid)
            if not other or other["surface_type"] != "PLANE":
                continue
            if aid in adjacent_planes:
                continue
            adjacent_planes.append(aid)
            area = other["area"]
            ratio = area / max(opening_area, 1e-9)

            # A true blind-hole bottom is bounded by the internal
            # cylinder and normally has no adjacent external cylinder.
            # An annular outside face around a bore can have a similar
            # area, so exclude it when it is also adjacent to an external
            # cylindrical wall.
            other_rec = _topology_face(topology, aid)
            has_external_cylinder = False
            for neighbor_id in other_rec.get("adjacent_face_ids", []):
                neighbor = primitive_by_id.get(neighbor_id)
                if not neighbor or neighbor["surface_type"] != "CYLINDER":
                    continue
                if neighbor.get("geometry", {}).get("internal_external") == "EXTERNAL":
                    has_external_cylinder = True
                    break

            if 0.55 <= ratio <= 1.8 and not has_external_cylinder:
                caps.append(aid)

    return caps, adjacent_planes


def recognize_holes_and_variants(cylinders, primitive_faces, topology,
                                  coordinate_system, solids):
    """Section 8: holes, variants and thread candidates."""
    primitive = _primitive_map(primitive_faces)
    results = []
    internal = [c for c in cylinders if c.get("internal_external") == "INTERNAL"]

    for c in internal:
        caps, adjacent_planes = _group_cap_evidence(c, primitive, topology)
        orientation = _feature_orientation(c["axis_global"], coordinate_system)
        diameter = c["diameter"]
        depth = c.get("axial_span")

        # A small planar cap approximately equal to pi*r^2 is strong
        # evidence for a blind hole bottom. A large internal cylinder
        # without such a cap is treated as a bore candidate.
        largest_external = max(
            [x["diameter"] for x in cylinders if x.get("internal_external") == "EXTERNAL"],
            default=diameter
        )

        # Large internal cylindrical regions are treated as bores even
        # when their terminating face is a flat bottom. The small-hole
        # case is classified as a blind hole when a real cap is present.
        if diameter >= 0.50 * largest_external:
            feature_type = "BORE"
            confidence = 0.90
        elif caps:
            feature_type = "BLIND_HOLE"
            confidence = 0.90
        else:
            feature_type = "THROUGH_HOLE"
            confidence = 0.76

        results.append(_new_feature(
            feature_type,
            {
                "diameter_mm": diameter,
                "depth_mm": depth,
                "openings": max(0, len(adjacent_planes) - len(caps)),
                "axis_orientation": orientation,
                "internal_external": "INTERNAL",
            },
            faces=c["face_ids"],
            axis=c["axis_global"],
            position=c["axis_location"],
            confidence=confidence,
            section=8,
        ))

        # Explicit thread candidate only; no pitch is invented.
        # Thread candidate is only reported when the cylinder boundary
        # contains non-circular edge geometry. Pure analytic cylinders
        # with circular boundaries are not enough to infer threads.
        non_circular_edges = False
        for fid in c["face_ids"]:
            frec = _topology_face(topology, fid)
            for eid in frec.get("edge_ids", []):
                et = topology["edge_records"].get(eid, {}).get("geometry_type")
                if et not in (None, "CIRCLE", "LINE"):
                    non_circular_edges = True
                    break
            if non_circular_edges:
                break

        if (
            non_circular_edges
            and depth is not None
            and depth >= max(1.0, diameter * 0.5)
        ):
            results.append(_new_feature(
                "THREAD_REGION_CANDIDATE",
                {
                    "major_diameter_mm": None,
                    "minor_diameter_mm": None,
                    "pitch": None,
                    "pitch_status": "NOT_INFERRED",
                    "length_mm": depth,
                },
                faces=c["face_ids"], axis=c["axis_global"],
                position=c["axis_location"], confidence=0.45, section=8,
            ))

    # Coaxial adjacent internal cylinders of different diameter.
    for i, a in enumerate(internal):
        for b in internal[i + 1:]:
            if not _parallel(a["axis_global"], b["axis_global"], 1.0):
                continue
            if a["axis_location"] is None or b["axis_location"] is None:
                continue
            if _distance(a["axis_location"], b["axis_location"]) > FEATURE_DISTANCE_TOL:
                continue
            if abs(a["diameter"] - b["diameter"]) <= FEATURE_DIAMETER_TOL:
                continue

            large, small = (a, b) if a["diameter"] > b["diameter"] else (b, a)
            la, lb = large.get("axial_span"), small.get("axial_span")
            relation = "COUNTERBORE" if la is not None and lb is not None and la < lb else "STEPPED_HOLE"
            results.append(_new_feature(
                relation,
                {
                    "large_diameter_mm": large["diameter"],
                    "small_diameter_mm": small["diameter"],
                    "large_depth_mm": la,
                    "small_depth_mm": lb,
                    "axis_orientation": _feature_orientation(large["axis_global"], coordinate_system),
                },
                faces=large["face_ids"] + small["face_ids"],
                axis=large["axis_global"], position=large["axis_location"],
                confidence=0.86, section=8,
            ))

    # Coaxial cone + internal cylinder => countersink candidate.
    cones = [f for f in primitive_faces if f["surface_type"] == "CONE"]
    for c in internal:
        for cone in cones:
            cg = cone.get("geometry", {})
            ca = cg.get("axis_direction")
            if ca is None or not _parallel(c["axis_global"], ca, 1.0):
                continue
            if cone["center"] is not None and c["axis_location"] is not None:
                if _distance(cone["center"], c["axis_location"]) > max(2.0, c["diameter"]):
                    continue
            results.append(_new_feature(
                "COUNTERSINK",
                {
                    "diameter_mm": c["diameter"],
                    "cone_angle_deg": cg.get("semi_angle_deg"),
                    "depth_mm": c.get("axial_span"),
                },
                faces=c["face_ids"] + [cone["face_id"]],
                axis=c["axis_global"], position=c["axis_location"],
                confidence=0.84, section=8,
            ))

    return results


def recognize_pockets(primitive_faces, topology, coordinate_system):
    """Section 9: conservative pocket recognition from floor/wall topology."""
    primitive = _primitive_map(primitive_faces)
    results = []

    for face in primitive_faces:
        if face["surface_type"] != "PLANE":
            continue
        rec = _topology_face(topology, face["face_id"])
        adjacent_ids = rec.get("adjacent_face_ids", [])
        adjacent = [primitive.get(i) for i in adjacent_ids]
        adjacent = [x for x in adjacent if x]
        walls = [x for x in adjacent if x["surface_type"] in ("CYLINDER", "PLANE", "CONE")]
        cyl_walls = [x for x in walls if x["surface_type"] == "CYLINDER"]
        if len(cyl_walls) < 2 or len(adjacent_ids) < 2:
            continue

        # A pocket floor is an enclosed/inner planar region. An outer
        # end face with one boundary loop is not treated as a pocket.
        if rec.get("boundary_loop_count", 0) < 2:
            continue

        # A pocket floor must be materially larger than a small hole cap.
        # This prevents the tiny planar bottoms of the lid's small holes
        # from being misclassified as pockets.
        if face["area"] < 25.0:
            continue

        # A circular floor surrounded by coaxial cylindrical walls is
        # the strongest pocket signal available in the current POC.
        axes = [x.get("geometry", {}).get("axis_direction") for x in cyl_walls]
        axes = [x for x in axes if x is not None]
        if len(axes) >= 2 and all(_parallel(axes[0], a, 1.0) for a in axes[1:]):
            ptype = "CIRCULAR_POCKET"
            confidence = 0.88
        else:
            ptype = "CLOSED_POCKET_CANDIDATE"
            confidence = 0.62

        # Estimate depth from floor center to the nearest adjacent planar
        # face center along the floor normal when such a face exists.
        depth = None
        floor_normal = face.get("normal")
        if floor_normal is not None:
            projections = []
            for other in primitive_faces:
                if other["face_id"] == face["face_id"]:
                    continue
                if other["surface_type"] != "PLANE":
                    continue
                delta = subtract(other["center"], face["center"])
                p = abs(dot(delta, floor_normal))
                if p > FEATURE_DISTANCE_TOL:
                    projections.append(p)
            if projections:
                depth = min(projections)

        results.append(_new_feature(
            ptype,
            {
                "floor_area_mm2": face["area"],
                "opening_area_mm2": None,
                "depth_mm": depth,
                "minimum_width_mm": None,
                "maximum_width_mm": None,
                "corner_radii_mm": [],
                "open_sides": 0 if rec.get("boundary_loop_count", 0) >= 2 else None,
                "pocket_closure": "CLOSED" if rec.get("boundary_loop_count", 0) >= 2 else "OPEN_CANDIDATE",
                "boundary_loops": rec.get("boundary_loop_count", 0),
            },
            faces=[face["face_id"]] + [x["face_id"] for x in cyl_walls],
            axis=floor_normal,
            position=face["center"],
            confidence=confidence,
            section=9,
        ))

    # Multi-level pockets are only emitted when there are two distinct
    # recognized pocket floors. A single floor is never paired with itself.

    # --------------------------------------------------------
    # Additional POC: planar-walled rectangular/irregular pockets.
    # Existing circular-pocket logic above is preserved.
    # --------------------------------------------------------
    existing_face_sets = {
        tuple(sorted(feature.get("faces", [])))
        for feature in results
    }

    planar_faces = [
        f for f in primitive_faces
        if f.get("surface_type") == "PLANE"
        and f.get("normal") is not None
    ]

    for floor in planar_faces:
        frec = _topology_face(topology, floor["face_id"])

        if frec.get("boundary_loop_count", 0) < 1:
            continue

        adjacent = [
            primitive.get(aid)
            for aid in frec.get("adjacent_face_ids", [])
        ]
        adjacent = [f for f in adjacent if f is not None]

        side_walls = [
            f for f in adjacent
            if f.get("surface_type") == "PLANE"
            and f.get("normal") is not None
            and _face_normal_perpendicular(
                floor.get("normal"),
                f.get("normal"),
                10.0
            )
        ]

        if len(side_walls) < 2:
            continue

        # A pocket floor should have multiple enclosing relationships.
        if len(frec.get("edge_ids", [])) < 3:
            continue

        # Reject the dominant exterior face.
        planar_area_max = max(
            (f.get("area", 0.0) for f in planar_faces),
            default=0.0
        )
        if planar_area_max > 0 and floor["area"] > 0.70 * planar_area_max:
            continue

        # Estimate depth from the closest supporting parallel plane.
        depths = []
        floor_normal = floor["normal"]

        for other in planar_faces:
            if other["face_id"] == floor["face_id"]:
                continue

            delta = subtract(
                other["center"],
                floor["center"]
            )

            distance = abs(
                dot(delta, floor_normal)
            )

            if distance > FEATURE_DISTANCE_TOL:
                depths.append(distance)

        depth = min(depths) if depths else None

        feature_faces = [floor["face_id"]] + [
            f["face_id"] for f in side_walls
        ]
        feature_faces = sorted(set(feature_faces))

        if tuple(feature_faces) in existing_face_sets:
            continue

        results.append(
            _new_feature(
                "PLANAR_POCKET_CANDIDATE",
                {
                    "floor_area_mm2": floor["area"],
                    "depth_mm": depth,
                    "wall_count": len(side_walls),
                    "boundary_loops": frec.get(
                        "boundary_loop_count", 0
                    ),
                    "pocket_closure": (
                        "CLOSED"
                        if frec.get("boundary_loop_count", 0) >= 2
                        else "OPEN_CANDIDATE"
                    ),
                    "pocket_shape": (
                        "RECTANGULAR_OR_IRREGULAR"
                    ),
                },
                faces=feature_faces,
                axis=floor_normal,
                position=floor["center"],
                confidence=0.68,
                section=9,
            )
        )

    if len(results) >= 2:
        base_results = list(results)
        for i, first in enumerate(base_results):
            for second in base_results[i + 1:]:
                p1 = first.get("position")
                p2 = second.get("position")
                if p1 is None or p2 is None:
                    continue
                distance = _distance(p1, p2)
                scale1 = max(
                    math.sqrt(max(first.get("details", {}).get("floor_area_mm2", 0.0), 0.0)),
                    1.0
                )
                scale2 = max(
                    math.sqrt(max(second.get("details", {}).get("floor_area_mm2", 0.0), 0.0)),
                    1.0
                )
                if distance > 1.5 * max(scale1, scale2):
                    continue
                a1, a2 = first.get("axis"), second.get("axis")
                if a1 is not None and a2 is not None and not _parallel(a1, a2, 5.0):
                    continue
                results.append(_new_feature(
                    "MULTI_LEVEL_POCKET",
                    {"level_relation": "SPATIALLY_RELATED_DISTINCT_FLOORS"},
                    faces=[first["faces"][0], second["faces"][0]],
                    axis=first.get("axis"),
                    position=first.get("position"),
                    confidence=0.74,
                    section=9,
                ))

    return results



def _local_face_center_spans(primitive_faces, coordinate_system):
    """Approximate overall model span from face centers in local coordinates."""
    points = []
    for face in primitive_faces:
        center = face.get("center")
        if center is None:
            continue
        points.append(
            global_to_local_point(
                center,
                (0.0, 0.0, 0.0),
                coordinate_system
            )
        )

    if not points:
        return {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
        }

    return {
        "x": max(p[0] for p in points) - min(p[0] for p in points),
        "y": max(p[1] for p in points) - min(p[1] for p in points),
        "z": max(p[2] for p in points) - min(p[2] for p in points)
    }


def _face_normal_perpendicular(a, b, tolerance_degrees=10.0):
    if a is None or b is None:
        return False
    angle = axis_angle_degrees(a, b)
    return abs(angle - 90.0) <= tolerance_degrees

def recognize_slots(primitive_faces, topology, coordinate_system):
    """
    Section 10: conservative slot/keyway recognition.

    A planar face is considered a slot floor only when:
      * it has a real boundary loop,
      * at least two planar side walls are adjacent,
      * two side walls are parallel,
      * the wall separation is small relative to the model,
      * the candidate is not simply the dominant exterior face.

    This intentionally rejects large exterior faces that previously produced
    77 mm-wide false SLOT/KEYWAY candidates.
    """
    primitive = _primitive_map(primitive_faces)
    results = []

    model_spans = _local_face_center_spans(
        primitive_faces,
        coordinate_system
    )
    positive_spans = [
        value for value in model_spans.values()
        if value > GEOMETRY_TOL
    ]
    model_min_span = min(positive_spans) if positive_spans else 0.0
    model_max_span = max(positive_spans) if positive_spans else 0.0

    planar_faces = [
        f for f in primitive_faces
        if f["surface_type"] == "PLANE"
    ]
    max_planar_area = max(
        (f["area"] for f in planar_faces),
        default=0.0
    )

    for floor in planar_faces:
        frec = _topology_face(
            topology,
            floor["face_id"]
        )

        # A slot floor should have a real boundary. Exterior planar faces
        # with no inner loop are not enough.
        if frec.get("boundary_loop_count", 0) < 1:
            continue

        # A dominant exterior face is not a slot floor.
        if (
            max_planar_area > 0
            and floor["area"] > 0.55 * max_planar_area
            and frec.get("boundary_loop_count", 0) <= 1
        ):
            continue

        adjacent = [
            primitive.get(i)
            for i in frec.get("adjacent_face_ids", [])
        ]
        walls = [
            x for x in adjacent
            if x
            and x["surface_type"] == "PLANE"
            and x.get("normal") is not None
        ]

        if len(walls) < 2:
            continue

        parallel_walls = []

        for i, a in enumerate(walls):
            for b in walls[i + 1:]:
                na = a.get("normal")
                nb = b.get("normal")

                if not _parallel(na, nb, 2.0):
                    continue

                # The two walls should be perpendicular to the floor,
                # otherwise they are usually two neighboring exterior faces.
                if not _face_normal_perpendicular(
                    floor.get("normal"),
                    na,
                    10.0
                ):
                    continue

                separation = _distance(
                    a["center"],
                    b["center"]
                )

                if separation <= FEATURE_DISTANCE_TOL:
                    continue

                # Reject a wall pair spanning almost the whole model.
                if (
                    model_max_span > 0
                    and separation > 0.45 * model_max_span
                ):
                    continue

                # Also reject a pair wider than the smallest meaningful
                # model span. This is the key protection against exterior
                # face pairs being labelled as slots.
                if (
                    model_min_span > 0
                    and separation > 0.75 * model_min_span
                ):
                    continue

                parallel_walls.append(
                    (a, b, separation)
                )

        if not parallel_walls:
            continue

        a, b, width = min(
            parallel_walls,
            key=lambda item: item[2]
        )

        wall_ids = [
            a["face_id"],
            b["face_id"]
        ]

        # A slot floor is normally materially smaller than the dominant
        # planar surface.
        area_ratio = (
            floor["area"] / max_planar_area
            if max_planar_area > 0
            else 1.0
        )

        if area_ratio > 0.50:
            continue

        orientation = _feature_orientation(
            floor.get("normal"),
            coordinate_system
        )

        # Conservative confidence: a candidate is not a confirmed slot
        # unless its end geometry is also established.
        confidence = 0.62

        results.append(
            _new_feature(
                "SLOT_CANDIDATE",
                {
                    "width_mm": width,
                    "length_mm": None,
                    "depth_mm": None,
                    "end_radius_mm": None,
                    "orientation": orientation,
                    "end_geometry": "NOT_DETERMINED",
                },
                faces=[floor["face_id"]] + wall_ids,
                axis=floor.get("normal"),
                position=floor["center"],
                confidence=confidence,
                section=10,
            )
        )

        # Keyway is stricter than a generic slot: keep it only for a narrow
        # candidate and an open/single boundary loop.
        if (
            frec.get("boundary_loop_count", 0) == 1
            and (
                model_min_span <= 0
                or width <= 0.25 * model_min_span
            )
        ):
            results.append(
                _new_feature(
                    "KEYWAY_CANDIDATE",
                    {
                        "width_mm": width,
                        "length_mm": None,
                        "depth_mm": None,
                    },
                    faces=[floor["face_id"]] + wall_ids,
                    axis=floor.get("normal"),
                    position=floor["center"],
                    confidence=0.50,
                    section=10,
                )
            )


    # --------------------------------------------------------
    # Additional POC: round-ended slot candidate.
    # --------------------------------------------------------
    for floor in planar_faces:
        frec = _topology_face(
            topology,
            floor["face_id"]
        )

        edge_types = [
            topology["edge_records"].get(
                eid, {}
            ).get("geometry_type")
            for eid in frec.get("edge_ids", [])
        ]

        circle_count = edge_types.count("CIRCLE")
        line_count = edge_types.count("LINE")

        if circle_count < 2 or line_count < 2:
            continue

        adjacent = [
            primitive.get(aid)
            for aid in frec.get("adjacent_face_ids", [])
        ]
        walls = [
            f for f in adjacent
            if f
            and f.get("surface_type") == "PLANE"
            and f.get("normal") is not None
        ]

        if len(walls) < 2:
            continue

        feature_faces = [
            floor["face_id"]
        ] + [
            f["face_id"] for f in walls
        ]

        results.append(
            _new_feature(
                "ROUND_ENDED_SLOT_CANDIDATE",
                {
                    "width_mm": None,
                    "length_mm": None,
                    "depth_mm": None,
                    "end_geometry": "CIRCULAR",
                    "circular_end_edge_count": circle_count,
                },
                faces=sorted(set(feature_faces)),
                axis=floor.get("normal"),
                position=floor["center"],
                confidence=0.70,
                section=10,
            )
        )

    return results

def recognize_bosses(primitive_faces, topology, coordinate_system):
    """
    Section 11: positive cylindrical/planar boss recognition.

    Circular bosses use an analytic external cylinder + cap.

    Rectangular/irregular bosses require:
      * a bounded planar top,
      * multiple perpendicular side walls,
      * a measurable outward height relative to a neighboring support face,
      * a support face larger than the proposed top.

    This prevents ordinary step faces from being reported as dozens of
    RECTANGULAR_BOSS_CANDIDATE features.
    """
    primitive = _primitive_map(primitive_faces)
    results = []
    circular_seen = set()

    # -------------------------
    # Circular bosses
    # -------------------------
    for cyl in primitive_faces:
        if cyl["surface_type"] != "CYLINDER":
            continue

        g = cyl.get("geometry", {})

        if g.get("internal_external") != "EXTERNAL":
            continue

        rec = _topology_face(
            topology,
            cyl["face_id"]
        )

        planar_neighbors = [
            primitive.get(i)
            for i in rec.get(
                "adjacent_face_ids",
                []
            )
        ]
        planar_neighbors = [
            x for x in planar_neighbors
            if x and x["surface_type"] == "PLANE"
        ]

        if not planar_neighbors:
            continue

        diameter = g.get("diameter")
        if diameter is None:
            continue

        expected_cap_area = (
            math.pi * (diameter / 2.0) ** 2
        )

        # Prefer the planar face whose area most closely matches a circular
        # cap. This is much safer than simply taking the smallest neighbor.
        top = min(
            planar_neighbors,
            key=lambda x: abs(
                x["area"] - expected_cap_area
            )
        )

        ratio = (
            top["area"] /
            max(expected_cap_area, 1e-9)
        )

        if not 0.70 <= ratio <= 1.30:
            continue

        axis = g.get("axis_direction")
        location = g.get("axis_position", g.get("axis_location"))
        key = (
            round(float(diameter), 4),
            tuple(round(float(v), 4) for v in axis) if axis else None,
            tuple(round(float(v), 3) for v in location) if location else None,
            top.get("face_id"),
        )
        if key in circular_seen:
            continue
        circular_seen.add(key)

        results.append(
            _new_feature(
                "CIRCULAR_BOSS",
                {
                    "diameter_mm": diameter,
                    "height_mm": g.get("axial_length"),
                    "top_area_mm2": top["area"],
                    "cross_section": "CIRCULAR",
                },
                faces=[
                    cyl["face_id"],
                    top["face_id"]
                ],
                axis=g.get("axis_direction"),
                position=top["center"],
                confidence=0.88,
                section=11,
            )
        )

    # -------------------------
    # Rectangular / irregular bosses
    # -------------------------
    planes = [
        f for f in primitive_faces
        if f["surface_type"] == "PLANE"
        and f.get("normal") is not None
    ]

    for face in planes:
        rec = _topology_face(
            topology,
            face["face_id"]
        )

        if rec.get("boundary_loop_count", 0) != 1:
            continue

        if len(rec.get("edge_ids", [])) < 3:
            continue

        adjacent = [
            primitive.get(aid)
            for aid in rec.get(
                "adjacent_face_ids",
                []
            )
        ]
        adjacent = [
            x for x in adjacent
            if x
        ]

        side_planes = [
            x for x in adjacent
            if (
                x["surface_type"] == "PLANE"
                and x.get("normal") is not None
                and _face_normal_perpendicular(
                    face["normal"],
                    x["normal"],
                    10.0
                )
            )
        ]

        if len(side_planes) < 2:
            continue

        # Find a neighboring support face behind the top face.
        supports = []

        for side in side_planes:
            side_rec = _topology_face(
                topology,
                side["face_id"]
            )

            for support_id in side_rec.get(
                "adjacent_face_ids",
                []
            ):
                support = primitive.get(
                    support_id
                )

                if support is None:
                    continue

                if support["face_id"] == face["face_id"]:
                    continue

                if support["surface_type"] != "PLANE":
                    continue

                if support["face_id"] in [
                    x["face_id"]
                    for x in side_planes
                ]:
                    continue

                supports.append(support)

        if not supports:
            continue

        unique_supports = {}
        for support in supports:
            unique_supports[
                support["face_id"]
            ] = support

        supports = list(
            unique_supports.values()
        )

        top_normal = face["normal"]

        best_support = None
        best_height = None

        for support in supports:
            delta = subtract(
                support["center"],
                face["center"]
            )

            height = abs(
                dot(
                    delta,
                    top_normal
                )
            )

            # Support should lie behind the proposed top, not in the
            # same plane.
            signed = dot(
                delta,
                top_normal
            )

            if (
                height > 0.50
                and signed < 0.0
                and (
                    best_height is None
                    or height < best_height
                )
            ):
                best_support = support
                best_height = height

        if best_support is None:
            continue

        # A boss top should not be larger than its support.
        if (
            best_support["area"]
            <= face["area"] * 1.10
        ):
            continue

        side_ids = [
            x["face_id"]
            for x in side_planes
        ]

        # Avoid re-emitting the same top/side set from a different support.
        result_faces = [
            face["face_id"]
        ] + side_ids + [
            best_support["face_id"]
        ]

        results.append(
            _new_feature(
                "RECTANGULAR_BOSS_CANDIDATE",
                {
                    "height_mm": best_height,
                    "cross_section": "RECTANGULAR_OR_IRREGULAR",
                    "top_area_mm2": face["area"],
                    "support_area_mm2": best_support["area"],
                },
                faces=sorted(set(result_faces)),
                axis=top_normal,
                position=face["center"],
                confidence=0.70,
                section=11,
            )
        )

    return results

def recognize_steps_fillets_chamfers(primitive_faces, topology, coordinate_system):
    """Section 12: steps, fillets and chamfers."""
    primitive = _primitive_map(primitive_faces)
    results = []

    # Fillet: torus is the analytic representation specified by the POC.
    for face in primitive_faces:
        if face["surface_type"] == "TORUS":
            g = face.get("geometry", {})
            rec = _topology_face(topology, face["face_id"])
            results.append(_new_feature(
                "FILLET",
                {
                    "radius_mm": g.get("minor_radius"),
                    "major_radius_mm": g.get("major_radius"),
                    "arc_length_mm": None,
                    "adjacent_faces": rec.get("adjacent_face_ids", []),
                    "concavity": "NOT_DETERMINED",
                },
                faces=[face["face_id"]], axis=g.get("axis_direction"),
                position=face["center"], confidence=0.82, section=12,
            ))

    # Chamfer: conical transition around an edge/hole.
    for face in primitive_faces:
        if face["surface_type"] != "CONE":
            continue
        g = face.get("geometry", {})
        rec = _topology_face(topology, face["face_id"])
        angle = g.get("semi_angle_deg")
        if angle is None:
            continue
        results.append(_new_feature(
            "CHAMFER",
            {
                "width_mm": None,
                "angle_deg": angle,
                "adjacent_faces": rec.get("adjacent_face_ids", []),
            },
            faces=[face["face_id"]], axis=g.get("axis_direction"),
            position=face["center"], confidence=0.72, section=12,
        ))

    # Planar/axial/radial step: neighboring planar faces whose normals
    # differ and whose centers are separated along one normal.
    planes = [f for f in primitive_faces if f["surface_type"] == "PLANE"]
    for i, a in enumerate(planes):
        for b in planes[i + 1:]:
            if a["face_id"] not in _topology_face(topology, b["face_id"]).get("adjacent_face_ids", []):
                continue
            na, nb = a.get("normal"), b.get("normal")
            if na is None or nb is None:
                continue
            angle = axis_angle_degrees(na, nb)
            if angle < 5.0 or abs(angle - 90.0) < 5.0:
                continue
            height = abs(dot(subtract(b["center"], a["center"]), na))
            if height <= FEATURE_DISTANCE_TOL:
                continue
            results.append(_new_feature(
                "PLANAR_STEP",
                {
                    "height_mm": height,
                    "area_mm2": min(a["area"], b["area"]),
                    "angle_between_faces_deg": angle,
                },
                faces=[a["face_id"], b["face_id"]],
                axis=na, position=a["center"], confidence=0.68, section=12,
            ))
    return results


def recognize_turning_features(primitive_faces, cylinders, topology, coordinate_system):
    """Section 13: turning-oriented OD/ID/face/shoulder/groove/taper/parting candidates."""
    results = []
    primitive_by_id = _primitive_map(primitive_faces)

    # Turning geometry must use the body's primary machining axis.
    z = coordinate_system["local_z"]

    def _turning_axis(axis):
        return axis is not None and axis_is_parallel(
            axis, z, FEATURE_ANGLE_TOL
        )

    external = [
        c for c in cylinders
        if c.get("internal_external") == "EXTERNAL"
    ]
    internal = [
        c for c in cylinders
        if c.get("internal_external") == "INTERNAL"
    ]

    # OD: retain major rotational outside diameters.
    if external:
        max_od = max(
            c["diameter"]
            for c in external
        )

        for c in external:
            if not _turning_axis(c.get("axis_global")):
                continue
            if c["diameter"] < 0.50 * max_od:
                continue

            results.append(
                _new_feature(
                    "OD",
                    {
                        "diameter_mm": c["diameter"],
                        "axial_length_mm": c.get("axial_span"),
                    },
                    faces=c["face_ids"],
                    axis=c["axis_global"],
                    position=c["axis_location"],
                    confidence=0.92,
                    section=13,
                )
            )

    # ID/Bore: largest internal cylinder is the primary turning bore.
    if internal:
        main_bore = max(
            internal,
            key=lambda x: x["diameter"]
        )

        if _turning_axis(main_bore.get("axis_global")):
            results.append(
                _new_feature(
                    "ID_BORE",
                    {
                        "diameter_mm": main_bore["diameter"],
                        "axial_length_mm": main_bore.get("axial_span"),
                    },
                    faces=main_bore["face_ids"],
                    axis=main_bore["axis_global"],
                    position=main_bore["axis_location"],
                    confidence=0.90,
                    section=13,
                )
            )

    # Tapers: only analytic cones with a meaningful radius change.
    for face in primitive_faces:
        if face["surface_type"] != "CONE":
            continue

        g = face.get("geometry", {})
        axis = g.get("axis_direction")

        if axis is None:
            continue

        radius_change = abs(
            (g.get("start_radius") or 0.0)
            - (g.get("end_radius") or 0.0)
        )

        if radius_change <= FEATURE_DISTANCE_TOL:
            continue

        if not _turning_axis(axis):
            continue

        internal_external = g.get(
            "internal_external"
        )

        if internal_external == "INTERNAL":
            feature_type = "INTERNAL_TAPER"
        elif internal_external == "EXTERNAL":
            feature_type = "EXTERNAL_TAPER"
        else:
            feature_type = "TAPER_CANDIDATE"

        results.append(
            _new_feature(
                feature_type,
                {
                    "start_radius_mm": g.get("start_radius"),
                    "end_radius_mm": g.get("end_radius"),
                    "length_mm": g.get("axial_span"),
                    "angle_deg": g.get("semi_angle_degrees"),
                    "taper_direction": g.get("taper_direction"),
                },
                faces=[face["face_id"]],
                axis=axis,
                position=face["center"],
                confidence=0.76 if internal_external != "UNKNOWN" else 0.60,
                section=13,
            )
        )

    max_planar_area = max(
        (
            f["area"]
            for f in primitive_faces
            if f["surface_type"] == "PLANE"
        ),
        default=0.0
    )

    for face in primitive_faces:
        if face["surface_type"] != "PLANE":
            continue

        if face.get("normal") is None:
            continue

        rec = _topology_face(
            topology,
            face["face_id"]
        )

        if (
            face["area"] >= 0.10 * max_planar_area
            and rec.get("boundary_loop_count", 0) <= 1
            and axis_is_parallel(
                face["normal"],
                z,
                5.0
            )
        ):
            results.append(
                _new_feature(
                    "FACE",
                    {
                        "area_mm2": face["area"],
                        "normal": face["normal"],
                    },
                    faces=[face["face_id"]],
                    axis=face["normal"],
                    position=face["center"],
                    confidence=0.70,
                    section=13,
                )
            )

    # Groove candidates: coaxial cylindrical regions with a short span and
    # a real diameter change.
    for i, a in enumerate(cylinders):
        for b in cylinders[i + 1:]:
            if not _turning_axis(a.get("axis_global")):
                continue
            if not _turning_axis(b.get("axis_global")):
                continue
            if a.get("internal_external") != b.get("internal_external"):
                continue

            if not _parallel(
                a["axis_global"],
                b["axis_global"],
                1.0
            ):
                continue

            if (
                a.get("axis_location") is None
                or b.get("axis_location") is None
            ):
                continue

            if _distance(
                a["axis_location"],
                b["axis_location"]
            ) > FEATURE_DISTANCE_TOL:
                continue

            diameter_change = abs(
                a["diameter"] - b["diameter"]
            )

            if diameter_change <= FEATURE_DIAMETER_TOL:
                continue

            short_span = min(
                a.get("axial_span") or 0.0,
                b.get("axial_span") or 0.0
            )

            major_d = max(
                a["diameter"],
                b["diameter"]
            )

            if (
                short_span <= 0
                or short_span > 0.25 * major_d
            ):
                continue

            groove_type = (
                "EXTERNAL_GROOVE"
                if a.get("internal_external") == "EXTERNAL"
                else "INTERNAL_GROOVE"
            )

            results.append(
                _new_feature(
                    groove_type,
                    {
                        "diameter_a_mm": a["diameter"],
                        "diameter_b_mm": b["diameter"],
                        "width_mm": short_span,
                        "depth_mm": diameter_change / 2.0,
                        "location": a["axis_location"],
                    },
                    faces=a["face_ids"] + b["face_ids"],
                    axis=a["axis_global"],
                    position=a["axis_location"],
                    confidence=0.60,
                    section=13,
                )
            )

    # Parting-region candidate: narrow planar face normal to primary axis
    # and bounded by at least two cylindrical faces.
    for face in primitive_faces:
        if face["surface_type"] != "PLANE":
            continue

        if face.get("normal") is None:
            continue

        rec = _topology_face(
            topology,
            face["face_id"]
        )

        cyl_neighbors = [
            primitive_by_id.get(aid)
            for aid in rec.get(
                "adjacent_face_ids",
                []
            )
        ]
        cyl_neighbors = [
            x for x in cyl_neighbors
            if x
            and x.get("surface_type") == "CYLINDER"
        ]

        if (
            len(cyl_neighbors) >= 2
            and (
                0.005 * max_planar_area
                <= face["area"]
                <= 0.10 * max_planar_area
            )
            and axis_is_parallel(
                face["normal"],
                z,
                5.0
            )
        ):
            results.append(
                _new_feature(
                    "PARTING_REGION_CANDIDATE",
                    {
                        "area_mm2": face["area"],
                        "width_mm": None,
                    },
                    faces=[face["face_id"]],
                    axis=face["normal"],
                    position=face["center"],
                    confidence=0.45,
                    section=13,
                )
            )


    # --------------------------------------------------------
    # Additional POC: turning shoulder.
    # Two coaxial cylindrical regions with a separating planar
    # face are treated as a shoulder only when the plane is
    # perpendicular to the turning axis.
    # --------------------------------------------------------
    for face in primitive_faces:
        if face.get("surface_type") != "PLANE":
            continue

        normal = face.get("normal")
        if normal is None or not _turning_axis(normal):
            continue

        rec = _topology_face(
            topology,
            face["face_id"]
        )

        neighboring_cylinders = [
            primitive_by_id.get(aid)
            for aid in rec.get("adjacent_face_ids", [])
        ]
        neighboring_cylinders = [
            f for f in neighboring_cylinders
            if f
            and f.get("surface_type") == "CYLINDER"
            and _turning_axis(
                f.get("geometry", {}).get("axis_direction")
            )
        ]

        if len(neighboring_cylinders) < 2:
            continue

        # A real turned shoulder is a transition between cylindrical
        # surfaces on the same side of the material (external-to-external
        # or internal-to-internal).  An end face containing a bore and/or
        # axial drilled holes is commonly adjacent to both external and
        # internal cylinders; treating those mixed neighbors as a shoulder
        # creates false positives such as Ø55 -> Ø1.2 on drilled-hole faces.
        side_types = {
            f.get("internal_external")
            for f in neighboring_cylinders
            if f.get("internal_external") in ("EXTERNAL", "INTERNAL")
        }
        if len(side_types) != 1:
            continue

        # Shoulder cylinders must share essentially the same spindle axis.
        # This also prevents separate off-axis holes from being interpreted
        # as a diameter step.
        reference_axis = neighboring_cylinders[0].get("axis_location")
        if reference_axis is None:
            continue
        if any(
            c.get("axis_location") is None
            or _distance(reference_axis, c.get("axis_location")) > FEATURE_DISTANCE_TOL
            for c in neighboring_cylinders
        ):
            continue

        diameters = [
            f.get("geometry", {}).get("diameter")
            for f in neighboring_cylinders
        ]
        diameters = [
            d for d in diameters
            if d is not None
        ]

        if len(diameters) < 2:
            continue

        if abs(max(diameters) - min(diameters)) <= FEATURE_DIAMETER_TOL:
            continue

        results.append(
            _new_feature(
                "TURNING_SHOULDER_CANDIDATE",
                {
                    "large_diameter_mm": max(diameters),
                    "small_diameter_mm": min(diameters),
                    "diameter_change_mm": (
                        max(diameters) - min(diameters)
                    ),
                    "face_area_mm2": face["area"],
                },
                faces=[
                    face["face_id"]
                ] + [
                    f["face_id"]
                    for f in neighboring_cylinders
                ],
                axis=normal,
                position=face["center"],
                confidence=0.78,
                section=13,
            )
        )

    return results

def recognize_thin_and_undercut(
    primitive_faces,
    cylinders,
    topology,
    coordinate_system
):
    """Section 14: thin walls, thin floors and undercut candidates."""
    results = []

    planes = [
        f for f in primitive_faces
        if f.get("surface_type") == "PLANE"
        and f.get("normal") is not None
    ]

    seen_pairs = set()

    # --------------------------------------------------------
    # Thin wall / thin floor.
    # --------------------------------------------------------
    for i, a in enumerate(planes):
        for b in planes[i + 1:]:

            if not _parallel(
                a["normal"],
                b["normal"],
                1.0
            ):
                continue

            pair = tuple(
                sorted(
                    (
                        a["face_id"],
                        b["face_id"]
                    )
                )
            )

            if pair in seen_pairs:
                continue

            a_rec = _topology_face(
                topology,
                a["face_id"]
            )
            b_rec = _topology_face(
                topology,
                b["face_id"]
            )

            adjacent = (
                b["face_id"]
                in a_rec.get(
                    "adjacent_face_ids",
                    []
                )
                or
                a["face_id"]
                in b_rec.get(
                    "adjacent_face_ids",
                    []
                )
            )

            separation = abs(
                dot(
                    subtract(
                        b["center"],
                        a["center"]
                    ),
                    a["normal"]
                )
            )

            center_distance = _distance(
                a["center"],
                b["center"]
            )

            if not adjacent and center_distance > 10.0:
                continue

            if not (
                0.01
                < separation
                <= THIN_WALL_TOL
            ):
                continue

            seen_pairs.add(pair)

            # A bounded pair with multiple loops is more likely to
            # represent a floor than a wall.
            is_floor = (
                a_rec.get(
                    "boundary_loop_count",
                    0
                ) >= 2
                or
                b_rec.get(
                    "boundary_loop_count",
                    0
                ) >= 2
            )

            feature_type = (
                "THIN_FLOOR"
                if is_floor
                else "THIN_WALL_OR_FLOOR"
            )

            confidence = (
                0.72
                if adjacent
                else 0.55
            )

            results.append(
                _new_feature(
                    feature_type,
                    {
                        "minimum_thickness_mm": separation,
                        "height_mm": None,
                        "area_mm2": min(
                            a["area"],
                            b["area"]
                        ),
                        "aspect_ratio": None,
                        "classification": (
                            "FLOOR"
                            if is_floor
                            else "WALL_OR_FLOOR"
                        ),
                    },
                    faces=[
                        a["face_id"],
                        b["face_id"]
                    ],
                    axis=a["normal"],
                    position=a["center"],
                    confidence=confidence,
                    section=14,
                )
            )

    # --------------------------------------------------------
    # Conservative undercut detection.
    #
    # A feature is considered an undercut candidate only when:
    #   1. adjacent faces meet at a re-entrant-looking angle;
    #   2. the feature is not simply two parallel thin-wall faces;
    #   3. the local geometry is not aligned as an ordinary planar step;
    #   4. the feature has a meaningful accessibility obstruction.
    #
    # This is intentionally a CANDIDATE, not a confirmed machining
    # undercut, because exact tool accessibility requires cutter
    # geometry and machining-direction assumptions.
    # --------------------------------------------------------
    for face in primitive_faces:

        if face.get("surface_type") not in (
            "PLANE",
            "CYLINDER",
            "CONE",
            "TORUS",
            "BSPLINE",
            "BEZIER",
        ):
            continue

        fid = face["face_id"]
        rec = _topology_face(
            topology,
            fid
        )

        normal_a = face.get("normal")
        if normal_a is None:
            continue

        for neighbor_id in rec.get(
            "adjacent_face_ids",
            []
        ):

            if neighbor_id <= fid:
                continue

            neighbor = next(
                (
                    f for f in primitive_faces
                    if f.get("face_id") == neighbor_id
                ),
                None
            )

            if neighbor is None:
                continue

            normal_b = neighbor.get("normal")
            if normal_b is None:
                continue

            angle = axis_angle_degrees(
                normal_a,
                normal_b
            )

            # Reject smooth/parallel surfaces and ordinary near-right
            # angle transitions. The remaining range is a useful
            # re-entrant candidate zone for this POC.
            if angle < 105.0 or angle > 175.0:
                continue

            if (
                face.get("surface_type") == "PLANE"
                and neighbor.get("surface_type") == "PLANE"
                and abs(angle - 180.0) < 5.0
            ):
                continue

            feature_axis = cross(
                normal_a,
                normal_b
            )

            if vector_length(
                feature_axis
            ) < GEOMETRY_TOL:
                continue

            feature_axis = normalize(
                feature_axis
            )

            # A strongly blocked direction is stronger evidence.
            local_axis = global_to_local_vector(
                feature_axis,
                coordinate_system
            )

            transverse = max(
                abs(local_axis[0]),
                abs(local_axis[1])
            )

            if transverse < 0.20:
                confidence = 0.56
            else:
                confidence = 0.62

            results.append(
                _new_feature(
                    "UNDERCUT_CANDIDATE",
                    {
                        "dihedral_angle_deg": angle,
                        "face_a_surface": face.get(
                            "surface_type"
                        ),
                        "face_b_surface": neighbor.get(
                            "surface_type"
                        ),
                        "accessibility_reason":
                            "REENTRANT_OR_TOOL_OBSTRUCTED_TRANSITION",
                    },
                    faces=[
                        fid,
                        neighbor_id
                    ],
                    axis=feature_axis,
                    position=face["center"],
                    confidence=confidence,
                    section=14,
                )
            )

    return results


def recognize_freeform_and_islands(primitive_faces, topology):
    """Section 15: freeform finishing regions and island candidates."""
    results = []
    primitive = _primitive_map(primitive_faces)
    for face in primitive_faces:
        if face["surface_type"] in ("BSPLINE", "BEZIER"):
            g = face.get("geometry", {})
            results.append(_new_feature(
                "FREEFORM_3D_FINISH_REGION",
                {
                    "surface_type": face["surface_type"],
                    "area_mm2": face["area"],
                    "normal_variation_degrees": g.get("normal_variation_degrees"),
                    "curvature_range": g.get("curvature_range"),
                    "3d_finishing": True,
                },
                faces=[face["face_id"]], position=face["center"], confidence=0.92, section=15,
            ))

        rec = _topology_face(topology, face["face_id"])
        if face["surface_type"] == "PLANE" and rec.get("boundary_loop_count", 0) >= 2:
            # An island must be distinct from the pocket floor. A face
            # cannot be both parent pocket and child island.
            # Keep this as a candidate only when a separate adjacent
            # planar face exists; do not emit a self-relation.
            adjacent_planar = [
                primitive.get(aid)
                for aid in rec.get("adjacent_face_ids", [])
                if primitive.get(aid) and primitive.get(aid).get("surface_type") == "PLANE"
            ]
            if adjacent_planar:
                results.append(_new_feature(
                    "POCKET_ISLAND_CANDIDATE",
                    {
                        "boundary_loops": rec.get("boundary_loop_count", 0),
                        "area_mm2": face["area"],
                    },
                    faces=[face["face_id"]], position=face["center"], confidence=0.50, section=15,
                ))
    return results


def recognize_cross_features(cylinders, coordinate_system):
    """Section 16: radial and angled internal holes."""
    results = []
    for c in cylinders:
        if c.get("internal_external") != "INTERNAL":
            continue
        orientation = _feature_orientation(c["axis_global"], coordinate_system)
        if orientation == "AXIAL":
            continue
        local_axis = global_to_local_vector(c["axis_global"], coordinate_system)
        angle_to_primary = math.degrees(math.acos(max(-1.0, min(1.0, abs(local_axis[2])))))
        feature_type = "CROSS_HOLE" if orientation == "RADIAL" else "ANGLED_HOLE"
        results.append(_new_feature(
            feature_type,
            {
                "diameter_mm": c["diameter"],
                "depth_mm": c.get("axial_span"),
                "angle_to_primary_axis_deg": angle_to_primary,
                "orientation": orientation,
            },
            faces=c["face_ids"], axis=c["axis_global"], position=c["axis_location"],
            confidence=0.82, section=16,
        ))
    return results


def calculate_feature_accessibility(feature, solid, coordinate_system):
    """POC setup-direction accessibility from the six local directions."""
    position = feature.get("position")
    if position is None:
        return {"+X": "UNKNOWN", "-X": "UNKNOWN", "+Y": "UNKNOWN", "-Y": "UNKNOWN", "+Z": "UNKNOWN", "-Z": "UNKNOWN"}
    bb = calculate_local_bounding_box(solid, coordinate_system)
    local = global_to_local_point(position, (0.0, 0.0, 0.0), coordinate_system)
    tol = FEATURE_DISTANCE_TOL * 2.0
    return {
        "+X": abs(local[0] - bb["xmax"]) <= tol,
        "-X": abs(local[0] - bb["xmin"]) <= tol,
        "+Y": abs(local[1] - bb["ymax"]) <= tol,
        "-Y": abs(local[1] - bb["ymin"]) <= tol,
        "+Z": abs(local[2] - bb["zmax"]) <= tol,
        "-Z": abs(local[2] - bb["zmin"]) <= tol,
    }


def build_compound_relationships(features):
    """
    Build conservative parent-child relationships.

    Relationships are only allowed between features belonging to the same
    body and with explicit geometric/topological evidence.
    """
    relationships = []

    holes = [
        f for f in features
        if f["type"] in (
            "THROUGH_HOLE",
            "BLIND_HOLE",
            "BORE"
        )
    ]

    variants = [
        f for f in features
        if f["type"] in (
            "COUNTERBORE",
            "COUNTERSINK",
            "STEPPED_HOLE"
        )
    ]

    pockets = [
        f for f in features
        if "POCKET" in f["type"]
        and "ISLAND" not in f["type"]
    ]

    islands = [
        f for f in features
        if "ISLAND" in f["type"]
    ]

    for variant in variants:
        body_id = variant.get("body_id")
        variant_faces = set(variant.get("faces", []))

        candidates = [
            hole for hole in holes
            if hole.get("body_id") == body_id
            and variant_faces.intersection(
                hole.get("faces", [])
            )
        ]

        if candidates:
            # Prefer the hole sharing the greatest number of faces.
            parent = max(
                candidates,
                key=lambda h: len(
                    variant_faces.intersection(
                        h.get("faces", [])
                    )
                )
            )
            relationships.append(
                (parent, variant, "HOLE_VARIANT")
            )

    # An island is not a parent/child relationship merely because it is
    # another planar face. Require distinct bodies to be rejected and require
    # a pocket feature whose face set contains evidence adjacent to the island.
    for island in islands:
        body_id = island.get("body_id")
        island_faces = set(island.get("faces", []))

        if not island_faces:
            continue

        same_body_pockets = [
            pocket for pocket in pockets
            if pocket.get("body_id") == body_id
            and not island_faces.intersection(
                pocket.get("faces", [])
            )
        ]

        # Only create a relationship when the island has a spatially
        # meaningful relationship with a pocket. Use feature positions when
        # available; do not fall back to arbitrary first-match linking.
        for pocket in same_body_pockets:
            ip = island.get("position")
            pp = pocket.get("position")

            if ip is None or pp is None:
                continue

            distance = _distance(ip, pp)
            pocket_details = pocket.get("details", {})
            scale = max(
                pocket_details.get("maximum_width_mm") or 0.0,
                pocket_details.get("minimum_width_mm") or 0.0,
                1.0
            )

            if distance <= max(scale * 2.0, FEATURE_DISTANCE_TOL * 10.0):
                relationships.append(
                    (pocket, island, "POCKET_ISLAND")
                )
                break

    return relationships


def _deduplicate_feature_list(features):
    """
    Remove repeated recognizer outputs without collapsing genuinely distinct
    features that merely share a type or diameter.
    """
    unique = []
    seen = set()

    for feature in features:
        details = feature.get("details", {})
        faces = tuple(sorted(feature.get("faces", [])))
        body_id = feature.get("body_id")

        position = feature.get("position")
        if position is not None:
            position_key = tuple(
                round(float(x), 3)
                for x in position
            )
        else:
            position_key = None

        key = (
            body_id,
            feature.get("type"),
            faces,
            position_key,
        )

        if key in seen:
            continue

        seen.add(key)
        unique.append(feature)

    return unique



# ============================================================
# TURNING MANUFACTURING INTELLIGENCE
# ============================================================
TURNING_RADIAL_ALLOWANCE_MM = 2.0
TURNING_AXIAL_ALLOWANCE_MM = 2.0
TURNING_AXIS_TOL_DEG = 5.0
COMPACT_OUTPUT = True  # Keep terminal reports compact without changing detection.
TOOL_REACH_RATIO_LIMIT = 6.0

def local_to_global_vector(vector, coordinate_system):
    x = coordinate_system["local_x"]; y = coordinate_system["local_y"]; z = coordinate_system["local_z"]
    return (x[0]*vector[0]+y[0]*vector[1]+z[0]*vector[2], x[1]*vector[0]+y[1]*vector[1]+z[1]*vector[2], x[2]*vector[0]+y[2]*vector[1]+z[2]*vector[2])

def local_to_global_point(point, origin, coordinate_system):
    v = local_to_global_vector(point, coordinate_system)
    return (origin[0]+v[0], origin[1]+v[1], origin[2]+v[2])

def validate_coordinate_system(coordinate_system):
    x=normalize(coordinate_system["local_x"]); y=normalize(coordinate_system["local_y"]); z=normalize(coordinate_system["local_z"])
    return {"x_length_error":abs(vector_length(x)-1.0),"y_length_error":abs(vector_length(y)-1.0),"z_length_error":abs(vector_length(z)-1.0),"xy_dot":dot(x,y),"xz_dot":dot(x,z),"yz_dot":dot(y,z),"right_handed_error":vector_length(subtract(cross(x,y),z))}

def choose_turning_origin(solid, coordinate_system):
    """Choose a datum point ON the detected spindle axis.

    Project the solid COM onto the actual axis line P + t*Z, where P is an
    OCC-derived point on the spindle axis. This is the correct 3-D geometry
    operation; projecting onto a line through the global origin was incorrect
    for STEP models whose spindle axis is offset from global (0,0,0).
    """
    com = cq.Shape.centerOfMass(solid)
    c = (com.x, com.y, com.z)
    z = normalize(coordinate_system["local_z"])
    axis_point = coordinate_system.get("axis_point_global", (0.0, 0.0, 0.0))
    relative = subtract(c, axis_point)
    t = dot(relative, z)
    return (
        axis_point[0] + z[0] * t,
        axis_point[1] + z[1] * t,
        axis_point[2] + z[2] * t,
    )

def coordinate_round_trip_error(point, origin, coordinate_system):
    local=global_to_local_point(point,origin,coordinate_system); recovered=local_to_global_point(local,origin,coordinate_system)
    return vector_length(subtract(point,recovered))

def _turning_local_profile(solid, coordinate_system, origin):
    try: points=solid.copy().tessellate(tolerance=0.05)[0]
    except Exception: points=[]
    if not points: points=[v.toTuple() for v in solid.Vertices()]
    lp=[global_to_local_point(tuple(p),origin,coordinate_system) for p in points]
    if not lp: raise ValueError("No geometry points available for turning stock analysis.")
    rs=[math.hypot(p[0],p[1]) for p in lp]; zs=[p[2] for p in lp]
    return {"max_radius_mm":max(rs),"min_radius_mm":min(rs),"z_min_mm":min(zs),"z_max_mm":max(zs),"axial_length_mm":max(zs)-min(zs)}

def estimate_turning_stock_and_removal(solid, coordinate_system, origin):
    profile = _turning_local_profile(solid, coordinate_system, origin)
    sd = 2.0 * profile["max_radius_mm"] + 2.0 * TURNING_RADIAL_ALLOWANCE_MM
    sl = profile["axial_length_mm"] + 2.0 * TURNING_AXIAL_ALLOWANCE_MM
    sv = math.pi * (sd / 2.0) ** 2 * sl
    fv = float(solid.Volume())
    removed = max(0.0, sv - fv)

    # Build the actual cylindrical stock around the detected turning axis.
    # The boolean difference gives a geometry-based removal surface area.
    removal_area = None
    try:
        z0 = profile["z_min_mm"] - TURNING_AXIAL_ALLOWANCE_MM
        axis = coordinate_system["local_z"]
        base = tuple(origin[i] + axis[i] * z0 for i in range(3))
        stock_shape = cq.Solid.makeCylinder(
            sd / 2.0,
            sl,
            cq.Vector(*base),
            cq.Vector(*axis)
        )
        removed_shape = stock_shape.cut(solid)
        removal_area = max(0.0, float(removed_shape.Area()))
    except Exception:
        # Keep volume analysis available even if the optional boolean fails.
        removal_area = None

    return {
        **profile,
        "radial_allowance_mm": TURNING_RADIAL_ALLOWANCE_MM,
        "axial_allowance_mm": TURNING_AXIAL_ALLOWANCE_MM,
        "stock_diameter_mm": sd,
        "stock_length_mm": sl,
        "stock_volume_mm3": sv,
        "finished_volume_mm3": fv,
        "material_removed_mm3": removed,
        "material_removed_area_mm2": removal_area,
        "material_removed_percent_of_stock": 100.0 * removed / sv if sv > 1e-12 else 0.0
    }

def _turning_tool_for_feature(feature):
    f=str(feature.get("type","")).upper()
    mapping={"OD":("OD ROUGHING / TURNING TOOL","LONGITUDINAL TURNING PATH"),"OD_FINISH":("OD FINISHING TOOL","FINISH PROFILE PATH"),"ID_BORE":("BORING BAR","INTERNAL LONGITUDINAL BORING PATH"),"ID":("BORING BAR","INTERNAL PROFILE PATH"),"FACE":("FACING / TURNING TOOL","RADIAL FACING PATH"),"TURNING_SHOULDER_CANDIDATE":("SHOULDER TURNING TOOL","SHOULDER TRANSITION PATH"),"EXTERNAL_GROOVE":("EXTERNAL GROOVING TOOL","GROOVE PLUNGE / PECK PATH"),"INTERNAL_GROOVE":("INTERNAL GROOVING TOOL","INTERNAL GROOVE PATH"),"EXTERNAL_TAPER":("TURNING / PROFILING TOOL","TAPER PROFILE PATH"),"INTERNAL_TAPER":("BORING / PROFILING TOOL","INTERNAL TAPER PATH"),"TAPER_CANDIDATE":("PROFILING TOOL","TAPER PROFILE PATH"),"PARTING_REGION_CANDIDATE":("PARTING BLADE","PARTING PLUNGE PATH"),"THREAD_REGION_CANDIDATE":("THREADING TOOL","SYNCHRONIZED THREAD PATH")}
    return mapping.get(f,("TURNING TOOL FAMILY TO BE SELECTED","TURNING PATH CANDIDATE"))


def _build_axial_drilling_operation(hole_features):
    """Group axial holes of the same size/depth into one manufacturing step."""
    axial = [
        f for f in hole_features
        if f.get("type") in ("BLIND_HOLE", "THROUGH_HOLE")
        and f.get("details", {}).get("axis_orientation") == "AXIAL"
    ]
    if not axial:
        return None

    # Group only geometrically matching holes so distinct drill sizes/depths
    # remain separate manufacturing operations.
    groups = {}
    for f in axial:
        d = f.get("details", {})
        key = (
            round(float(d.get("diameter_mm", 0.0)), 4),
            round(float(d.get("depth_mm", 0.0) or 0.0), 4),
            f.get("type"),
        )
        groups.setdefault(key, []).append(f)

    operations = []
    for (diameter, depth, hole_type), members in sorted(groups.items()):
        drill_type = "BLIND HOLE DRILLING" if hole_type == "BLIND_HOLE" else "THROUGH HOLE DRILLING"
        operations.append({
            "feature": "AXIAL DRILLING",
            "tool_family": f"Ø{diameter:.3f} DRILL",
            "path": "AXIAL DRILLING PATH",
            "details": {
                "diameter_mm": diameter,
                "depth_mm": depth,
                "quantity": len(members),
                "hole_type": drill_type,
                "faces": [fid for f in members for fid in f.get("faces", [])],
                "axis": members[0].get("axis"),
                "position": None,
                "orientation": "AXIAL",
                "confidence": min((f.get("confidence") or 0.0) for f in members),
                "source_features": members,
                "machinability": "MACHINABLE ON TURNING CENTER WITH AXIAL DRILLING CAPABILITY",
                "machinability_reason": "Axial holes are part of the finished model and can be drilled along the turning axis when the machine supports axial drilling/live tooling.",
            },
        })
    return operations

def classify_turning_machinability(feature, coordinate_system):
    f=str(feature.get("type","")).upper(); axis=feature.get("axis"); z=coordinate_system["local_z"]
    if axis is not None and not axis_is_parallel(axis,z,TURNING_AXIS_TOL_DEG): return "NON-MACHINABLE BY BASIC TURNING","Feature axis is not aligned with the turning spindle axis."
    if "RADIAL" in f or "ANGLED" in f: return "NON-MACHINABLE BY BASIC TURNING","Requires cross/angled machining rather than basic turning."
    d=feature.get("details",{}); dia=d.get("diameter_mm") or d.get("large_diameter_mm"); depth=d.get("depth_mm") or d.get("length_mm") or d.get("axial_length_mm")
    if dia and depth and dia>0 and depth/dia>TOOL_REACH_RATIO_LIMIT and "ID" in f: return "DIFFICULT / SPECIAL TOOL","High internal depth-to-diameter ratio; boring-bar reach is critical."
    if "UNDERCUT" in f: return "DIFFICULT / SPECIAL TOOL","Undercut requires special tool geometry and verified access."
    if "THIN" in f: return "DIFFICULT / SPECIAL TOOL","Thin geometry may deflect during turning."
    return "MACHINABLE","Geometry is aligned with the turning axis and has a basic turning approach."

def enrich_turning_features(turning_features, solid, coordinate_system, origin):
    for feature in turning_features:
        d=feature.setdefault("details",{}); pos=feature.get("position"); axis=feature.get("axis")
        if pos is not None: d["local_position_mm"]=global_to_local_point(pos,origin,coordinate_system)
        if axis is not None: d["axis_local"]=global_to_local_vector(axis,coordinate_system)
        tool,path=_turning_tool_for_feature(feature); d["tool_family"]=tool; d["tool_path_strategy"]=path
        status,reason=classify_turning_machinability(feature,coordinate_system); d["machinability"]=status; d["machinability_reason"]=reason
    return turning_features

def build_turning_analysis(body_id, solid, turning_features, coordinate_system, hole_features=None):
    origin=choose_turning_origin(solid,coordinate_system); validation=validate_coordinate_system(coordinate_system)
    com=cq.Shape.centerOfMass(solid); cp=(com.x,com.y,com.z)
    stock=estimate_turning_stock_and_removal(solid,coordinate_system,origin)
    axis_definition = _turning_axis_definition(coordinate_system, origin)
    footprint = _validate_part_footprint(solid, coordinate_system, origin, stock)
    features=enrich_turning_features(turning_features,solid,coordinate_system,origin)
    ops=[]
    for feature_index, f in enumerate(features):
        if f.get("details",{}).get("machinability") == "NON-MACHINABLE BY BASIC TURNING":
            continue
        ops.append({
            "feature": f.get("type"),
            "tool_family": f.get("details",{}).get("tool_family"),
            "path": f.get("details",{}).get("tool_path_strategy"),
            "feature_index": feature_index,
        })

    # Include axial drilled holes in the manufacturing sequence. They are
    # part of the finished model even though they are not a conventional
    # OD/ID turning operation. Group matching holes into one drilling step.
    for drill_op in (_build_axial_drilling_operation(hole_features or []) or []):
        drill_feature_index = len(features)
        ops.append({
            "feature": drill_op["feature"],
            "tool_family": drill_op["tool_family"],
            "path": drill_op["path"],
            "details": drill_op["details"],
            "feature_index": drill_feature_index,
        })
        features.append({
            "type": drill_op["feature"],
            "details": drill_op["details"],
            "faces": drill_op["details"].get("faces", []),
            "axis": drill_op["details"].get("axis"),
            "position": None,
            "orientation": "AXIAL",
            "confidence": drill_op["details"].get("confidence"),
        })

    analysis = {
        "body_id": body_id,
        "origin_global": origin,
        "coordinate_validation": validation,
        "center_of_mass_round_trip_error_mm": coordinate_round_trip_error(cp, origin, coordinate_system),
        "axis_definition": axis_definition,
        "stock": stock,
        "footprint": footprint,
        "finished_surface_area_mm2": float(solid.Area()),
        "features": features,
        "operation_sequence": ops,
    }
    analysis["toolpath_preview"] = _build_turning_toolpath(analysis)
    return analysis

def _turning_axis_definition(coordinate_system, origin):
    """Return an explicit, human-readable definition of the turning frame."""
    z = normalize(coordinate_system["local_z"])
    x = normalize(coordinate_system["local_x"])
    y = normalize(coordinate_system["local_y"])
    global_x = (1.0, 0.0, 0.0)
    global_y = (0.0, 1.0, 0.0)
    global_z = (0.0, 0.0, 1.0)
    def angle(v):
        return math.degrees(math.acos(max(-1.0, min(1.0, abs(dot(z, v))))))
    angle_to_global_z = angle(global_z)
    # Rotation matrix R maps LOCAL coordinates to GLOBAL coordinates:
    # p_global = O + R @ p_local, where the columns are local X/Y/Z.
    # Therefore GLOBAL -> LOCAL uses R^T @ (p_global - O).
    rotation_matrix = (
        (x[0], y[0], z[0]),
        (x[1], y[1], z[1]),
        (x[2], y[2], z[2]),
    )
    return {
        "spindle_axis_name": "LOCAL Z",
        "spindle_axis_global": z,
        "local_x": x,
        "local_y": y,
        "local_z": z,
        "rotation_matrix_local_to_global": rotation_matrix,
        "rotation_matrix_global_to_local": tuple(zip(*rotation_matrix)),
        "axis_point_global": tuple(coordinate_system.get("axis_point_global", origin)),
        "datum_origin_global": tuple(origin),
        "angle_to_global_x_deg": angle(global_x),
        "angle_to_global_y_deg": angle(global_y),
        "angle_to_global_z_deg": angle_to_global_z,
    }


def _validate_part_footprint(solid, coordinate_system, origin, stock):
    """Validate footprint in GLOBAL coordinates and turning envelope in LOCAL coordinates.

    The requested model footprint is the actual STEP/global bounding box.  The
    turning envelope is separately evaluated in the validated local frame using
    r=sqrt(X_local^2+Y_local^2), Z_local.  This keeps global footprint reporting
    faithful to the CAD model while using the local frame for turning/stock checks.
    """
    # Global footprint: use OCC's geometric bounding box, not tessellation.
    bb = solid.BoundingBox()
    gx = float(bb.xmax - bb.xmin)
    gy = float(bb.ymax - bb.ymin)
    gz = float(bb.zmax - bb.zmin)

    profile = _turning_local_profile(solid, coordinate_system, origin)
    stock_radius = float(stock["stock_diameter_mm"]) / 2.0
    stock_z_min = float(profile["z_min_mm"]) - float(stock["axial_allowance_mm"])
    stock_z_max = float(profile["z_max_mm"]) + float(stock["axial_allowance_mm"])

    # Validate global <-> local mapping over the model samples.
    try:
        samples = solid.copy().tessellate(tolerance=0.05)[0]
    except Exception:
        samples = []
    if not samples:
        samples = [v.toTuple() for v in solid.Vertices()]

    max_round_trip = 0.0
    for point in samples:
        local = global_to_local_point(tuple(point), origin, coordinate_system)
        recovered = local_to_global_point(local, origin, coordinate_system)
        max_round_trip = max(max_round_trip, vector_length(subtract(tuple(point), recovered)))

    radial_excess = max(0.0, profile["max_radius_mm"] - stock_radius)
    axial_low_excess = max(0.0, stock_z_min - profile["z_min_mm"])
    axial_high_excess = max(0.0, profile["z_max_mm"] - stock_z_max)
    contained = radial_excess <= 1e-6 and axial_low_excess <= 1e-6 and axial_high_excess <= 1e-6

    axis_point = coordinate_system.get("axis_point_global", origin)
    z = normalize(coordinate_system["local_z"])
    axis_offset = subtract(origin, axis_point)
    axis_line_distance = vector_length(subtract(axis_offset, multiply(z, dot(axis_offset, z))))

    return {
        "status": "VALID - PART FITS INSIDE STOCK" if contained else "INVALID - PART EXCEEDS STOCK",
        "global_x_length_mm": gx,
        "global_y_length_mm": gy,
        "global_z_length_mm": gz,
        "model_diameter_mm": 2.0 * profile["max_radius_mm"],
        "model_axial_length_mm": profile["axial_length_mm"],
        "stock_diameter_mm": float(stock["stock_diameter_mm"]),
        "stock_length_mm": float(stock["stock_length_mm"]),
        "radial_clearance_mm": max(0.0, stock_radius - profile["max_radius_mm"]),
        "axial_clearance_each_end_mm": float(stock["axial_allowance_mm"]),
        "radial_excess_mm": radial_excess,
        "axial_excess_low_mm": axial_low_excess,
        "axial_excess_high_mm": axial_high_excess,
        "local_z_min_mm": profile["z_min_mm"],
        "local_z_max_mm": profile["z_max_mm"],
        "max_geometry_round_trip_error_mm": max_round_trip,
        "axis_line_distance_mm": axis_line_distance,
    }


def _build_turning_toolpath(analysis):
    """Build a simple deterministic X-Z toolpath for visualization.

    This is a planning/animation path, not CNC-ready G-code. It uses the
    validated local turning frame and deliberately stays conservative.
    """
    stock = analysis["stock"]
    r_stock = stock["stock_diameter_mm"] / 2.0
    r_part = analysis["footprint"]["model_diameter_mm"] / 2.0
    z0 = stock["z_min_mm"]
    z1 = stock["z_max_mm"]
    clearance = 1.0
    paths = []

    # OD roughing: several axial passes at progressively smaller radii.
    radial_step = max(0.5, (r_stock - r_part) / 4.0)
    radii = []
    r = r_stock
    while r - radial_step > r_part + 0.05:
        r -= radial_step
        radii.append(r)
    radii.append(r_part)
    for rp in radii:
        paths.append({"operation": "OD ROUGHING", "points": [(r_stock + clearance, z0 - clearance), (rp, z0), (rp, z1), (r_stock + clearance, z1 + clearance)]})

    # ID boring: schematic axial pass at the finished bore radius.
    id_radius = None
    for f in analysis.get("features", []):
        if f.get("type") == "ID_BORE":
            id_radius = float(f.get("details", {}).get("diameter_mm", 0.0)) / 2.0
            break
    if id_radius and id_radius > 0:
        paths.append({"operation": "ID BORING", "points": [(0.0, z0 + clearance), (id_radius, z0 + clearance), (id_radius, z1 - clearance), (0.0, z1 - clearance)]})

    # Facing: radial sweep at each detected end.
    for name, zf in (("FACING FRONT", z0), ("FACING BACK", z1)):
        paths.append({"operation": name, "points": [(0.0, zf), (r_stock, zf)]})

    # Axial drilling: centerline strokes, one per hole, shown as repeated
    # centerline motion because the actual XY hole positions are handled in
    # the manufacturing feature data rather than this 2-D turning preview.
    for f in analysis.get("features", []):
        if f.get("type") == "AXIAL DRILLING":
            d = f.get("details", {})
            depth = float(d.get("depth_mm", 0.0) or 0.0)
            qty = int(d.get("quantity", 1) or 1)
            for k in range(qty):
                paths.append({"operation": f"AXIAL DRILL {k+1}/{qty}", "points": [(0.0, z1 + clearance), (0.0, z1 - depth), (0.0, z1 + clearance)]})
    return paths


def _save_turning_toolpath_animation(analysis):
    """Save a lightweight X-Z GIF showing the planned turning movements."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.animation import FuncAnimation, PillowWriter
    except Exception as exc:
        return None, f"Animation unavailable: {exc}"

    paths = _build_turning_toolpath(analysis)
    if not paths:
        return None, "No toolpath points available for animation."

    profile = analysis["stock"]
    r_stock = profile["stock_diameter_mm"] / 2.0
    fp = analysis["footprint"]
    r_part = fp["model_diameter_mm"] / 2.0
    z0 = profile["z_min_mm"]
    z1 = profile["z_max_mm"]

    frames = []
    for path in paths:
        pts = path["points"]
        for j in range(1, len(pts) + 1):
            frames.append((path["operation"], pts[:j]))

    fig, ax = plt.subplots(figsize=(9, 4.8))
    ax.set_title(f"Turning Tool Path Preview - Body {analysis['body_id']}")
    ax.set_xlabel("Local radial X (mm)")
    ax.set_ylabel("Local Z / spindle axis (mm)")
    ax.set_xlim(-2.0, r_stock + 3.0)
    ax.set_ylim(z0 - 3.0, z1 + 3.0)
    ax.set_aspect("equal", adjustable="box")
    ax.plot([r_part, r_part], [z0, z1], linewidth=2, label="Finished OD")
    ax.plot([r_stock, r_stock], [z0, z1], linestyle="--", label="Stock radius")
    line, = ax.plot([], [], linewidth=2, label="Tool movement")
    point, = ax.plot([], [], marker="o")
    text = ax.text(0.02, 0.95, "", transform=ax.transAxes, va="top")
    ax.legend(loc="best")

    def update(frame):
        name, pts = frames[frame]
        xs = [p[0] for p in pts]
        zs = [p[1] for p in pts]
        line.set_data(xs, zs)
        point.set_data([xs[-1]], [zs[-1]])
        text.set_text(name)
        return line, point, text

    animation = FuncAnimation(fig, update, frames=len(frames), interval=250, blit=True, repeat=False)
    output = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"turning_toolpath_body_{analysis['body_id']}.gif")
    try:
        animation.save(output, writer=PillowWriter(fps=4))
    except Exception as exc:
        plt.close(fig)
        return None, f"Animation save failed: {exc}"
    plt.close(fig)
    return output, None


def print_turning_setup_first(analyses):
    """Print only the validated turning reference/footprint first."""
    print("\n================ 1. TURNING AXIS & COORDINATE SETUP ================")
    for a in analyses:
        axis = a["axis_definition"]
        cv = a["coordinate_validation"]
        fp = a["footprint"]
        print(f"\nBody {a['body_id']}")
        print("  AXIS RECOGNITION")
        print("    Recognized spindle axis : LOCAL Z")
        print(f"    Global axis direction  : {tuple(round(x,6) for x in axis['spindle_axis_global'])}")
        print(f"    Axis point (global)    : {tuple(round(x,3) for x in axis['axis_point_global'])}")
        print("    Definition             : LOCAL Z = turning spindle/tool axis")
        print()
        print("  GLOBAL ↔ LOCAL ALIGNMENT")
        print("    LOCAL X : radial reference direction")
        print("    LOCAL Y : radial reference direction")
        print("    LOCAL Z : spindle/turning direction")
        print("    Rotation matrix R (LOCAL → GLOBAL):")
        for row in axis["rotation_matrix_local_to_global"]:
            print(f"      [{row[0]: .6f}  {row[1]: .6f}  {row[2]: .6f}]")
        print("    Global → Local : Rᵀ @ (P_global - O)")
        print("    Local → Global : O + R @ P_local")
        print(f"    Matrix check   : XY={cv['xy_dot']:.3e}, XZ={cv['xz_dot']:.3e}, YZ={cv['yz_dot']:.3e}")
        print(f"    det/right-hand : error={cv['right_handed_error']:.3e}")
        print(f"    Round-trip     : {a['center_of_mass_round_trip_error_mm']:.9f} mm")
        print()
        print("  PART FOOTPRINT")
        print(f"    Model footprint (turning plane) : {fp['model_diameter_mm']:.3f} × {fp['model_diameter_mm']:.3f} mm")
        print(f"    Axial length                    : {fp['model_axial_length_mm']:.3f} mm")
        print(f"    Global CAD bounding box         : X={fp['global_x_length_mm']:.3f} × Y={fp['global_y_length_mm']:.3f} × Z={fp['global_z_length_mm']:.3f} mm")
        print("    Note                             : global AABB is axis-aligned to world X/Y/Z; the 55×55 value is the physical radial footprint after axis alignment.")
        print(f"    Stock envelope                  : Ø{fp['stock_diameter_mm']:.3f} × {fp['stock_length_mm']:.3f} mm")
        print(f"    Validation                      : {fp['status']}")


def print_turning_analysis(analyses):
    """Print the turning report in the requested manufacturing order."""
    print("\n================ TURNING MANUFACTURING ANALYSIS ================")
    total_model_area = 0.0
    total_removed_area = 0.0
    removed_area_known = True

    for a in analyses:
        print()
        print(f"Body {a['body_id']}")
        print("-" * 64)

        # 1) Axis recognition/definition comes first and explicitly names the axis.
        axis = a["axis_definition"]
        cv = a["coordinate_validation"]
        print("  1. AXIS RECOGNITION & DEFINITION")
        print("    Recognized spindle axis : LOCAL Z")
        print(f"    Global axis direction  : {tuple(round(x,6) for x in axis['spindle_axis_global'])}")
        print(f"    Axis point (global)    : {tuple(round(x,3) for x in axis['axis_point_global'])}")
        print("    Definition             : LOCAL Z is the turning spindle/tool axis")
        print(f"    Angle to Global X/Y/Z  : {axis['angle_to_global_x_deg']:.4f} / {axis['angle_to_global_y_deg']:.4f} / {axis['angle_to_global_z_deg']:.4f} deg")
        print()

        # 2) Global/local alignment and actual rotation matrix.
        print("  2. GLOBAL ↔ LOCAL AXIS ALIGNMENT")
        print("    Local X : radial reference direction")
        print("    Local Y : radial reference direction")
        print("    Local Z : spindle/turning direction")
        print("    Rotation matrix R (LOCAL → GLOBAL):")
        for row in axis["rotation_matrix_local_to_global"]:
            print(f"      [{row[0]: .6f}  {row[1]: .6f}  {row[2]: .6f}]")
        print("    Global → Local uses Rᵀ and Local → Global uses R")
        print(f"    Orthonormal check      : XY={cv['xy_dot']:.3e}, XZ={cv['xz_dot']:.3e}, YZ={cv['yz_dot']:.3e}")
        print(f"    Right-handed check     : error={cv['right_handed_error']:.3e}")
        print(f"    Coordinate round-trip  : {a['center_of_mass_round_trip_error_mm']:.9f} mm")
        print()

        # 3) Footprint: global CAD dimensions first, local turning envelope second.
        fp = a["footprint"]
        print("  3. PART FOOTPRINT VALIDATION")
        print(f"    Global footprint       : X={fp['global_x_length_mm']:.3f} × Y={fp['global_y_length_mm']:.3f} mm")
        print(f"    Global model length    : Z={fp['global_z_length_mm']:.3f} mm")
        print(f"    Turning envelope       : Ø{fp['model_diameter_mm']:.3f} × {fp['model_axial_length_mm']:.3f} mm")
        print(f"    Stock envelope         : Ø{fp['stock_diameter_mm']:.3f} × {fp['stock_length_mm']:.3f} mm")
        print(f"    Radial clearance       : {fp['radial_clearance_mm']:.3f} mm")
        print(f"    Axial clearance/end    : {fp['axial_clearance_each_end_mm']:.3f} mm")
        print(f"    Global/local mapping   : round-trip={fp['max_geometry_round_trip_error_mm']:.9f} mm")
        print(f"    Stock containment      : {fp['status']}")
        print()

        # 4) Existing manufacturing feature information.
        print("  4. MANUFACTURING FEATURES")
        if not a.get("features"):
            print("    No manufacturing features detected.")
        else:
            for i, f in enumerate(a["features"], 1):
                d = f.get("details", {})
                print(f"\n    FEATURE {i}: {f.get('type')}")
                for key, label in (("diameter_mm","Diameter"),("axial_length_mm","Axial length"),("depth_mm","Depth"),("large_diameter_mm","Large diameter"),("small_diameter_mm","Small diameter"),("quantity","Quantity")):
                    if key in d and d[key] is not None:
                        try:
                            val = f"{float(d[key]):.3f} mm" if key != "quantity" else str(int(d[key]))
                        except (TypeError, ValueError):
                            val = str(d[key])
                        print(f"      {label:<18}: {val}")
                if d.get("tool_family"):
                    print(f"      {'Tool family':<18}: {d['tool_family']}")
                if d.get("tool_path_strategy"):
                    print(f"      {'Tool path':<18}: {d['tool_path_strategy']}")
                if f.get("faces") is not None:
                    print(f"      {'Faces':<18}: {f.get('faces')}")
                if f.get("axis") is not None:
                    print(f"      {'Axis':<18}: {tuple(round(x,3) for x in f.get('axis'))}")
        print()

        # 5) Stock/material removal.
        s = a["stock"]
        area_text = f"{s['material_removed_area_mm2']:.3f} mm²" if s.get("material_removed_area_mm2") is not None else "N/A"
        print("  5. STOCK / MATERIAL REMOVAL")
        print(f"    Stock                  : Ø{s['stock_diameter_mm']:.3f} × {s['stock_length_mm']:.3f} mm")
        print(f"    Stock volume           : {s['stock_volume_mm3']:.3f} mm³")
        print(f"    Finished volume        : {s['finished_volume_mm3']:.3f} mm³")
        print(f"    Material removed       : {s['material_removed_mm3']:.3f} mm³ ({s['material_removed_percent_of_stock']:.2f}%)")
        print(f"    Material removal area  : {area_text}")
        print(f"    Finished surface area  : {a['finished_surface_area_mm2']:.3f} mm²")
        print()

        # 6) Tool mechanism + animation.  This is a planning preview, not G-code.
        print("  6. TURNING MECHANISM / TOOL PATH")
        print("    Coordinate frame       : LOCAL X = radial / LOCAL Z = spindle axis")
        for i, o in enumerate(a.get("operation_sequence", []), 1):
            print(f"\n    OPERATION {i}: {o['feature']}")
            print(f"      Tool family          : {o['tool_family']}")
            print(f"      Movement strategy    : {o['path']}")
            if o.get("feature") == "AXIAL DRILLING":
                d = o.get("details", {})
                print(f"      Movement             : approach → drill {float(d.get('depth_mm',0) or 0):.3f} mm → retract")
            elif "FACING" in str(o.get("path", "")):
                print("      Movement             : radial sweep across end face")
            elif "BORING" in str(o.get("path", "")):
                print("      Movement             : axial entry → longitudinal bore → retract")
            elif "LONGITUDINAL" in str(o.get("path", "")):
                print("      Movement             : radial approach → axial cutting pass → retract")
            else:
                print("      Movement             : approach → cutting path → retract")
        print(f"\n    Planned path segments : {len(a.get('toolpath_preview', []))}")
        print("    Animation             : generated as X-Z planning preview")
        print("    Note                  : preview is not CNC-ready G-code")
        animation_path, animation_error = _save_turning_toolpath_animation(a)
        if animation_path:
            print(f"    Animation file        : {animation_path}")
        else:
            print(f"    Animation status      : {animation_error}")
        print()

        # 7) Machinability is deliberately last: can the planned mechanism make it?
        print("  7. MACHINABILITY")
        machinable_count = 0
        non_machinable = []
        for i, o in enumerate(a.get("operation_sequence", []), 1):
            d = o.get("details", {})
            status = d.get("machinability", "MACHINABLE")
            reason = d.get("machinability_reason", "")
            if status.startswith("MACHINABLE"):
                machinable_count += 1
            else:
                non_machinable.append((i, o["feature"], status, reason))
            print(f"    Operation {i:<3} : {o['feature']:<24} → {status}")
            if reason:
                print(f"      Reason              : {reason}")
        if non_machinable:
            print("    Overall status        : NOT FULLY MACHINABLE WITH CURRENT PLAN")
        else:
            print("    Overall status        : MACHINABLE WITH CURRENT PLANNED CAPABILITIES")
        print()

        total_model_area += float(a.get("finished_surface_area_mm2", 0.0) or 0.0)
        if s.get("material_removed_area_mm2") is None:
            removed_area_known = False
        else:
            total_removed_area += float(s["material_removed_area_mm2"])

    if analyses:
        print("================ TOTAL MODEL SUMMARY ================")
        print(f"Total model surface area   : {total_model_area:.3f} mm²")
        print(f"Total material removal area: {total_removed_area:.3f} mm²" if removed_area_known else "Total material removal area: N/A")


def run_remaining_poc_features(
    primitive_faces,
    solids,
    body_coordinate_systems,
    fallback_coordinate_system=None
):
    """Run Sections 8-16 with body-specific geometry, topology and axes."""
    section_features = {number: [] for number in range(8, 17)}
    turning_analyses = []

    for body_id, solid in enumerate(solids, start=1):
        body_faces = [
            face for face in primitive_faces
            if face.get("solid_id") == body_id
        ]
        body_topology = build_topology_for_solid(solid)
        body_coordinate_system = body_coordinate_systems.get(
            body_id, fallback_coordinate_system
        )
        if body_coordinate_system is None:
            raise ValueError(f"No coordinate system available for Body {body_id}.")

        body_groups = group_cylindrical_faces(
            body_faces, body_coordinate_system
        )
        body_cylinders = classify_cylindrical_groups(
            body_groups, body_coordinate_system
        )

        body_sections = {
            8: recognize_holes_and_variants(
                body_cylinders, body_faces, body_topology,
                body_coordinate_system, [solid]
            ),
            9: recognize_pockets(
                body_faces, body_topology, body_coordinate_system
            ),
            10: recognize_slots(
                body_faces, body_topology, body_coordinate_system
            ),
            11: recognize_bosses(
                body_faces, body_topology, body_coordinate_system
            ),
            12: recognize_steps_fillets_chamfers(
                body_faces, body_topology, body_coordinate_system
            ),
            13: recognize_turning_features(
                body_faces, body_cylinders, body_topology,
                body_coordinate_system
            ),
            14: recognize_thin_and_undercut(
                body_faces, body_cylinders, body_topology,
                body_coordinate_system
            ),
            15: recognize_freeform_and_islands(
                body_faces, body_topology
            ),
            16: recognize_cross_features(
                body_cylinders, body_coordinate_system
            ),
        }

        turning_analyses.append(
            build_turning_analysis(
                body_id,
                solid,
                body_sections[13],
                body_coordinate_system,
                hole_features=body_sections[8],
            )
        )
        body_sections[13] = turning_analyses[-1]["features"]

        for section_number, feature_list in body_sections.items():
            for feature in feature_list:
                feature["body_id"] = body_id
                feature["orientation"] = _feature_orientation(
                    feature.get("axis"), body_coordinate_system
                )
                feature["accessibility"] = calculate_feature_accessibility(
                    feature, solid, body_coordinate_system
                )
            section_features[section_number].extend(feature_list)

    for section_number, feature_list in section_features.items():
        section_features[section_number] = _deduplicate_feature_list(
            feature_list
        )

    all_features = []
    for feature_list in section_features.values():
        all_features.extend(feature_list)

    relationships = build_compound_relationships(all_features)
    validate_poc_coverage(section_features)
    return section_features, relationships, turning_analyses


def validate_poc_coverage(section_features):
    """
    Internal guard that all nine feature-recognition POC sections
    are actually executed and represented in the result dictionary.
    It never changes the printed feature format.
    """
    expected = set(range(8, 17))
    actual = set(section_features.keys())

    missing = expected - actual

    if missing:
        raise RuntimeError(
            "POC feature sections missing from parser result: "
            + ", ".join(str(x) for x in sorted(missing))
        )

    return True



def _compact_value(value):
    if isinstance(value, float):
        return f"{value:.3f}"
    if isinstance(value, (list, tuple)):
        return "(" + ", ".join(f"{x:.3f}" if isinstance(x, float) else str(x) for x in value) + ")"
    return str(value)

def print_feature_block(feature, number=None):
    """Print each detected feature in one compact terminal line."""
    title = str(feature.get("type", "UNKNOWN")).replace("_", " ")
    prefix = f"FEATURE {number}: " if number is not None else "FEATURE: "
    parts = [prefix + title]
    if feature.get("body_id") is not None:
        parts.append(f"B{feature['body_id']}")
    details = feature.get("details", {})
    if isinstance(details, dict):
        preferred = (
            "diameter_mm", "large_diameter_mm", "small_diameter_mm", "depth_mm",
            "axial_length_mm", "length_mm", "width_mm", "height_mm", "tool_family",
            "tool_path_strategy", "machinability", "machinability_reason"
        )
        used = set()
        for key in preferred:
            if key in details and details[key] is not None:
                label = key.replace("_mm", "").replace("_", " ")
                parts.append(f"{label}={_compact_value(details[key])}")
                used.add(key)
        # Keep important feature-specific fields without dumping every derived value.
        for key in ("hole_type", "pocket_type", "slot_type", "boss_type", "turning_type", "accessibility"):
            if key in details and details[key] is not None and key not in used:
                parts.append(f"{key.replace('_', ' ')}={_compact_value(details[key])}")
    if feature.get("faces"):
        parts.append(f"Faces={feature['faces']}")
    if feature.get("axis") is not None:
        parts.append(f"Axis={_compact_value(feature['axis'])}")
    if feature.get("position") is not None:
        parts.append(f"Pos={_compact_value(feature['position'])}")
    if feature.get("orientation") is not None:
        parts.append(f"Ori={feature['orientation']}")
    if feature.get("accessibility") is not None and "accessibility=" not in " ".join(parts):
        parts.append(f"Access={feature['accessibility']}")
    if feature.get("confidence") is not None:
        try:
            parts.append(f"Conf={float(feature['confidence']):.2f}")
        except (TypeError, ValueError):
            parts.append(f"Conf={feature['confidence']}")
    print(" | ".join(parts))

def print_feature_section(number, title, features):
    """Print a compact section header followed by one line per feature."""
    print(f"\n================ {number}. {title} ================")
    if not features:
        print("No feature detected.")
        return
    for index, feature in enumerate(features, start=1):
        print_feature_block(feature, index)

def print_feature_relationships(relationships):
    """Print explicitly detected feature relationships."""
    if not relationships:
        return

    print("\n\n================================================")
    print("FEATURE RELATIONSHIPS")
    print("================================================")

    for parent, child, relation in relationships:
        parent_name = str(parent.get("type", "UNKNOWN")).replace("_", " ")
        child_name = str(child.get("type", "UNKNOWN")).replace("_", " ")
        print(f"{parent_name} -> {child_name} | {relation}")
        print(" Parent faces:", parent.get("faces", []))
        print(" Child faces:", child.get("faces", []))


def _aggregate_multi_solid_geometry(solids):
    """Return true STEP-level volume, area, bbox and center of mass."""
    if not solids:
        raise ValueError("No solids available for aggregation.")

    boxes = [s.BoundingBox() for s in solids]
    xmin = min(b.xmin for b in boxes)
    xmax = max(b.xmax for b in boxes)
    ymin = min(b.ymin for b in boxes)
    ymax = max(b.ymax for b in boxes)
    zmin = min(b.zmin for b in boxes)
    zmax = max(b.zmax for b in boxes)

    total_volume = sum(float(s.Volume()) for s in solids)
    total_area = sum(float(s.Area()) for s in solids)

    weighted = [0.0, 0.0, 0.0]
    if total_volume > 1e-12:
        for solid in solids:
            c = cq.Shape.centerOfMass(solid)
            v = float(solid.Volume())
            weighted[0] += c.x * v
            weighted[1] += c.y * v
            weighted[2] += c.z * v
        center = tuple(x / total_volume for x in weighted)
    else:
        center = None

    return {
        "solid_count": len(solids),
        "body_count": len(solids),
        "bounding_box": {
            "xmin": xmin, "xmax": xmax,
            "ymin": ymin, "ymax": ymax,
            "zmin": zmin, "zmax": zmax,
            "x_length": xmax - xmin,
            "y_length": ymax - ymin,
            "z_length": zmax - zmin,
        },
        "volume": total_volume,
        "surface_area": total_area,
        "center_of_mass": center,
    }


def process_step_file(step_file):
    """
    Process one STEP file using the existing parser pipeline.
    """
    model = load_step_file(step_file)
    solids = extract_solids(model)

    if not solids:
        raise ValueError("No solid body found in STEP file.")

    section_1 = build_section_1_report(
        step_file,
        model,
        solids
    )

    primitive_faces = extract_all_primitive_geometry(solids)

    coordinate_system = build_local_coordinate_system(
        primitive_faces
    )

    body_coordinate_systems = build_body_coordinate_systems(
        solids,
        primitive_faces,
        fallback_system=coordinate_system
    )

    alignment = calculate_axis_alignment(
        coordinate_system
    )

    # STEP-level geometry now covers ALL solids, not just Body 1.
    basic_geometry = _aggregate_multi_solid_geometry(solids)

    # Calculate a model-oriented bounding box per body and combine the
    # projected extrema. This avoids silently reporting Body 1 dimensions.
    local_boxes = [
        calculate_local_bounding_box(solid, coordinate_system)
        for solid in solids
    ]

    local_bbox = {
        "xmin": min(b["xmin"] for b in local_boxes),
        "xmax": max(b["xmax"] for b in local_boxes),
        "ymin": min(b["ymin"] for b in local_boxes),
        "ymax": max(b["ymax"] for b in local_boxes),
        "zmin": min(b["zmin"] for b in local_boxes),
        "zmax": max(b["zmax"] for b in local_boxes),
    }
    local_bbox.update({
        "x_length": local_bbox["xmax"] - local_bbox["xmin"],
        "y_length": local_bbox["ymax"] - local_bbox["ymin"],
        "z_length": local_bbox["zmax"] - local_bbox["zmin"],
    })

    # Sections 6-7 are also body-aware now. Each body's topology is used
    # only with that body's primitive faces.
    body_cylindrical_features = []
    body_planar_features = []
    body_topologies = {}

    for body_id, solid in enumerate(solids, start=1):
        body_faces = [
            f for f in primitive_faces
            if f.get("solid_id") == body_id
        ]
        body_coordinate_system = body_coordinate_systems[body_id]
        body_topology = build_topology_for_solid(solid)
        body_topologies[body_id] = body_topology

        body_groups = group_cylindrical_faces(
            body_faces, body_coordinate_system
        )
        body_cylinders = classify_cylindrical_groups(
            body_groups, body_coordinate_system
        )
        for feature in body_cylinders:
            feature["body_id"] = body_id
        body_cylindrical_features.extend(body_cylinders)

        planar_faces = classify_planar_faces(
            body_faces, body_coordinate_system
        )
        planar_features = identify_planar_relationships(
            planar_faces, body_topology
        )
        for feature in planar_features:
            feature["body_id"] = body_id
        body_planar_features.extend(planar_features)

    cylindrical_features = body_cylindrical_features
    planar_features = body_planar_features

    # Build manufacturing features/analysis before printing so the validated
    # turning axis and footprint are the FIRST manufacturing information shown.
    section_features, relationships, turning_analyses = run_remaining_poc_features(
        primitive_faces,
        solids,
        body_coordinate_systems,
        fallback_coordinate_system=coordinate_system
    )

    print_turning_setup_first(turning_analyses)

    print("\n================================================")
    print("PRIMARY MODEL SUMMARY")
    print("================================================")
    global_bb = basic_geometry["bounding_box"]
    print(f"Axis: Z={tuple(round(x,4) for x in coordinate_system['local_z'])}")
    print("Body axes: " + " | ".join(
        f"B{bid} Z={tuple(round(x,4) for x in body_coordinate_systems[bid]['local_z'])}"
        for bid in sorted(body_coordinate_systems)
    ))
    print(f"Global dimensions: {global_bb['x_length']:.3f} x {global_bb['y_length']:.3f} x {global_bb['z_length']:.3f} mm")
    print(f"Local dimensions: {local_bbox['x_length']:.3f} x {local_bbox['y_length']:.3f} x {local_bbox['z_length']:.3f} mm")
    print(f"Total volume: {basic_geometry['volume']:.3f} mm³ | Total model surface area: {basic_geometry['surface_area']:.3f} mm²")

    print("\n\n================================================")
    print("COMPACT PARSER OUTPUT")
    print("================================================")

    print_section_1_report(section_1)
    print_section_2_report(primitive_faces)
    print("\n================ TOPOLOGY BY BODY ================")
    for body_id in sorted(body_topologies):
        print(f"\nBody {body_id} topology:")
        print_topology_report(body_topologies[body_id])

    print_basic_geometry_report(basic_geometry)

    print_axis_orientation_report(
        coordinate_system,
        alignment,
        local_bbox
    )

    print_cylindrical_feature_report(
        cylindrical_features
    )

    print_planar_feature_report(
        planar_features
    )

    print_feature_section(
        8,
        "HOLES & HOLE VARIANTS",
        section_features[8]
    )

    print_feature_section(
        9,
        "POCKETS",
        section_features[9]
    )

    print_feature_section(
        10,
        "SLOTS / KEYWAYS",
        section_features[10]
    )

    print_feature_section(
        11,
        "BOSSES",
        section_features[11]
    )

    print_feature_section(
        12,
        "STEPS / FILLETS / CHAMFERS",
        section_features[12]
    )

    print_feature_section(
        13,
        "TURNING FEATURES",
        section_features[13]
    )

    print_feature_section(
        14,
        "THIN WALLS / FLOORS / UNDERCUTS",
        section_features[14]
    )

    print_feature_section(
        15,
        "FREEFORM / POCKET ISLANDS",
        section_features[15]
    )

    print_feature_section(
        16,
        "CROSS / RADIAL / ANGLED FEATURES",
        section_features[16]
    )

    print_feature_relationships(
        relationships
    )

    print_turning_analysis(turning_analyses)


def main():
    selected_files = select_step_files()

    if not selected_files:
        return

    print("\n================================================")
    print("CNC STEP POC PARSER")
    print("================================================")
    print(
        "Selected STEP files:",
        len(selected_files)
    )

    for index, step_file in enumerate(
        selected_files,
        start=1
    ):
        print("\n\n############################################################")
        print(
            f"FILE {index} OF {len(selected_files)}"
        )
        print("############################################################")
        print(
            "STEP file:",
            os.path.abspath(step_file)
        )

        try:
            process_step_file(
                step_file
            )
        except Exception as exc:
            print(
                "\nERROR:",
                str(exc)
            )
            print(
                "This file was skipped; remaining selected files will continue."
            )


if __name__ == "__main__":
    main()