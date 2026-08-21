import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hệ thống Quản lý Du học & Học bổng",
  description: "Abroad Scholarship System",
};

// Single root layout for the whole app (staff + portal share one <html>/<body> —
// see docs/frontend/FRONTEND_ARCHITECTURE.md "Portal as surface, not a separate app").
// Route-group layouts under (internal)/ and (portal)/ are nested layouts, never a
// second root — that would trigger Next.js's "multiple root layouts" full-reload
// caveat between the two surfaces for no reason, since they share the same origin,
// auth mechanism, and design tokens.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
