import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { ToastProvider } from "@/components/ToastProvider";
import { TimezoneDetector } from "@/components/TimezoneDetector";

export const metadata: Metadata = {
  title: "Tome",
  description: "Track your reading progress with Calibre integration",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tome",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-color-mode="light" data-bottom-nav="false" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Set theme before page loads to prevent flicker
                const savedMode = localStorage.getItem("darkMode");
                const theme = savedMode !== null 
                  ? (savedMode === "true" ? "dark" : "light")
                  : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                
                document.documentElement.setAttribute("data-theme", theme);
                document.documentElement.setAttribute("data-color-mode", theme);
                
                // Set bottom navigation preference before page loads to prevent flicker
                const bottomNavEnabled = localStorage.getItem("bottomNavigationEnabled");
                if (bottomNavEnabled === "true") {
                  document.documentElement.setAttribute("data-bottom-nav", "true");
                } else {
                  document.documentElement.setAttribute("data-bottom-nav", "false");
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)]">
        <ToastProvider />
        <TimezoneDetector />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
