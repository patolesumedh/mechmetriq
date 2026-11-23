/**
 * Raw Material Marketplace — weight + price maths for the LIVE PREVIEW.
 *
 * The authoritative calculation lives in the database
 * (`rm_piece_weight_kg`, `rm_validate_dims`, `rm_price_line` in
 * supabase/migrations/0008_raw_material_marketplace.sql). Anything saved to
 * the cart or an order is re-priced there, so a buyer can never send their
 * own price. Keep this file in step with those functions —
 * scripts/check-rm-pricing-parity.mjs compares the two.
 *
 * Units: dimensions and lengths in mm, density in g/cm³, weights in kg.
 */

export type Formula =
  | "round_bar"
  | "square_bar"
  | "hex_bar"
  | "flat_bar"
  | "sheet"
  | "perforated"
  | "coil"
  | "round_tube"
  | "square_tube"
  | "rect_tube"
  | "equal_angle"
  | "t_section"
  | "ismc"
  | "wire";

export interface DimSpec {
  key: string;
  label: string;
  unit: string;
  std?: number[];
  min?: number;
  max?: number;
}

export interface ShapeForPricing {
  name: string;
  formula: Formula;
  sell_by: "piece" | "kg";
  dims: DimSpec[];
  std_lengths: number[];
  std_sheet_sizes: [number, number][];
  rate_premium_pct: number;
}

export interface PricingSettings {
  cut_charge_per_cut: number;
  cut_charge_per_kg: number;
  mtc_fee: number;
  min_order_value: number;
  bulk_tiers: { min_kg: number; pct: number }[];
}

export type Dims = Record<string, number>;

/** Nominal kg/m of Indian Standard Medium-weight Channels (IS 808:1989). */
export const ISMC_KG_PER_M: Record<number, number> = {
  75: 7.14,
  100: 9.56,
  125: 13.1,
  150: 16.8,
  175: 19.6,
  200: 22.3,
  225: 26.1,
  250: 30.6,
  300: 36.3,
  350: 42.1,
  400: 50.1,
};

/**
 * Half-up rounding that matches Postgres numeric round(): strip binary
 * floating-point noise first (e.g. 11.67785 stored as 11.6778499999…).
 */
export function round(value: number, dp: number): number {
  const clean = Number(value.toPrecision(14));
  const shifted = Number((clean * 10 ** dp).toPrecision(14));
  return Math.round(shifted) / 10 ** dp;
}

/** True for shapes whose length is part of the piece dimensions (sheets) or that are sold by kg. */
export function usesLength(formula: Formula): boolean {
  return !["sheet", "perforated", "coil", "wire"].includes(formula);
}

/** Theoretical weight of one piece in kg; null for shapes sold by kg. */
export function pieceWeightKg(
  formula: Formula,
  dims: Dims,
  lengthMm: number | null,
  density: number
): number | null {
  const k = density / 1_000_000; // kg per mm³
  const { d = 0, a = 0, b = 0, h = 0, t = 0, w = 0, l = 0, od = 0, af = 0, size = 0 } = dims;
  const open = dims.open ?? 0;
  const L = lengthMm ?? 0;

  switch (formula) {
    case "coil":
    case "wire":
      return null;
    case "sheet":
      return round(t * w * l * k, 4);
    case "perforated":
      return round(t * w * l * (1 - open / 100) * k, 4);
    case "ismc": {
      const perM = ISMC_KG_PER_M[size];
      return perM === undefined ? NaN : round((perM * L) / 1000, 4);
    }
  }

  const area: Record<string, number> = {
    round_bar: (Math.PI / 4) * d * d,
    square_bar: a * a,
    hex_bar: (Math.sqrt(3) / 2) * af * af,
    flat_bar: w * t,
    round_tube: Math.PI * (od - t) * t,
    square_tube: 4 * t * (a - t),
    rect_tube: 2 * t * (a + b - 2 * t),
    equal_angle: t * (2 * a - t),
    t_section: t * (b + h - t),
  };
  return round(area[formula] * L * k, 4);
}

