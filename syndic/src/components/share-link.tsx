"use client";
import { I18nText } from "@/components/i18n";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="button outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <I18nText text={String(" ")} />
        <I18nText
          text={String(copied ? "Lien copié" : "Copier l’invitation")}
        />
      </button>
      <a href={url} className="small text-link" style={{ marginLeft: 10 }}>
        <I18nText text="Ouvrir" />
      </a>
    </div>
  );
}
