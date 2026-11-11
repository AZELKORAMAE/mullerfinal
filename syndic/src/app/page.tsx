import { I18nText } from "@/components/i18n";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Wallet,
  MessageCircle,
  Users,
  ShieldCheck,
  CalendarDays,
  ChevronRight,
  Check,
  Mail,
  Phone,
} from "lucide-react";
import { plans, contact } from "@/lib/plans";
import { Brand } from "@/components/brand";
import { currentLocale } from "@/lib/locale-server";
export default async function Home() {
  const locale = await currentLocale();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#experience">
            <I18nText text="L’expérience" />
          </a>
          <a href="#comment">
            <I18nText text="Comment ça marche" />
          </a>
          <a href="#tarifs">
            <I18nText text="Tarifs" />
          </a>
          <Link href="/inscription">
            <I18nText text="Créer un compte" />
          </Link>
          <Link href="/connexion" className="button primary">
            <I18nText text="Mon espace" />
            <ArrowUpRight size={17} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <Image
            src="/images/residence-hero.png"
            alt={locale === "ar" ? "إقامة عصرية وحديقة بالأشجار" : locale === "en" ? "Contemporary residence and landscaped garden" : "Résidence contemporaine et jardin arboré"}
            fill
            priority
            sizes="100vw"
          />
          <div className="landing-shade" />
          <div className="hero-copy">
            <span className="landing-tag">
              <I18nText text="La résidence, côté humain." />
            </span>
            <h1>
              <I18nText text="Bien vivre ensemble." />
              <br />
              <em>
                <I18nText text="Tout simplement." />
              </em>
            </h1>
            <p>
              <I18nText text="Les comptes sont clairs. Les échanges sont simples. Toute votre résidence se retrouve au même endroit." />
            </p>
            <div className="actions">
              <Link href="/connexion" className="button light">
                <I18nText text="Accéder à ma résidence" />
                <ArrowUpRight size={19} />
              </Link>
              <a href="#experience" className="hero-discover">
                <I18nText text="Découvrir" />
                <ChevronRight size={18} />
              </a>
            </div>
            <div className="hero-chips">
              <span>
                <ShieldCheck size={16} />
                <I18nText text="Accès privés" />
              </span>
              <span>
                <Users size={16} />
                <I18nText text="Syndics et habitants" />
              </span>
            </div>
          </div>
          <div className="hero-floating">
            <span className="floating-icon">
              <Wallet size={24} />
            </span>
            <div>
              <strong>
                <I18nText text="Moins de questions." />
              </strong>
              <span>
                <I18nText text="Plus de transparence." />
              </span>
            </div>
          </div>
        </section>
        <section className="landing-intro" id="experience">
          <span className="eyebrow">
            <I18nText text="Votre quotidien, en mieux" />
          </span>
          <h2>
            <I18nText text="Une résidence connectée." />
            <br />
            <I18nText text="Une gestion apaisée." />
          </h2>
          <div className="landing-features">
            {[
              [
                Wallet,
                "Qui doit quoi ?",
                "Retrouvez les dépenses partagées, les règlements et le montant restant à payer.",
              ],
              [
                MessageCircle,
                "On se parle.",
                "Échangez avec votre syndic, recevez les annonces et suivez vos demandes.",
              ],
              [
                CalendarDays,
                "Rien ne vous échappe.",
                "Réunions, activités et rappels : gardez le fil de la vie de votre résidence.",
              ],
            ].map(([Icon, title, description]) => {
              const I = Icon as typeof Wallet;
              return (
                <article key={String(title)}>
                  <I size={28} />
                  <h3>
                    <I18nText text={String(String(title))} />
                  </h3>
                  <p>
                    <I18nText text={String(String(description))} />
                  </p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="landing-steps" id="comment">
          <div>
            <span className="eyebrow">
              <I18nText text="Bienvenue chez vous" />
            </span>
            <h2>
              <I18nText text="Un lien." />
              <br />
              <I18nText text="Et vous êtes chez vous." />
            </h2>
          </div>
          <div className="steps-list">
            <article>
              <b>01</b>
              <div>
                <h3>
                  <I18nText text="Votre syndic vous invite" />
                </h3>
                <p>
                  <I18nText text="Recevez le lien privé de votre appartement." />
                </p>
              </div>
            </article>
            <article>
              <b>02</b>
              <div>
                <h3>
                  <I18nText text="Vous créez votre profil" />
                </h3>
                <p>
                  <I18nText text="Choisissez votre pseudo et vos identifiants." />
                </p>
              </div>
            </article>
            <article>
              <b>03</b>
              <div>
                <h3>
                  <I18nText text="Votre résidence prend vie" />
                </h3>
                <p>
                  <I18nText text="Consultez vos comptes et échangez avec votre syndic." />
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="landing-pricing" id="tarifs">
          <span className="eyebrow">
            <I18nText text="Tarifs" />
          </span>
          <h2>
            <I18nText text="Un plan pour chaque syndic." />
          </h2>
          <p>
            <I18nText text="Commencez gratuitement pendant un mois. Le compte des habitants est toujours gratuit." />
          </p>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={plan.id === "standard" ? "featured" : ""}
              >
                <h3>
                  <I18nText text={plan.name} />
                </h3>
                <div className="price">
                  <strong>
                    <I18nText text={plan.price} />
                  </strong>
                  <span>
                    <I18nText text={plan.period} />
                  </span>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      <I18nText text={feature} />
                    </li>
                  ))}
                </ul>
                {plan.id === "entreprise" ? (
                  <a href="#contact" className="button outline">
                    <I18nText text="Contacter l’entreprise" />
                  </a>
                ) : (
                  <Link
                    href="/inscription?syndic=1"
                    className="button primary"
                  >
                    <I18nText
                      text={
                        plan.id === "essai"
                          ? "Commencer l’essai gratuit"
                          : "Choisir Standard"
                      }
                    />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className="landing-contact" id="contact">
          <div>
            <span className="eyebrow">
              <I18nText text="Contact" />
            </span>
            <h2>
              <I18nText text="Parlons de votre résidence." />
            </h2>
            <p>
              <I18nText text="Une question, une offre Entreprise ? Notre équipe vous répond." />
            </p>
          </div>
          <div className="contact-links">
            <a href={`mailto:${contact.email}`}>
              <Mail size={20} />
              {contact.email}
            </a>
            <a href={`tel:${contact.phoneIntl}`}>
              <Phone size={20} />
              {contact.phone}
            </a>
            <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={20} />
              <I18nText text="WhatsApp" />
            </a>
          </div>
        </section>
        <section className="landing-cta">
          <h2>
            <I18nText text="Votre résidence." />
            <br />
            <I18nText text="Votre nouvel espace commun." />
          </h2>
          <div className="actions">
            <Link href="/inscription" className="button light">
              <I18nText text="Créer un compte" />
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/connexion" className="button light">
              <I18nText text="Se connecter" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>
          <I18nText text="Votre copropriété, en toute transparence." />
        </span>
        <Link href="/connexion">
          <I18nText text="Connexion" />
        </Link>
      </footer>
    </div>
  );
}