/** Returns a human-readable problem with the dimensions, or null if they're fine. */
export function validateDims(shape: ShapeForPricing, dims: Dims, lengthMm: number | null): string | null {
  for (const spec of shape.dims) {
    const v = dims[spec.key];
    if (v === undefined || Number.isNaN(v) || v <= 0) return `${spec.label} is required`;
    if (spec.min !== undefined && v < spec.min) return `${spec.label} must be at least ${spec.min} ${spec.unit}`;
    if (spec.max !== undefined && v > spec.max) return `${spec.label} must be at most ${spec.max} ${spec.unit}`;
  }
  const { a = 0, b = 0, h = 0, t = 0, w = 0, od = 0, size = 0 } = dims;
  switch (shape.formula) {
    case "ismc":
      if (ISMC_KG_PER_M[size] === undefined) return "Unknown ISMC size";
      break;
    case "round_tube":
      if (t * 2 >= od) return "Wall thickness must be less than half the outer diameter";
      break;
    case "square_tube":
    case "equal_angle":
      if (t * 2 >= a) return "Thickness must be less than half the side";
      break;
    case "rect_tube":
      if (t * 2 >= Math.min(a, b)) return "Wall thickness must be less than half the smaller side";
      break;
    case "t_section":
      if (t >= b || t >= h) return "Thickness must be less than flange width and height";
      break;
    case "flat_bar":
      if (t > w) return "Thickness cannot exceed width";
      break;
  }
  if (shape.sell_by === "piece" && usesLength(shape.formula)) {
    if (lengthMm === null || Number.isNaN(lengthMm) || lengthMm < 10 || lengthMm > 12000) {
      return "Length must be between 10 and 12,000 mm";
    }
  }
  return null;
}

export function validateQuantity(shape: ShapeForPricing, qty: number): string | null {
  if (!qty || Number.isNaN(qty) || qty <= 0) return "Quantity must be greater than zero";
  if (shape.sell_by === "piece") {
    if (!Number.isInteger(qty)) return "Quantity must be a whole number of pieces";
    if (qty > 10000) return "For more than 10,000 pieces please contact us";
  } else if (qty < 10 || qty > 100000) {
    return "Quantity must be between 10 and 100,000 kg";
  }
  return null;
}

/** Effective ₹/kg: shape-specific override, else base × (1 + shape premium). */
export function effectiveRate(
  baseRate: number | null,
  shapeRate: number | null,
  premiumPct: number
): number | null {
  if (shapeRate !== null) return shapeRate;
  if (baseRate === null) return null;
  return round(baseRate * (1 + premiumPct / 100), 2);
}

export function isCutToSize(shape: ShapeForPricing, dims: Dims, lengthMm: number | null): boolean {
  if (shape.sell_by === "kg") return false;
  if (shape.formula === "sheet" || shape.formula === "perforated") {
    return !shape.std_sheet_sizes.some(([sw, sl]) => sw === dims.w && sl === dims.l);
  }
  return lengthMm === null || !shape.std_lengths.includes(lengthMm);
}

export interface LinePreview {
  pieceWeightKg: number | null;
  weightKg: number;
  ratePerKg: number;
  materialValue: number;
  cut: boolean;
  cutCharge: number;
  mtcFee: number;
}

export function previewLine(args: {
  shape: ShapeForPricing;
  density: number;
  ratePerKg: number;
  settings: PricingSettings;
  dims: Dims;
  lengthMm: number | null;
  quantity: number;
  mtc: boolean;
}): LinePreview {
  const { shape, density, ratePerKg, settings, dims, quantity, mtc } = args;
  const lengthMm = usesLength(shape.formula) ? args.lengthMm : null;
  let pw: number | null = null;
  let wt: number;
  let cut = false;
  if (shape.sell_by === "kg") {
    wt = round(quantity, 3);
  } else {
    pw = pieceWeightKg(shape.formula, dims, lengthMm, density) ?? 0;
    wt = round(pw * quantity, 3);
    cut = isCutToSize(shape, dims, lengthMm);
  }
  return {
    pieceWeightKg: pw,
    weightKg: wt,
    ratePerKg,
    materialValue: round(wt * ratePerKg, 2),
    cut,
    cutCharge: cut
      ? round(Math.max(quantity * settings.cut_charge_per_cut, wt * settings.cut_charge_per_kg), 2)
      : 0,
    mtcFee: mtc ? settings.mtc_fee : 0,
  };
}

export function bulkPct(settings: PricingSettings, totalWeightKg: number): number {
  return settings.bulk_tiers
    .filter((t) => totalWeightKg >= t.min_kg)
    .reduce((m, t) => Math.max(m, t.pct), 0);
}
