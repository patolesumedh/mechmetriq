"""
Part thumbnail for Smart Quote: a small shaded isometric PNG of the solid.

Tessellates the B-Rep and draws it with matplotlib (no GPU / display
needed), with simple Lambert shading so the shape reads like a CAD preview.
"""

import base64
import io

import numpy as np

SIZE_PX = 360
MAX_TRIANGLES = 40_000
BASE_RGB = np.array([0.80, 0.81, 0.83])
LIGHT = np.array([0.35, -0.55, 0.76])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def _triangles(solids):
    tris = []
    for solid in solids:
        bb = solid.BoundingBox()
        diag = max(bb.DiagonalLength, 1e-6)
        verts, faces = solid.tessellate(diag * 0.002, 0.3)
        if not faces:
            continue
        v = np.array([(p.x, p.y, p.z) for p in verts], dtype=float)
        tris.append(v[np.array(faces, dtype=int)])
    if not tris:
        return None
    t = np.concatenate(tris)
    if len(t) > MAX_TRIANGLES:
        t = t[:: int(np.ceil(len(t) / MAX_TRIANGLES))]
    return _subdivide(t)


def _subdivide(t, budget=MAX_TRIANGLES, passes=6):
    """Split long triangles into 4 so matplotlib's painter sort layers them right."""
    pts = t.reshape(-1, 3)
    limit = (pts.max(axis=0) - pts.min(axis=0)).max() / 12
    for _ in range(passes):
        edge = np.max(
            np.stack([
                np.linalg.norm(t[:, 0] - t[:, 1], axis=1),
                np.linalg.norm(t[:, 1] - t[:, 2], axis=1),
                np.linalg.norm(t[:, 2] - t[:, 0], axis=1),
            ]),
            axis=0,
        )
        big = edge > limit
        if not big.any() or len(t) + 3 * big.sum() > budget:
            break
        a, b, c = t[big, 0], t[big, 1], t[big, 2]
        ab, bc, ca = (a + b) / 2, (b + c) / 2, (c + a) / 2
        split = np.concatenate([
            np.stack([a, ab, ca], 1), np.stack([ab, b, bc], 1),
            np.stack([ca, bc, c], 1), np.stack([ab, bc, ca], 1),
        ])
        t = np.concatenate([t[~big], split])
    return t


def render_thumbnail_png(solids, axis=None):
    """Return base64 PNG (no data: prefix) or None if rendering fails."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    tris = _triangles(solids)
    if tris is None:
        return None

    # Put the part's main axis vertical so turned parts stand upright.
    if axis is not None:
        z = np.asarray(axis, dtype=float)
        if np.linalg.norm(z) > 0:
            z = z / np.linalg.norm(z)
            helper = np.array([1.0, 0, 0]) if abs(z[0]) < 0.9 else np.array([0, 1.0, 0])
            x = np.cross(helper, z)
            x /= np.linalg.norm(x)
            y = np.cross(z, x)
            tris = tris @ np.stack([x, y, z], axis=1)

    normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    lengths[lengths == 0] = 1
    normals /= lengths
    shade = 0.38 + 0.62 * np.abs(normals @ LIGHT)
    colors = np.clip(BASE_RGB[None, :] * shade[:, None], 0, 1)

    pts = tris.reshape(-1, 3)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    center = (lo + hi) / 2
    radius = max((hi - lo).max() / 2, 1e-6)

    fig = plt.figure(figsize=(SIZE_PX / 100, SIZE_PX / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1], projection="3d")
    ax.add_collection3d(
        Poly3DCollection(tris, facecolors=colors, edgecolors=colors, linewidths=0.15)
    )
    for set_lim, c in zip((ax.set_xlim, ax.set_ylim, ax.set_zlim), center):
        set_lim(c - radius, c + radius)
    ax.set_box_aspect((1, 1, 1))
    ax.view_init(elev=28, azim=-55)
    ax.set_proj_type("ortho")
    ax.set_axis_off()
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, dpi=100)
    plt.close(fig)
    return base64.b64encode(_crop_square(buf.getvalue())).decode("ascii")


def _crop_square(png_bytes, pad=0.06):
    """Trim empty margins so the part fills the preview box."""
    from PIL import Image

    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if not box:
        return png_bytes
    x0, y0, x1, y1 = box
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * pad))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)), (0, 0))
    out = out.resize((256, 256), Image.LANCZOS)
    b = io.BytesIO()
    out.save(b, format="PNG", optimize=True)
    return b.getvalue()
