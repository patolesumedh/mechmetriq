import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { addAddressAction, deleteAddressAction } from "./actions";

export default async function AddressesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", user.id)
    .order("is_default", { ascending: false });
  const allAddresses = addresses ?? [];

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Addresses" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <Card>
          <CardHeader title="Saved Addresses" />
          {allAddresses.length > 0 ? (
            <div className="divide-y divide-grid">
              {allAddresses.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
                >
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      {a.label}
                      {a.is_default && <Badge tone="active">Default</Badge>}
                    </div>
                    <div className="text-[12.5px] text-ink-2">
                      {a.full_address} — {a.pincode}
                    </div>
                  </div>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="address_id" value={a.id} />
                    <button type="submit" className="text-[12.5px] font-semibold text-crit">
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-[13.5px] text-ink-2">
              No addresses saved yet.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-[14.5px] font-semibold">Add Address</h3>
          <form action={addAddressAction} className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Label</label>
              <input
                name="label"
                required
                placeholder="e.g. Factory, Warehouse"
                className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Full address
              </label>
              <textarea
                name="full_address"
                required
                rows={3}
                className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Pincode
              </label>
              <input
                name="pincode"
                required
                className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <input type="checkbox" name="is_default" /> Set as default address
            </label>
            <button
              type="submit"
              className="rounded-[9px] bg-brand py-2.5 text-[13.5px] font-bold text-white"
            >
              Add Address
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
