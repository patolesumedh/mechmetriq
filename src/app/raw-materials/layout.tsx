import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { createClient } from "@/lib/supabase/server";

export default async function RawMaterialsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let cartCount: number | null = null;
  if (user) {
    const { count } = await supabase
      .from("rm_cart_items")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id);
    cartCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteHeader />
      <div className="border-b border-grid bg-plane">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <Link href="/raw-materials" className="text-[13px] font-bold text-ink">
            Raw Material Marketplace
          </Link>
          <nav className="flex items-center gap-5 text-[13px] text-ink-2">
            <Link href="/raw-materials" className="hover:text-ink">
              Browse
            </Link>
            <Link href="/raw-materials/weight-calculator" className="hover:text-ink">
              Weight calculator
            </Link>
            <Link
              href={user ? "/buyer/cart" : "/login?next=/buyer/cart"}
              className="flex items-center gap-1.5 rounded-lg border border-grid bg-surface px-3 py-1.5 font-semibold text-ink hover:border-brand"
            >
              Cart
              {cartCount !== null && cartCount > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
