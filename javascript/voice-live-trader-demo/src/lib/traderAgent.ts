import type { VoiceLiveTool } from "@/lib/voiceLive/types";

export type TraderLanguage = "zh" | "en";

export const traderInstructionsEn = `You are a trading assistant.

Language policy:
- Reply in the SAME language as the user's latest message.
- If the user mixes languages, mirror the dominant language.

Core behavior:
- Keep responses concise and action-oriented.
- Prefer calling update_order_form to keep the UI draft in sync (partial updates are OK).
- Place orders ONLY after details are complete and the user explicitly confirms.
- Ask 1–2 clarification questions when key fields are missing or inconsistent.
- Never read order ids aloud.

Budget orders:
- If the user orders by amount/budget, call get_account_snapshot then get_market_price, convert budget to quantity, write it to the draft, and ask for confirmation.
`;

// Kept for backward compatibility; the app now uses the simplified English prompt.
export const traderInstructionsZh = traderInstructionsEn;

export function getTraderInstructions(lang: TraderLanguage): string {
  void lang;
  // Always use the simplified English prompt to reduce tokens;
  // the assistant will still reply in the user's language per the policy above.
  return traderInstructionsEn;
}

function baseOrderParamsByLang(lang: TraderLanguage) {
  const zh = {
    symbol: "标的代码或名称",
    side: "买卖方向：buy 或 sell",
    quantity: "数量（必须 > 0）",
    orderType: "订单类型：market(市价)/limit(限价)",
    limitPrice: "限价（仅当 orderType=limit 时需要，必须 > 0）",
    currency: "币种（可选，默认 USD）",
    timeInForce: "有效期（可选）：day 或 gtc",
    note: "备注（可选）",
  };
  const en = {
    symbol: "Symbol or name",
    side: "Side: buy or sell",
    quantity: "Quantity (must be > 0)",
    orderType: "Order type: market or limit",
    limitPrice: "Limit price (required when orderType=limit; must be > 0)",
    currency: "Currency (optional; default USD)",
    timeInForce: "Time in force (optional): day or gtc",
    note: "Note (optional)",
  };

  const d = lang === "en" ? en : zh;
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      symbol: { type: "string", description: d.symbol },
      side: { type: "string", enum: ["buy", "sell"], description: d.side },
      quantity: { type: "integer", description: d.quantity, minimum: 1 },
      orderType: { type: "string", enum: ["market", "limit"], description: d.orderType },
      limitPrice: { type: "number", description: d.limitPrice, minimum: 0 },
      currency: { type: "string", enum: ["USD", "JPY", "CNY"], description: d.currency },
      timeInForce: { type: "string", enum: ["day", "gtc"], description: d.timeInForce },
      note: { type: "string", description: d.note },
    },
    required: ["symbol", "side", "quantity", "orderType"],
  } as const;
}

const baseOrderParams = baseOrderParamsByLang("zh");

