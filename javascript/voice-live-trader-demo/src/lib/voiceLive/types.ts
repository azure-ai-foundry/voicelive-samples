export type VoiceLiveVoice =
  | { type: "openai"; name: string }
  | { type: "azure-standard"; name: string; temperature?: number; rate?: string }
  | { type: "azure-custom"; name: string; endpoint_id: string; temperature?: number; style?: string; rate?: string };

export type VoiceLiveTool = {
  type: "function";
  name: string;
  description?: string;
  parameters: unknown;
};

export type VoiceLiveConnectionConfig = {
  resourceHost: string; // e.g. my-resource.services.ai.azure.com
  apiVersion: string; // e.g. 2025-10-01
  model: string; // e.g. gpt-realtime
  apiKey: string;
  voice: VoiceLiveVoice;
  instructions: string;
  languageHint?: string; // e.g. zh,en
  enableAudioLogging?: boolean;
  enableBargeIn?: boolean;
  vadThreshold?: number; // 0.0 - 1.0
  vadPrefixPaddingMs?: number;
  vadSilenceDurationMs?: number;
};

export type VoiceLiveClientEvent = Record<string, unknown> & { type: string };
export type VoiceLiveServerEvent = Record<string, unknown> & { type: string };

export type UsageTotals = {
  turns: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;

  inputTextTokens: number;
  inputAudioTokens: number;
  inputTextCachedTokens: number;
  inputAudioCachedTokens: number;
  inputCachedTokens: number;

  outputTextTokens: number;
  outputAudioTokens: number;
  outputTextCachedTokens: number;
  outputAudioCachedTokens: number;
  outputCachedTokens: number;

  speechEndToFirstResponseMsMin: number;
  speechEndToFirstResponseMsAvg: number;
  speechEndToFirstResponseMsP90: number;
  speechEndToFirstResponseCount: number;
};

export type WireStats = {
  wsSentBytes: number;
  wsReceivedBytes: number;
  audioSentBytes: number;
  audioReceivedBytes: number;
  toolCalls: number;
};
