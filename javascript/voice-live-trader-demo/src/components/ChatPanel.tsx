"use client";

import { useEffect, useRef, memo } from "react";
import { useLanguage } from "@/lib/i18n";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts?: string; // e.g. 11:18:44 AM
};

type Props = {
  messages: ChatMessage[];
  error?: string | null;
  fill?: boolean;
};

export const ChatPanel = memo(function ChatPanel({ messages, error, fill }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function roleLabel(role: ChatMessage["role"]) {
    if (role === "user") return t.user;
    if (role === "assistant") return t.assistant;
    return t.system;
  }

  function rolePillClass(role: ChatMessage["role"]) {
    if (role === "assistant") return "bg-emerald-500/20 text-emerald-400";
    if (role === "user") return "bg-sky-500/20 text-sky-400";
    return "bg-muted text-muted-foreground";
  }

  return (
    <section
      className={`rounded-lg border border-border bg-card p-3${
        fill ? " flex h-full flex-col" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.chatHistory}</h2>
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
      </div>

      <div
        className={`mt-2 overflow-auto rounded-md border border-border bg-background p-2${
          fill ? " min-h-0 flex-1" : " h-[220px]"
        }`}
      >
        {messages.length === 0 ? <div className="text-sm text-zinc-500">{t.noTrades}</div> : null}

        <div className="space-y-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-2 rounded-sm px-2 py-1 text-sm text-foreground"
            >
              <div className="shrink-0 text-[11px] text-zinc-500">{m.ts ? `[${m.ts}]` : ""}</div>
              <div className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${rolePillClass(m.role)}`}
              >
                {roleLabel(m.role)}
              </div>
              <div className="min-w-0 whitespace-pre-wrap text-sm leading-snug">{m.text}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </section>
  );
});
