"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function AuthButtons() {
  return (
    <div className="space-y-4">
      <Button
        size="lg"
        className="w-full rounded-2xl"
        onClick={() => signIn("google", { callbackUrl: "/dashboard", redirect: true })}
      >
        Continue with Google
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="w-full rounded-2xl bg-background/80"
        onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard", redirect: true })}
      >
        Continue with Microsoft Entra ID
      </Button>
    </div>
  );
}
