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
          <main className="mx-auto max-w-[1600px] px-4 pb-6 pt-[172px] sm:pt-[178px] md:pt-[84px]">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
