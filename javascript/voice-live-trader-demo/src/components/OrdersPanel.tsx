"use client";

import type { ModifyOrderRequest, OrderRecord } from "@/lib/trade/types";
import { useMemo, useState, memo } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  orders: OrderRecord[];
  onCancel: (orderId: string) => Promise<void>;
  onModify: (orderId: string, patch: ModifyOrderRequest) => Promise<void>;
};

export const OrdersPanel = memo(function OrdersPanel({ orders, onCancel, onModify }: Props) {
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
  const [limit, setLimit] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(orders.map((o) => [o.orderId, o])), [orders]);

  function startEdit(orderId: string) {
    const o = byId.get(orderId);
    if (!o) return;
    setError(null);
    setEditingId(orderId);
    setQ(String(o.quantity));
    setLimit(o.limitPrice !== undefined ? String(o.limitPrice) : "");
  }

  async function doCancel(orderId: string) {
    setError(null);
    setBusyId(orderId);
    try {
      await onCancel(orderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function doModify(orderId: string) {
    setError(null);
    const qty = Number(q);
    const lp = limit === "" ? undefined : Number(limit);

    const patch: ModifyOrderRequest = {};
    if (Number.isFinite(qty)) patch.quantity = qty;
    if (lp !== undefined && Number.isFinite(lp)) patch.limitPrice = lp;

    setBusyId(orderId);
    try {
      await onModify(orderId, patch);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.activeOrders}</h2>
        <div className="text-xs text-muted-foreground">{orders.length} {t.items}</div>
      </div>
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}

      <div className="mt-3 space-y-2">
        {orders.length === 0 ? <div className="text-sm text-muted-foreground">{t.noActiveOrders}</div> : null}

        {orders.map((o) => {
          const pending = o.status === "pending";
          const busy = busyId === o.orderId;
          const editing = editingId === o.orderId;

          const sideLabel = o.side === "buy" ? t.buy : t.sell;
          const productLabel = t.productType[o.productType as keyof typeof t.productType] ?? o.productType;
          const statusLabel =
            o.status === "filled"
              ? t.status.filled
              : o.status === "pending"
                ? t.status.pending
                : o.status === "canceled"
                  ? t.status.canceled
                  : t.status.rejected;
          const orderTypeLabel = o.orderType === "market" ? t.ticket.market : `${t.ticket.limit} ${o.limitPrice}`;

          return (
            <div
              key={o.orderId}
              className="rounded-md border border-border bg-transparent p-3 text-sm text-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {sideLabel} {o.quantity} {productLabel} {o.symbol}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {orderTypeLabel} · {o.currency} · {statusLabel}
                  </div>
                </div>

                {pending ? (
                  <div className="flex gap-2">
                    <button
                      className="h-8 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground disabled:opacity-50 hover:bg-accent"
                      onClick={() => doCancel(o.orderId)}
                      disabled={busy}
                    >
                      {t.cancel}
                    </button>
                    <button
                      className="h-8 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground disabled:opacity-50 hover:bg-accent"
                      onClick={() => startEdit(o.orderId)}
                      disabled={busy}
                    >
                      {t.modify}
                    </button>
                  </div>
                ) : null}
              </div>

              {o.status === "filled" && o.fillPrice !== undefined ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  {t.fillPrice} {o.fillPrice} · {t.fillValue} {o.fillValue}
                </div>
              ) : null}

              {editing ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    inputMode="decimal"
                    placeholder={t.ticket.quantity}
                    disabled={busy}
                  />
                  <input
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none disabled:opacity-50"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    inputMode="decimal"
                    placeholder={o.orderType === "limit" ? t.ticket.limit : t.marketNoEditPrice}
                    disabled={busy || o.orderType !== "limit"}
                  />

                  <button
                    className="col-span-2 h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
                    onClick={() => doModify(o.orderId)}
                    disabled={busy}
                  >
                    {busy ? t.processing : t.submitModify}
                  </button>

                  <button
                    className="col-span-2 h-9 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground disabled:opacity-50 hover:bg-accent"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                  >
                    {t.cancelEdit}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
});