export function buildTradingTools(lang: TraderLanguage): VoiceLiveTool[] {
  const baseOrderParams = baseOrderParamsByLang(lang);
  const isEn = lang === "en";

  const getMarketPriceTool: VoiceLiveTool = {
    type: "function",
    name: "get_market_price",
    description: isEn
      ? "Get an estimated market price (for converting a budget into quantity, or validating price reasonableness)."
      : "获取当前估算市价（用于把‘按金额下单’换算为数量，或用于校验价格合理性）。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        productType: { type: "string", enum: ["stock", "bond", "fund", "option", "crypto"] },
        symbol: { type: "string", description: isEn ? "Symbol (e.g., MSFT / BTC)" : "标的代码（例如 MSFT / BTC）" },
        currency: {
          type: "string",
          enum: ["USD", "JPY", "CNY"],
          description: isEn ? "Quote currency (optional; default USD)" : "计价币种（可选，默认 USD）",
        },
      },
      required: ["productType", "symbol"],
    },
  };

  const placeStockOrderTool: VoiceLiveTool = {
    type: "function",
    name: "place_stock_order",
    description: isEn
      ? "Submit a stock order. Use only when details are complete and the user explicitly confirms."
      : "提交股票订单。仅在信息齐全且用户明确确认下单时使用。",
    parameters: baseOrderParams,
  };

  const placeFundOrderTool: VoiceLiveTool = {
    type: "function",
    name: "place_fund_order",
    description: isEn
      ? "Submit a fund order. Use only when details are complete and the user explicitly confirms."
      : "提交基金订单。仅在信息齐全且用户明确确认下单时使用。",
    parameters: baseOrderParams,
  };

  const placeBondOrderTool: VoiceLiveTool = {
    type: "function",
    name: "place_bond_order",
    description: isEn
      ? "Submit a bond order. Use only when details are complete and the user explicitly confirms."
      : "提交债券订单。仅在信息齐全且用户明确确认下单时使用。",
    parameters: baseOrderParams,
  };

  const placeCryptoOrderTool: VoiceLiveTool = {
    type: "function",
    name: "place_crypto_order",
    description: isEn
      ? "Submit a crypto order. Use only when details are complete and the user explicitly confirms."
      : "提交数字货币订单。仅在信息齐全且用户明确确认下单时使用。",
    parameters: {
      ...baseOrderParams,
      properties: {
        ...(baseOrderParams as any).properties,
        quantity: {
          type: "number",
          minimum: 0,
          description: isEn ? "Quantity (can be fractional; must be > 0)" : "数量（可为小数；必须 > 0）",
        },
        currency: {
          type: "string",
          enum: ["USD"],
          description: isEn ? "Crypto is quoted in USD only (default USD)" : "数字货币仅支持使用 USD 买卖（默认 USD）",
        },
      },
    } as const,
  };

  const placeOptionOrderTool: VoiceLiveTool = {
    type: "function",
    name: "place_option_order",
    description: isEn
      ? "Submit an option order. Use only when details are complete and the user explicitly confirms."
      : "提交期权订单。仅在信息齐全且用户明确确认下单时使用。",
    parameters: {
      ...baseOrderParams,
      properties: {
        ...(baseOrderParams as any).properties,
        optionType: { type: "string", enum: ["call", "put"], description: isEn ? "Option type (optional)" : "期权类型（可选）" },
        strike: { type: "number", description: isEn ? "Strike price (optional)" : "行权价（可选）" },
        expiry: { type: "string", description: isEn ? "Expiry (optional, e.g. 2026-03-27)" : "到期日（可选，例如 2026-03-27）" },
      },
    } as const,
  };

  const updateOrderFormTool: VoiceLiveTool = {
    type: "function",
    name: "update_order_form",
    description: isEn
      ? "Update the UI order draft (no submission). Use this to fill recognized fields into the form during conversation. Partial fields are allowed."
      : "更新 UI 上的交易表单草稿（不下单）。用于在对话过程中把已识别的字段逐步填写到表单里。字段允许部分提供。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ticketId: {
          type: "string",
          description: isEn
            ? "Optional: draft ticket id to update (usually from the previous update_order_form result)."
            : "可选：要更新的草稿单 id。通常由上一次 update_order_form 的返回值获得。",
        },
        newTicket: {
          type: "boolean",
          description: isEn
            ? "Optional: create a new draft ticket and update it (for multiple orders). Default false."
            : "可选：是否新建一个草稿单并更新它（用于一次填写多笔订单）。默认 false。",
        },
        productType: { type: "string", enum: ["stock", "bond", "fund", "option", "crypto"] },
        symbol: { type: "string" },
        side: { type: "string", enum: ["buy", "sell"] },
        quantity: { type: "number" },
        orderType: { type: "string", enum: ["market", "limit"] },
        limitPrice: { type: "number" },
        currency: { type: "string", enum: ["USD", "JPY", "CNY"] },
        timeInForce: { type: "string", enum: ["day", "gtc"] },
        note: { type: "string" },
        clear: {
          type: "boolean",
          description: isEn ? "Clear the form before filling (default false)." : "是否清空表单后再填写（默认 false）。",
        },
        optionType: { type: "string", enum: ["call", "put"], description: isEn ? "Option type (optional)" : "期权类型（可选）" },
        strike: { type: "number", description: isEn ? "Strike price (optional)" : "行权价（可选）" },
        expiry: { type: "string", description: isEn ? "Expiry (optional, e.g. 2026-03-27)" : "到期日（可选，例如 2026-03-27）" },
        maturity: { type: "string", description: isEn ? "Bond maturity (optional, e.g. 2030-06-30)" : "债券到期日（可选，例如 2030-06-30）" },
      },
      required: [],
    },
  };

  const getAccountSnapshotTool: VoiceLiveTool = {
    type: "function",
    name: "get_account_snapshot",
    description: isEn
      ? "Get current account snapshot: cash balances (USD/JPY/CNY only), asset positions (including crypto), and orders list."
      : "获取当前客户账户信息：现金余额（仅 USD/JPY/CNY）、资产持仓（含数字货币持仓）、订单列表。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  };

  const convertCurrencyTool: VoiceLiveTool = {
    type: "function",
    name: "convert_currency",
    description: isEn
      ? "Convert between USD/JPY/CNY. Use only when the user explicitly requests currency conversion."
      : "在 USD/JPY/CNY 之间换汇。仅在用户明确要求时使用。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", enum: ["USD", "JPY", "CNY"] },
        to: { type: "string", enum: ["USD", "JPY", "CNY"] },
        amount: { type: "number", description: isEn ? "Amount to sell (must be > 0)" : "换出金额，必须 > 0" },
      },
      required: ["from", "to", "amount"],
    },
  };

  const cancelOrderTool: VoiceLiveTool = {
    type: "function",
    name: "cancel_order",
    description: isEn
      ? "Cancel a pending order. Use only when the user explicitly asks to cancel."
      : "取消待成交（pending）的订单。仅在用户明确要求取消时使用。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "string", description: isEn ? "Order id" : "订单号" },
      },
      required: ["orderId"],
    },
  };

  const modifyOrderTool: VoiceLiveTool = {
    type: "function",
    name: "modify_order",
    description: isEn
      ? "Modify a pending order. Use only when the user explicitly asks to modify."
      : "修改待成交（pending）的订单（改单）。仅在用户明确要求改单时使用。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "string", description: isEn ? "Order id" : "订单号" },
        quantity: { type: "number", description: isEn ? "New quantity (optional)" : "新数量（可选）" },
        limitPrice: { type: "number", description: isEn ? "New limit price (optional; for limit orders only)" : "新限价（可选，限价单才适用）" },
        timeInForce: { type: "string", enum: ["day", "gtc"], description: isEn ? "New time in force (optional)" : "新有效期（可选）" },
        note: { type: "string", description: isEn ? "New note (optional)" : "新备注（可选）" },
      },
      required: ["orderId"],
    },
  };

  return [
    updateOrderFormTool,
    placeStockOrderTool,
    placeFundOrderTool,
    placeBondOrderTool,
    placeOptionOrderTool,
    placeCryptoOrderTool,
    getAccountSnapshotTool,
    getMarketPriceTool,
    convertCurrencyTool,
    cancelOrderTool,
    modifyOrderTool,
  ];
}

