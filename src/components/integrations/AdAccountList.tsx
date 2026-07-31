"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  metaAccountId: string;
  currency: string;
  status: string | null;
  active: boolean;
};

export function AdAccountList({
  accounts,
  readOnly = false,
}: {
  accounts: Account[];
  readOnly?: boolean;
}) {
  if (!accounts.length) {
    return <p className="text-sm text-faint">Nenhuma conta de anúncio.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {accounts.map((acc) => (
        <AccountRow key={acc.id} account={acc} readOnly={readOnly} />
      ))}
    </ul>
  );
}

function AccountRow({ account, readOnly }: { account: Account; readOnly: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(account.active);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (readOnly) return;
    const next = !active;
    setActive(next);
    setBusy(true);
    try {
      await fetch("/api/integrations/meta/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, active: next }),
      });
      router.refresh();
    } catch {
      setActive(!next); // reverte
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{account.name}</div>
        <div className="text-xs text-faint">
          {account.metaAccountId} · {account.currency}
          {account.status && ` · ${account.status}`}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy || readOnly}
        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
          active ? "bg-pos" : "bg-panel-2 border border-line"
        }`}
        aria-pressed={active}
        title={readOnly ? "Somente leitura" : active ? "Ativa" : "Desativada"}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${
            active ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </li>
  );
}
