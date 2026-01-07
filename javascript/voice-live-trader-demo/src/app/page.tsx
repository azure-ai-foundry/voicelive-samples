"use client";

import Image from "next/image";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { AccountPanel } from "@/components/AccountPanel";
import { AssetsPanel } from "@/components/AssetsPanel";
import { TradeForm, defaultOrder } from "@/components/TradeForm";
import { UsagePanel } from "@/components/UsagePanel";
import { buildTradingTools, getTraderInstructions } from "@/lib/traderAgent";
import type {
  AccountSnapshot,
  AssetPosition,
  BalanceAdjustRequest,
  BalanceAdjustResponse,
  FxConvertRequest,
  FxConvertResponse,
  ModifyOrderRequest,
  TradeOrderRequest,
  TradeOrderResponse,
} from "@/lib/trade/types";
import {
  adjustBalance as simAdjustBalance,
  cancelOrder as simCancelOrder,
  convertCurrency as simConvertCurrency,
  getAccountSnapshot as simGetAccountSnapshot,
  getMarketPrice as simGetMarketPrice,
  modifyOrder as simModifyOrder,
  placeOrder as simPlaceOrder,
  subscribeAccountSnapshot,
} from "@/lib/trade/engine";
import { VoiceLiveClient } from "@/lib/voiceLive/VoiceLiveClient";
import type { UsageTotals, VoiceLiveConnectionConfig, WireStats } from "@/lib/voiceLive/types";
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";
import { TicketCard } from "@/components/TicketCard";
import { TradeTicket } from "@/lib/trade/ticket";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFlashOnChange } from "@/lib/hooks";
import { useLanguage } from "@/lib/i18n";

function canSubmitOrder(order: TradeOrderRequest, disabled?: boolean) {
  if (disabled) return false;
  if (!order.symbol.trim()) return false;
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) return false;
  if (order.orderType === "limit") {
    if (!Number.isFinite(order.limitPrice) || (order.limitPrice ?? 0) <= 0) return false;
  }
  return true;
}

const defaultConfig: VoiceLiveConnectionConfig = {
  resourceHost: "",
  apiVersion: "2025-10-01",
  model: "gpt-4o",
  apiKey: "",
  voice: { type: "azure-standard", name: "zh-CN-XiaochenMultilingualNeural", temperature: 0.8 },
  instructions: getTraderInstructions("en"),
  languageHint: "zh,en",
  enableAudioLogging: true,
  enableBargeIn: true,
  vadThreshold: 0.5,
  vadPrefixPaddingMs: 300,
  vadSilenceDurationMs: 200,
};

const ENDPOINT_COOKIE = "vl_endpoint_host";
const API_KEY_COOKIE = "vl_api_key";

