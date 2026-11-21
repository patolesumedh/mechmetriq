import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MechOneHub — Custom Manufacturing & Raw Materials Marketplace",
  description:
    "Upload a part for an instant quote, or buy metals, plastics and sheets from verified vendors. Mechanical Intelligence. Smarter Quotations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..700&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
