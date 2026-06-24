"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, MessageSquarePlus, ChevronDown, ChevronUp } from "lucide-react";

interface AccountRow {
  id: string;
  email: string;
  playerId: string | null;
  playerName: string | null;
  role: string;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "text-emerald-600 dark:text-emerald-400",
  pending: "text-amber-600 dark:text-amber-400",
  rejected: "text-red-600 dark:text-red-400",
};

function CoachNoteForm({ account }: { account: AccountRow }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = note.trim();
    if (!text || !account.playerId || !account.playerName) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/player-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: account.playerId, playerName: account.playerName, note: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save note");
      }
      setNote("");
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving note");
    } finally {
      setSaving(false);
    }
  }

  if (!account.playerId || !account.playerName) return null;

  return (
    <div className="mt-2 w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-foreground transition-colors"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Add Coach Note
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-surface-muted p-3">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Note for ${account.playerName}...`}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-[var(--brand-primary-border)] focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setNote(""); }}
              className="text-xs font-semibold text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !note.trim()}
              className="inline-flex items-center rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {saved ? "Saved!" : saving ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      // silently fail — page shows empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActing(id);
    try {
      const res = await fetch("/api/admin/accounts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error("Failed");
      await load();
    } catch {
      // noop
    } finally {
      setActing(null);
    }
  }

  const pending = accounts.filter((a) => a.status === "pending");
  const others = accounts.filter((a) => a.status !== "pending");
  const withPlayers = others.filter((a) => a.playerId && a.role === "player");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        Admin
      </div>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">
        Account Management
      </h1>
      <p className="mt-2 text-sm text-muted">
        Approve accounts and leave coach notes for players.
      </p>

      {loading ? (
        <div className="mt-8 text-sm text-muted">Loading...</div>
      ) : (
        <>
          {/* Pending section */}
          <section className="mt-8">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              <Clock className="h-3.5 w-3.5" />
              Pending ({pending.length})
            </div>
            {pending.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                No accounts pending approval.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-foreground">{a.email}</div>
                      {a.playerName && (
                        <div className="mt-0.5 text-xs text-muted">{a.playerName}</div>
                      )}
                      <div className="mt-0.5 text-[10px] text-muted">
                        Requested {new Date(a.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAction(a.id, "approve")}
                      disabled={acting === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(a.id, "reject")}
                      disabled={acting === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Coach notes section */}
          {withPlayers.length > 0 && (
            <section className="mt-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Coach Notes — Player Accounts ({withPlayers.length})
              </div>
              <p className="mt-1 text-xs text-muted">Notes are visible to the player in their portal.</p>
              <div className="mt-3 space-y-2">
                {withPlayers.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-foreground">{a.playerName}</div>
                        <div className="mt-0.5 text-xs text-muted">{a.email}</div>
                      </div>
                      <span className={`text-xs font-bold ${STATUS_COLORS[a.status] ?? "text-muted"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </div>
                    <CoachNoteForm account={a} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All accounts */}
          <section className="mt-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              All Accounts ({accounts.length})
            </div>
            <div className="mt-3 space-y-2">
              {others.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground">{a.email}</div>
                    {a.playerName && (
                      <div className="mt-0.5 text-xs text-muted">{a.playerName} · {a.role}</div>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${STATUS_COLORS[a.status] ?? "text-muted"}`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                  {a.status === "rejected" && (
                    <button
                      onClick={() => handleAction(a.id, "approve")}
                      disabled={acting === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
