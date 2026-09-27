import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { initials } from "./_lib/ui";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "buyer") {
    redirect("/login");
  }

  const { count: cartCount } = await supabase
    .from("rm_cart_items")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Buyer"
        items={[
          { label: "Overview", href: "/buyer" },
          { label: "Get Instant Quote", href: "/buyer/quote" },
          { label: "My Quotes", href: "/buyer/quotes" },
          { label: "My Orders", href: "/buyer/orders" },
          { label: "Raw Materials", href: "/raw-materials" },
          { label: "Cart", href: "/buyer/cart", count: cartCount || undefined },
          { label: "Addresses", href: "/buyer/addresses" },
          { label: "Profile", href: "/buyer/profile" },
        ]}
        footer={{
          initials: initials(profile.full_name),
          name: profile.full_name,
          subtitle: profile.email,
        }}
      />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
