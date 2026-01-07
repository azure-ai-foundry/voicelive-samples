"use client";

import type { AssetPosition } from "@/lib/trade/types";
import { useFlashOnChange } from "@/lib/hooks";
import { memo } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  assets: AssetPosition[];
};

function AssetCard({ p }: { p: AssetPosition }) {
  const flash = useFlashOnChange(p.quantity);
  const { t } = useLanguage();
  const h = "flash-3s";

  return (
    <div
      className={`rounded-md border border-border bg-background p-3 text-sm text-foreground${
        flash ? " " + h : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">
          {p.productType} {p.symbol}
        </div>
        <div className="text-xs text-zinc-500">{p.currency}</div>
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {t.quantity} {p.quantity} · {t.avgCost} {p.avgCost}
      </div>
    </div>
  );
}

export const AssetsPanel = memo(function AssetsPanel({ assets }: Props) {
  const { t } = useLanguage();
  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t.assets}</h2>
        <div className="text-xs text-zinc-500">{assets.length} {t.items}</div>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto">
        {assets.length === 0 ? <div className="text-sm text-zinc-500">{t.noAssets}</div> : null}

        {assets.map((p) => (
          <AssetCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
});