export const getMarketPriceTool: VoiceLiveTool = {
  type: "function",
  name: "get_market_price",
  description: "获取当前估算市价（用于把‘按金额下单’换算为数量，或用于校验价格合理性）。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      productType: { type: "string", enum: ["stock", "bond", "fund", "option", "crypto"] },
      symbol: { type: "string", description: "标的代码（例如 MSFT / BTC）" },
      currency: { type: "string", enum: ["USD", "JPY", "CNY"], description: "计价币种（可选，默认 USD）" },
    },
    required: ["productType", "symbol"],
  },
};

export const placeStockOrderTool: VoiceLiveTool = {
  type: "function",
  name: "place_stock_order",
  description: "提交股票订单。仅在信息齐全且用户明确确认下单时使用。",
  parameters: baseOrderParams,
};

export const placeFundOrderTool: VoiceLiveTool = {
  type: "function",
  name: "place_fund_order",
  description: "提交基金订单。仅在信息齐全且用户明确确认下单时使用。",
  parameters: baseOrderParams,
};

export const placeBondOrderTool: VoiceLiveTool = {
  type: "function",
  name: "place_bond_order",
  description: "提交债券订单。仅在信息齐全且用户明确确认下单时使用。",
  parameters: baseOrderParams,
};

export const placeCryptoOrderTool: VoiceLiveTool = {
  type: "function",
  name: "place_crypto_order",
  description: "提交数字货币订单。仅在信息齐全且用户明确确认下单时使用。",
  parameters: {
    ...baseOrderParams,
    properties: {
      ...baseOrderParams.properties,
      currency: {
        type: "string",
        enum: ["USD"],
        description: "数字货币仅支持使用 USD 买卖（默认 USD）",
      },
    },
  },
};

