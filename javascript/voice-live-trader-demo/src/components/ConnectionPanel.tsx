"use client";

import type { VoiceLiveConnectionConfig, VoiceLiveVoice } from "@/lib/voiceLive/types";
import { normalizeResourceHost } from "@/lib/voiceLive/normalize";
import { memo } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  config: VoiceLiveConnectionConfig;
  onChange: (next: VoiceLiveConnectionConfig) => void;
  status: "disconnected" | "connecting" | "connected";
  micOn: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMic: () => void;
};

function setVoice(config: VoiceLiveConnectionConfig, voice: VoiceLiveVoice): VoiceLiveConnectionConfig {
  return { ...config, voice };
}

export const ConnectionPanel = memo(function ConnectionPanel({
  config,
  onChange,
  status,
  micOn,
  onConnect,
  onDisconnect,
  onToggleMic,
}: Props) {
  const voiceType = config.voice.type;
  const { t } = useLanguage();

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (status !== "connected") onConnect();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t.connectionConfig}</h2>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-500">Endpoint（host only）</span>
            <input
              className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
              value={config.resourceHost}
              onChange={(e) =>
                onChange({ ...config, resourceHost: normalizeResourceHost(e.target.value) || e.target.value.trim() })
              }
              placeholder={t.endpointPlaceholder}
              spellCheck={false}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-zinc-500">
              API Key -{" "}
              <a href="https://ai.azure.com" target="_blank" rel="noopener noreferrer" className="underline">
                Get API Key/Endpoint Here 👈
              </a>
            </span>
            <input
              className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
              value={config.apiKey}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
              placeholder="******"
              type="password"
              autoComplete="off"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-2">
            {status !== "connected" ? (
              <button
                type="submit"
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={!config.resourceHost || !config.apiVersion || !config.model || !config.apiKey}
              >
                {t.connect}
              </button>
            ) : (
              <button
                type="button"
                className="h-9 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground hover:bg-accent"
                onClick={onDisconnect}
              >
                {t.disconnect}
              </button>
            )}

            <button
              type="button"
              className="h-9 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground disabled:opacity-50 hover:bg-accent"
              onClick={onToggleMic}
              disabled={status !== "connected"}
            >
              {micOn ? t.stopMic : t.startMic}
            </button>
          </div>

          <details className="mt-1 rounded-md border border-border">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">
              {t.advancedSettings}
            </summary>
            <div className="grid grid-cols-1 gap-3 border-t border-border p-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">API Version</span>
              <input
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
                value={config.apiVersion}
                onChange={(e) => onChange({ ...config, apiVersion: e.target.value.trim() })}
                placeholder="2025-10-01"
                spellCheck={false}
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableBargeIn ?? true}
                onChange={(e) => onChange({ ...config, enableBargeIn: e.target.checked })}
              />
              <span className="text-xs text-foreground">{t.enableBargeIn}</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">VAD Threshold</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
                  value={config.vadThreshold ?? 0.5}
                  onChange={(e) => onChange({ ...config, vadThreshold: parseFloat(e.target.value) })}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Prefix (ms)</span>
                <input
                  type="number"
                  step="100"
                  className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
                  value={config.vadPrefixPaddingMs ?? 300}
                  onChange={(e) => onChange({ ...config, vadPrefixPaddingMs: parseInt(e.target.value) })}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Silence (ms)</span>
                <input
                  type="number"
                  step="100"
                  className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none"
                  value={config.vadSilenceDurationMs ?? 200}
                  onChange={(e) => onChange({ ...config, vadSilenceDurationMs: parseInt(e.target.value) })}
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableAudioLogging ?? false}
                onChange={(e) => onChange({ ...config, enableAudioLogging: e.target.checked })}
              />
              <span className="text-xs text-foreground">{t.enableAudioLogging}</span>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Model</span>
              <select
                className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:text-zinc-100"
                value={config.model}
                onChange={(e) => onChange({ ...config, model: e.target.value })}
              >
                <optgroup label="Voice live pro">
                  <option value="gpt-realtime">gpt-realtime</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                  <option value="gpt-5">gpt-5</option>
                  <option value="gpt-5-chat">gpt-5-chat</option>
                </optgroup>
                <optgroup label="Voice live basic">
                  <option value="gpt-realtime-mini">gpt-realtime-mini</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-5-mini">gpt-5-mini</option>
                </optgroup>
                <optgroup label="Voice live lite">
                  <option value="gpt-5-nano">gpt-5-nano</option>
                  <option value="phi4-mm-realtime">phi4-mm-realtime</option>
                  <option value="phi4-mini">phi4-mini</option>
                </optgroup>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.voiceType}</span>
              <select
                className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:text-zinc-100"
                value={voiceType}
                onChange={(e) => {
                  const nextType = e.target.value as VoiceLiveVoice["type"];
                  if (nextType === "openai") onChange(setVoice(config, { type: "openai", name: "alloy" }));
                  if (nextType === "azure-standard")
                    onChange(setVoice(config, { type: "azure-standard", name: "zh-CN-XiaochenMultilingualNeural" }));
                  if (nextType === "azure-custom")
                    onChange(setVoice(config, { type: "azure-custom", name: "my-custom-voice", endpoint_id: "" }));
                }}
              >
                <option value="openai">openai</option>
                <option value="azure-standard">azure-standard</option>
                <option value="azure-custom">azure-custom</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.voiceName}</span>
              <input
                className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:text-zinc-100"
                value={config.voice.name}
                onChange={(e) => onChange(setVoice(config, { ...config.voice, name: e.target.value }))}
                placeholder={voiceType === "openai" ? "alloy" : "en-US-Ava:DragonHDLatestNeural"}
                spellCheck={false}
              />
            </label>

            {voiceType === "azure-custom" ? (
              <label className="grid gap-1">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.azureCustomVoiceEndpointId}</span>
                <input
                  className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:text-zinc-100"
                  value={config.voice.type === "azure-custom" ? config.voice.endpoint_id : ""}
                  onChange={(e) => {
                    if (config.voice.type !== "azure-custom") return;
                    onChange(setVoice(config, { ...config.voice, endpoint_id: e.target.value }));
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  spellCheck={false}
                />
              </label>
            ) : null}

            <label className="grid gap-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.languageHint}</span>
              <input
                className="h-9 rounded-md border border-black/10 bg-transparent px-3 text-sm text-zinc-900 outline-none dark:border-white/15 dark:text-zinc-100"
                value={config.languageHint ?? ""}
                onChange={(e) => onChange({ ...config, languageHint: e.target.value.trim() || undefined })}
                placeholder="zh,en"
                spellCheck={false}
              />
            </label>
            </div>
          </details>
        </div>
      </form>
    </section>
  );
});
