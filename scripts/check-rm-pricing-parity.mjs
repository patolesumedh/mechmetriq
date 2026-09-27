// Compares the configurator's live-preview maths (src/lib/rawMaterials/weight.ts)
// with the database's authoritative pricing (rm_price_line) on random but
// valid lines drawn from the seeded catalogue.
//
// Usage (Node ≥ 22.18, psql on PATH):
//   DATABASE_URL=postgres://... node scripts/check-rm-pricing-parity.mjs [samples]
import { execFileSync } from "node:child_process";
import {
  effectiveRate,
  previewLine,
  usesLength,
  validateDims,
} from "../src/lib/rawMaterials/weight.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(2);
}
const samples = Number(process.argv[2] ?? 400);

function sql(query) {
  const out = execFileSync("psql", [url, "-At", "-c", query], { encoding: "utf8" });
  return out.trim();
}
function sqlJson(query) {
  return JSON.parse(sql(`select coalesce(json_agg(x), '[]') from (${query}) x`));
}

const shapes = sqlJson("select * from rm_shapes where active");
const combos = sqlJson(`
  select s.id as shape_id, s.slug as shape_slug, g.id as grade_id, g.slug as grade_slug,
         coalesce(g.density, m.density)::float as density,
         (select rate_per_kg from rm_rates r where r.grade_id = g.id and r.shape_id is null)::float as base_rate,
         (select rate_per_kg from rm_rates r where r.grade_id = g.id and r.shape_id = s.id)::float as shape_rate
  from rm_shape_materials sm
  join rm_shapes s on s.id = sm.shape_id
  join rm_materials m on m.id = sm.material_id
  join rm_grades g on g.material_id = m.id and (g.shape_slugs is null or s.slug = any (g.shape_slugs))`);
const settingsRow = sqlJson("select * from rm_settings where id = 1")[0];
const settings = {
  cut_charge_per_cut: Number(settingsRow.cut_charge_per_cut),
  cut_charge_per_kg: Number(settingsRow.cut_charge_per_kg),
  mtc_fee: Number(settingsRow.mtc_fee),
  min_order_value: Number(settingsRow.min_order_value),
  bulk_tiers: settingsRow.bulk_tiers,
};
const shapeById = new Map(
  shapes.map((s) => [
    s.id,
    {
      ...s,
      std_lengths: (s.std_lengths ?? []).map(Number),
      rate_premium_pct: Number(s.rate_premium_pct),
    },
  ])
);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let checked = 0;
let mismatches = 0;
let attempts = 0;
while (checked < samples && attempts < samples * 20) {
  attempts++;
  const c = pick(combos);
  const shape = shapeById.get(c.shape_id);
  const dims = {};
  for (const spec of shape.dims) {
    const std = spec.std ?? [];
    dims[spec.key] =
      Math.random() < 0.7 && std.length
        ? pick(std)
        : Math.round((spec.min + Math.random() * (Math.min(spec.max, 400) - spec.min)) * 10) / 10;
  }
  if (shape.formula === "sheet" || shape.formula === "perforated") {
    if (Math.random() < 0.5 && shape.std_sheet_sizes.length) {
      const [w, l] = pick(shape.std_sheet_sizes);
      dims.w = w;
      dims.l = l;
    }
  }
  const length = usesLength(shape.formula)
    ? Math.random() < 0.5 && shape.std_lengths.length
      ? pick(shape.std_lengths)
      : Math.round(100 + Math.random() * 5900)
    : null;
  if (validateDims(shape, dims, length)) continue;
  const qty = shape.sell_by === "kg" ? Math.round(10 + Math.random() * 3000) : 1 + Math.floor(Math.random() * 40);
  const mtc = Math.random() < 0.3;
  const rate = effectiveRate(c.base_rate, c.shape_rate, shape.rate_premium_pct);
  const ts = previewLine({ shape, density: c.density, ratePerKg: rate, settings, dims, lengthMm: length, quantity: qty, mtc });

  const db = sqlJson(`select * from rm_price_line('${c.shape_id}', '${c.grade_id}', '${JSON.stringify(dims)}'::jsonb,
    ${length ?? "null"}, ${qty}, ${mtc})`)[0];
  const pairs = [
    ["weight", ts.weightKg, Number(db.weight_kg)],
    ["rate", ts.ratePerKg, Number(db.rate_per_kg)],
    ["value", ts.materialValue, Number(db.material_value)],
    ["cut", ts.cut, db.cut],
    ["cutCharge", ts.cutCharge, Number(db.cut_charge)],
    ["mtc", ts.mtcFee, Number(db.mtc_fee)],
  ];
  const bad = pairs.filter(([, a, b]) => (typeof a === "number" ? Math.abs(a - b) > 0.011 : a !== b));
  if (bad.length) {
    mismatches++;
    console.log("MISMATCH", c.shape_slug, c.grade_slug, JSON.stringify(dims), length, qty, bad);
  }
  checked++;
}
console.log(`checked ${checked} lines across ${combos.length} shape×grade combos — ${mismatches} mismatches`);
process.exit(mismatches ? 1 : 0);
