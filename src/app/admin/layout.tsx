import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { initialsFor } from "./_lib/format";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Admin"
        items={[
          { label: "Overview", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "Vendors", href: "/admin/vendors" },
          { label: "Orders", href: "/admin/orders" },
          { label: "Quotes & RFQs", href: "/admin/quotes" },
          { label: "Category & Material Master", href: "/admin/catalog" },
          { label: "Disputes", href: "/admin/disputes" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        footer={{
          initials: initialsFor(profile.full_name),
          name: profile.full_name,
          subtitle: "Administrator",
        }}
      />
      <main className="flex-1 p-7">{children}</main>
    </div>
  );
}
