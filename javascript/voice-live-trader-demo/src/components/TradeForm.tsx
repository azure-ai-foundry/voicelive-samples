"use client";

import type { CurrencyCode, TradeOrderRequest, TradeProductType } from "@/lib/trade/types";
import { useFlashOnChange } from "@/lib/hooks";
import { memo } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  order: TradeOrderRequest;
  onOrderChange: (next: TradeOrderRequest) => void;
  disabled?: boolean;
};

export const defaultOrder: TradeOrderRequest = {
  productType: "stock",
  symbol: "",
  side: "buy",
  quantity: 0,
  orderType: "market",
  currency: "USD",
  timeInForce: "day",
};

const CURRENCIES: CurrencyCode[] = ["USD", "JPY", "CNY"];

export const TradeForm = memo(function TradeForm({ order, onOrderChange, disabled }: Props) {
  const { t } = useLanguage();
  const limitNeeded = order.orderType === "limit";

  const flashSide = useFlashOnChange(order.side);
  const flashSymbol = useFlashOnChange(order.symbol);
  const flashQty = useFlashOnChange(order.quantity);
  const flashOrderType = useFlashOnChange(order.orderType);
  const flashLimit = useFlashOnChange(order.limitPrice ?? "");
  const flashCurrency = useFlashOnChange((order.currency ?? "USD") as CurrencyCode);
  const flashTif = useFlashOnChange(order.timeInForce ?? "day");

  const flashOptionType = useFlashOnChange(order.optionType ?? "call");
  const flashStrike = useFlashOnChange(order.strike ?? "");
  const flashExpiry = useFlashOnChange(order.expiry ?? "");
  const flashMaturity = useFlashOnChange(order.maturity ?? "");

  const h = "flash-3s";
  const flash = (v: boolean) => (v ? ` ${h}` : "");

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.side}</span>
          <select
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
              flash(flashSide)
            }
            value={order.side}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, side: e.target.value as TradeOrderRequest["side"] })}
          >
            <option value="buy">{t.buy}</option>
            <option value="sell">{t.sell}</option>
          </select>
        </label>

        <label className="md:col-span-2 grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.symbol}</span>
          <input
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
              flash(flashSymbol)
            }
            value={order.symbol}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, symbol: e.target.value })}
            placeholder={t.ticket.placeholders.symbol}
          />
        </label>

        {order.productType === "option" ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs text-zinc-500">{t.ticket.optionType}</span>
              <select
                className={
                  "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
                  flash(flashOptionType)
                }
                value={order.optionType ?? "call"}
                disabled={!!disabled}
                onChange={(e) => onOrderChange({ ...order, optionType: e.target.value as "call" | "put" })}
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-zinc-500">{t.ticket.strike}</span>
              <input
                className={
                  "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
                  flash(flashStrike)
                }
                value={order.strike ?? ""}
                disabled={!!disabled}
                onChange={(e) =>
                  onOrderChange({ ...order, strike: e.target.value === "" ? undefined : Number(e.target.value) })
                }
                inputMode="decimal"
                placeholder={t.ticket.placeholders.strike}
              />
            </label>

            <label className="md:col-span-3 grid gap-1">
              <span className="text-xs text-zinc-500">{t.ticket.expiry}</span>
              <input
                className={
                  "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
                  flash(flashExpiry)
                }
                value={order.expiry ?? ""}
                disabled={!!disabled}
                onChange={(e) => onOrderChange({ ...order, expiry: e.target.value || undefined })}
                placeholder={t.ticket.placeholders.expiry}
              />
            </label>
          </>
        ) : null}

        {order.productType === "bond" ? (
          <label className="md:col-span-3 grid gap-1">
            <span className="text-xs text-zinc-500">{t.ticket.maturity}</span>
            <input
              className={
                "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
                flash(flashMaturity)
              }
              value={order.maturity ?? ""}
              disabled={!!disabled}
              onChange={(e) => onOrderChange({ ...order, maturity: e.target.value || undefined })}
              placeholder={t.ticket.placeholders.maturity}
            />
          </label>
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.quantity}</span>
          <input
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
              flash(flashQty)
            }
            value={Number.isFinite(order.quantity) ? String(order.quantity) : ""}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, quantity: Number(e.target.value) })}
            inputMode="decimal"
            placeholder="100"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.orderType}</span>
          <select
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
              flash(flashOrderType)
            }
            value={order.orderType}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, orderType: e.target.value as TradeOrderRequest["orderType"] })}
          >
            <option value="market">{t.ticket.market}</option>
            <option value="limit">{t.ticket.limit}</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.limitPrice}</span>
          <input
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none disabled:opacity-50" +
              flash(flashLimit)
            }
            value={order.limitPrice ?? ""}
            onChange={(e) => onOrderChange({ ...order, limitPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
            inputMode="decimal"
            disabled={!!disabled || !limitNeeded}
            placeholder={limitNeeded ? t.ticket.placeholders.limitPrice : "-"}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.currency}</span>
          <select
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none disabled:opacity-50" +
              flash(flashCurrency)
            }
            value={(order.currency ?? "USD") as CurrencyCode}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, currency: e.target.value as CurrencyCode })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-zinc-500">{t.ticket.timeInForce}</span>
          <select
            className={
              "h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none" +
              flash(flashTif)
            }
            value={order.timeInForce ?? "day"}
            disabled={!!disabled}
            onChange={(e) => onOrderChange({ ...order, timeInForce: e.target.value as TradeOrderRequest["timeInForce"] })}
          >
            <option value="day">{t.ticket.day}</option>
            <option value="gtc">GTC</option>
          </select>
        </label>
    </div>
  );
});
