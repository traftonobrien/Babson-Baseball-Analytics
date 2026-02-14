"use client";

import { useState, useEffect } from "react";
import { Radio, Lock } from "lucide-react";

const STORAGE_KEY = "trackman_preview_auth";
const PASSCODE = "mitchh";

export default function TrackmanLayout({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSCODE) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-sm w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-zinc-800 rounded-full p-3">
            <Radio className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-zinc-100">Trackman Sessions</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6">Coming soon. Enter passcode to preview.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder="Passcode"
              autoFocus
              className={`w-full bg-zinc-800 border rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 ${
                error ? "border-red-500/60" : "border-zinc-700"
              }`}
            />
          </div>
          {error && (
            <p className="text-xs text-red-400">Incorrect passcode</p>
          )}
          <button
            type="submit"
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium py-2 rounded-md transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
