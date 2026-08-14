import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "../../_lib/ui";
import { placeOrderAction } from "./actions";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.buyer_id !== user.id) notFound();
  if (order.status !== "draft") redirect(`/buyer/orders/${order.id}`);

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order.id);
  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", user.id)
    .order("is_default", { ascending: false });
  const allAddresses = addresses ?? [];

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Checkout" />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Order Items" />
            <div className="divide-y divide-grid">
              {(items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
                >
                  <div>
                    <div className="font-semibold text-ink">{item.description}</div>
                    <div className="text-[12px] text-muted">
                      Qty {item.quantity} × {formatCurrency(item.unit_price)}
                    </div>
                  </div>
                  <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery Address" />
            <div className="px-5 py-4">
              {allAddresses.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {allAddresses.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-start gap-2.5 rounded-lg border border-grid px-3.5 py-3 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-brand-light"
                    >
                      <input
                        type="radio"
                        name="delivery_address_id"
                        value={a.id}
                        form="checkout-form"
                        defaultChecked={a.is_default}
                        required
                        className="mt-0.5"
                      />
                      <span>
                        <b className="block text-ink">{a.label}</b>
                        <span className="text-ink-2">
                          {a.full_address} — {a.pincode}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-ink-2">
                  You have no saved addresses.{" "}
                  <a href="/buyer/addresses" className="font-semibold text-brand">
                    Add one
                  </a>{" "}
                  before placing this order.
                </p>
              )}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="text-[14.5px] font-semibold">Order Summary</h3>
          <form id="checkout-form" action={placeOrderAction} className="flex flex-col gap-3">
            <input type="hidden" name="order_id" value={order.id} />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Coupon code
              </label>
              <input
                name="coupon_code"
                type="text"
                placeholder="Optional"
                className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
              />
            </div>
            <div className="flex flex-col gap-1.5 border-t border-grid pt-3 text-[13.5px]">
              <div className="flex justify-between text-ink-2">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>GST (18%)</span>
                <span>{formatCurrency(order.subtotal * 0.18)}</span>
              </div>
              <div className="flex justify-between text-[14.5px] font-bold text-ink">
                <span>Total (est.)</span>
                <span>{formatCurrency(order.subtotal * 1.18)}</span>
              </div>
              <p className="text-[11.5px] text-muted">
                Final total is recalculated on placing the order, after any coupon discount.
              </p>
            </div>
            <button
              type="submit"
              disabled={allAddresses.length === 0}
              className="rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
            >
              Place Order
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
