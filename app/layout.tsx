import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/geist";
import "../tokens.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "A2Z DSA Course Roadmap",
  description: "Practice the A2Z DSA sheet, keep a coding journal, and plan your next revision.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
