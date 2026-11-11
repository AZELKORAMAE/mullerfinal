import { I18nText } from "@/components/i18n";
export default function Loading() {
  return (
    <div className="content" role="status">
      <I18nText text="Chargement de votre espace…" />
    </div>
  );
}
