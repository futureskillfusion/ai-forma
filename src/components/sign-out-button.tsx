"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

export function SignOutButton({ path }: { path: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch(path, { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
