import type {
  AccountSnapshot,
  AssetPosition,
  BalanceAdjustRequest,
  BalanceAdjustResponse,
  CancelOrderResponse,
  CurrencyCode,
  FxConvertRequest,
  FxConvertResponse,
  ModifyOrderRequest,
  ModifyOrderResponse,
  OrderRecord,
  TradeOrderRequest,
  TradeOrderResponse,
  TradeOrderStatus,
  TradeProductType,
} from "@/lib/trade/types";

type BalanceState = {
  available: number;
  reserved: number;
};

type EngineState = {
  balances: Record<CurrencyCode, BalanceState>;
  assets: Map<string, AssetPosition>; // key = productType|symbol|currency
  orders: Map<string, OrderRecord>;
  fillTimers: Map<string, ReturnType<typeof setTimeout>>;
};

function nowIso() {
  return new Date().toISOString();
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round8(n: number) {
  return Math.round(n * 100_000_000) / 100_000_000;
}

function isCryptoCcy(ccy: CurrencyCode) {
  return ccy === "BTC" || ccy === "ETH" || ccy === "USDT" || ccy === "USDC";
}

function roundByCcy(ccy: CurrencyCode, n: number) {
  return isCryptoCcy(ccy) ? round8(n) : round2(n);
}

function clampFinite(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n;
}

function assetKey(productType: TradeProductType, symbol: string, currency: CurrencyCode) {
  return `${productType}|${symbol.toUpperCase()}|${currency}`;
}

function orderCurrency(order: TradeOrderRequest): CurrencyCode {
  return (order.currency ?? "USD") as CurrencyCode;
}

function hashTo01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 2 ** 32;
  return u;
}

function marketPrice(productType: TradeProductType, symbol: string, currency: CurrencyCode) {
  if (productType === "crypto") {
    const sym = symbol.trim().toUpperCase();
    const usdPx =
      sym === "BTC"
        ? 100_000
        : sym === "ETH"
          ? 4_000
          : sym === "USDT" || sym === "USDC"
            ? 1
            : 0;
    if (usdPx > 0) return round2(usdPx * fxRate("USD", currency));
  }
  const base = 10 + 490 * hashTo01(`${productType}:${symbol.toUpperCase()}`);
  const fx = fxRate("USD", currency);
  return round2(base * fx);
}

export function getMarketPrice(args: {
  productType: TradeProductType;
  symbol: string;
  currency?: CurrencyCode;
}): { ok: boolean; price?: number; currency: CurrencyCode; productType: TradeProductType; symbol: string; error?: string } {
  const productType = args.productType;
  const symbol = args.symbol.trim();
  const currency = (args.currency ?? "USD") as CurrencyCode;

  if (!symbol) {
    return { ok: false, currency, productType, symbol: "", error: "symbol is required" };
  }

  const px = marketPrice(productType, symbol, currency);
  if (!Number.isFinite(px) || px <= 0) {
    return { ok: false, currency, productType, symbol, error: "price unavailable" };
  }

  return { ok: true, price: px, currency, productType, symbol };
}

function fxRate(from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return 1;

  // Simple fixed rates for the demo.
  const usdTo: Record<CurrencyCode, number> = {
    USD: 1,
    JPY: 150,
    CNY: 7.2,
    BTC: 1 / 100_000,
    ETH: 1 / 4_000,
    USDT: 1,
    USDC: 1,
  };

  const fromUsd = 1 / usdTo[from];
  const toUsd = usdTo[to];
  return fromUsd * toUsd;
}

function randInt(min: number, max: number) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

function randFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function sampleUnique<T>(items: readonly T[], n: number) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
}

