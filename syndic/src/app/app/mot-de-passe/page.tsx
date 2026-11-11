import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { updatePassword } from "@/app/actions";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  return (
    <section className="card auth-card">
      <h1>
        <I18nText text="Nouveau mot de passe" />
      </h1>
      <Notice message={(await searchParams).message} />
      <form action={updatePassword} className="form">
        <label>
          <I18nText text="Mot de passe" />
          <LocalizedInput
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <Submit>
          <I18nText text="Enregistrer" />
        </Submit>
      </form>
    </section>
  );
}
