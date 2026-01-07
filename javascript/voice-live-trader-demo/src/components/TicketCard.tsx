"use client";

import { memo } from "react";
import { TradeForm } from "./TradeForm";
import { TradeOrderRequest, TradeOrderResponse, TradeProductType } from "@/lib/trade/types";
import { TradeTicket } from "@/lib/trade/ticket";
import { useFlashOnChange } from "@/lib/hooks";
import { useLanguage } from "@/lib/i18n";

type Props = {
  t: TradeTicket;
  idx: number;
  onToggleCollapse: (id: string) => void;
  onUpdateOrder: (id: string, order: TradeOrderRequest) => void;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
};

function statusClass(s: TradeOrderResponse["status"]) {
  if (s === "filled") return "text-emerald-600 dark:text-emerald-400";
  if (s === "pending") return "text-amber-600 dark:text-amber-400";
  if (s === "canceled") return "text-zinc-600 dark:text-zinc-400";
  return "text-red-600";
}

function fmtIsoShort(s: string | undefined) {
  if (!s) return "";
  return s.replace("T", " ").slice(0, 19);
}

function fmtNum(n: number | undefined, digits = 2) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return n.toFixed(digits);
}

function canSubmitOrder(order: TradeOrderRequest) {
  if (!order.symbol.trim()) return false;
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) return false;
  if (order.orderType === "limit") {
    if (!Number.isFinite(order.limitPrice) || (order.limitPrice ?? 0) <= 0) return false;
  }
  return true;
}

const PRODUCT_TYPES: TradeProductType[] = ["stock", "bond", "fund", "option", "crypto"];

export const TicketCard = memo(function TicketCard({
  t: ticket,
  idx,
  onToggleCollapse,
  onUpdateOrder,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const label = `#${idx + 1}`;
  const resp = ticket.lastResponse;

  const flashProduct = useFlashOnChange(ticket.order.productType);
  const flashStatus = useFlashOnChange(resp?.status ?? "");
  const canSubmit = canSubmitOrder(ticket.order);
  const flashSubmit = useFlashOnChange(canSubmit);

  const getStatusLabel = (s: TradeOrderResponse["status"]) => {
    if (s === "filled") return t.status.filled;
    if (s === "pending") return t.status.pending;
    if (s === "canceled") return t.status.canceled;
    return t.status.rejected;
  };

  if (ticket.frozen && resp) {
    const filledAt = fmtIsoShort(resp.filledAt);
    const receivedAt = fmtIsoShort(resp.receivedAt);
    const fillPrice = fmtNum(resp.fillPrice, 4) || fmtNum(resp.fillPrice, 2);
    const fillValue = fmtNum(resp.fillValue, 2);

    const order = resp.order;
    const sideLabel = order.side === "buy" ? t.buy : t.sell;
    const productLabel = t.productType[order.productType] ?? order.productType;
    const orderTypeLabel = order.orderType === "market" ? t.market : t.limit;
    const qtyText = typeof order.quantity === "number" ? String(order.quantity) : "";
    const limitText =
      order.orderType === "limit" && typeof order.limitPrice === "number" && Number.isFinite(order.limitPrice)
        ? ` @ ${fmtNum(order.limitPrice, 4) || fmtNum(order.limitPrice, 2)} ${order.currency ?? ""}`.trim()
        : "";
    const fillText =
      resp.status === "filled" && fillPrice ? ` @ ${fillPrice} ${order.currency ?? ""}`.trim() : "";
    const summaryText =
      `${getStatusLabel(resp.status)} (${orderTypeLabel}): ${sideLabel} ${qtyText} ${productLabel} ${order.symbol}` +
      (resp.status === "filled" ? fillText : limitText);

    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className={`text-xs font-semibold ${statusClass(resp.status)}${flashStatus ? " flash-3s" : ""}`}>
                {getStatusLabel(resp.status)}
              </div>
              <div className="text-xs text-zinc-500">{t.orderId} {resp.orderId}</div>
            </div>
            <div className="mt-0.5 truncate font-medium">{summaryText}</div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {resp.status === "filled" ? (
                <>
                  {filledAt ? <span>{t.filledAt} {filledAt}</span> : null}
                  {fillPrice ? <span>{t.fillPrice} {fillPrice}</span> : null}
                  {fillValue ? (
                    <span>
                      {t.fillValue} {fillValue} {resp.order.currency ?? ""}
                    </span>
                  ) : null}
                </>
              ) : (
                <>{receivedAt ? <span>{t.submittedAt} {receivedAt}</span> : null}</>
              )}
            </div>
          </div>

          <button
            className="h-8 shrink-0 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => onToggleCollapse(ticket.id)}
          >
            {ticket.collapsed ? t.details : t.collapse}
          </button>
        </div>

        {!ticket.collapsed ? (
          <div className="mt-3">
            <TradeForm
              order={ticket.order}
              disabled
              onOrderChange={() => {
                // frozen
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (ticket.frozen && !resp) {
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="mt-0.5 truncate font-medium">{t.orderSubmitted}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-xs font-semibold text-foreground">{t.filling}</div>
            <select
              className={
                "h-8 rounded-md border border-border bg-transparent px-2 text-xs text-foreground outline-none" +
                (flashProduct ? " flash-3s" : "")
              }
              value={ticket.order.productType}
              onChange={(e) =>
                onUpdateOrder(ticket.id, { ...ticket.order, productType: e.target.value as TradeOrderRequest["productType"] })
              }
            >
              {PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t.productType[pt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className={
              "h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50" +
              (flashSubmit ? " flash-3s" : "")
            }
            disabled={!canSubmit}
            onClick={() => onSubmit(ticket.id)}
          >
            {t.submit}
          </button>
          <button
            className="h-8 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => onDelete(ticket.id)}
          >
            {t.delete}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <TradeForm order={ticket.order} onOrderChange={(next) => onUpdateOrder(ticket.id, next)} />
      </div>
    </div>
  );
});
