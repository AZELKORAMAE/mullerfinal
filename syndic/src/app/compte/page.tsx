import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { signedIn } from "@/lib/access";
import { AppFrame } from "@/components/app-frame";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
import { saveNickname } from "./save";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { user } = await signedIn();
  return (
    <AppFrame>
      <main className="container section">
        <h1>
          <I18nText text="Mon profil" />
        </h1>
        <Notice message={(await searchParams).message} />
        <section className="card">
          <form action={saveNickname} className="form">
            <label>
              <I18nText text="Pseudo" />
              <LocalizedInput
                name="nickname"
                defaultValue={
                  typeof user.user_metadata?.nickname === "string"
                    ? user.user_metadata.nickname
                    : ""
                }
                required
                minLength={2}
                maxLength={40}
              />
            </label>
            <p>{user.email}</p>
            <Submit>
              <I18nText text="Enregistrer" />
            </Submit>
          </form>
        </section>
      </main>
    </AppFrame>
  );
}