function seedDemoHoldings(s: EngineState) {
  const stockSymbols = ["MSFT", "AAPL", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX"] as const;
  const fundSymbols = ["SPY", "QQQ", "VTI", "VOO", "IWM"] as const;

  const want = randInt(2, 3);
  const picks = sampleUnique(
    [
      ...stockSymbols.map((sym) => ({ productType: "stock" as const, symbol: sym })),
      ...fundSymbols.map((sym) => ({ productType: "fund" as const, symbol: sym })),
    ],
    want
  );

  for (const p of picks) {
    const currency: CurrencyCode = "USD";
    const qty = p.productType === "stock" ? randInt(5, 200) : randInt(10, 500);
    const mkt = marketPrice(p.productType, p.symbol, currency);
    const avg = round2(mkt * randFloat(0.85, 1.15));
    const key = assetKey(p.productType, p.symbol, currency);
    const pos: AssetPosition = {
      id: `pos_${crypto.randomUUID()}`,
      productType: p.productType,
      symbol: p.symbol,
      currency,
      quantity: round2(qty),
      avgCost: avg,
      updatedAt: nowIso(),
    };
    s.assets.set(key, pos);
  }

  // Seed only 2 crypto balances (shown as assets in UI).
  const cryptos: CurrencyCode[] = ["BTC", "ETH", "USDT", "USDC"];
  const chosen = sampleUnique(cryptos, 2);
  s.balances.BTC.available = 0;
  s.balances.ETH.available = 0;
  s.balances.USDT.available = 0;
  s.balances.USDC.available = 0;
  for (const c of chosen) {
    if (c === "BTC") s.balances.BTC.available = round8(randFloat(0.002, 0.03));
    if (c === "ETH") s.balances.ETH.available = round8(randFloat(0.05, 1.2));
    if (c === "USDT") s.balances.USDT.available = round8(randFloat(200, 3000));
    if (c === "USDC") s.balances.USDC.available = round8(randFloat(200, 3000));
  }
}

function createInitialState(): EngineState {
  const s: EngineState = {
    balances: {
      USD: { available: 100_000, reserved: 0 },
      JPY: { available: 10_000_000, reserved: 0 },
      CNY: { available: 500_000, reserved: 0 },
      BTC: { available: 0, reserved: 0 },
      ETH: { available: 0, reserved: 0 },
      USDT: { available: 0, reserved: 0 },
      USDC: { available: 0, reserved: 0 },
    },
    assets: new Map(),
    orders: new Map(),
    fillTimers: new Map(),
  };

  seedDemoHoldings(s);
  return s;
}

let STATE: EngineState | null = null;
const listeners = new Set<(snap: AccountSnapshot) => void>();

function notify(snap: AccountSnapshot) {
  if (!listeners.size) return;
  for (const l of listeners) {
    try {
      l(snap);
    } catch {
      // ignore
    }
  }
}

function scheduleFillIfNeeded(orderId: string) {
  const s = state();
  if (s.fillTimers.has(orderId)) return;
  const o = s.orders.get(orderId);
  if (!o || o.status !== "pending" || o.orderType !== "limit") return;
  const limitPx = o.limitPrice ?? 0;
  if (!Number.isFinite(limitPx) || limitPx <= 0) return;

  const delayMs = Math.floor(60_000 + hashTo01(orderId) * 240_000); // 1-5 minutes
  const timer = setTimeout(() => {
    try {
      applyFill(orderId, round2(limitPx));
      notify(snapshot());
    } catch {
      // ignore
    }
  }, delayMs);
  s.fillTimers.set(orderId, timer);
}

export function subscribeAccountSnapshot(listener: (snap: AccountSnapshot) => void) {
  listeners.add(listener);
  try {
    listener(snapshot());
  } catch {
    // ignore
  }
  return () => {
    listeners.delete(listener);
  };
}

function state(): EngineState {
  if (!STATE) {
    // No persistence: every page refresh resets the demo account.
    STATE = createInitialState();
  }
  return STATE;
}

function snapshot(): AccountSnapshot {
  const s = state();
  const asOf = nowIso();

  // Balances are cash only (fiat). Crypto is exposed as assets/positions.
  const cashCcys: Array<"USD" | "JPY" | "CNY"> = ["USD", "JPY", "CNY"];
  const balances = cashCcys.map((ccy) => {
    const b = s.balances[ccy];
    const available = roundByCcy(ccy, clampFinite(b.available));
    const reserved = roundByCcy(ccy, clampFinite(b.reserved));
    return { currency: ccy, available, reserved, total: roundByCcy(ccy, available + reserved) };
  });

  const assets = Array.from(s.assets.values()).map((p) => ({ ...p }));

  const cryptoCcys: CurrencyCode[] = ["BTC", "ETH", "USDT", "USDC"];
  for (const c of cryptoCcys) {
    const b = s.balances[c];
    const qty = roundByCcy(c, clampFinite(b.available) + clampFinite(b.reserved));
    if (qty <= 0) continue;
    assets.unshift({
      id: `pos_crypto_${c}`,
      productType: "crypto",
      symbol: c,
      currency: c,
      quantity: qty,
      avgCost: 0,
      updatedAt: asOf,
    });
  }
  const orders = Array.from(s.orders.values())
    .map((o) => ({ ...o }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return { asOf, balances, assets, orders };
}

function requirePending(order: OrderRecord) {
  if (order.status !== "pending") throw new Error("Only pending orders can be changed");
}

function setOrderStatus(orderId: string, status: TradeOrderStatus) {
  const s = state();
  const order = s.orders.get(orderId);
  if (!order) throw new Error("Order not found");
  order.status = status;
  order.updatedAt = nowIso();
  s.orders.set(orderId, order);
  return order;
}

function releaseReservation(order: OrderRecord) {
  const s = state();

  if (order.productType === "crypto") {
    const base = order.symbol.trim().toUpperCase();
    if (base !== "BTC" && base !== "ETH" && base !== "USDT" && base !== "USDC") {
      order.reservedValue = 0;
      return;
    }

    if (order.side === "buy") {
      const b = s.balances[order.currency];
      const v = round2(order.reservedValue ?? 0);
      if (v > 0) {
        b.reserved = round2(b.reserved - v);
        b.available = round2(b.available + v);
      }
      order.reservedValue = 0;
      return;
    }

    // sell: reservation is base quantity
    const b = s.balances[base as CurrencyCode];
    const q = round8(order.reservedValue ?? 0);
    if (q > 0) {
      b.reserved = round8(b.reserved - q);
      b.available = round8(b.available + q);
    }
    order.reservedValue = 0;
    return;
  }

  if (order.side === "buy") {
    const b = s.balances[order.currency];
    const v = round2(order.reservedValue ?? 0);
    if (v > 0) {
      b.reserved = round2(b.reserved - v);
      b.available = round2(b.available + v);
    }
    order.reservedValue = 0;
    return;
  }

  // sell: release reserved quantity by adding back to position (we reserve by subtracting from free quantity)
  const key = assetKey(order.productType, order.symbol, order.currency);
  const pos = s.assets.get(key);
  const reservedQty = (order.reservedValue ?? 0) / 1;
  if (reservedQty > 0) {
    if (pos) {
      pos.quantity = round2(pos.quantity + reservedQty);
      pos.updatedAt = nowIso();
      s.assets.set(key, pos);
    } else {
      // Should not happen, but restore as new position at 0 cost.
      const created: AssetPosition = {
        id: `pos_${crypto.randomUUID()}`,
        productType: order.productType,
        symbol: order.symbol,
        currency: order.currency,
        quantity: round2(reservedQty),
        avgCost: 0,
        updatedAt: nowIso(),
      };
      s.assets.set(key, created);
    }
  }
  order.reservedValue = 0;
}

function applyFill(orderId: string, fillPrice: number) {
  const s = state();
  const order = s.orders.get(orderId);
  if (!order) return;
  if (order.status !== "pending") return;

  if (order.productType === "crypto") {
    const base = order.symbol.trim().toUpperCase();
    if (base !== "BTC" && base !== "ETH" && base !== "USDT" && base !== "USDC") return;
    if (order.currency !== "USD") return;

    const qty = round8(order.quantity);
    const value = round2(fillPrice * qty);

    if (order.side === "buy") {
      const cash = s.balances[order.currency];
      const reserved = round2(order.reservedValue ?? 0);
      cash.reserved = round2(cash.reserved - reserved);
      const diff = round2(reserved - value);
      if (diff > 0) cash.available = round2(cash.available + diff);
      order.reservedValue = 0;

      const coin = s.balances[base as CurrencyCode];
      coin.available = round8(coin.available + qty);
    } else {
      // sell: reduce reserved coin qty, credit USD
      const coin = s.balances[base as CurrencyCode];
      const reservedQty = round8(order.reservedValue ?? 0);
      coin.reserved = round8(coin.reserved - reservedQty);
      order.reservedValue = 0;

      const cash = s.balances[order.currency];
      cash.available = round2(cash.available + value);
    }

    order.status = "filled";
    order.filledAt = nowIso();
    order.fillPrice = round2(fillPrice);
    order.fillValue = value;
    order.updatedAt = nowIso();
    s.orders.set(orderId, order);

    const t = s.fillTimers.get(orderId);
    if (t) {
      clearTimeout(t);
      s.fillTimers.delete(orderId);
    }
    return;
  }

  const qty = order.quantity;
  const value = round2(fillPrice * qty);

  if (order.side === "buy") {
    // Spend reserved cash.
    const b = s.balances[order.currency];
    const reserved = round2(order.reservedValue ?? 0);
    b.reserved = round2(b.reserved - reserved);
    // Any difference between reserved and actual (should be 0 for limit) is returned.
    const diff = round2(reserved - value);
    if (diff > 0) b.available = round2(b.available + diff);
    order.reservedValue = 0;

    const key = assetKey(order.productType, order.symbol, order.currency);
    const existing = s.assets.get(key);
    if (existing) {
      const newQty = round2(existing.quantity + qty);
      const totalCost = round2(existing.avgCost * existing.quantity + value);
      const newAvg = newQty > 0 ? round2(totalCost / newQty) : 0;
      existing.quantity = newQty;
      existing.avgCost = newAvg;
      existing.updatedAt = nowIso();
      s.assets.set(key, existing);
    } else {
      const created: AssetPosition = {
        id: `pos_${crypto.randomUUID()}`,
        productType: order.productType,
        symbol: order.symbol,
        currency: order.currency,
        quantity: round2(qty),
        avgCost: round2(value / qty),
        updatedAt: nowIso(),
      };
      s.assets.set(key, created);
    }
  } else {
    // Sell: position quantity was reserved by subtracting at submit; credit cash at fill.
    const b = s.balances[order.currency];
    b.available = round2(b.available + value);
    order.reservedValue = 0;
  }

  order.status = "filled";
  order.filledAt = nowIso();
  order.fillPrice = round2(fillPrice);
  order.fillValue = value;
  order.updatedAt = nowIso();
  s.orders.set(orderId, order);

  const t = s.fillTimers.get(orderId);
  if (t) {
    clearTimeout(t);
    s.fillTimers.delete(orderId);
  }
}

export function getAccountSnapshot(): AccountSnapshot {
  return snapshot();
}

export function adjustBalance(req: BalanceAdjustRequest): BalanceAdjustResponse {
  const s = state();
  const asOf = nowIso();

  const currency = req.currency;
  if (currency !== "USD" && currency !== "JPY" && currency !== "CNY") {
    return { ok: false, asOf, error: "Only USD/JPY/CNY are supported for deposit/withdraw", snapshot: snapshot() };
  }

  const amount = round2(req.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, asOf, error: "amount must be a non-zero number", snapshot: snapshot() };
  }

  const bal = s.balances[currency];
  if (amount < 0) {
    const withdraw = Math.abs(amount);
    if (bal.available < withdraw) {
      return { ok: false, asOf, error: "Insufficient funds", snapshot: snapshot() };
    }
    bal.available = round2(bal.available - withdraw);
    const snap = snapshot();
    notify(snap);
    return { ok: true, asOf, snapshot: snap };
  }

  // deposit
  bal.available = round2(bal.available + amount);
  const snap = snapshot();
  notify(snap);
  return { ok: true, asOf, snapshot: snap };
}

export function convertCurrency(req: FxConvertRequest): FxConvertResponse {
  const s = state();
  const asOf = nowIso();

  if (
    (req.from !== "USD" && req.from !== "JPY" && req.from !== "CNY") ||
    (req.to !== "USD" && req.to !== "JPY" && req.to !== "CNY")
  ) {
    return { ok: false, asOf, error: "Only USD/JPY/CNY are supported for FX conversion", snapshot: snapshot() };
  }

  const amount = roundByCcy(req.from, req.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, asOf, error: "amount must be > 0", snapshot: snapshot() };
  }

  if (req.from === req.to) {
    return { ok: false, asOf, error: "from and to must be different", snapshot: snapshot() };
  }

  const fromBal = s.balances[req.from];
  if (fromBal.available < amount) {
    return { ok: false, asOf, error: "Insufficient funds", snapshot: snapshot() };
  }

  const rate = fxRate(req.from, req.to);
  const credited = roundByCcy(req.to, amount * rate);

  fromBal.available = roundByCcy(req.from, fromBal.available - amount);
  s.balances[req.to].available = roundByCcy(req.to, s.balances[req.to].available + credited);

  const snap = snapshot();
  notify(snap);
  return { ok: true, asOf, rate, debited: amount, credited, snapshot: snap };
}

export function placeOrder(orderReq: TradeOrderRequest): TradeOrderResponse {
  const s = state();
  const receivedAt = nowIso();

  const currency = orderReq.productType === "crypto" ? ("USD" as CurrencyCode) : orderCurrency(orderReq);

  const orderId = `ord_${crypto.randomUUID()}`;
  const createdAt = receivedAt;

  const symbol = orderReq.symbol.trim();
  const qty = orderReq.productType === "crypto" ? round8(orderReq.quantity) : round2(orderReq.quantity);

  const record: OrderRecord = {
    orderId,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    productType: orderReq.productType,
    symbol,
    side: orderReq.side,
    quantity: qty,
    orderType: orderReq.orderType,
    limitPrice: orderReq.orderType === "limit" ? orderReq.limitPrice : undefined,
    currency,
    timeInForce: orderReq.timeInForce,
    note: orderReq.note,
  };

  const warnings: string[] = [];

  if (record.productType === "crypto") {
    const base = record.symbol.trim().toUpperCase();
    if (base !== "BTC" && base !== "ETH" && base !== "USDT" && base !== "USDC") {
      record.status = "rejected";
      s.orders.set(orderId, record);
      notify(snapshot());
      return {
        orderId,
        status: "rejected",
        receivedAt,
        summary: "订单被拒绝：仅支持 BTC/ETH/USDT/USDC",
        order: { ...orderReq, currency: "USD" },
      };
    }
    record.symbol = base;
    record.currency = "USD";
  }

  if (record.orderType === "market") {
    const px = marketPrice(record.productType, record.symbol, record.currency);
    const value = round2(px * qty);

    if (record.productType === "crypto") {
      const base = record.symbol;
      if (record.side === "buy") {
        const b = s.balances[record.currency];
        if (b.available < value) {
          record.status = "rejected";
          s.orders.set(orderId, record);
          notify(snapshot());
          return {
            orderId,
            status: "rejected",
            receivedAt,
            summary: `订单被拒绝：金额不足（需要 ${value} ${record.currency}）`,
            order: { ...orderReq, currency: record.currency },
            warnings: warnings.length ? warnings : undefined,
          };
        }

        b.available = round2(b.available - value);
        s.balances[base as CurrencyCode].available = round8(s.balances[base as CurrencyCode].available + qty);
      } else {
        const coin = s.balances[base as CurrencyCode];
        if (coin.available < qty) {
          record.status = "rejected";
          s.orders.set(orderId, record);
          notify(snapshot());
          return {
            orderId,
            status: "rejected",
            receivedAt,
            summary: `订单被拒绝：持仓不足（需要 ${qty}，当前 ${coin.available}）`,
            order: { ...orderReq, currency: record.currency },
            warnings: warnings.length ? warnings : undefined,
          };
        }
        coin.available = round8(coin.available - qty);
        s.balances[record.currency].available = round2(s.balances[record.currency].available + value);
      }

      record.status = "filled";
      record.filledAt = nowIso();
      record.fillPrice = px;
      record.fillValue = value;
      record.updatedAt = nowIso();
      s.orders.set(orderId, record);
      notify(snapshot());

      return {
        orderId,
        status: "filled",
        receivedAt,
        summary: `已成交（市价）：${record.side === "buy" ? "买入" : "卖出"} ${qty} ${record.productType} ${record.symbol}，成交价 ${px} ${record.currency}`,
        order: { ...orderReq, currency: record.currency },
        warnings: warnings.length ? warnings : undefined,
        filledAt: record.filledAt,
        fillPrice: record.fillPrice,
        fillValue: record.fillValue,
      };
    }

    if (record.side === "buy") {
      const b = s.balances[record.currency];
      if (b.available < value) {
        record.status = "rejected";
        s.orders.set(orderId, record);
        notify(snapshot());
        return {
          orderId,
          status: "rejected",
          receivedAt,
          summary: `订单被拒绝：金额不足（需要 ${value} ${record.currency}）`,
          order: { ...orderReq, currency: record.currency },
          warnings: warnings.length ? warnings : undefined,
        };
      }

      b.available = round2(b.available - value);

      const key = assetKey(record.productType, record.symbol, record.currency);
      const existing = s.assets.get(key);
      if (existing) {
        const newQty = round2(existing.quantity + qty);
        const totalCost = round2(existing.avgCost * existing.quantity + value);
        existing.quantity = newQty;
        existing.avgCost = newQty > 0 ? round2(totalCost / newQty) : 0;
        existing.updatedAt = nowIso();
        s.assets.set(key, existing);
      } else {
        s.assets.set(key, {
          id: `pos_${crypto.randomUUID()}`,
          productType: record.productType,
          symbol: record.symbol,
          currency: record.currency,
          quantity: qty,
          avgCost: px,
          updatedAt: nowIso(),
        });
      }
    } else {
      const key = assetKey(record.productType, record.symbol, record.currency);
      const pos = s.assets.get(key);
      if (!pos || pos.quantity < qty) {
        record.status = "rejected";
        s.orders.set(orderId, record);
        notify(snapshot());
        return {
          orderId,
          status: "rejected",
          receivedAt,
          summary: `订单被拒绝：持仓不足（需要 ${qty}，当前 ${pos?.quantity ?? 0}）`,
          order: { ...orderReq, currency: record.currency },
          warnings: warnings.length ? warnings : undefined,
        };
      }
      pos.quantity = round2(pos.quantity - qty);
      pos.updatedAt = nowIso();
      if (pos.quantity <= 0) s.assets.delete(key);
      else s.assets.set(key, pos);

      s.balances[record.currency].available = round2(s.balances[record.currency].available + value);
    }

    record.status = "filled";
    record.filledAt = nowIso();
    record.fillPrice = px;
    record.fillValue = value;
    record.updatedAt = nowIso();
    s.orders.set(orderId, record);
    notify(snapshot());

    return {
      orderId,
      status: "filled",
      receivedAt,
      summary: `已成交（市价）：${record.side === "buy" ? "买入" : "卖出"} ${qty} ${record.productType} ${record.symbol}，成交价 ${px} ${record.currency}`,
      order: { ...orderReq, currency: record.currency },
      warnings: warnings.length ? warnings : undefined,
      filledAt: record.filledAt,
      fillPrice: record.fillPrice,
      fillValue: record.fillValue,
    };
  }

  // limit (non-market): pending, reserve funds/qty, fill randomly 1-5 minutes.
  const limitPx = orderReq.limitPrice ?? 0;
  if (!Number.isFinite(limitPx) || limitPx <= 0) {
    record.status = "rejected";
    s.orders.set(orderId, record);
    notify(snapshot());
    return {
      orderId,
      status: "rejected",
      receivedAt,
      summary: "订单被拒绝：限价单需要 limitPrice > 0",
      order: { ...orderReq, currency: record.currency },
      warnings: warnings.length ? warnings : undefined,
    };
  }

  const reserveValue = round2(limitPx * qty);

  if (record.side === "buy") {
    const b = s.balances[record.currency];
    if (b.available < reserveValue) {
      record.status = "rejected";
      s.orders.set(orderId, record);
      notify(snapshot());
      return {
        orderId,
        status: "rejected",
        receivedAt,
        summary: `订单被拒绝：金额不足（需要 ${reserveValue} ${record.currency}）`,
        order: { ...orderReq, currency: record.currency },
        warnings: warnings.length ? warnings : undefined,
      };
    }

    b.available = round2(b.available - reserveValue);
    b.reserved = round2(b.reserved + reserveValue);
    record.reservedValue = reserveValue;
  } else {
    if (record.productType === "crypto") {
      const base = record.symbol;
      const coin = s.balances[base as CurrencyCode];
      if (coin.available < qty) {
        record.status = "rejected";
        s.orders.set(orderId, record);
        notify(snapshot());
        return {
          orderId,
          status: "rejected",
          receivedAt,
          summary: `订单被拒绝：持仓不足（需要 ${qty}，当前 ${coin.available}）`,
          order: { ...orderReq, currency: record.currency },
          warnings: warnings.length ? warnings : undefined,
        };
      }
      coin.available = round8(coin.available - qty);
      coin.reserved = round8(coin.reserved + qty);
      record.reservedValue = qty;
    } else {
      const key = assetKey(record.productType, record.symbol, record.currency);
      const pos = s.assets.get(key);
      if (!pos || pos.quantity < qty) {
        record.status = "rejected";
        s.orders.set(orderId, record);
        notify(snapshot());
        return {
          orderId,
          status: "rejected",
          receivedAt,
          summary: `订单被拒绝：持仓不足（需要 ${qty}，当前 ${pos?.quantity ?? 0}）`,
          order: { ...orderReq, currency: record.currency },
          warnings: warnings.length ? warnings : undefined,
        };
      }

      // Reserve by removing from position until fill/cancel.
      pos.quantity = round2(pos.quantity - qty);
      pos.updatedAt = nowIso();
      if (pos.quantity <= 0) s.assets.delete(key);
      else s.assets.set(key, pos);

      record.reservedValue = qty;
    }
  }

  record.status = "pending";
  record.updatedAt = nowIso();
  s.orders.set(orderId, record);

  scheduleFillIfNeeded(orderId);
  notify(snapshot());

  return {
    orderId,
    status: "pending",
    receivedAt,
    summary: `已提交（限价，待成交）：${record.side === "buy" ? "买入" : "卖出"} ${qty} ${record.productType} ${record.symbol}，限价 ${limitPx} ${record.currency}`,
    order: { ...orderReq, currency: record.currency },
    warnings: warnings.length ? warnings : undefined,
  };
}

export function cancelOrder(orderId: string): CancelOrderResponse {
  const s = state();
  const asOf = nowIso();
  const order = s.orders.get(orderId);
  if (!order) return { ok: false, asOf, error: "Order not found", snapshot: snapshot() };

  if (order.status !== "pending") {
    return { ok: false, asOf, error: "Only pending orders can be canceled", order: { ...order }, snapshot: snapshot() };
  }

  // Stop timer first.
  const t = s.fillTimers.get(orderId);
  if (t) {
    clearTimeout(t);
    s.fillTimers.delete(orderId);
  }

  releaseReservation(order);
  const updated = setOrderStatus(orderId, "canceled");

  const snap = snapshot();
  notify(snap);
  return { ok: true, asOf, order: { ...updated }, snapshot: snap };
}

export function modifyOrder(orderId: string, patch: ModifyOrderRequest): ModifyOrderResponse {
  const s = state();
  const asOf = nowIso();
  const order = s.orders.get(orderId);
  if (!order) return { ok: false, asOf, error: "Order not found", snapshot: snapshot() };

  try {
    requirePending(order);

    const nextQty =
      patch.quantity !== undefined
        ? order.productType === "crypto"
          ? round8(patch.quantity)
          : round2(patch.quantity)
        : order.quantity;
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      return { ok: false, asOf, error: "quantity must be > 0", order: { ...order }, snapshot: snapshot() };
    }

    const nextLimit = patch.limitPrice !== undefined ? patch.limitPrice : order.limitPrice;
    if (order.orderType === "limit") {
      if (!Number.isFinite(nextLimit) || (nextLimit ?? 0) <= 0) {
        return { ok: false, asOf, error: "limitPrice must be > 0 for limit orders", order: { ...order }, snapshot: snapshot() };
      }
    }

    // Adjust reservations
    if (order.orderType === "limit") {
      if (order.side === "buy") {
        const b = s.balances[order.currency];
        const prevReserved = round2(order.reservedValue ?? 0);
        const required = round2((nextLimit ?? 0) * nextQty);
        const delta = round2(required - prevReserved);
        if (delta > 0) {
          if (b.available < delta) {
            return { ok: false, asOf, error: "Insufficient funds", order: { ...order }, snapshot: snapshot() };
          }
          b.available = round2(b.available - delta);
          b.reserved = round2(b.reserved + delta);
        } else if (delta < 0) {
          b.reserved = round2(b.reserved + delta);
          b.available = round2(b.available - delta);
        }
        order.reservedValue = required;
      } else {
        // sell: reservation is quantity
        const prevReservedQty = order.productType === "crypto" ? round8(order.reservedValue ?? 0) : round2(order.reservedValue ?? 0);
        const deltaQty = order.productType === "crypto" ? round8(nextQty - prevReservedQty) : round2(nextQty - prevReservedQty);

        if (order.productType === "crypto") {
          const base = order.symbol.trim().toUpperCase();
          if (base !== "BTC" && base !== "ETH" && base !== "USDT" && base !== "USDC") {
            return { ok: false, asOf, error: "Unsupported crypto symbol", order: { ...order }, snapshot: snapshot() };
          }
          const coin = s.balances[base as CurrencyCode];
          if (deltaQty > 0) {
            if (coin.available < deltaQty) {
              return { ok: false, asOf, error: "Insufficient position", order: { ...order }, snapshot: snapshot() };
            }
            coin.available = round8(coin.available - deltaQty);
            coin.reserved = round8(coin.reserved + deltaQty);
          } else if (deltaQty < 0) {
            const release = round8(-deltaQty);
            coin.reserved = round8(coin.reserved - release);
            coin.available = round8(coin.available + release);
          }
          order.reservedValue = round8(nextQty);
        } else {
          const key = assetKey(order.productType, order.symbol, order.currency);
          const pos = s.assets.get(key);

          if (deltaQty > 0) {
            if (!pos || pos.quantity < deltaQty) {
              return { ok: false, asOf, error: "Insufficient position", order: { ...order }, snapshot: snapshot() };
            }
            pos.quantity = round2(pos.quantity - deltaQty);
            pos.updatedAt = nowIso();
            if (pos.quantity <= 0) s.assets.delete(key);
            else s.assets.set(key, pos);
          } else if (deltaQty < 0) {
            // release back
            const release = round2(-deltaQty);
            if (pos) {
              pos.quantity = round2(pos.quantity + release);
              pos.updatedAt = nowIso();
              s.assets.set(key, pos);
            } else {
              s.assets.set(key, {
                id: `pos_${crypto.randomUUID()}`,
                productType: order.productType,
                symbol: order.symbol,
                currency: order.currency,
                quantity: release,
                avgCost: 0,
                updatedAt: nowIso(),
              });
            }
          }

          order.reservedValue = nextQty;
        }
      }
    }

    order.quantity = nextQty;
    if (order.orderType === "limit") order.limitPrice = nextLimit;
    if (patch.timeInForce !== undefined) order.timeInForce = patch.timeInForce;
    if (patch.note !== undefined) order.note = patch.note;

    order.updatedAt = nowIso();
    s.orders.set(orderId, order);

    const snap = snapshot();
    notify(snap);
    return { ok: true, asOf, order: { ...order }, snapshot: snap };
  } catch (e) {
    return {
      ok: false,
      asOf,
      error: e instanceof Error ? e.message : String(e),
      order: order ? { ...order } : undefined,
      snapshot: snapshot(),
    };
  }
}
