"use client";
import { useState } from "react";
import { I18nText } from "@/components/i18n";
import { LocalizedInput } from "@/components/i18n-input";
import { Submit } from "@/components/submit";
import { signUp } from "@/app/actions";
import { plans } from "@/lib/plans";
export function SignUpForm({
  syndic: initialSyndic,
  next,
}: {
  syndic: boolean;
  next?: string;
}) {
  const [syndic, setSyndic] = useState(initialSyndic);
  return (
    <form action={signUp} className="form">
      {next && <input type="hidden" name="next" value={next} />}
      <label>
        <I18nText text="Prénom" />
        <LocalizedInput
          name="first_name"
          autoComplete="given-name"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        <I18nText text="Nom" />
        <LocalizedInput
          name="last_name"
          autoComplete="family-name"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        <I18nText text="Téléphone" />
        <LocalizedInput
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={24}
        />
      </label>
      <label>
        <I18nText text="Adresse e-mail" />
        <LocalizedInput
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        <I18nText text="Mot de passe" />
        <LocalizedInput
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
        <span className="form-note">
          <I18nText text="12 caractères minimum" />
        </span>
      </label>
      <label>
        <I18nText text="Confirmer le mot de passe" />
        <LocalizedInput
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      {!next && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="syndic"
            checked={syndic}
            onChange={(event) => setSyndic(event.target.checked)}
          />
          <I18nText text="Je suis syndic (gestionnaire de résidence)" />
        </label>
      )}
      {syndic && !next && (
        <>
          <p className="form-note">
            <I18nText text="Les comptes syndic sont validés par notre équipe avant activation. Vous commencez par un essai gratuit d’un mois." />
          </p>
          <label>
            <I18nText text="Nom du syndic / de la société" />
            <LocalizedInput
              name="organization"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <fieldset className="plan-choice">
            <legend>
              <I18nText text="Plan souhaité" />
            </legend>
            {plans.map((plan, index) => (
              <label key={plan.id}>
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  defaultChecked={index === 0}
                />
                <span>
                  <I18nText text={plan.name} />
                  {" · "}
                  <I18nText text={plan.price} />
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      <Submit>
        <I18nText text="Créer mon compte" />
      </Submit>
    </form>
  );
}
