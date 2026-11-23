import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { saveSmartQuoteRatesAction } from "./actions";

type Cfg = Record<string, unknown>;

const SECTIONS: { title: string; help: string; keys: string[] }[] = [
  {
    title: "Commercial",
    help: "Applied after cost. Prices shown to buyers exclude GST.",
    keys: ["margin_pct", "min_order_value"],
  },
  {
    title: "Machine & labour",
    help: "Machine-hour rates and one-time minutes per order (spread over the quantity).",
    keys: [
      "milling_rate_per_hr", "turning_rate_per_hr", "setup_min_per_setup", "programming_min",
      "handling_min_per_part", "hours_per_day", "machines_in_parallel",
    ],
  },
  {
    title: "Material & cutting",
    help: "Material ₹/kg comes from the Raw Material rate card. Stock = part size + allowance on each side (milled) or the parser's round bar (turned).",
    keys: ["stock_allowance_mm", "scrap_pct", "base_mrr_cm3_per_min", "base_finish_cm2_per_min", "material_time_factor"],
  },
  {
    title: "Features",
    help: "Minutes per detected feature (× √material factor) and a cap per group. 'Candidate' detections count at the candidate weight.",
    keys: ["feature_minutes", "feature_cap_minutes", "candidate_weight", "thread_min_each", "insert_min_each", "insert_cost_each"],
  },
  {
    title: "Precision",
    help: "Cycle-time multipliers.",
    keys: ["tolerance_multiplier", "roughness_multiplier"],
  },
  {
    title: "Finishing, inspection & extras",
    help: "Finish ₹ per dm² of surface area, plus a per-order lot charge and extra days when any finish is chosen.",
    keys: ["finish_rate_per_dm2", "finish_min_lot", "finish_extra_days", "inspection_fee", "certificate_fee", "marking_fee_per_part"],
  },
  {
    title: "Lead-time tiers",
    help: "Base working days and price multiplier for each option on the quote page.",
    keys: ["tiers"],
  },
];

const human = (k: string) =>
  k
    .replace(/_/g, " ")
    .replace(/\bpct\b/, "%")
    .replace(/\bper hr\b/, "₹/hr")
    .replace(/\bmin\b/g, "min")
    .replace(/^\w/, (c) => c.toUpperCase());

function Field({ path, label, value }: { path: string; label: string; value: unknown }) {
  const isNum = typeof value === "number";
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
      <span className="truncate" title={label}>{label}</span>
      <input
        name={path}
        type={isNum ? "number" : "text"}
        step="any"
        min={isNum ? 0 : undefined}
        defaultValue={String(value)}
        className="rounded-lg border border-grid px-2.5 py-1.5 text-[13px] font-normal text-ink"
      />
    </label>
  );
}

function Leaves({ path, value }: { path: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-col gap-2">
        {value.map((v, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 rounded-lg bg-plane p-3 md:grid-cols-4">
            {Object.entries(v as Cfg).map(([k, vv]) => (
              <Field key={k} path={`${path}.${i}.${k}`} label={human(k)} value={vv} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-plane p-3 md:grid-cols-4">
        {Object.entries(value as Cfg).map(([k, v]) => (
          <Field key={k} path={`${path}.${k}`} label={k} value={v} />
        ))}
      </div>
    );
  }
  return <Field path={path} label={human(path)} value={value} />;
}

export default async function SmartQuoteRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient(); // admin layout checks the role
  const { data } = await supabase.from("sq_settings").select("config, updated_at").eq("id", 1).maybeSingle();
  const cfg = (data?.config ?? {}) as Cfg;

  return (
    <div>
      <Topbar title="Smart Quote rates" pill={{ label: "CNC instant estimate" }} />
      <div className="mt-6 flex max-w-[1000px] flex-col gap-4">
        {saved && (
          <div className="rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            Saved. New estimates use these rates straight away.
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            {error === "save" || error === "missing" ? "Couldn't save." : `Check these values: ${error}`}
          </div>
        )}
        <p className="text-[13px] leading-relaxed text-ink-2">
          Every instant estimate is built from these numbers. Calibrate them against a handful of past jobs: upload the
          part, compare the estimate&rsquo;s breakdown (on the RFQ page) with what the job really cost, and adjust.
          {data?.updated_at && <> Last changed {new Date(data.updated_at).toLocaleString("en-IN")}.</>}
        </p>
        <form action={saveSmartQuoteRatesAction} className="flex flex-col gap-4">
          {SECTIONS.map((sec) => (
            <Card key={sec.title}>
              <CardHeader title={sec.title} />
              <div className="flex flex-col gap-3 p-5">
                <p className="text-[12px] text-muted">{sec.help}</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {sec.keys
                    .filter((k) => k in cfg && (typeof cfg[k] !== "object" || cfg[k] === null))
                    .map((k) => (
                      <Field key={k} path={k} label={human(k)} value={cfg[k]} />
                    ))}
                </div>
                {sec.keys
                  .filter((k) => k in cfg && typeof cfg[k] === "object" && cfg[k] !== null)
                  .map((k) => (
                    <div key={k}>
                      <div className="mb-1.5 text-[12px] font-bold text-ink">{human(k)}</div>
                      <Leaves path={k} value={cfg[k]} />
                    </div>
                  ))}
              </div>
            </Card>
          ))}
          <div className="sticky bottom-4 flex justify-end">
            <button type="submit" className="rounded-[9px] bg-brand px-5 py-3 text-[14px] font-bold text-white shadow">
              Save rates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
