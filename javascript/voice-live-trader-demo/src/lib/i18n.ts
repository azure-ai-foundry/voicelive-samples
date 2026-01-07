import { useState, useEffect, createContext, useContext, createElement, type ReactNode } from "react";

export type Language = "zh" | "en";

type LanguageContextValue = {
  lang: Language;
  setLang: (next: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectNavigatorLanguage(): Language {
  if (typeof navigator !== "undefined") {
    const l = navigator.language.toLowerCase();
    if (l.startsWith("zh")) return "zh";
  }
  return "en";
}

const translations = {
  zh: {
    // AccountPanel
    accountBalance: "账户余额",
    reserved: "预留：",
    exchange: "换汇",
    depositWithdraw: "出入金",
    amount: "金额",
    confirm: "确认",
    processing: "处理中…",
    deposit: "入金",
    withdraw: "出金",
    amountPositive: "金额必须 > 0",
    sameCurrency: "from/to 不能相同",
    exchangeFailed: "换汇失败",
    noCashConfig: "未配置出入金接口",
    opFailed: "操作失败",

    // AssetsPanel
    assets: "资产",
    items: "项",
    noAssets: "暂无持仓",
    quantity: "数量",
    avgCost: "均价",

    // ConnectionPanel
    connectionConfig: "连接配置",
    endpointPlaceholder: "<resource>.services.ai.azure.com (host only)",
    connect: "连接",
    disconnect: "断开",
    startMic: "开启麦克风",
    stopMic: "停止麦克风",
    advancedSettings: "高级设置",
    enableBargeIn: "启用打断 (Barge-in)",
    enableAudioLogging: "启用音频日志",
    voiceType: "Voice Type",
    voiceName: "Voice Name",
    azureCustomVoiceEndpointId: "Azure 自定义语音 Endpoint ID",
    languageHint: "Language Hint（可选）",
    
    // ChatPanel
    chatHistory: "对话历史",
    user: "用户",
    assistant: "助理",
    system: "系统",
    
    // OrdersPanel
    activeOrders: "当前委托",
    noActiveOrders: "暂无委托",
    cancel: "撤单",
    
    // TradeHistoryPanel
    tradeHistory: "成交记录",
    noTrades: "暂无成交",
    
    // UsagePanel
    usageStats: "用量统计",
    turns: "对话轮数",
    tokens: "Tokens",
    latency: "延迟 (ms)",
    wire: "网络传输",
    totalTokens: "总Tokens",
    inputTokens: "输入",
    outputTokens: "输出",
    text: "文本",
    audio: "音频",
    cached: "缓存",
    
    // TicketCard
    ticket: {
      side: "方向",
      symbol: "标的（代码/名称）",
      optionType: "期权类型",
      strike: "行权价",
      expiry: "到期日（可选）",
      maturity: "到期日（可选）",
      quantity: "数量",
      orderType: "订单类型",
      market: "市价",
      limit: "限价",
      limitPrice: "限价（限价单必填）",
      currency: "币种",
      timeInForce: "有效期（可选）",
      day: "当日有效",
      placeholders: {
        symbol: "例如 600519 / AAPL / BTC",
        strike: "例如 200",
        expiry: "例如 2026-03-27",
        maturity: "例如 2030-06-30",
        limitPrice: "例如 123.45",
      },
    },
    productType: {
      stock: "股票",
      bond: "债券",
      fund: "基金",
      option: "期权",
      crypto: "数字货币",
    },
    status: {
      filled: "已成交",
      pending: "待成交",
      canceled: "已取消",
      rejected: "已拒绝",
    },
    buy: "买入",
    sell: "卖出",
    market: "市价",
    limit: "限价",
    day: "当日有效",
    gtc: "一直有效",
    submit: "提交",
    delete: "删除",
    filling: "填写中",
    details: "详情",
    collapse: "收起",
    orderId: "订单号",
    submittedAt: "提交时间",
    filledAt: "成交时间",
    fillPrice: "成交价",
    fillValue: "成交额",
    orderSubmitted: "已提交订单",
    modify: "改单",
    submitModify: "提交改单",
    cancelEdit: "取消编辑",
    marketNoEditPrice: "市价单不可改价",
    order: "订单",
    submitting: "提交中…",
    orderSent: "订单已发送",
    orderFailed: "下单失败",

    // Trade Window
    tradeWindowTitle: "交易窗口",
    createOrder: "新建订单",

    // Logs
    logs: {
      connecting: "连接中：",
      connected: "✅ 已连接",
      disconnected: "⛔ 已断开",
      errorPrefix: "❌ 错误：",
      tradeFailedPrefix: "❌ 下单失败：",
      toolInvokePrefix: "🔧 工具调用：",
      argsPrefix: "↳ 参数：",
      outputPrefix: "↳ 输出：",
      modelRequestedToolPrefix: "🧩 模型请求工具：",
      toolArgsReadyPrefix: "🧩 工具参数就绪：",
      speechStarted: "🎤 speech_started（barge-in）",
      speechStopped: "🎤 speech_stopped",
      audioBytes: "🎧 audio bytes",
    },

    // Tools
    tools: {
      names: {
        update_order_form: "更新订单表单",
        place_stock_order: "提交股票订单",
        place_fund_order: "提交基金订单",
        place_bond_order: "提交债券订单",
        place_option_order: "提交期权订单",
        place_crypto_order: "提交数字货币订单",
        get_account_snapshot: "获取账户快照",
        get_market_price: "获取市价估算",
        convert_currency: "换汇",
        cancel_order: "撤单",
        modify_order: "改单",
      },
      errors: {
        invalidJsonArguments: "参数不是有效的 JSON",
        invalidArgumentsShape: "参数格式不正确（应为对象）",
        unknownToolPrefix: "未知工具：",
        productTypeInvalid: "productType 必须是 stock|fund|bond|option|crypto",
        symbolRequired: "symbol 为必填",
        currencyInvalid: "currency 必须是 USD|JPY|CNY",
        fromToInvalid: "from/to 必须是 USD|JPY|CNY",
        amountInvalid: "amount 必须是 > 0 的数字",
        orderIdRequired: "orderId 为必填",
      },
    },
    
    // Common
    error: "错误",
  },
  en: {
    // AccountPanel
    accountBalance: "Account Balance",
    reserved: "Reserved: ",
    exchange: "Exchange",
    depositWithdraw: "Deposit/Withdraw",
    amount: "Amount",
    confirm: "Confirm",
    processing: "Processing...",
    deposit: "Deposit",
    withdraw: "Withdraw",
    amountPositive: "Amount must be > 0",
    sameCurrency: "From/To cannot be same",
    exchangeFailed: "Exchange failed",
    noCashConfig: "Deposit/Withdraw not configured",
    opFailed: "Operation failed",

    // AssetsPanel
    assets: "Assets",
    items: " items",
    noAssets: "No positions",
    quantity: "Qty",
    avgCost: "Avg",

    // ConnectionPanel
    connectionConfig: "Connection Config",
    endpointPlaceholder: "<resource>.services.ai.azure.com (host only)",
    connect: "Connect",
    disconnect: "Disconnect",
    startMic: "Start Mic",
    stopMic: "Stop Mic",
    advancedSettings: "Advanced Settings",
    enableBargeIn: "Enable Barge-in",
    enableAudioLogging: "Enable Audio Logging",
    voiceType: "Voice Type",
    voiceName: "Voice Name",
    azureCustomVoiceEndpointId: "Azure Custom Voice Endpoint ID",
    languageHint: "Language Hint (Optional)",
    
    // ChatPanel
    chatHistory: "Chat History",
    user: "User",
    assistant: "Assistant",
    system: "System",
    
    // OrdersPanel
    activeOrders: "Active Orders",
    noActiveOrders: "No active orders",
    cancel: "Cancel",
    
    // TradeHistoryPanel
    tradeHistory: "Trade History",
    noTrades: "No trades",
    
    // UsagePanel
    usageStats: "Usage Stats",
    turns: "Turns",
    tokens: "Tokens",
    latency: "Latency (ms)",
    wire: "Network",
    totalTokens: "Total Tokens",
    inputTokens: "Input",
    outputTokens: "Output",
    text: "Text",
    audio: "Audio",
    cached: "Cached",
    
    // TicketCard
    ticket: {
      side: "Side",
      symbol: "Symbol (Code/Name)",
      optionType: "Option Type",
      strike: "Strike",
      expiry: "Expiry (Optional)",
      maturity: "Maturity (Optional)",
      quantity: "Quantity",
      orderType: "Order Type",
      market: "Market",
      limit: "Limit",
      limitPrice: "Limit Price (Required for limit)",
      currency: "Currency",
      timeInForce: "Time In Force (Optional)",
      day: "Day",
      placeholders: {
        symbol: "e.g. 600519 / AAPL / BTC",
        strike: "e.g. 200",
        expiry: "e.g. 2026-03-27",
        maturity: "e.g. 2030-06-30",
        limitPrice: "e.g. 123.45",
      },
    },
    productType: {
      stock: "Stock",
      bond: "Bond",
      fund: "Fund",
      option: "Option",
      crypto: "Crypto",
    },
    status: {
      filled: "Filled",
      pending: "Pending",
      canceled: "Canceled",
      rejected: "Rejected",
    },
    buy: "Buy",
    sell: "Sell",
    market: "Market",
    limit: "Limit",
    day: "Day",
    gtc: "GTC",
    submit: "Submit",
    delete: "Delete",
    filling: "Editing",
    details: "Details",
    collapse: "Collapse",
    orderId: "Order ID",
    submittedAt: "Submitted",
    filledAt: "Filled",
    fillPrice: "Fill Price",
    fillValue: "Fill Value",
    orderSubmitted: "Order submitted",
    modify: "Modify",
    submitModify: "Submit Changes",
    cancelEdit: "Cancel Edit",
    marketNoEditPrice: "Market order: price can't be modified",
    order: "Order",
    submitting: "Submitting...",
    orderSent: "Order Sent",
    orderFailed: "Order Failed",

    // Trade Window
    tradeWindowTitle: "Trading",
    createOrder: "New Order",

    // Logs
    logs: {
      connecting: "Connecting:",
      connected: "✅ Connected",
      disconnected: "⛔ Disconnected",
      errorPrefix: "❌ Error:",
      tradeFailedPrefix: "❌ Trade failed:",
      toolInvokePrefix: "🔧 Tool call:",
      argsPrefix: "↳ 参数：",
      outputPrefix: "↳ 输出：",
      modelRequestedToolPrefix: "🧩 模型请求工具：",
      toolArgsReadyPrefix: "🧩 工具参数就绪：",
      speechStarted: "🎤 speech_started (barge-in)",
      speechStopped: "🎤 speech_stopped",
      audioBytes: "🎧 audio bytes",
    },

    // Tools
    tools: {
      names: {
        update_order_form: "Update order form",
        place_stock_order: "Place stock order",
        place_fund_order: "Place fund order",
        place_bond_order: "Place bond order",
        place_option_order: "Place option order",
        place_crypto_order: "Place crypto order",
        get_account_snapshot: "Get account snapshot",
        get_market_price: "Get market price (estimate)",
        convert_currency: "Convert currency",
        cancel_order: "Cancel order",
        modify_order: "Modify order",
      },
      errors: {
        invalidJsonArguments: "Invalid JSON arguments",
        invalidArgumentsShape: "Invalid arguments shape (expected an object)",
        unknownToolPrefix: "Unknown tool:",
        productTypeInvalid: "productType must be stock|fund|bond|option|crypto",
        symbolRequired: "symbol is required",
        currencyInvalid: "currency must be USD|JPY|CNY",
        fromToInvalid: "from/to must be USD|JPY|CNY",
        amountInvalid: "amount must be a number > 0",
        orderIdRequired: "orderId is required",
      },
    },
    
    // Common
    error: "Error",
  },
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (ctx) {
    return { lang: ctx.lang, setLang: ctx.setLang, t: translations[ctx.lang] };
  }

  // Backward-compatible fallback (in case a component is used outside the provider).
  const [lang, setLang] = useState<Language>("zh");
  useEffect(() => {
    setLang(detectNavigatorLanguage());
  }, []);
  return { lang, setLang, t: translations[lang] };
}

export function LanguageProvider({ children, initialLang }: { children: ReactNode; initialLang?: Language }) {
  const [lang, setLang] = useState<Language>(initialLang ?? "zh");

  useEffect(() => {
    if (initialLang) return;
    setLang(detectNavigatorLanguage());
  }, [initialLang]);

  return createElement(LanguageContext.Provider, { value: { lang, setLang } }, children);
}
