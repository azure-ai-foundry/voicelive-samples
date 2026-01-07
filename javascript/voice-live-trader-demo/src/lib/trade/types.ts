export type CurrencyCode = "USD" | "JPY" | "CNY" | "BTC" | "ETH" | "USDT" | "USDC";

export type TradeProductType = "stock" | "bond" | "fund" | "option" | "crypto";
export type TradeSide = "buy" | "sell";
export type TradeOrderType = "market" | "limit";
export type TradeTimeInForce = "day" | "gtc";

export type TradeOrderStatus = "rejected" | "pending" | "filled" | "canceled";

export type TradeOrderRequest = {
  productType: TradeProductType;
  symbol: string;
  side: TradeSide;
  quantity: number;
  orderType: TradeOrderType;
  limitPrice?: number;
  currency?: CurrencyCode;
  timeInForce?: TradeTimeInForce;
  note?: string;

  // Option-specific (optional)
  optionType?: "call" | "put";
  strike?: number;
  expiry?: string;

  // Bond-specific (optional)
  maturity?: string;
};

export type TradeOrderResponse = {
  orderId: string;
  status: TradeOrderStatus;
  receivedAt: string;
  summary: string;
  order: TradeOrderRequest;
  warnings?: string[];
  filledAt?: string;
  fillPrice?: number;
  fillValue?: number;
};

export type AccountBalance = {
  currency: CurrencyCode;
  available: number;
  reserved: number;
  total: number;
};

export type AssetPosition = {
  id: string;
  productType: TradeProductType;
  symbol: string;
  currency: CurrencyCode;
  quantity: number;
  avgCost: number;
  updatedAt: string;
};

export type OrderRecord = {
  orderId: string;
  status: TradeOrderStatus;
  createdAt: string;
  updatedAt: string;

  productType: TradeProductType;
  symbol: string;
  side: TradeSide;
  quantity: number;
  orderType: TradeOrderType;
  limitPrice?: number;
  currency: CurrencyCode;
  timeInForce?: TradeTimeInForce;
  note?: string;

  reservedValue?: number;

  filledAt?: string;
  fillPrice?: number;
  fillValue?: number;
};

export type AccountSnapshot = {
  asOf: string;
  balances: AccountBalance[];
  assets: AssetPosition[];
  orders: OrderRecord[];
};

export type FxConvertRequest = {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
};

export type FxConvertResponse = {
  ok: boolean;
  asOf: string;
  rate?: number;
  debited?: number;
  credited?: number;
  error?: string;
  snapshot: AccountSnapshot;
};

export type CancelOrderResponse = {
  ok: boolean;
  asOf: string;
  error?: string;
  order?: OrderRecord;
  snapshot: AccountSnapshot;
};

export type ModifyOrderRequest = {
  quantity?: number;
  limitPrice?: number;
  timeInForce?: TradeTimeInForce;
  note?: string;
};

export type ModifyOrderResponse = {
  ok: boolean;
  asOf: string;
  error?: string;
  order?: OrderRecord;
  snapshot: AccountSnapshot;
};

export type BalanceAdjustRequest = {
  currency: CurrencyCode;
  amount: number;
};

export type BalanceAdjustResponse = {
  ok: boolean;
  asOf: string;
  error?: string;
  snapshot: AccountSnapshot;
};
