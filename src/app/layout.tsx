import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DemoSessionProvider } from "@/components/session";
import { SessionGate } from "@/components/session-gate";

// Two families only: IBM Plex Sans for the interface, IBM Plex Mono reserved
// for technical identifiers, timestamps and diagnostic metadata.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Energy Tracker",
  description: "Home energy telemetry, alerts, and AI saving insights",
};

// Runs before paint: restores the saved theme (default light) so there is no
// flash of the wrong colors. Keep in sync with ThemeToggle's storage key.
// Key was bumped to "et-theme" so a stale "dark" saved while dark was the
// forced default is ignored and light stays the true default.
// color-scheme is set here too — see the note in globals.css.
const THEME_INIT = `try{var t=localStorage.getItem("et-theme");var d=t==="dark";document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <DemoSessionProvider>
          <SessionGate>
            <AppShell>{children}</AppShell>
          </SessionGate>
        </DemoSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
