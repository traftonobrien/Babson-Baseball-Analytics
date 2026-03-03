"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={cn(
        "text-xs text-zinc-500 hover:text-zinc-300 transition-smooth",
        className,
      )}
    >
      Logout
    </button>
  );
}
