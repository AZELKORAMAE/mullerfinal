"use client";
import type { ComponentProps } from "react";
import { translate, useLocale } from "./i18n";
export function LocalizedInput(props: ComponentProps<"input">) {
  const locale = useLocale();
  return (
    <input
      {...props}
      placeholder={
        props.placeholder ? translate(props.placeholder, locale) : undefined
      }
      aria-label={
        props["aria-label"] ? translate(props["aria-label"], locale) : undefined
      }
    />
  );
}
