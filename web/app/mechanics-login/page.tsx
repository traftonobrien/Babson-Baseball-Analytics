"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MechanicsLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/mechanics-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/mechanics");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Wrong password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Mechanics</h1>
        <p className="text-xs text-zinc-500 text-center">
          This section is in development. Enter the access code to continue.
        </p>
        <input
          type="password"
          placeholder="Access code"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded font-medium transition-smooth disabled:opacity-50"
        >
          {loading ? "..." : "Enter"}
        </button>
        <Link
          href="/"
          className="block text-center text-xs text-zinc-600 hover:text-zinc-400 transition-smooth"
        >
          Back to Pitch Tracker
        </Link>
      </form>
    </div>
  );
}
