import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Tome",
  description: "Track your reading progress with Calibre integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedMode = localStorage.getItem("darkMode");
                if (savedMode !== null) {
                  document.documentElement.setAttribute("data-theme", savedMode === "true" ? "dark" : "light");
                } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.setAttribute("data-theme", "light");
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)]">
        <ToastProvider />
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-7xl">
          {children}
        </main>
      </body>
    </html>
  );
}
