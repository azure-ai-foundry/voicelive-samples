"use client";

import type { UsageTotals, WireStats } from "@/lib/voiceLive/types";
import { memo } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  usage: UsageTotals;
  wire: WireStats;
};

export const UsagePanel = memo(function UsagePanel({ usage, wire }: Props) {
  const { t } = useLanguage();
  const interactions = usage.turns + wire.toolCalls;
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">{t.usageStats}</div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <div className="text-xs text-zinc-500">{t.turns}</div>
            <div className="font-semibold text-foreground">{interactions}</div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-xs text-zinc-500">{t.latency}</div>
            <div className="text-xs text-zinc-500">
              min <span className="font-semibold text-foreground">{Math.round(usage.speechEndToFirstResponseMsMin)}ms</span>
            </div>
            <div className="text-xs text-zinc-500">
              avg <span className="font-semibold text-foreground">{Math.round(usage.speechEndToFirstResponseMsAvg)}ms</span>
            </div>
            <div className="text-xs text-zinc-500">
              p90 <span className="font-semibold text-foreground">{Math.round(usage.speechEndToFirstResponseMsP90)}ms</span>
            </div>
            <div className="text-xs text-zinc-500">n {usage.speechEndToFirstResponseCount}</div>
          </div>

          <div className="flex items-baseline gap-2 border-l border-border pl-4">
            <div className="text-xs text-zinc-500">{t.inputTokens}</div>
            <div className="text-xs text-zinc-500">
              {t.text} {usage.inputTextTokens} ({t.cached} {usage.inputTextCachedTokens}) / {t.audio} {usage.inputAudioTokens} ({t.cached} {usage.inputAudioCachedTokens})
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-xs text-zinc-500">{t.outputTokens}</div>
            <div className="text-xs text-zinc-500">
              {t.text} {usage.outputTextTokens} / {t.audio} {usage.outputAudioTokens}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
