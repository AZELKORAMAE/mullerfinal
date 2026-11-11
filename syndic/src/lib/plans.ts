export const contact = {
  email: "aliadigital.info@gmail.com",
  phone: "0693700583",
  phoneIntl: "+212693700583",
  whatsapp: "https://wa.me/212693700583",
};
export const STANDARD_MONTHLY_CENTS = 3000;
export const plans = [
  {
    id: "essai",
    name: "Essai gratuit",
    price: "0 DH",
    period: "pendant 1 mois",
    features: [
      "Toutes les fonctionnalités",
      "Résidences et appartements illimités",
      "Sans engagement",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: "30 DH",
    period: "par mois",
    features: [
      "Invitations des habitants par lien",
      "Cotisations, messages et réunions",
      "Suivi des incidents",
    ],
  },
  {
    id: "entreprise",
    name: "Entreprise",
    price: "Sur devis",
    period: "Contactez-nous",
    features: [
      "Plusieurs résidences et gestionnaires",
      "Accompagnement personnalisé",
      "Tarif adapté à votre parc",
    ],
  },
] as const;
export const planLabels: Record<string, string> = {
  essai: "Essai gratuit",
  standard: "Standard",
  entreprise: "Entreprise",
  essentiel: "Essentiel",
  pro: "Pro",
  business: "Business",
};
export function daysLeft(endsAt: string) {
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
}
