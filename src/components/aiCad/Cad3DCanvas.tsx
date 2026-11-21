"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { CappProcessPlan, DfmIssue, TurnedPartDocument } from "@/lib/aiCad/types";
import type { ParsedCadModel3D } from "@/lib/aiCad/cadFileParser";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

type FeatureRoleTag =
  | "od_cylinder"
  | "shoulder"
  | "chamfer_fillet"
  | "groove"
  | "thread"
  | "bore"
  | "cut_plane"
  | "chuck";

interface PolyFace {
  verts: Vec3[];
  normal: Vec3;
  baseColor: [number, number, number];
  alpha: number;
  role: FeatureRoleTag;
  wallThicknessMm?: number;
  isDfmAlert?: boolean;
  isThread?: boolean;
  isCutFace?: boolean;
  isChuck?: boolean;
}

export type ColorFilterMode = "material" | "feature_map" | "wall_heatmap";

const FEATURE_ROLE_COLORS: Record<FeatureRoleTag, [number, number, number]> = {
  od_cylinder: [56, 189, 248], // Sky blue
  shoulder: [16, 185, 129], // Emerald
  chamfer_fillet: [250, 204, 21], // Amber/Gold
  groove: [249, 115, 22], // Orange
  thread: [168, 85, 247], // Purple
  bore: [99, 102, 241], // Indigo
  cut_plane: [45, 212, 191], // Teal
  chuck: [34, 197, 94], // Green
};

