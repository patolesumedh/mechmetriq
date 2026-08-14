import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { masterStatusTone, titleCase } from "../_lib/format";
import { createMasterItemAction, toggleMasterItemStatusAction } from "./actions";
import type { Database } from "@/lib/types/database";

type MasterItem = Database["public"]["Tables"]["master_items"]["Row"];
type MasterItemType = Database["public"]["Enums"]["master_item_type"];

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const { msg, error } = await searchParams;
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("master_items")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const all = itemsData ?? [];
  const byType = (t: MasterItemType) => all.filter((i) => i.type === t);

  const processes = byType("process");
  const materials = byType("material");
  const units = byType("unit");
  const finishes = byType("finish");

  const topLevelMaterials = materials.filter((m) => !m.parent_id);
  const gradesByParent = new Map<string, MasterItem[]>();
  for (const m of materials) {
    if (m.parent_id) {
      gradesByParent.set(m.parent_id, [...(gradesByParent.get(m.parent_id) ?? []), m]);
    }
  }
  const orderedMaterials: { item: MasterItem; isChild: boolean }[] = [];
  for (const parent of topLevelMaterials) {
    orderedMaterials.push({ item: parent, isChild: false });
    for (const grade of gradesByParent.get(parent.id) ?? []) {
      orderedMaterials.push({ item: grade, isChild: true });
    }
  }

  return (
    <div>
      <Topbar title="Category & Material Master" />

      <div className="mt-6 space-y-5">
        <div className="rounded-[10px] bg-brand-light px-4.5 py-3 text-[12.5px] font-semibold leading-relaxed text-brand-dark">
          &#9432; This is the backbone data every other form depends on — process, material and
          grade dropdowns in Instant Quote, RFQ submission, and Add Listing all pull from here.
        </div>

        {msg === "created" && (
          <div className="rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            Item created.
          </div>
        )}
        {msg === "updated" && (
          <div className="rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            Status updated.
          </div>
        )}
        {error === "name_required" && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            Name is required.
          </div>
        )}

        <CatalogSection
          id="process"
          title="Processes"
          rows={processes.map((item) => ({ item, isChild: false }))}
          addForm={<AddItemForm type="process" />}
        />

        <CatalogSection
          id="material"
          title="Materials"
          rows={orderedMaterials}
          addForm={<AddItemForm type="material" parentOptions={topLevelMaterials} />}
        />

        <CatalogSection
          id="unit"
          title="Units"
          rows={units.map((item) => ({ item, isChild: false }))}
          addForm={<AddItemForm type="unit" />}
        />

        <CatalogSection
          id="finish"
          title="Finishes"
          rows={finishes.map((item) => ({ item, isChild: false }))}
          addForm={<AddItemForm type="finish" />}
        />
      </div>
    </div>
  );
}

function CatalogSection({
  id,
  title,
  rows,
  addForm,
}: {
  id: string;
  title: string;
  rows: { item: MasterItem; isChild: boolean }[];
  addForm: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20">
      <Card>
        <CardHeader title={title} />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Default unit</Th>
              <Th>HSN code</Th>
              <Th>GST rate</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={6}>No {title.toLowerCase()} yet.</EmptyRow>
            )}
            {rows.map(({ item, isChild }) => (
              <tr key={item.id}>
                <Td strong={!isChild}>
                  <span className={isChild ? "pl-4 text-ink-2" : ""}>
                    {isChild ? "— " : ""}
                    {item.name}
                  </span>
                </Td>
                <Td>{item.default_unit ?? "—"}</Td>
                <Td>{item.hsn_code ?? "—"}</Td>
                <Td>{item.gst_rate != null ? `${item.gst_rate}%` : "—"}</Td>
                <Td>
                  <Badge tone={masterStatusTone(item.status)}>
                    {item.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td>
                  <form action={toggleMasterItemStatusAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="type" value={item.type} />
                    <input
                      type="hidden"
                      name="nextStatus"
                      value={item.status === "active" ? "inactive" : "active"}
                    />
                    <button type="submit" className="text-[12.5px] font-semibold text-brand">
                      {item.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="border-t border-grid p-5">
          <div className="mb-3 text-[12.5px] font-semibold text-ink-2">
            Add new {title.replace(/e?s$/, "").toLowerCase()}
          </div>
          {addForm}
        </div>
      </Card>
    </div>
  );
}

function AddItemForm({
  type,
  parentOptions,
}: {
  type: MasterItemType;
  parentOptions?: MasterItem[];
}) {
  return (
    <form action={createMasterItemAction} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="type" value={type} />
      <div className="col-span-2">
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">
          Name <span className="text-crit">*</span>
        </label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
      </div>
      {parentOptions && (
        <div className="col-span-2">
          <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">
            Parent material{" "}
            <span className="font-normal text-muted">(leave blank for a top-level material)</span>
          </label>
          <select
            name="parentId"
            defaultValue=""
            className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
          >
            <option value="">— None (top-level) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">Default unit</label>
        <input
          name="defaultUnit"
          placeholder="e.g. kg, pc"
          className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">HSN code</label>
        <input
          name="hsnCode"
          className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">GST rate (%)</label>
        <input
          name="gstRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">
          Applicable processes
        </label>
        <input
          name="applicableProcesses"
          placeholder="e.g. CNC Machining, Sheet Metal"
          className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
      </div>
      <div className="col-span-2">
        <Button type="submit" variant="outline">
          + Add {titleCase(type)}
        </Button>
      </div>
    </form>
  );
}
