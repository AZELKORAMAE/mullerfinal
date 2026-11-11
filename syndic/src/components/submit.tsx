"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { I18nText } from "@/components/i18n";
export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending}>
      {pending ? <I18nText text="En cours…" /> : children}
    </Button>
  );
}
