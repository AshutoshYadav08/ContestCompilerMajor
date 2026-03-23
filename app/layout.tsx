import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Contest Compiler",
  description: "Mock real-time contest platform built with Next.js"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-[1600px] px-4 pb-6 pt-20 md:pt-[72px]">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
