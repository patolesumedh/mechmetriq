import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { gradesFor, loadCatalog, materialsForShape } from "@/lib/rawMaterials/catalog";
import { removeSupplyAction, toggleSupplyAction } from "./actions";
import { SupplyForm, type SupplyOption } from "./SupplyForm";

export default async function SupplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cat, { data: rows }, { data: vendor }] = await Promise.all([
    loadCatalog(),
    supabase.from("rm_vendor_supply").select("*").eq("vendor_id", user.id).order("created_at", { ascending: false }),
    supabase.from("vendor_profiles").select("warehouse_pincode").eq("id", user.id).single(),
  ]);

  const options: SupplyOption[] = cat.shapes.map((s) => ({
    shapeId: s.id,
    shapeName: s.name,
    materials: materialsForShape(cat, s).map((m) => ({
      id: m.id,
      name: m.name,
      grades: gradesFor(cat, s, m).map((g) => ({ id: g.id, name: g.name })),
    })),
  }));
  const shapeName = new Map(cat.shapes.map((s) => [s.id, s.name]));
  const gradeInfo = new Map(
    cat.grades.map((g) => [g.id, { name: g.name, material: cat.materials.find((m) => m.id === g.material_id)?.name }])
  );

  return (
    <div>
      <Topbar title="What I Supply" />
      <p className="mt-5 max-w-[760px] text-[13px] leading-relaxed text-ink-2">
        MECHmetrIQ sets marketplace prices from its rate card and assigns each approved order to a verified supplier.
        Tell us which shapes and grades you can supply and where you dispatch from — orders for those lines are routed
        to you first.
      </p>

      <Card className="mt-5">
        <CardHeader title="Add supply" />
        <SupplyForm options={options} defaultPincode={vendor?.warehouse_pincode ?? ""} />
      </Card>

      <Card className="mt-5">
        <CardHeader title={`My supply (${(rows ?? []).length})`} />
        {(rows ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">Nothing declared yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-grid text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-2.5 font-semibold">Grade</th>
                  <th className="px-5 py-2.5 font-semibold">Shape</th>
                  <th className="px-5 py-2.5 font-semibold">Dispatch</th>
                  <th className="px-5 py-2.5 font-semibold">Sizes</th>
                  <th className="px-5 py-2.5 font-semibold">MTC / Cut</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => {
                  const g = gradeInfo.get(r.grade_id);
                  return (
                    <tr key={r.id} className={"border-b border-grid last:border-0 " + (r.active ? "" : "opacity-50")}>
                      <td className="px-5 py-2.5 font-semibold">
                        {g?.name} <span className="font-normal text-muted">· {g?.material}</span>
                      </td>
                      <td className="px-5 py-2.5">{shapeName.get(r.shape_id)}</td>
                      <td className="px-5 py-2.5">{r.warehouse_pincode ?? "—"}</td>
                      <td className="px-5 py-2.5 text-ink-2">{r.size_range ?? "—"}</td>
                      <td className="px-5 py-2.5 text-ink-2">
                        {r.mtc_available ? "MTC" : "—"} / {r.cut_to_size ? "Cut" : "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">
                        <form action={toggleSupplyAction} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="active" value={String(!r.active)} />
                          <button type="submit" className="text-[12.5px] font-semibold text-brand">
                            {r.active ? "Pause" : "Resume"}
                          </button>
                        </form>
                        <form action={removeSupplyAction} className="ml-3 inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-[12.5px] font-semibold text-[#a12525]">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