export const placeOptionOrderTool: VoiceLiveTool = {
  type: "function",
  name: "place_option_order",
  description: "提交期权订单。仅在信息齐全且用户明确确认下单时使用。",
  parameters: {
    ...baseOrderParams,
    properties: {
      ...baseOrderParams.properties,
      optionType: { type: "string", enum: ["call", "put"], description: "期权类型（可选）" },
      strike: { type: "number", description: "行权价（可选）" },
      expiry: { type: "string", description: "到期日（可选，例如 2026-03-27）" },
    },
  },
};

export const updateOrderFormTool: VoiceLiveTool = {
  type: "function",
  name: "update_order_form",
  description:
    "更新 UI 上的交易表单草稿（不下单）。用于在对话过程中把已识别的字段逐步填写到表单里。字段允许部分提供。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      ticketId: {
        type: "string",
        description: "可选：要更新的草稿单 id。通常由上一次 update_order_form 的返回值获得。",
      },
      newTicket: {
        type: "boolean",
        description: "可选：是否新建一个草稿单并更新它（用于一次填写多笔订单）。默认 false。",
      },
      productType: { type: "string", enum: ["stock", "bond", "fund", "option", "crypto"] },
      symbol: { type: "string" },
      side: { type: "string", enum: ["buy", "sell"] },
      quantity: { type: "number" },
      orderType: { type: "string", enum: ["market", "limit"] },
      limitPrice: { type: "number" },
      currency: { type: "string", enum: ["USD", "JPY", "CNY"] },
      timeInForce: { type: "string", enum: ["day", "gtc"] },
      note: { type: "string" },
      clear: {
        type: "boolean",
        description: "是否清空表单后再填写（默认 false）。",
      },
      optionType: { type: "string", enum: ["call", "put"], description: "期权类型（可选）" },
      strike: { type: "number", description: "行权价（可选）" },
      expiry: { type: "string", description: "到期日（可选，例如 2026-03-27）" },
      maturity: { type: "string", description: "债券到期日（可选，例如 2030-06-30）" },
    },
    required: [],
  },
};

export const getAccountSnapshotTool: VoiceLiveTool = {
  type: "function",
  name: "get_account_snapshot",
  description: "获取当前客户账户信息：现金余额（仅 USD/JPY/CNY）、资产持仓（含数字货币持仓）、订单列表。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
};

export const convertCurrencyTool: VoiceLiveTool = {
  type: "function",
  name: "convert_currency",
  description: "在 USD/JPY/CNY 之间换汇。仅在用户明确要求时使用。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      from: { type: "string", enum: ["USD", "JPY", "CNY"] },
      to: { type: "string", enum: ["USD", "JPY", "CNY"] },
      amount: { type: "number", description: "换出金额，必须 > 0" },
    },
    required: ["from", "to", "amount"],
  },
};

export const cancelOrderTool: VoiceLiveTool = {
  type: "function",
  name: "cancel_order",
  description: "取消待成交（pending）的订单。仅在用户明确要求取消时使用。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      orderId: { type: "string", description: "订单号" },
    },
    required: ["orderId"],
  },
};

export const modifyOrderTool: VoiceLiveTool = {
  type: "function",
  name: "modify_order",
  description: "修改待成交（pending）的订单（改单）。仅在用户明确要求改单时使用。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      orderId: { type: "string", description: "订单号" },
      quantity: { type: "number", description: "新数量（可选）" },
      limitPrice: { type: "number", description: "新限价（可选，限价单才适用）" },
      timeInForce: { type: "string", enum: ["day", "gtc"], description: "新有效期（可选）" },
      note: { type: "string", description: "新备注（可选）" },
    },
    required: ["orderId"],
  },
};
