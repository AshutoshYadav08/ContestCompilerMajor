"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <AuthProvider>{children}</AuthProvider>
    </ClerkProvider>
  );
}
