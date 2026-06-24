"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        Admin
      </div>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">
        Account Approvals
      </h1>
      <p className="mt-2 text-sm text-muted">
        Approve or reject non-Babson accounts requesting access.
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
