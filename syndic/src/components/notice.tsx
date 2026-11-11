import { I18nText } from "@/components/i18n";
export function Notice({
  message,
  error,
}: {
  message?: string;
  error?: boolean;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="notice">
          <I18nText text="Les données sont temporairement indisponibles. Vérifiez la connexion et l’installation de la migration SyndiConnect." />
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          <I18nText text={message} />
        </div>
      )}
    </>
  );
}
