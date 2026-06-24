"use client";

import { FormEvent, useState } from "react";
import { Mail, Send } from "lucide-react";

interface RequestLinkResponse {
  ok?: boolean;
  error?: string;
  delivery?: "webhook" | "console";
  previewUrl?: string | null;
}

export function AccountLoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPreviewUrl(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/account/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as RequestLinkResponse | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to send confirmation link");
        return;
      }

      setMessage("Check your email for the confirmation link.");
      setPreviewUrl(payload?.previewUrl ?? null);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        <Mail className="h-4 w-4" />
        Email Link
      </div>
      <label className="mt-4 block text-sm font-semibold text-foreground">
        Email address
      </label>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="your@email.com"
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth placeholder:text-muted focus:border-[var(--brand-primary-border)] focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.22)]"
        autoComplete="email"
      />
      <p className="mt-3 text-xs leading-5 text-muted">
        You&apos;ll receive a login link. Coach accounts get in immediately; all
        others require coach approval.
      </p>

      {error ? <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-foreground">{message}</p> : null}
      {previewUrl ? (
        <a
          href={previewUrl}
          className="mt-3 block break-all rounded-xl border border-border bg-background px-4 py-3 text-xs font-semibold text-foreground transition-smooth hover:bg-surface-muted"
        >
          Local preview link: {previewUrl}
        </a>
      ) : null}

      <button
        type="submit"
        disabled={isSending || !email}
        className="mt-5 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition-smooth hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {isSending ? "Sending..." : "Send Link"}
      </button>
    </form>
  );
}