function statusText(s: "disconnected" | "connecting" | "connected") {
  if (s === "connected") return "Connected";
  if (s === "connecting") return "Connecting";
  return "Disconnected";
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function chatTs() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isGitHubPagesRuntime() {
  return typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
}

function formatTradeSummary(tn: any, trade: TradeOrderResponse): string {
  const order = trade.order;
  const sideLabel = order.side === "buy" ? tn.buy : tn.sell;
  const productLabel = (tn.productType && tn.productType[order.productType]) || order.productType;
  const orderTypeLabel = order.orderType === "market" ? tn.market : tn.limit;
  const statusLabel = (tn.status && tn.status[trade.status]) || trade.status;

  const qtyText = typeof order.quantity === "number" ? String(order.quantity) : "";
  const currencyText = order.currency ?? "";

  if (trade.status === "filled" && typeof trade.fillPrice === "number" && Number.isFinite(trade.fillPrice)) {
    const px = trade.fillPrice.toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return `${statusLabel} (${orderTypeLabel}): ${sideLabel} ${qtyText} ${productLabel} ${order.symbol} @ ${px} ${currencyText}`.trim();
  }

  if (order.orderType === "limit" && typeof order.limitPrice === "number" && Number.isFinite(order.limitPrice)) {
    const px = order.limitPrice.toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return `${statusLabel} (${orderTypeLabel}): ${sideLabel} ${qtyText} ${productLabel} ${order.symbol} @ ${px} ${currencyText}`.trim();
  }

  return `${statusLabel} (${orderTypeLabel}): ${sideLabel} ${qtyText} ${productLabel} ${order.symbol} ${currencyText}`.trim();
}

async function postTrade(order: TradeOrderRequest): Promise<TradeOrderResponse> {
  const res = simPlaceOrder(order);
  if (res.status === "rejected") throw new Error(res.summary || "Order rejected");
  return res;
}

async function fetchAccount(): Promise<AccountSnapshot> {
  return simGetAccountSnapshot();
}

async function postFxConvert(req: FxConvertRequest): Promise<FxConvertResponse> {
  return simConvertCurrency(req);
}

async function postBalanceAdjust(req: BalanceAdjustRequest): Promise<BalanceAdjustResponse> {
  return simAdjustBalance(req);
}

async function postCancel(orderId: string) {
  const res = simCancelOrder(orderId);
  if (!res.ok) throw new Error(res.error ?? "Cancel failed");
  return { snapshot: res.snapshot } as { snapshot?: AccountSnapshot };
}

async function postModify(orderId: string, patch: ModifyOrderRequest) {
  const res = simModifyOrder(orderId, patch);
  if (!res.ok) throw new Error(res.error ?? "Modify failed");
  return { snapshot: res.snapshot } as { snapshot?: AccountSnapshot };
}

export default function Home() {
  const { t: i18n, lang, setLang } = useLanguage();
  const clientRef = useRef<VoiceLiveClient | null>(null);

  const [config, setConfig] = useState<VoiceLiveConnectionConfig>(defaultConfig);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [micOn, setMicOn] = useState(false);

  const [usage, setUsage] = useState<UsageTotals>({
    turns: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    inputTextTokens: 0,
    inputAudioTokens: 0,
    inputTextCachedTokens: 0,
    inputAudioCachedTokens: 0,
    inputCachedTokens: 0,
    outputTextTokens: 0,
    outputAudioTokens: 0,
    outputTextCachedTokens: 0,
    outputAudioCachedTokens: 0,
    outputCachedTokens: 0,

    speechEndToFirstResponseMsMin: 0,
    speechEndToFirstResponseMsAvg: 0,
    speechEndToFirstResponseMsP90: 0,
    speechEndToFirstResponseCount: 0,
  });
  const [wire, setWire] = useState<WireStats>({
    wsSentBytes: 0,
    wsReceivedBytes: 0,
    audioSentBytes: 0,
    audioReceivedBytes: 0,
    toolCalls: 0,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);

  const [assistantStreaming, setAssistantStreaming] = useState<string>("");
  const [assistantStreamingTs, setAssistantStreamingTs] = useState<string | null>(null);

  const [tickets, setTickets] = useState<TradeTicket[]>([]);

  const [account, setAccount] = useState<AccountSnapshot | null>(null);

  const ticketsRef = useRef(tickets);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  const i18nRef = useRef(i18n);
  const langRef = useRef(lang);
  useEffect(() => { i18nRef.current = i18n; }, [i18n]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const audioLogRef = useRef({ lastTs: 0, lastAudioIn: 0, lastAudioOut: 0 });

  useEffect(() => {
    let alive = true;

    const unsubscribe = subscribeAccountSnapshot((snap) => {
      if (!alive) return;
      setAccount(snap);

      setTickets((prev) => {
        if (!snap.orders?.length) return prev;
        const byId = new Map(snap.orders.map((o) => [o.orderId, o] as const));
        const changedIds: string[] = [];
        const next = prev.map((t) => {
          const last = t.lastResponse;
          const orderId = last?.orderId;
          if (!t.frozen || !orderId || !last) return t;
          const rec = byId.get(orderId);
          if (!rec) return t;

          const prevStatus = last.status;
          if (rec.status === prevStatus) return t;

          changedIds.push(t.id);
          const tn = i18nRef.current;
          const sideLabel = rec.side === "buy" ? tn.buy : tn.sell;
          const summary =
            rec.status === "filled"
              ? `${tn.order} ${rec.orderId} ${tn.status.filled}: ${sideLabel} ${rec.quantity} ${rec.symbol}`
              : rec.status === "canceled"
                ? `${tn.order} ${rec.orderId} ${tn.status.canceled}: ${sideLabel} ${rec.quantity} ${rec.symbol}`
                : rec.status === "rejected"
                  ? `${tn.order} ${rec.orderId} ${tn.status.rejected}: ${sideLabel} ${rec.quantity} ${rec.symbol}`
                  : last.summary;

          return {
            ...t,
            lastResponse: {
              ...last,
              status: rec.status,
              summary,
              filledAt: rec.filledAt,
              fillPrice: rec.fillPrice,
              fillValue: rec.fillValue,
            },
          };
        });

        if (!changedIds.length) return prev;
        const bumped = next.filter((t) => changedIds.includes(t.id));
        const rest = next.filter((t) => !changedIds.includes(t.id));
        return [...bumped, ...rest];
      });
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const saved = getCookie(ENDPOINT_COOKIE);
    if (saved && !config.resourceHost) {
      setConfig((prev) => ({ ...prev, resourceHost: saved }));
    }

    const savedKey = getCookie(API_KEY_COOKIE);
    if (savedKey && !config.apiKey) {
      setConfig((prev) => ({ ...prev, apiKey: savedKey }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const host = config.resourceHost.trim();
    if (host) setCookie(ENDPOINT_COOKIE, host, { days: 365 });
    else deleteCookie(ENDPOINT_COOKIE);
  }, [config.resourceHost]);

  useEffect(() => {
    const key = config.apiKey;
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    if (key) setCookie(API_KEY_COOKIE, key, { days: 30, secure });
    else deleteCookie(API_KEY_COOKIE);
  }, [config.apiKey]);

  const assetsForPanel: AssetPosition[] = useMemo(() => account?.assets ?? [], [account]);

  const connectDisabled = useMemo(() => {
    return !config.resourceHost || !config.apiVersion || !config.model || !config.apiKey;
  }, [config]);

  function logSystem(text: string) {
    setMessages((prev) => [...prev, { id: newId("sys"), role: "system", text, ts: chatTs() }]);
  }

  function getActiveTicketId(ts: TradeTicket[]) {
    return ts.find((t) => !t.frozen)?.id;
  }

  const connect = useCallback(async () => {
    if (connectDisabled) return;
    setChatError(null);

    const config = {
      ...configRef.current,
      instructions: getTraderInstructions(langRef.current),
    };
    logSystem(`${i18nRef.current.logs.connecting} ${config.resourceHost} / ${config.model}`);

    const client = new VoiceLiveClient({
      tools: buildTradingTools(langRef.current),
      functionHandler: async ({ name, callId, argumentsJson }) => {
        const toolDisplayName = i18nRef.current.tools.names[name as keyof typeof i18nRef.current.tools.names] ?? name;
        const te = i18nRef.current.tools.errors;

        logSystem(`${i18nRef.current.logs.toolInvokePrefix} ${toolDisplayName} (call_id=${callId})`);
        logSystem(`${i18nRef.current.logs.argsPrefix} ${argumentsJson}`);

        if (name === "update_order_form") {
          let argsUnknown: unknown;
          try {
            argsUnknown = JSON.parse(argumentsJson);
          } catch {
            const output = JSON.stringify({ ok: false, error: te.invalidJsonArguments });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const r = argsUnknown && typeof argsUnknown === "object" ? (argsUnknown as Record<string, unknown>) : null;
          if (!r) {
            const output = JSON.stringify({ ok: false, error: te.invalidArgumentsShape });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const requestedTicketId = typeof r.ticketId === "string" && r.ticketId.trim() ? r.ticketId.trim() : null;
          const createNew = r.newTicket === true;
          const clear = r.clear === true;

          let chosenTicketId = requestedTicketId;
          let created = false;

          setTickets((prev) => {
            let nextTickets = prev;
            let targetId = chosenTicketId;

            const hasTarget = !!targetId && prev.some((t) => t.id === targetId);

            if (createNew || (targetId && !hasTarget)) {
              const createdTicket: TradeTicket = {
                id: newId("ticket"),
                order: defaultOrder,
                frozen: false,
                collapsed: true,
              };
              created = true;
              targetId = createdTicket.id;
              nextTickets = [createdTicket, ...prev];
            } else if (!targetId) {
              const activeId = getActiveTicketId(prev);
              if (activeId) {
                targetId = activeId;
              } else {
                const createdTicket: TradeTicket = {
                  id: newId("ticket"),
                  order: defaultOrder,
                  frozen: false,
                  collapsed: true,
                };
                created = true;
                targetId = createdTicket.id;
                nextTickets = [createdTicket, ...prev];
              }
            }

            chosenTicketId = targetId;

            const updated = nextTickets.map((t) => {
              if (t.id !== targetId) return t;

              const base = clear ? defaultOrder : t.order;
              const next: TradeOrderRequest = { ...base };

              if (
                r.productType === "stock" ||
                r.productType === "bond" ||
                r.productType === "fund" ||
                r.productType === "option" ||
                r.productType === "crypto"
              ) {
                next.productType = r.productType;
              }
              if (typeof r.symbol === "string") next.symbol = r.symbol;
              if (r.side === "buy" || r.side === "sell") next.side = r.side;

              if (typeof r.quantity === "number" && Number.isFinite(r.quantity)) next.quantity = r.quantity;

              if (r.orderType === "market" || r.orderType === "limit") next.orderType = r.orderType;
              if (typeof r.limitPrice === "number" && Number.isFinite(r.limitPrice)) next.limitPrice = r.limitPrice;

              if (r.currency === "USD" || r.currency === "JPY" || r.currency === "CNY") next.currency = r.currency;
              if (r.timeInForce === "day" || r.timeInForce === "gtc") next.timeInForce = r.timeInForce;
              if (typeof r.note === "string") next.note = r.note;

              if (r.optionType === "call" || r.optionType === "put") next.optionType = r.optionType;
              if (typeof r.strike === "number" && Number.isFinite(r.strike)) next.strike = r.strike;
              if (typeof r.expiry === "string") next.expiry = r.expiry;
              if (typeof r.maturity === "string") next.maturity = r.maturity;

              return { ...t, order: next };
            });

            const bumped = updated.find((t) => t.id === targetId);
            if (!bumped) return updated;
            return [bumped, ...updated.filter((t) => t.id !== targetId)];
          });

          const output = JSON.stringify({ ok: true, ticketId: chosenTicketId, created });
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }

        if (name === "get_account_snapshot") {
          try {
            const snap = await fetchAccount();
            setAccount(snap);
            const output = JSON.stringify(snap);
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          } catch (e) {
            const output = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
        }

        if (name === "get_market_price") {
          let argsUnknown: unknown;
          try {
            argsUnknown = JSON.parse(argumentsJson);
          } catch {
            const output = JSON.stringify({ error: te.invalidJsonArguments });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const r = argsUnknown && typeof argsUnknown === "object" ? (argsUnknown as Record<string, unknown>) : null;
          const productType = r?.productType;
          const symbol = typeof r?.symbol === "string" ? r.symbol : "";
          const currency = r?.currency;

          const isProductType = (v: unknown) =>
            v === "stock" || v === "fund" || v === "bond" || v === "option" || v === "crypto";
          const isFiat = (v: unknown) => v === "USD" || v === "JPY" || v === "CNY";

          if (!isProductType(productType)) {
            const output = JSON.stringify({ error: te.productTypeInvalid });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          if (!symbol.trim()) {
            const output = JSON.stringify({ error: te.symbolRequired });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          if (currency !== undefined && !isFiat(currency)) {
            const output = JSON.stringify({ error: te.currencyInvalid });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const res = simGetMarketPrice({
            productType,
            symbol,
            currency: currency as "USD" | "JPY" | "CNY" | undefined,
          });

          const output = JSON.stringify(res);
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }

        if (name === "convert_currency") {
          let argsUnknown: unknown;
          try {
            argsUnknown = JSON.parse(argumentsJson);
          } catch {
            const output = JSON.stringify({ error: te.invalidJsonArguments });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const r = argsUnknown && typeof argsUnknown === "object" ? (argsUnknown as Record<string, unknown>) : null;
          const from = r?.from;
          const to = r?.to;
          const amount = r?.amount;

          const isFiat = (v: unknown) => v === "USD" || v === "JPY" || v === "CNY";

          if (!isFiat(from) || !isFiat(to)) {
            const output = JSON.stringify({ error: te.fromToInvalid });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            const output = JSON.stringify({ error: te.amountInvalid });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          try {
            const res = await postFxConvert({ from, to, amount });
            if (res.snapshot) setAccount(res.snapshot);
            const output = JSON.stringify(res);
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          } catch (e) {
            const output = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
        }

        if (name === "cancel_order") {
          let argsUnknown: unknown;
          try {
            argsUnknown = JSON.parse(argumentsJson);
          } catch {
            const output = JSON.stringify({ error: te.invalidJsonArguments });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
          const r = argsUnknown && typeof argsUnknown === "object" ? (argsUnknown as Record<string, unknown>) : null;
          const orderId = typeof r?.orderId === "string" ? r.orderId : "";
          if (!orderId) {
            const output = JSON.stringify({ error: te.orderIdRequired });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
          try {
            const res = await postCancel(orderId);
            if (res.snapshot) setAccount(res.snapshot);
            else setAccount(await fetchAccount());
            const output = JSON.stringify(res);
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          } catch (e) {
            const output = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
        }

        if (name === "modify_order") {
          let argsUnknown: unknown;
          try {
            argsUnknown = JSON.parse(argumentsJson);
          } catch {
            const output = JSON.stringify({ error: te.invalidJsonArguments });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const r = argsUnknown && typeof argsUnknown === "object" ? (argsUnknown as Record<string, unknown>) : null;
          const orderId = typeof r?.orderId === "string" ? r.orderId : "";
          if (!orderId) {
            const output = JSON.stringify({ error: te.orderIdRequired });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }

          const patch: ModifyOrderRequest = {};
          if (typeof r?.quantity === "number" && Number.isFinite(r.quantity)) patch.quantity = r.quantity;
          if (typeof r?.limitPrice === "number" && Number.isFinite(r.limitPrice)) patch.limitPrice = r.limitPrice;
          if (r?.timeInForce === "day" || r?.timeInForce === "gtc") patch.timeInForce = r.timeInForce;
          if (typeof r?.note === "string") patch.note = r.note;

          try {
            const res = await postModify(orderId, patch);
            if (res.snapshot) setAccount(res.snapshot);
            else setAccount(await fetchAccount());
            const output = JSON.stringify(res);
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          } catch (e) {
            const output = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
            return { output };
          }
        }

        const productTypeByTool: Record<string, TradeOrderRequest["productType"]> = {
          place_stock_order: "stock",
          place_fund_order: "fund",
          place_bond_order: "bond",
          place_option_order: "option",
          place_crypto_order: "crypto",
        };

        const productType = productTypeByTool[name];
        if (!productType) {
          const output = JSON.stringify({ error: `${te.unknownToolPrefix} ${name}`, callId });
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }

        let argsUnknown: unknown;
        try {
          argsUnknown = JSON.parse(argumentsJson);
        } catch {
          const output = JSON.stringify({ error: te.invalidJsonArguments });
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }

        if (!argsUnknown || typeof argsUnknown !== "object") {
          const output = JSON.stringify({ error: te.invalidArgumentsShape });
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }

        const args = argsUnknown as Record<string, unknown>;

        const order: TradeOrderRequest = {
          productType,
          symbol: (typeof args.symbol === "string" ? args.symbol : "") as string,
          side: args.side as TradeOrderRequest["side"],
          quantity: (typeof args.quantity === "number" ? args.quantity : Number(args.quantity)) as number,
          orderType: args.orderType as TradeOrderRequest["orderType"],
          limitPrice: (typeof args.limitPrice === "number" ? args.limitPrice : Number(args.limitPrice)) as number,
          currency: args.currency === "USD" || args.currency === "JPY" || args.currency === "CNY" ? args.currency : undefined,
          timeInForce: args.timeInForce as TradeOrderRequest["timeInForce"],
          note: typeof args.note === "string" ? args.note : undefined,
        };

        // Crypto orders are quoted in USD in this demo.
        if (productType === "crypto") order.currency = "USD";

        if (productType === "option") {
          if (args.optionType === "call" || args.optionType === "put") order.optionType = args.optionType;
          const strike = typeof args.strike === "number" ? args.strike : Number(args.strike);
          if (Number.isFinite(strike) && strike > 0) order.strike = strike;
          if (typeof args.expiry === "string") order.expiry = args.expiry;
        }
        if (productType === "bond") {
          if (typeof args.maturity === "string") order.maturity = args.maturity;
        }

        try {
          const trade = await postTrade(order);
          const localizedTrade: TradeOrderResponse = { ...trade, summary: formatTradeSummary(i18nRef.current, trade) };
          const output = JSON.stringify(localizedTrade);
          logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          setTickets((prev) => [
            {
              id: newId("ticket"),
              order,
              frozen: true,
              collapsed: true,
              lastResponse: localizedTrade,
            },
            ...prev.filter((t) => t.frozen),
          ]);
          try {
            const snap = await fetchAccount();
            setAccount(snap);
          } catch {
            // ignore
          }
          // Return structured JSON so the model can summarize.
          return { output };
        } catch (e) {
          const output = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            logSystem(`${i18nRef.current.logs.outputPrefix} ${output}`);
          return { output };
        }
      },
      callbacks: {
        onStatus: (s) => {
          setStatus(s);
          if (s === "connected") logSystem(i18nRef.current.logs.connected);
          if (s === "disconnected") logSystem(i18nRef.current.logs.disconnected);
        },
        onError: (m) => {
          setChatError(m);
          logSystem(`${i18nRef.current.logs.errorPrefix} ${m}`);
        },
        onServerEvent: (event) => {
          if (configRef.current.enableAudioLogging) {
            const t = event.type;
            if (t === "input_audio_buffer.speech_started" || t === "input_audio_buffer_speech_started") {
              logSystem(i18nRef.current.logs.speechStarted);
            }
            if (t === "input_audio_buffer.speech_stopped" || t === "input_audio_buffer_speech_stopped") {
              logSystem(i18nRef.current.logs.speechStopped);
            }

            // Throttled byte logging to avoid spamming.
            if (t === "response.audio.delta" || t === "input_audio_buffer.append") {
              const now = Date.now();
              if (now - audioLogRef.current.lastTs >= 1000) {
                const inBytes = wire.audioSentBytes;
                const outBytes = wire.audioReceivedBytes;
                const inDelta = inBytes - audioLogRef.current.lastAudioIn;
                const outDelta = outBytes - audioLogRef.current.lastAudioOut;
                audioLogRef.current.lastTs = now;
                audioLogRef.current.lastAudioIn = inBytes;
                audioLogRef.current.lastAudioOut = outBytes;
                if (inDelta > 0 || outDelta > 0) {
                  logSystem(`${i18nRef.current.logs.audioBytes} (+in ${inDelta}, +out ${outDelta})`);
                }
              }
            }

            // response.audio.done is intentionally not logged to avoid noise.
          }

          if (event.type === "response.output_item.added") {
            const item = (event as unknown as Record<string, unknown>).item;
            if (item && typeof item === "object") {
              const ir = item as Record<string, unknown>;
              if (ir.type === "function_call") {
                const name = typeof ir.name === "string" ? ir.name : "function_call";
                const callId = typeof ir.call_id === "string" ? ir.call_id : "";
                const toolDisplayName = i18nRef.current.tools.names[name as keyof typeof i18nRef.current.tools.names] ?? name;
                logSystem(
                  `${i18nRef.current.logs.modelRequestedToolPrefix} ${toolDisplayName}${callId ? ` (call_id=${callId})` : ""}`,
                );
              }
            }
          }
          if (event.type === "response.function_call_arguments.done") {
            const r = event as unknown as Record<string, unknown>;
            const name = typeof r.name === "string" ? r.name : undefined;
            const callId = typeof r.call_id === "string" ? r.call_id : undefined;
            const args = typeof r.arguments === "string" ? r.arguments : undefined;
            const toolDisplayName =
              (name && (i18nRef.current.tools.names[name as keyof typeof i18nRef.current.tools.names] ?? name)) || "";
            logSystem(
              `${i18nRef.current.logs.toolArgsReadyPrefix} ${toolDisplayName}${callId ? ` (call_id=${callId})` : ""}`.trim(),
            );
            if (args) logSystem(`${i18nRef.current.logs.argsPrefix} ${args}`);
          }
        },
        onStats: ({ usage: u, wire: w }) => {
          setUsage(u);
          setWire(w);
        },
        onUserTranscript: (text) => {
          // Follow the user's input language for the whole UI.
          if (/[\u4E00-\u9FFF]/.test(text)) setLang("zh");
          else if (/[A-Za-z]/.test(text)) setLang("en");
          setMessages((prev) => [...prev, { id: newId("u"), role: "user", text, ts: chatTs() }]);
        },
        onAssistantTextDelta: (delta) => {
          setAssistantStreamingTs((prev) => prev ?? chatTs());
          setAssistantStreaming((prev) => prev + delta);
        },
        onAssistantTextDone: (text) => {
          setAssistantStreaming("");
          setAssistantStreamingTs(null);
          setMessages((prev) => [...prev, { id: newId("a"), role: "assistant", text, ts: chatTs() }]);
        },
      },
    });

    clientRef.current = client;
    await client.connect(config);
  }, [connectDisabled]);

  const disconnect = useCallback(() => {
    try {
      clientRef.current?.disconnect();
    } finally {
      clientRef.current = null;
      setMicOn(false);
      setAssistantStreaming("");
      setAssistantStreamingTs(null);
      setStatus("disconnected");
      logSystem(i18nRef.current.logs.disconnected);
    }
  }, []);

  const toggleMic = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      if (!micOn) {
        await client.startMicrophone();
        setMicOn(true);
      } else {
        client.stopMicrophone();
        setMicOn(false);
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : String(e));
    }
  }, [micOn]);

  const visibleMessages = useMemo(() => {
    if (!assistantStreaming) return messages;
    return [
      ...messages,
      {
        id: "assistant_stream",
        role: "assistant" as const,
        text: assistantStreaming,
        ts: assistantStreamingTs ?? undefined,
      },
    ];
  }, [messages, assistantStreaming, assistantStreamingTs]);

  const submitTicket = useCallback(async (ticketId: string) => {
    const t = ticketsRef.current.find((x) => x.id === ticketId);
    if (!t || t.frozen) return;
    if (!canSubmitOrder(t.order)) return;

    try {
      const payload: TradeOrderRequest = { ...t.order, symbol: t.order.symbol.trim() };
      const trade = await postTrade(payload);

      setMessages((prev) => [...prev, { id: newId("s"), role: "system", text: trade.summary, ts: chatTs() }]);
      setTickets((prev) => prev.filter((x) => x.id !== ticketId));

      void fetchAccount()
        .then((snap) => setAccount(snap))
        .catch(() => {
          // ignore
        });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setChatError(msg);
      logSystem(`${i18nRef.current.logs.tradeFailedPrefix} ${msg}`);
    }
  }, []);

  const deleteTicket = useCallback((ticketId: string) => {
    setTickets((prev) => prev.filter((x) => x.id !== ticketId));
  }, []);

  const updateOrder = useCallback((ticketId: string, updates: Partial<TradeOrderRequest>) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        return { ...t, order: { ...t.order, ...updates } };
      })
    );
  }, []);

  const toggleCollapse = useCallback((ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        return { ...t, collapsed: !t.collapsed };
      })
    );
  }, []);

  const handleConvert = useCallback(async (req: FxConvertRequest) => {
    const res = await postFxConvert(req);
    if (res.snapshot) setAccount(res.snapshot);
    return res;
  }, []);

  const handleAdjust = useCallback(async (req: BalanceAdjustRequest) => {
    const res = await postBalanceAdjust(req);
    if (res.snapshot) setAccount(res.snapshot);
    return { ok: res.ok, error: res.error };
  }, []);

  const handleCreateTicket = useCallback(() => {
    setTickets((prev) => [{ id: newId("ticket"), order: defaultOrder, frozen: false, collapsed: true }, ...prev]);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="https://devblogs.microsoft.com/foundry/wp-content/uploads/sites/89/2025/03/ai-foundry.png"
              alt="Azure AI"
              width={120}
              height={28}
              style={{ height: "20px", width: "auto" }}
              priority
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">Azure Voice Live - Trader Agent</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span
              className={`text-[10px] ${
                status === "connected" ? "text-sky-600" : status === "connecting" ? "text-amber-500" : "text-zinc-400"
              }`}
            >
              ●
            </span>
            <span>{statusText(status)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4 lg:h-[calc(100vh-140px)] lg:overflow-hidden lg:pr-1">
          <ConnectionPanel
            config={config}
            onChange={setConfig}
            status={status}
            micOn={micOn}
            onConnect={connect}
            onDisconnect={disconnect}
            onToggleMic={toggleMic}
          />

          <AccountPanel
            balances={(account?.balances ?? []).filter((b) => b.currency === "USD" || b.currency === "JPY" || b.currency === "CNY")}
            onConvert={handleConvert}
            onAdjust={handleAdjust}
          />

          <div className="min-h-0 flex-1">
            <AssetsPanel assets={assetsForPanel} />
          </div>
        </div>

        <div className="grid gap-4 lg:h-[calc(100vh-140px)] lg:grid-rows-[1fr_auto_auto]">
          <section className="min-h-0 overflow-auto rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">{i18n.tradeWindowTitle}</h2>
              <button
                className="h-9 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                onClick={handleCreateTicket}
              >
                {i18n.createOrder}
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {tickets.map((t, idx) => (
                <TicketCard
                  key={t.id}
                  t={t}
                  idx={idx}
                  onUpdateOrder={updateOrder}
                  onSubmit={submitTicket}
                  onDelete={deleteTicket}
                  onToggleCollapse={toggleCollapse}
                />
              ))}
            </div>
          </section>

          <ChatPanel
            messages={visibleMessages}
            error={chatError}
          />

          <UsagePanel usage={usage} wire={wire} />
        </div>
      </main>
    </div>
  );
}