export function Cad3DCanvas({
  doc,
  capp,
  issues,
  parsedModel,
  heightClass = "h-[330px]",
}: {
  doc: TurnedPartDocument;
  capp: CappProcessPlan;
  issues: DfmIssue[];
  parsedModel?: ParsedCadModel3D | null;
  heightClass?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [renderStyle, setRenderStyle] = useState<"shaded" | "wireframe" | "xray">("shaded");
  const [colorFilter, setColorFilter] = useState<ColorFilterMode>("material");
  const defaultGeometrySource: "parametric" | "mesh" | "prismatic" =
    parsedModel?.triangles && parsedModel.triangles.length > 0
      ? "mesh"
      : parsedModel && !parsedModel.rotational
      ? "prismatic"
      : "parametric";
  const [geometryOverride, setGeometryOverride] = useState<{
    model: ParsedCadModel3D | null | undefined;
    source: "parametric" | "mesh" | "prismatic";
  } | null>(null);
  const geometrySource =
    geometryOverride && geometryOverride.model === parsedModel
      ? geometryOverride.source
      : defaultGeometrySource;
  const setGeometrySource = (source: "parametric" | "mesh" | "prismatic") =>
    setGeometryOverride({ model: parsedModel, source });
  const [sectionCut, setSectionCut] = useState<boolean>(false);
  const [showChuck, setShowChuck] = useState<boolean>(true);
  const [showDims, setShowDims] = useState<boolean>(true);
  const [showBbox, setShowBbox] = useState<boolean>(false);
  const [showDfmGlow, setShowDfmGlow] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 720, h: 360 });

  // Orbit camera angles (yaw, pitch), pan offset, and zoom
  const [rotation, setRotation] = useState<{ yaw: number; pitch: number }>({
    yaw: -0.58,
    pitch: 0.38,
  });
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.08);

  const draggingRef = useRef<{
    active: boolean;
    mode: "orbit" | "pan";
    lastX: number;
    lastY: number;
  }>({
    active: false,
    mode: "orbit",
    lastX: 0,
    lastY: 0,
  });

  // Track container resize for crisp high-DPI rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 20 && height > 20) {
          setCanvasSize({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, expanded]);

  // Smooth 60fps turntable auto-rotation
  useEffect(() => {
    if (!autoRotate || viewMode !== "3d") return;
    let rafId = 0;
    const step = () => {
      setRotation((r) => ({ ...r, yaw: r.yaw + 0.008 }));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [autoRotate, viewMode]);

  // Material base RGB colors
  const matColor = useMemo<[number, number, number]>(
    () =>
      doc.material.slug === "brass"
        ? [218, 175, 72]
        : doc.material.slug === "aluminium"
        ? [196, 210, 226]
        : doc.material.slug === "stainless"
        ? [176, 186, 198]
        : [132, 148, 168],
    [doc.material.slug]
  );

  function resetCamera() {
    setRotation({ yaw: -0.58, pitch: 0.38 });
    setPan({ x: 0, y: 0 });
    setZoom(1.08);
    setAutoRotate(false);
  }

  function exportSnapshotPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_3d_render.png`;
    a.click();
  }

  useEffect(() => {
    if (viewMode !== "3d") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Supersampled high-resolution DPI scaling without hurting frame rate
    const rawDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(2.5, rawDpr * (isInteracting ? 1.0 : 1.35));
    const width = canvasSize.w || canvas.clientWidth || 680;
    const height = canvasSize.h || canvas.clientHeight || 350;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Studio background gradient
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(0.6, "#111827");
    grad.addColorStop(1, "#090d16");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle CAD studio background grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < width; gx += 36) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
    for (let gy = 0; gy < height; gy += 36) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }

    const totalLen = Math.max(10, capp.overall_length_mm);
    const maxOd = Math.max(10, capp.max_od_mm);
    const gripLen =
      showChuck && geometrySource === "parametric"
        ? capp.recommended_stock.chuck_grip_allowance_mm
        : 0;

    let sceneSpan = Math.max(totalLen + gripLen * 1.35, maxOd * 1.55);
    if (geometrySource === "mesh" && parsedModel?.bbox_mm) {
      sceneSpan = Math.max(...parsedModel.bbox_mm, 20) * 1.45;
    } else if (geometrySource === "prismatic" && parsedModel?.bbox_mm) {
      sceneSpan = Math.max(...parsedModel.bbox_mm, 20) * 1.45;
    }

    const scale = (Math.min(width, height) * 0.65 * zoom) / sceneSpan;
    const zCenter = geometrySource === "parametric" ? totalLen / 2 : 0;

    const cosYaw = Math.cos(rotation.yaw);
    const sinYaw = Math.sin(rotation.yaw);
    const cosPitch = Math.cos(rotation.pitch);
    const sinPitch = Math.sin(rotation.pitch);

    function project(p: Vec3): { sx: number; sy: number; depth: number; cam: Vec3 } {
      const zRel = p.z - zCenter;
      const x0 = zRel;
      const y0 = p.y;
      const z0 = p.x;

      const x1 = x0 * cosYaw - z0 * sinYaw;
      const z1 = x0 * sinYaw + z0 * cosYaw;
      const y2 = y0 * cosPitch - z1 * sinPitch;
      const z2 = y0 * sinPitch + z1 * cosPitch;

      return {
        sx: width * 0.52 + pan.x + x1 * scale,
        sy: height * 0.52 + pan.y - y2 * scale,
        depth: z2,
        cam: { x: x1, y: y2, z: z2 },
      };
    }

    function rotateNormal(n: Vec3): Vec3 {
      const x0 = n.z;
      const y0 = n.y;
      const z0 = n.x;
      const x1 = x0 * cosYaw - z0 * sinYaw;
      const z1 = x0 * sinYaw + z0 * cosYaw;
      const y2 = y0 * cosPitch - z1 * sinPitch;
      const z2 = y0 * sinPitch + z1 * cosPitch;
      return { x: x1, y: y2, z: z2 };
    }

    function pickSurfaceColor(
      role: FeatureRoleTag,
      isAlert: boolean | undefined,
      wallThicknessMm: number | undefined
    ): [number, number, number] {
      if (isAlert && showDfmGlow && colorFilter === "material") {
        return [239, 68, 68];
      }
      if (colorFilter === "feature_map") {
        return FEATURE_ROLE_COLORS[role] ?? matColor;
      }
      if (colorFilter === "wall_heatmap") {
        if (role === "chuck") return [34, 197, 94];
        const t = wallThicknessMm ?? maxOd / 2;
        const minSafe = doc.material.min_wall_mm || 1.0;
        if (t < minSafe) return [239, 68, 68]; // Critical thin wall (Red)
        if (t < minSafe * 2.0) return [245, 158, 11]; // Caution wall (Amber)
        if (t < minSafe * 4.0) return [56, 189, 248]; // Medium wall (Cyan)
        return [16, 185, 129]; // Robust solid section (Emerald)
      }
      return matColor;
    }

    const faces: PolyFace[] = [];

    if (geometrySource === "mesh" && parsedModel?.triangles && parsedModel.triangles.length > 0) {
      const tris = parsedModel.triangles;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const t of tris) {
        for (const v of [t.v0, t.v1, t.v2]) {
          if (v[0] < minX) minX = v[0];
          if (v[0] > maxX) maxX = v[0];
          if (v[1] < minY) minY = v[1];
          if (v[1] > maxY) maxY = v[1];
          if (v[2] < minZ) minZ = v[2];
          if (v[2] > maxZ) maxZ = v[2];
        }
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;

      const maxTris = isInteracting ? 2800 : 6000;
      const stride = Math.max(1, Math.floor(tris.length / maxTris));
      for (let i = 0; i < tris.length; i += stride) {
        const t = tris[i];
        const v0: Vec3 = { x: t.v0[0] - cx, y: t.v0[1] - cy, z: t.v0[2] - cz };
        const v1: Vec3 = { x: t.v1[0] - cx, y: t.v1[1] - cy, z: t.v1[2] - cz };
        const v2: Vec3 = { x: t.v2[0] - cx, y: t.v2[1] - cy, z: t.v2[2] - cz };

        if (sectionCut && v0.x > 0 && v1.x > 0 && v2.x > 0) continue;

        faces.push({
          verts: [v0, v1, v2],
          normal: { x: t.normal[0], y: t.normal[1], z: t.normal[2] },
          baseColor: pickSurfaceColor("od_cylinder", false, maxOd * 0.25),
          alpha: renderStyle === "xray" ? 0.42 : 1.0,
          role: "od_cylinder",
        });
      }
    } else if (geometrySource === "prismatic" && parsedModel) {
      const [bx, by, bz] = parsedModel.bbox_mm;
      const hx = bx / 2;
      const hy = by / 2;
      const hz = bz / 2;
      const xMin = -hx;
      const xMax = sectionCut ? 0 : hx;

      const corners: Vec3[] = [
        { x: xMin, y: -hy, z: -hz },
        { x: xMax, y: -hy, z: -hz },
        { x: xMax, y: hy, z: -hz },
        { x: xMin, y: hy, z: -hz },
        { x: xMin, y: -hy, z: hz },
        { x: xMax, y: -hy, z: hz },
        { x: xMax, y: hy, z: hz },
        { x: xMin, y: hy, z: hz },
      ];

      const boxFaces: { idx: [number, number, number, number]; n: Vec3; cut?: boolean }[] = [
        { idx: [0, 1, 2, 3], n: { x: 0, y: 0, z: -1 } },
        { idx: [4, 5, 6, 7], n: { x: 0, y: 0, z: 1 } },
        { idx: [0, 1, 5, 4], n: { x: 0, y: -1, z: 0 } },
        { idx: [3, 2, 6, 7], n: { x: 0, y: 1, z: 0 } },
        { idx: [0, 3, 7, 4], n: { x: -1, y: 0, z: 0 } },
        { idx: [1, 2, 6, 5], n: { x: 1, y: 0, z: 0 }, cut: sectionCut },
      ];

      for (const bf of boxFaces) {
        const role: FeatureRoleTag = bf.cut ? "cut_plane" : "od_cylinder";
        faces.push({
          verts: bf.idx.map((i) => corners[i]),
          normal: bf.n,
          baseColor: bf.cut ? [72, 187, 178] : pickSurfaceColor(role, false, Math.min(bx, by) * 0.3),
          alpha: renderStyle === "xray" ? 0.45 : 1.0,
          role,
          isCutFace: bf.cut,
        });
      }

      for (const feat of parsedModel.prismaticFeatures ?? []) {
        if (feat.kind === "hole" && feat.diameter_mm) {
          const r = feat.diameter_mm / 2;
          const steps = isInteracting ? 18 : 28;
          for (let s = 0; s < steps; s++) {
            const a0 = (s / steps) * Math.PI * 2;
            const a1 = ((s + 1) / steps) * Math.PI * 2;
            faces.push({
              verts: [
                { x: feat.x_mm + r * Math.cos(a0), y: hy + 0.2, z: feat.y_mm + r * Math.sin(a0) },
                { x: feat.x_mm + r * Math.cos(a1), y: hy + 0.2, z: feat.y_mm + r * Math.sin(a1) },
                { x: feat.x_mm + r * Math.cos(a1), y: -hy - 0.2, z: feat.y_mm + r * Math.sin(a1) },
                { x: feat.x_mm + r * Math.cos(a0), y: -hy - 0.2, z: feat.y_mm + r * Math.sin(a0) },
              ],
              normal: { x: -Math.cos(a0), y: 0, z: -Math.sin(a0) },
              baseColor: pickSurfaceColor("bore", false, 3),
              alpha: 0.95,
              role: "bore",
            });
          }
        }
      }
    } else {
      // High-Resolution Parametric Revolved Turning B-Rep Solid
      const profileRings: {
        z: number;
        rExt: number;
        segId: string;
        role: FeatureRoleTag;
        isThread?: boolean;
        isDfmAlert?: boolean;
      }[] = [];

      const alertedSegIds = new Set(
        issues
          .filter(
            (i) => i.severity === "error" || i.severity === "warning" || i.severity === "blocker"
          )
          .map((i) => i.feature_ref)
          .filter(Boolean)
      );

      const rBore =
        doc.bore.enabled && doc.bore.diameter_mm > 0
          ? Math.min(doc.bore.diameter_mm / 2, maxOd / 2 - 0.35)
          : 0;
      const boreDepth = doc.bore.enabled
        ? doc.bore.is_through
          ? totalLen
          : Math.min(totalLen, doc.bore.depth_mm)
        : 0;

      let zCursor = 0;
      for (let i = 0; i < doc.segments.length; i++) {
        const seg = doc.segments[i];
        const rStart = seg.diameter_mm / 2;
        const rEnd =
          seg.taper_end_diameter_mm && seg.taper_end_diameter_mm > 0
            ? seg.taper_end_diameter_mm / 2
            : rStart;
        const z0 = zCursor;
        const z1 = zCursor + seg.length_mm;
        const isAlert = alertedSegIds.has(seg.id);
        const cStart = Math.min(seg.chamfer_start_mm || 0, seg.length_mm * 0.2, rStart * 0.25);
        const cEnd = Math.min(seg.chamfer_end_mm || 0, seg.length_mm * 0.2, rEnd * 0.25);
        const segRole: FeatureRoleTag = seg.thread ? "thread" : "od_cylinder";

        if (cStart > 0 && i === 0) {
          profileRings.push({
            z: z0,
            rExt: Math.max(1, rStart - cStart),
            segId: seg.id,
            role: "chamfer_fillet",
            isDfmAlert: isAlert,
          });
          profileRings.push({
            z: z0 + cStart,
            rExt: rStart,
            segId: seg.id,
            role: segRole,
            isDfmAlert: isAlert,
          });
        } else {
          // If step change from previous segment, mark shoulder transition
          if (profileRings.length > 0 && Math.abs(profileRings[profileRings.length - 1].rExt - rStart) > 0.2) {
            profileRings.push({
              z: z0,
              rExt: rStart,
              segId: seg.id,
              role: "shoulder",
              isDfmAlert: isAlert,
            });
          }
          profileRings.push({
            z: z0,
            rExt: rStart,
            segId: seg.id,
            role: segRole,
            isDfmAlert: isAlert,
          });
        }

        // Subdivide grooved segments or threaded segments for high visual fidelity
        if (seg.groove && seg.length_mm > seg.groove.width_mm + 4) {
          const gz0 = z0 + seg.groove.offset_from_start_mm - seg.groove.width_mm / 2;
          const gz1 = gz0 + seg.groove.width_mm;
          const gR = Math.max(2, rStart - seg.groove.depth_mm);
          profileRings.push({
            z: gz0,
            rExt: rStart,
            segId: seg.id,
            role: segRole,
            isDfmAlert: isAlert,
          });
          profileRings.push({
            z: gz0 + 0.08,
            rExt: gR,
            segId: seg.id,
            role: "groove",
            isDfmAlert: isAlert,
          });
          profileRings.push({
            z: gz1 - 0.08,
            rExt: gR,
            segId: seg.id,
            role: "groove",
            isDfmAlert: isAlert,
          });
          profileRings.push({
            z: gz1,
            rExt: rStart,
            segId: seg.id,
            role: segRole,
            isDfmAlert: isAlert,
          });
        } else if (seg.thread) {
          // Fine axial thread crests for realistic ISO metric thread appearance
          const threadRings = isInteracting ? 6 : 12;
          const zStartT = z0 + cStart;
          const zEndT = z1 - cEnd;
          const pitchDepth = Math.min(0.9, (seg.thread.pitch_mm || 1.5) * 0.38);
          for (let tr = 1; tr < threadRings; tr++) {
            const zt = zStartT + (tr / threadRings) * (zEndT - zStartT);
            const rCrest = tr % 2 === 0 ? rStart : Math.max(2, rStart - pitchDepth);
            profileRings.push({
              z: zt,
              rExt: rCrest,
              segId: seg.id,
              role: "thread",
              isThread: true,
              isDfmAlert: isAlert,
            });
          }
        }

        if (cEnd > 0 && i === doc.segments.length - 1) {
          profileRings.push({
            z: z1 - cEnd,
            rExt: rEnd,
            segId: seg.id,
            role: segRole,
            isThread: !!seg.thread,
            isDfmAlert: isAlert,
          });
          profileRings.push({
            z: z1,
            rExt: Math.max(1, rEnd - cEnd),
            segId: seg.id,
            role: "chamfer_fillet",
            isThread: false,
            isDfmAlert: isAlert,
          });
        } else {
          profileRings.push({
            z: z1,
            rExt: rEnd,
            segId: seg.id,
            role: segRole,
            isThread: !!seg.thread,
            isDfmAlert: isAlert,
          });
        }

        zCursor = z1;
      }

      // Adaptive angular resolution: 64 steps when idle, 40 steps when actively dragging
      const thetaSteps = sectionCut
        ? isInteracting
          ? 24
          : 36
        : isInteracting
        ? 40
        : 64;
      const thetaStart = sectionCut ? Math.PI * 0.5 : 0;
      const thetaSpan = sectionCut ? Math.PI : Math.PI * 2;
      const baseAlpha = renderStyle === "xray" ? 0.42 : 1.0;

      const ringPoint = (r: number, theta: number, z: number): Vec3 => ({
        x: r * Math.cos(theta),
        y: r * Math.sin(theta),
        z,
      });

      for (let i = 0; i < profileRings.length - 1; i++) {
        const a = profileRings[i];
        const b = profileRings[i + 1];
        const dz = b.z - a.z;
        const dr = b.rExt - a.rExt;
        const len = Math.hypot(dz, dr) || 1;
        const zMid = (a.z + b.z) * 0.5;
        const rAvg = (a.rExt + b.rExt) * 0.5;
        const wallT = zMid <= boreDepth && rBore > 0 ? Math.max(0.1, rAvg - rBore) : rAvg;
        const faceRole: FeatureRoleTag =
          Math.abs(dz) < 0.05 && Math.abs(dr) > 0.2 ? "shoulder" : b.role;
        const alertFlag = b.isDfmAlert || a.isDfmAlert;

        for (let t = 0; t < thetaSteps; t++) {
          const th0 = thetaStart + (t / thetaSteps) * thetaSpan;
          const th1 = thetaStart + ((t + 1) / thetaSteps) * thetaSpan;
          const thMid = (th0 + th1) * 0.5;

          const v0 = ringPoint(a.rExt, th0, a.z);
          const v1 = ringPoint(b.rExt, th0, b.z);
          const v2 = ringPoint(b.rExt, th1, b.z);
          const v3 = ringPoint(a.rExt, th1, a.z);

          const nr = dz / len;
          const nz = -dr / len;
          const normal: Vec3 = {
            x: nr * Math.cos(thMid),
            y: nr * Math.sin(thMid),
            z: nz,
          };

          faces.push({
            verts: [v0, v1, v2, v3],
            normal,
            baseColor: pickSurfaceColor(faceRole, alertFlag, wallT),
            alpha: baseAlpha,
            role: faceRole,
            wallThicknessMm: wallT,
            isDfmAlert: alertFlag,
            isThread: b.isThread,
          });
        }
      }

      const rFrontOuter = profileRings[0]?.rExt ?? 10;
      const rRearOuter = profileRings[profileRings.length - 1]?.rExt ?? 10;
      const rFrontInner = rBore > 0 ? rBore : 0;
      const rRearInner = rBore > 0 && boreDepth >= totalLen - 0.01 ? rBore : 0;

      for (let t = 0; t < thetaSteps; t++) {
        const th0 = thetaStart + (t / thetaSteps) * thetaSpan;
        const th1 = thetaStart + ((t + 1) / thetaSteps) * thetaSpan;

        faces.push({
          verts: [
            ringPoint(rFrontInner, th0, 0),
            ringPoint(rFrontOuter, th0, 0),
            ringPoint(rFrontOuter, th1, 0),
            ringPoint(rFrontInner, th1, 0),
          ],
          normal: { x: 0, y: 0, z: -1 },
          baseColor: pickSurfaceColor("shoulder", false, rFrontOuter - rFrontInner),
          alpha: baseAlpha,
          role: "shoulder",
        });

        faces.push({
          verts: [
            ringPoint(rRearInner, th0, totalLen),
            ringPoint(rRearOuter, th0, totalLen),
            ringPoint(rRearOuter, th1, totalLen),
            ringPoint(rRearInner, th1, totalLen),
          ],
          normal: { x: 0, y: 0, z: 1 },
          baseColor: pickSurfaceColor("shoulder", false, rRearOuter - rRearInner),
          alpha: baseAlpha,
          role: "shoulder",
        });
      }

      if (rBore > 0 && boreDepth > 0) {
        const boreZSteps = 8;
        const boreAlert = issues.some((i) => i.code === "DEEP_BORE_LD_EXCEEDED") && showDfmGlow;
        for (let bz = 0; bz < boreZSteps; bz++) {
          const z0 = (bz / boreZSteps) * boreDepth;
          const z1 = ((bz + 1) / boreZSteps) * boreDepth;
          for (let t = 0; t < thetaSteps; t++) {
            const th0 = thetaStart + (t / thetaSteps) * thetaSpan;
            const th1 = thetaStart + ((t + 1) / thetaSteps) * thetaSpan;
            const thMid = (th0 + th1) * 0.5;
            faces.push({
              verts: [
                ringPoint(rBore, th0, z0),
                ringPoint(rBore, th0, z1),
                ringPoint(rBore, th1, z1),
                ringPoint(rBore, th1, z0),
              ],
              normal: {
                x: -Math.cos(thMid),
                y: -Math.sin(thMid),
                z: 0,
              },
              baseColor:
                colorFilter === "feature_map"
                  ? FEATURE_ROLE_COLORS.bore
                  : boreAlert
                  ? [245, 158, 11]
                  : [96, 114, 138],
              alpha: baseAlpha,
              role: "bore",
            });
          }
        }

        if (boreDepth < totalLen - 0.01) {
          for (let t = 0; t < thetaSteps; t++) {
            const th0 = thetaStart + (t / thetaSteps) * thetaSpan;
            const th1 = thetaStart + ((t + 1) / thetaSteps) * thetaSpan;
            faces.push({
              verts: [
                ringPoint(0, th0, boreDepth),
                ringPoint(rBore, th0, boreDepth),
                ringPoint(rBore, th1, boreDepth),
                ringPoint(0, th1, boreDepth),
              ],
              normal: { x: 0, y: 0, z: -1 },
              baseColor: [88, 102, 122],
              alpha: baseAlpha,
              role: "bore",
            });
          }
        }
      }

      if (sectionCut) {
        for (let i = 0; i < profileRings.length - 1; i++) {
          const a = profileRings[i];
          const b = profileRings[i + 1];
          const rInA = rBore > 0 && a.z <= boreDepth ? rBore : 0;
          const rInB = rBore > 0 && b.z <= boreDepth ? rBore : 0;
          const wallT = Math.max(0.1, a.rExt - rInA);

          for (const th of [thetaStart, thetaStart + thetaSpan]) {
            faces.push({
              verts: [
                ringPoint(rInA, th, a.z),
                ringPoint(a.rExt, th, a.z),
                ringPoint(b.rExt, th, b.z),
                ringPoint(rInB, th, b.z),
              ],
              normal: { x: 1, y: 0, z: 0 },
              baseColor:
                colorFilter === "wall_heatmap"
                  ? pickSurfaceColor("cut_plane", a.isDfmAlert, wallT)
                  : a.isDfmAlert
                  ? [248, 113, 113]
                  : [45, 212, 191],
              alpha: 0.96,
              role: "cut_plane",
              isCutFace: true,
            });
          }
        }
      }

      if (showChuck) {
        const rStock = capp.recommended_stock.standard_diameter_mm / 2;
        const gLen = capp.recommended_stock.chuck_grip_allowance_mm;
        const jawAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        for (const ja of jawAngles) {
          const span = 0.42;
          const th0 = ja - span / 2;
          const th1 = ja + span / 2;
          const rJawOuter = rStock + Math.max(6, rStock * 0.28);
          faces.push({
            verts: [
              ringPoint(rStock, th0, -gLen),
              ringPoint(rStock, th0, 2),
              ringPoint(rJawOuter, th0, 2),
              ringPoint(rJawOuter, th0, -gLen),
            ],
            normal: { x: 0, y: 1, z: 0 },
            baseColor: [34, 197, 94],
            alpha: 0.35,
            role: "chuck",
            isChuck: true,
          });
          faces.push({
            verts: [
              ringPoint(rJawOuter, th0, -gLen),
              ringPoint(rJawOuter, th0, 2),
              ringPoint(rJawOuter, th1, 2),
              ringPoint(rJawOuter, th1, -gLen),
            ],
            normal: { x: Math.cos(ja), y: Math.sin(ja), z: 0 },
            baseColor: [34, 197, 94],
            alpha: 0.45,
            role: "chuck",
            isChuck: true,
          });
        }
      }
    }

    // Painter's Algorithm Depth Sort + Dual-Light Anisotropic Blinn-Phong Shading
    const keyLight = { x: -0.38, y: 0.68, z: 0.62 };
    const fillLight = { x: 0.55, y: -0.35, z: 0.75 };

    const rendered = faces.map((f) => {
      const pVerts = f.verts.map(project);
      const avgDepth =
        pVerts.reduce((acc, v) => acc + v.depth, 0) / Math.max(1, pVerts.length);
      const rn = rotateNormal(f.normal);
      const dotKey = Math.max(
        0,
        rn.x * keyLight.x + rn.y * keyLight.y + Math.abs(rn.z) * keyLight.z
      );
      const dotFill = Math.max(
        0,
        rn.x * fillLight.x + rn.y * fillLight.y + Math.abs(rn.z) * fillLight.z
      );
      return { f, pVerts, avgDepth, dotKey, dotFill };
    });

    rendered.sort((a, b) => a.avgDepth - b.avgDepth);

    for (const item of rendered) {
      const { f, pVerts, dotKey, dotFill } = item;
      const ambient = f.isCutFace ? 0.58 : 0.32;
      const diffuse = dotKey * 0.62 + dotFill * 0.18;
      const spec = Math.pow(dotKey, 18) * (f.isCutFace ? 0.08 : 0.34);
      const shade = ambient + diffuse;

      const r = Math.min(255, Math.round(f.baseColor[0] * shade + spec * 255));
      const g = Math.min(255, Math.round(f.baseColor[1] * shade + spec * 255));
      const b = Math.min(255, Math.round(f.baseColor[2] * shade + spec * 255));

      ctx.beginPath();
      ctx.moveTo(pVerts[0].sx, pVerts[0].sy);
      for (let k = 1; k < pVerts.length; k++) {
        ctx.lineTo(pVerts[k].sx, pVerts[k].sy);
      }
      ctx.closePath();

      if (renderStyle !== "wireframe") {
        ctx.fillStyle = `rgba(${r},${g},${b},${f.alpha})`;
        ctx.fill();
      }

      if (renderStyle === "wireframe") {
        ctx.strokeStyle = f.isDfmAlert
          ? "rgba(248, 113, 113, 0.85)"
          : "rgba(56, 189, 248, 0.52)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else if (f.isCutFace) {
        ctx.strokeStyle = "rgba(45, 212, 191, 0.65)";
        ctx.lineWidth = 0.75;
        ctx.stroke();
      } else if (f.isChuck) {
        ctx.strokeStyle = "rgba(74, 222, 128, 0.75)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else {
        // Subtle seam elimination stroke matching face color
        ctx.strokeStyle = `rgba(${r},${g},${b},${f.alpha * 0.55})`;
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }
    }

    // Optional Bounding Box Envelope Cage
    if (showBbox) {
      const bx = maxOd / 2;
      const by = maxOd / 2;
      const z0 = geometrySource === "parametric" ? 0 : -totalLen / 2;
      const z1 = geometrySource === "parametric" ? totalLen : totalLen / 2;
      const bbCorners: Vec3[] = [
        { x: -bx, y: -by, z: z0 },
        { x: bx, y: -by, z: z0 },
        { x: bx, y: by, z: z0 },
        { x: -bx, y: by, z: z0 },
        { x: -bx, y: -by, z: z1 },
        { x: bx, y: -by, z: z1 },
        { x: bx, y: by, z: z1 },
        { x: -bx, y: by, z: z1 },
      ];
      const edges: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ];
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
      ctx.lineWidth = 1.1;
      for (const [i0, i1] of edges) {
        const p0 = project(bbCorners[i0]);
        const p1 = project(bbCorners[i1]);
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Spindle Axis Centerline (Z-Axis)
    const axisStart = project({
      x: 0,
      y: 0,
      z: geometrySource === "parametric" ? -gripLen - 12 : -totalLen * 0.65,
    });
    const axisEnd = project({
      x: 0,
      y: 0,
      z: geometrySource === "parametric" ? totalLen + 14 : totalLen * 0.65,
    });
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(axisStart.sx, axisStart.sy);
    ctx.lineTo(axisEnd.sx, axisEnd.sy);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(
      geometrySource === "prismatic" ? "Primary Machine Axis" : "Z-Spindle Axis",
      axisEnd.sx + 6,
      axisEnd.sy + 3
    );

    // Draw Live Dimension Annotations
    if (showDims && geometrySource === "parametric") {
      const topLeft = project({ x: 0, y: maxOd / 2 + 12, z: 0 });
      const topRight = project({ x: 0, y: maxOd / 2 + 12, z: totalLen });
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(topLeft.sx, topLeft.sy);
      ctx.lineTo(topRight.sx, topRight.sy);
      ctx.stroke();

      const midX = (topLeft.sx + topRight.sx) / 2;
      const midY = (topLeft.sy + topRight.sy) / 2 - 8;
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11.5px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`L = ${totalLen.toFixed(1)} mm`, midX, midY);

      let segZ = 0;
      for (const seg of doc.segments) {
        const pt = project({ x: 0, y: -seg.diameter_mm / 2 - 10, z: segZ + seg.length_mm / 2 });
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 11px sans-serif";
        ctx.fillText(
          `Ø${seg.diameter_mm}${seg.thread ? ` (${seg.thread.designation})` : ""}`,
          pt.sx,
          pt.sy + 6
        );
        segZ += seg.length_mm;
      }
      ctx.textAlign = "start";
    }
  }, [
    doc,
    capp,
    issues,
    parsedModel,
    viewMode,
    renderStyle,
    colorFilter,
    geometrySource,
    sectionCut,
    showChuck,
    showDims,
    showBbox,
    showDfmGlow,
    rotation,
    pan,
    zoom,
    isInteracting,
    canvasSize,
    matColor,
  ]);

  const activeHeightClass = expanded ? "h-[520px]" : heightClass;

  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-grid bg-[#090d16] text-white shadow-sm">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#111827] px-3.5 py-2 text-[11.5px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-bold tracking-wide text-slate-100">{doc.part_name}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10.5px] text-sky-300">
            {doc.material.grade_name}
          </span>
          <span className="rounded bg-emerald-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            HD 64-Seg B-Rep
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {parsedModel?.triangles && parsedModel.triangles.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setGeometrySource("mesh")}
                className={cn(
                  "rounded px-2 py-0.5 text-[10.5px] font-semibold transition",
                  geometrySource === "mesh"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                Raw Mesh
              </button>
              <button
                type="button"
                onClick={() => setGeometrySource("parametric")}
                className={cn(
                  "rounded px-2 py-0.5 text-[10.5px] font-semibold transition",
                  geometrySource === "parametric"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                Parametric
              </button>
              <span className="mx-0.5 text-slate-700">|</span>
            </>
          )}
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-semibold transition",
              viewMode === "3d"
                ? "bg-sky-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            🧊 3D Solid
          </button>
          <button
            type="button"
            onClick={() => setViewMode("2d")}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-semibold transition",
              viewMode === "2d"
                ? "bg-sky-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            📐 2D X-R
          </button>
          <span className="mx-0.5 text-slate-700">|</span>
          <button
            type="button"
            onClick={() => {
              setAutoRotate(false);
              setRotation({ yaw: -0.58, pitch: 0.38 });
            }}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
          >
            ISO
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoRotate(false);
              setRotation({ yaw: 0, pitch: 0 });
            }}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
          >
            SIDE
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoRotate(false);
              setRotation({ yaw: -Math.PI / 2, pitch: 0 });
            }}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
          >
            FRONT
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoRotate(false);
              setRotation({ yaw: 0, pitch: Math.PI / 2 - 0.05 });
            }}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
          >
            TOP
          </button>
          <button
            type="button"
            onClick={resetCamera}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-amber-300 hover:bg-slate-700"
            title="Reset Camera Orbit, Pan & Zoom"
          >
            🎯 Reset
          </button>
          <button
            type="button"
            onClick={exportSnapshotPng}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
            title="Download High-Res PNG Snapshot"
          >
            📸 PNG
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-slate-700"
            title="Toggle Viewport Height"
          >
            {expanded ? "🗕 Compact" : "⛶ Expand"}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === "3d" ? (
        <div ref={containerRef} className={cn("relative w-full select-none", activeHeightClass)}>
          <canvas
            ref={canvasRef}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => {
              setAutoRotate(false);
              setIsInteracting(true);
              const isPan = e.shiftKey || e.button === 2 || e.button === 1;
              draggingRef.current = {
                active: true,
                mode: isPan ? "pan" : "orbit",
                lastX: e.clientX,
                lastY: e.clientY,
              };
            }}
            onMouseMove={(e) => {
              if (!draggingRef.current.active) return;
              const dx = e.clientX - draggingRef.current.lastX;
              const dy = e.clientY - draggingRef.current.lastY;
              draggingRef.current.lastX = e.clientX;
              draggingRef.current.lastY = e.clientY;
              if (draggingRef.current.mode === "pan") {
                setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
              } else {
                setRotation((r) => ({
                  yaw: r.yaw + dx * 0.01,
                  pitch: Math.max(-1.4, Math.min(1.4, r.pitch + dy * 0.01)),
                }));
              }
            }}
            onMouseUp={() => {
              draggingRef.current.active = false;
              setIsInteracting(false);
            }}
            onMouseLeave={() => {
              draggingRef.current.active = false;
              setIsInteracting(false);
            }}
            onWheel={(e) => {
              e.preventDefault();
              setZoom((z) => Math.max(0.45, Math.min(2.6, z - e.deltaY * 0.001)));
            }}
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />

          {/* Top-Left HUD Overlay */}
          <div className="pointer-events-none absolute left-3 top-2.5 flex flex-col gap-0.5 rounded bg-slate-900/80 px-2.5 py-1.5 text-[10.5px] text-slate-300 backdrop-blur">
            <span>🖱️ Drag: Orbit 360° · Shift+Drag: Pan · Scroll: Zoom</span>
            <span>
              Part:{" "}
              <b className="text-sky-300">
                Ø{capp.max_od_mm} × {capp.overall_length_mm} mm
              </b>{" "}
              · Stock Bar:{" "}
              <b className="text-emerald-400">
                Ø{capp.recommended_stock.standard_diameter_mm} ×{" "}
                {capp.recommended_stock.cut_length_mm} mm
              </b>
            </span>
          </div>

          {/* Top-Right Render Style & Color Filter Overlay */}
          <div className="absolute right-3 top-2.5 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/85 p-1 text-[10.5px] backdrop-blur">
              {(
                [
                  ["shaded", "Shaded"],
                  ["wireframe", "Wireframe"],
                  ["xray", "X-Ray"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRenderStyle(k)}
                  className={cn(
                    "rounded px-2 py-0.5 font-semibold transition",
                    renderStyle === k
                      ? "bg-sky-500 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Color Filter Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/85 p-1 text-[10.5px] backdrop-blur">
              <span className="px-1.5 text-[10px] font-bold uppercase text-slate-400">Filter:</span>
              {(
                [
                  ["material", "🎨 Metallic"],
                  ["feature_map", "🧩 Feature Map"],
                  ["wall_heatmap", "🌡️ Wall Thickness"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setColorFilter(k)}
                  className={cn(
                    "rounded px-2 py-0.5 font-semibold transition",
                    colorFilter === k
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend when Feature Map or Wall Heatmap is active */}
          {colorFilter !== "material" && (
            <div className="pointer-events-none absolute bottom-2.5 left-3 flex flex-wrap items-center gap-2.5 rounded bg-slate-900/85 px-2.5 py-1 text-[10px] text-slate-200 backdrop-blur">
              {colorFilter === "feature_map" ? (
                <>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-sky-400" /> OD Cylinder
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Shoulder
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-purple-400" /> Thread
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-orange-400" /> Groove
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-indigo-400" /> Internal Bore
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-300">Radial Wall Map:</span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-rose-500" /> &lt;{" "}
                    {doc.material.min_wall_mm}mm (Deflection Risk)
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Thin Warning
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Medium Wall
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Rigid Core
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <Profile2DBlueprint doc={doc} capp={capp} heightClass={activeHeightClass} />
      )}

      {/* Bottom Inspector Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#111827] px-3.5 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSectionCut((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              sectionCut
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            ✂️ {sectionCut ? "Full 360°" : "Cut in Half"}
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              autoRotate
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            🔄 {autoRotate ? "Stop Spin" : "Auto-Rotate"}
          </button>
          <button
            type="button"
            onClick={() => setShowChuck((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              showChuck
                ? "bg-emerald-700 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            🔲 Chuck Grip
          </button>
          <button
            type="button"
            onClick={() => setShowBbox((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              showBbox
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            📦 Envelope
          </button>
          <button
            type="button"
            onClick={() => setShowDims((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              showDims
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            📏 Dimensions
          </button>
          <button
            type="button"
            onClick={() => setShowDfmGlow((v) => !v)}
            className={cn(
              "rounded px-2 py-1 font-semibold transition",
              showDfmGlow
                ? "bg-rose-700 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            ⚠️ DFM Glow
          </button>
        </div>

        <div className="text-[11px] text-slate-400">
          Mass: <b className="text-slate-200">{capp.finished_mass_kg} kg</b> · Scrap Removed:{" "}
          <b className="text-slate-200">{capp.recommended_stock.removed_Percent}%</b>
        </div>
      </div>
    </div>
  );
}

/**
 * 2D Axial Half-Profile (X-R Plane) Blueprint Renderer
 */
function Profile2DBlueprint({
  doc,
  capp,
  heightClass,
}: {
  doc: TurnedPartDocument;
  capp: CappProcessPlan;
  heightClass?: string;
}) {
  const totalLen = Math.max(10, capp.overall_length_mm);
  const maxOd = Math.max(10, capp.max_od_mm);
  const stockR = capp.recommended_stock.standard_diameter_mm / 2;
  const gripLen = capp.recommended_stock.chuck_grip_allowance_mm;

  const padX = 60;
  const svgW = 680;
  const svgH = 340;
  const axisY = svgH * 0.56;

  const scaleX = (svgW - padX * 2) / (totalLen + gripLen + 15);
  const scaleY = (svgH * 0.36) / Math.max(stockR, maxOd / 2);
  const scale = Math.min(scaleX, scaleY);

  const x0 = padX + gripLen * scale;
  const rBore = doc.bore.enabled ? doc.bore.diameter_mm / 2 : 0;
  const boreLen = doc.bore.enabled
    ? doc.bore.is_through
      ? totalLen
      : Math.min(totalLen, doc.bore.depth_mm)
    : 0;

  const pts: string[] = [];
  pts.push(`${x0},${axisY - rBore * scale}`);
  let curX = 0;
  for (const seg of doc.segments) {
    const r = seg.diameter_mm / 2;
    const rEnd =
      seg.taper_end_diameter_mm && seg.taper_end_diameter_mm > 0
        ? seg.taper_end_diameter_mm / 2
        : r;
    pts.push(`${x0 + curX * scale},${axisY - r * scale}`);
    curX += seg.length_mm;
    pts.push(`${x0 + curX * scale},${axisY - rEnd * scale}`);
  }
  if (rBore > 0 && boreLen < totalLen) {
    pts.push(`${x0 + totalLen * scale},${axisY}`);
    pts.push(`${x0 + boreLen * scale},${axisY}`);
    pts.push(`${x0 + boreLen * scale},${axisY - rBore * scale}`);
  } else {
    pts.push(`${x0 + totalLen * scale},${axisY - rBore * scale}`);
  }

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center bg-[#090d16] p-3",
        heightClass ?? "h-[330px]"
      )}
    >
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-full w-full">
        {/* Raw Bar Stock Envelope */}
        <rect
          x={x0 - gripLen * scale}
          y={axisY - stockR * scale}
          width={(totalLen + gripLen + 5) * scale}
          height={stockR * 2 * scale}
          fill="none"
          stroke="#22c55e"
          strokeWidth="1.2"
          strokeDasharray="5,4"
        />
        <text
          x={x0 - gripLen * scale + 6}
          y={axisY - stockR * scale - 6}
          fill="#4ade80"
          fontSize="11"
          fontWeight="bold"
        >
          Raw Bar Stock Envelope: Ø{capp.recommended_stock.standard_diameter_mm} mm (Grip:{" "}
          {gripLen} mm)
        </text>

        {/* Upper Half-Profile (X-R Plane) */}
        <polygon
          points={pts.join(" ")}
          fill="rgba(56, 189, 248, 0.25)"
          stroke="#38bdf8"
          strokeWidth="2.2"
        />

        {/* Spindle Centerline (R = 0) */}
        <line
          x1={padX - 15}
          y1={axisY}
          x2={svgW - padX + 15}
          y2={axisY}
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="8,4,2,4"
        />
        <text x={svgW - padX - 95} y={axisY + 16} fill="#fb7185" fontSize="11" fontWeight="bold">
          +X Spindle Axis (R = 0)
        </text>

        {/* Segment Semantic Labels */}
        {doc.segments
          .reduce<Array<{ s: (typeof doc.segments)[number]; startMm: number }>>((items, s) => {
            const prev = items[items.length - 1];
            const startMm = prev ? prev.startMm + prev.s.length_mm : 0;
            items.push({ s, startMm });
            return items;
          }, [])
          .map(({ s, startMm }) => {
            const cx = x0 + (startMm + s.length_mm / 2) * scale;
            const cy = axisY - (s.diameter_mm / 2) * scale - 8;
            return (
              <g key={s.id}>
                <text
                  x={cx}
                  y={cy}
                  fill="#e2e8f0"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {s.label}: Ø{s.diameter_mm}×{s.length_mm}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
