import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MECHmetrIQ — Custom Manufacturing & Raw Materials Marketplace",
  description:
    "Upload a part for an instant quote, or buy metals, plastics and sheets from verified vendors. Mechanical Intelligence. Smarter Quotations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
