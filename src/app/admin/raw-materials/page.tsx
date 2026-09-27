import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDateTime } from "../_lib/format";
import { toSettings } from "@/lib/rawMaterials/catalog";
import { inr, kg, rmStatusLabel } from "@/lib/rawMaterials/format";
import { saveRatesAction, saveSettingsAction } from "./actions";

const ERRORS: Record<string, string> = {
  invalid_rate: "Rates must be positive numbers.",
  save_failed: "Could not save. Please try again.",
  invalid_settings: "Charges and minimum order must be zero or more.",
  invalid_tier: "Each bulk tier needs a minimum kg above zero and a discount between 0 and 50%.",
};

const inputClass =
  "w-full rounded-lg border border-grid px-3 py-2 text-[13px] outline-none focus:border-brand";

export default async function AdminRawMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; saved?: string; error?: string }>;
}) {
  const { tab = "approvals", saved, error } = await searchParams;
  const supabase = await createClient();

  return (
    <div>
      <Topbar title="Raw Material Marketplace" />
      <div className="mt-6">
        <FilterTabs
          basePath="/admin/raw-materials"
          paramName="tab"
          active={tab}
          tabs={[
            { label: "Order approvals", value: "approvals" },
            { label: "Rate card", value: "rates" },
            { label: "Charges & shapes", value: "settings" },
          ]}
        />
        {error && ERRORS[error] && (
          <Card className="mb-4 border-[#f3c4c4] bg-crit-bg px-5 py-3 text-[13px] text-[#a12525]">{ERRORS[error]}</Card>
        )}
        {saved && (
          <Card className="mb-4 border-[#bfe3bf] bg-good-bg px-5 py-3 text-[13px] text-[#0a6b0a]">
            {tab === "rates" ? `Saved ${saved} rate change${saved === "1" ? "" : "s"}.` : "Settings saved."}
          </Card>
        )}
        {tab === "rates" ? (
          <RatesTab supabase={supabase} />
        ) : tab === "settings" ? (
          <SettingsTab supabase={supabase} />
        ) : (
          <ApprovalsTab supabase={supabase} />
        )}
      </div>
    </div>
  );
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function ApprovalsTab({ supabase }: { supabase: Supa }) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, buyer_id, subtotal, total_amount, rm_total_weight_kg, created_at")
    .eq("order_type", "raw_material")
    .in("status", ["draft", "quoted"])
    .order("created_at", { ascending: true });
  const buyerIds = Array.from(new Set((orders ?? []).map((o) => o.buyer_id)));
  const { data: buyers } = buyerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", buyerIds)
    : { data: [] as { id: string; full_name: string }[] };
  const buyerName = new Map((buyers ?? []).map((b) => [b.id, b.full_name]));

  return (
    <Card>
      <CardHeader title="Waiting on us or the buyer" />
      {(orders ?? []).length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">No raw-material orders waiting.</p>
      ) : (
        <div className="divide-y divide-grid">
          {(orders ?? []).map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[13px] hover:bg-plane"
            >
              <div>
                <div className="font-semibold text-ink">
                  {o.order_number} · {buyerName.get(o.buyer_id) ?? "Buyer"}
                </div>
                <div className="text-[12px] text-muted">
                  {kg(Number(o.rm_total_weight_kg))} · placed {formatDateTime(o.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{inr(o.subtotal)}</span>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-[11.5px] font-bold " +
                    (o.status === "draft" ? "bg-warn-bg text-[#8a5a00]" : "bg-brand-light text-brand-dark")
                  }
                >
                  {o.status === "draft" ? "Needs approval" : rmStatusLabel(o.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

async function RatesTab({ supabase }: { supabase: Supa }) {
  const [{ data: materials }, { data: grades }, { data: rates }] = await Promise.all([
    supabase.from("rm_materials").select("id, slug, name").order("sort_order"),
    supabase.from("rm_grades").select("id, material_id, name, equivalents, active").order("sort_order"),
    supabase.from("rm_rates").select("grade_id, rate_per_kg, updated_at").is("shape_id", null),
  ]);
  const rateByGrade = new Map((rates ?? []).map((r) => [r.grade_id, r]));

  return (
    <div className="space-y-4.5">
      <p className="text-[12.5px] text-ink-2">
        Base rates in ₹/kg excl. GST. Each shape adds its premium (see <i>Charges &amp; shapes</i>). New rates apply to
        carts immediately and to orders placed from now on; placed orders keep their rates. Every change is logged.
      </p>
      {(materials ?? []).map((m) => {
        const list = (grades ?? []).filter((g) => g.material_id === m.id);
        return (
          <Card key={m.id}>
            <form action={saveRatesAction} id={m.slug} className="scroll-mt-6">
              <input type="hidden" name="material" value={m.slug} />
              <div className="flex items-center justify-between border-b border-grid px-5 py-3.5">
                <h3 className="text-[14.5px] font-semibold">{m.name}</h3>
                <button type="submit" className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-bold text-white">
                  Save {m.name} rates
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {list.map((g) => {
                      const r = rateByGrade.get(g.id);
                      return (
                        <tr key={g.id} className="border-b border-grid last:border-0">
                          <td className="px-5 py-2 font-semibold">
                            {g.name}
                            {!g.active && <span className="ml-2 text-[11px] text-muted">(inactive)</span>}
                          </td>
                          <td className="px-5 py-2 text-[12px] text-muted">{g.equivalents}</td>
                          <td className="w-[150px] px-5 py-2">
                            <input type="hidden" name={`prev:${g.id}`} value={r ? String(r.rate_per_kg) : ""} />
                            <input
                              name={`rate:${g.id}`}
                              aria-label={`${g.name} rate per kg`}
                              type="number"
                              step="0.01"
                              min="0.01"
                              defaultValue={r ? String(r.rate_per_kg) : ""}
                              placeholder="On request"
                              className={inputClass}
                            />
                          </td>
                          <td className="whitespace-nowrap px-5 py-2 text-[11.5px] text-muted">
                            {r ? `updated ${formatDateTime(r.updated_at)}` : "no rate"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

async function SettingsTab({ supabase }: { supabase: Supa }) {
  const [{ data: row }, { data: shapes }] = await Promise.all([
    supabase.from("rm_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("rm_shapes").select("id, name, rate_premium_pct").order("sort_order"),
  ]);
  const s = toSettings(row);
  const tiers = [...s.bulk_tiers, ...Array(5).fill(null)].slice(0, 5) as ({ min_kg: number; pct: number } | null)[];
  const fields: [string, string, number][] = [
    ["cut_charge_per_cut", "Cutting — ₹ per piece", s.cut_charge_per_cut],
    ["cut_charge_per_kg", "Cutting — ₹ per kg", s.cut_charge_per_kg],
    ["mtc_fee", "MTC fee — ₹ per line", s.mtc_fee],
    ["min_order_value", "Minimum order — ₹ before GST", s.min_order_value],
    ["freight_gst_rate", "GST on freight — %", Number(row?.freight_gst_rate ?? 18)],
  ];

  return (
    <form action={saveSettingsAction} className="grid items-start gap-4.5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Charges" />
        <div className="grid gap-3.5 p-5 sm:grid-cols-2">
          {fields.map(([name, label, value]) => (
            <div key={name}>
              <label htmlFor={name} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                {label}
              </label>
              <input id={name} name={name} type="number" step="0.01" min="0" defaultValue={value} className={inputClass} />
            </div>
          ))}
        </div>
        <p className="px-5 pb-4 text-[12px] text-muted">
          Cutting is charged at the higher of (pieces × per-piece) and (kg × per-kg) on non-stock sizes.
        </p>
        <div className="border-t border-grid p-5">
          <div className="mb-2 text-[12.5px] font-semibold text-ink-2">Bulk discount tiers (on order weight)</div>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input
                  name={`tier_kg_${i}`}
                  aria-label={`Tier ${i + 1} minimum kg`}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="From kg"
                  defaultValue={t?.min_kg ?? ""}
                  className={inputClass}
                />
                <input
                  name={`tier_pct_${i}`}
                  aria-label={`Tier ${i + 1} discount %`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Discount %"
                  defaultValue={t?.pct ?? ""}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Shape premiums (% on top of base rate)" />
        <div className="divide-y divide-grid">
          {(shapes ?? []).map((sh) => (
            <div key={sh.id} className="flex items-center justify-between gap-3 px-5 py-2">
              <label htmlFor={`premium-${sh.id}`} className="text-[13px] font-medium">
                {sh.name}
              </label>
              <input
                id={`premium-${sh.id}`}
                name={`premium:${sh.id}`}
                type="number"
                step="0.01"
                defaultValue={String(sh.rate_premium_pct)}
                className="w-[110px] rounded-lg border border-grid px-3 py-1.5 text-[13px] outline-none focus:border-brand"
              />
            </div>
          ))}
        </div>
      </Card>
      <div className="xl:col-span-2">
        <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white">
          Save charges &amp; premiums
        </button>
      </div>
    </form>
  );
}
