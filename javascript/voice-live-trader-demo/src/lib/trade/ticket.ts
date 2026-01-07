import { TradeOrderRequest, TradeOrderResponse } from "./types";

export type TradeTicket = {
  id: string;
  order: TradeOrderRequest;
  frozen: boolean;
  collapsed: boolean;
  lastResponse?: TradeOrderResponse;
};
