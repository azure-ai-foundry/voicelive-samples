"use client";

import type { AccountBalance, CurrencyCode, FxConvertRequest, FxConvertResponse } from "@/lib/trade/types";
import { useMemo, useState, memo } from "react";
import { useFlashOnChange } from "@/lib/hooks";
import { useLanguage } from "@/lib/i18n";

type Props = {
  balances: AccountBalance[];
  onConvert: (req: FxConvertRequest) => Promise<FxConvertResponse>;
  onAdjust?: (req: { currency: "USD" | "JPY" | "CNY"; amount: number }) => Promise<{ ok: boolean; error?: string }>;
};

const DISPLAY_CCYS: Array<"USD" | "JPY" | "CNY"> = ["USD", "JPY", "CNY"];
const CONVERT_CCYS: CurrencyCode[] = ["USD", "JPY", "CNY"];

function BalanceCard({ ccy, balance }: { ccy: CurrencyCode; balance?: AccountBalance }) {
  const flash = useFlashOnChange(balance?.available);
  const { t } = useLanguage();
  const h = "flash-3s";

  return (
    <div
      className={`rounded-md border border-border bg-background p-3${
        flash ? " " + h : ""
      }`}
    >
      <div className="text-xs text-zinc-500">{ccy}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {balance ? balance.available.toLocaleString() : "0"}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">
        {t.reserved}{balance ? balance.reserved.toLocaleString() : "0"}
      </div>
    </div>
  );
}

export const AccountPanel = memo(function AccountPanel({ balances, onConvert, onAdjust }: Props) {
  const { t } = useLanguage();
  const [from, setFrom] = useState<CurrencyCode>("USD");
  const [to, setTo] = useState<CurrencyCode>("CNY");
  const [amount, setAmount] = useState<string>("100");
  const [busy, setBusy] = useState(false);

  const [cashCcy, setCashCcy] = useState<"USD" | "JPY" | "CNY">("USD");
  const [cashAmount, setCashAmount] = useState<string>("1000");
  const [cashMode, setCashMode] = useState<"deposit" | "withdraw">("deposit");

  const [error, setError] = useState<string | null>(null);

  const byCcy = useMemo(() => {
    const m = new Map<CurrencyCode, AccountBalance>();
    for (const b of balances) m.set(b.currency, b);
    return m;
  }, [balances]);

  async function submit() {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t.amountPositive);
      return;
    }
    if (from === to) {
      setError(t.sameCurrency);
      return;
    }

    setBusy(true);
    try {
      const res = await onConvert({ from, to, amount: n });
      if (!res.ok) setError(res.error ?? t.exchangeFailed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCash() {
    if (!onAdjust) {
      setError(t.noCashConfig);
      return;
    }
    setError(null);
    const n = Number(cashAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t.amountPositive);
      return;
    }

    setBusy(true);
    try {
      const amountSigned = cashMode === "deposit" ? n : -n;
      const res = await onAdjust({ currency: cashCcy, amount: amountSigned });
      if (!res.ok) setError(res.error ?? t.opFailed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.accountBalance}</h2>
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {DISPLAY_CCYS.map((ccy) => (
          <BalanceCard key={ccy} ccy={ccy} balance={byCcy.get(ccy)} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-foreground hover:bg-accent text-center">
            {t.exchange}
          </summary>
          <div className="grid gap-2 border-t border-border p-3">
            <select
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={from}
              onChange={(e) => setFrom(e.target.value as CurrencyCode)}
              disabled={busy}
            >
              {CONVERT_CCYS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={to}
              onChange={(e) => setTo(e.target.value as CurrencyCode)}
              disabled={busy}
            >
              {CONVERT_CCYS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={t.amount}
              disabled={busy}
            />
            <button
              className="h-9 w-full rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              onClick={submit}
              disabled={busy}
            >
              {busy ? t.processing : t.confirm}
            </button>
          </div>
        </details>

        <details className="rounded-md border border-border">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-foreground hover:bg-accent text-center">
            {t.depositWithdraw}
          </summary>
          <div className="grid gap-2 border-t border-border p-3">
            <select
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={cashMode}
              onChange={(e) => setCashMode(e.target.value as "deposit" | "withdraw")}
              disabled={busy}
            >
              <option value="deposit">{t.deposit}</option>
              <option value="withdraw">{t.withdraw}</option>
            </select>
            <select
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={cashCcy}
              onChange={(e) => setCashCcy(e.target.value as "USD" | "JPY" | "CNY")}
              disabled={busy}
            >
              {DISPLAY_CCYS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              inputMode="decimal"
              placeholder={t.amount}
              disabled={busy}
            />
            <button
              className="h-9 w-full rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              onClick={submitCash}
              disabled={busy || !onAdjust}
            >
              {busy ? t.processing : t.confirm}
            </button>
          </div>
        </details>
      </div>
    </section>
  );
});
