'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
// Module sans directive client : le formulaire n'embarque pas les champs du simulateur (forms.tsx).
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { CHAMPS_OBLIGATOIRES, CONTACT_EMAIL, LIBELLES_DES_SUJETS, SUJETS, erreursDuContact, lienMailto } from '@/lib/contact';
import type { ChampObligatoire, MessageContact } from '@/lib/contact';

/**
 * Champ du formulaire : le dessin des champs du simulateur (components/ui/forms.tsx) : 48 px, rayon 12 px, contour
 * filet-fort (3,54:1), orange foncé au focus en plus de l'anneau du site, rouge quand la saisie est refusée. Transition
 * sans `outline-color` : l'anneau de focus apparaît d'emblée (DESIGN.md, section 7).
 */
const CHAMP =
  'mt-2 block min-h-12 w-full min-w-0 rounded-champ border border-filet-fort bg-white px-4 py-2.5 text-base text-texte transition-[color,background-color,border-color] hover:border-texte-doux focus-visible:border-orange-deep aria-invalid:border-rouge';

/** Zone de l'erreur d'un champ : elle existe toujours, pour que l'erreur soit annoncée quand elle apparaît. */
function Erreur({ id, message }: { id: string; message: string | undefined }) {
  return (
    <div aria-live="polite" className="[&:not(:empty)]:mt-2">
      {message ? (
        <p id={id} className="flex items-start gap-1.5 text-sm leading-snug font-medium text-rouge">
          <Icon name="alerte" className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="sr-only">Erreur : </span>
            {message}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Formulaire de contact. Il n'envoie rien lui-même : il ouvre la messagerie de l'utilisateur avec un message prérempli
 * adressé à SFG Développement (lien mailto, `lib/contact.ts`) ; aucune donnée n'est collectée par le site. Les champs
 * obligatoires (nom, adresse e-mail, message) sont contrôlés avant : erreur affichée quand on quitte le champ, ou pour
 * tous à l'envoi, entre le libellé et le champ (aria-invalid, aria-describedby), focus sur le premier champ à corriger.
 */
export function ContactForm() {
  const [valeurs, setValeurs] = useState<MessageContact>({
    nom: '',
    entreprise: '',
    email: '',
    telephone: '',
    sujet: SUJETS[0],
    message: '',
  });
  const [quittes, setQuittes] = useState<ReadonlySet<ChampObligatoire>>(new Set());
  const [envoiTente, setEnvoiTente] = useState(false);
  const [emailMalForme, setEmailMalForme] = useState(false);
  const [sent, setSent] = useState(false);
  const champNom = useRef<HTMLInputElement>(null);
  const champEmail = useRef<HTMLInputElement>(null);
  const champMessage = useRef<HTMLTextAreaElement>(null);

  const erreurs = erreursDuContact(valeurs, emailMalForme);
  const erreur = (champ: ChampObligatoire) => (envoiTente || quittes.has(champ) ? erreurs[champ] : undefined);

  const changer =
    (champ: keyof MessageContact) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const valeur = e.target.value;
      setValeurs((v) => ({ ...v, [champ]: valeur }));
      // Le contrôle de forme est celui du navigateur pour un champ type="email" (le même qu'avant ce formulaire).
      if (champ === 'email' && e.target instanceof HTMLInputElement) setEmailMalForme(e.target.validity.typeMismatch);
    };
  const quitter = (champ: ChampObligatoire) => () => setQuittes((q) => new Set(q).add(champ));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnvoiTente(true);
    const premiere = CHAMPS_OBLIGATOIRES.find((c) => erreurs[c]);
    if (premiere) {
      ({ nom: champNom, email: champEmail, message: champMessage })[premiere].current?.focus();
      return;
    }
    // Même effet que l'affectation de `location.href` (ouverture de la messagerie), écrit en appel de méthode.
    window.location.assign(lienMailto(valeurs));
    setSent(true);
  };

  /** Attributs d'accessibilité d'un champ obligatoire selon son erreur affichée. */
  const etat = (champ: ChampObligatoire) => {
    const message = erreur(champ);
    return {
      'aria-invalid': message ? true : undefined,
      'aria-describedby': message ? `contact-${champ}-erreur` : undefined,
    } as const;
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Écrire à SFG Développement">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel label="Votre nom" required htmlFor="contact-nom" />
          <Erreur id="contact-nom-erreur" message={erreur('nom')} />
          <input
            ref={champNom}
            id="contact-nom"
            type="text"
            required
            autoComplete="name"
            value={valeurs.nom}
            onChange={changer('nom')}
            onBlur={quitter('nom')}
            placeholder="Ex&nbsp;: Marie Dupont"
            className={CHAMP}
            {...etat('nom')}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel label="Entreprise" facultatif htmlFor="contact-entreprise" />
          <input
            id="contact-entreprise"
            type="text"
            autoComplete="organization"
            value={valeurs.entreprise}
            onChange={changer('entreprise')}
            placeholder="Ex&nbsp;: Boulangerie Dupont"
            className={CHAMP}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel label="Votre adresse e-mail" required htmlFor="contact-email" />
          <Erreur id="contact-email-erreur" message={erreur('email')} />
          <input
            ref={champEmail}
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={valeurs.email}
            onChange={changer('email')}
            onBlur={quitter('email')}
            placeholder="vous@entreprise.fr"
            className={CHAMP}
            {...etat('email')}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel label="Téléphone" facultatif htmlFor="contact-tel" />
          <input
            id="contact-tel"
            type="tel"
            autoComplete="tel"
            value={valeurs.telephone}
            onChange={changer('telephone')}
            placeholder="06 12 34 56 78"
            className={CHAMP}
          />
        </div>
      </div>

      <div className="mt-6 min-w-0">
        <FieldLabel label="Sujet" required htmlFor="contact-sujet" />
        <div className="relative">
          <select
            id="contact-sujet"
            value={valeurs.sujet}
            onChange={changer('sujet')}
            className={cx(CHAMP, 'cursor-pointer appearance-none pr-11')}
          >
            {/* Libellé court, lisible sans coupure à 320 px ; la valeur, reprise dans l'objet du message, reste le sujet
                complet (lib/contact.ts). */}
            {SUJETS.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_DES_SUJETS[s]}
              </option>
            ))}
          </select>
          <Icon
            name="chevron"
            className="pointer-events-none absolute top-[calc(50%+0.25rem)] right-4 size-4 -translate-y-1/2 rotate-90 text-texte-doux"
          />
        </div>
      </div>

      <div className="mt-6 min-w-0">
        <FieldLabel label="Votre message" required htmlFor="contact-message" />
        <Erreur id="contact-message-erreur" message={erreur('message')} />
        <textarea
          ref={champMessage}
          id="contact-message"
          required
          rows={6}
          value={valeurs.message}
          onChange={changer('message')}
          onBlur={quitter('message')}
          placeholder="Décrivez votre projet&nbsp;: formation envisagée, nombre de salariés concernés, échéance…"
          className={cx(CHAMP, 'min-h-36 resize-y leading-relaxed')}
          {...etat('message')}
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Button type="submit" size="lg" icone="courriel" pleineLargeur="mobile" className="shrink-0 sm:whitespace-nowrap">
          Ouvrir ma messagerie
        </Button>
        <p className="min-w-0 text-sm leading-relaxed text-texte-discret">
          Votre messagerie s&apos;ouvre avec le message prérempli, adressé à{' '}
          <span className="break-words">{CONTACT_EMAIL}</span>.
        </p>
      </div>

      <div role="status" className="[&:not(:empty)]:mt-5">
        {sent && (
          <Callout tone="confirmation">
            Votre messagerie s&apos;est ouverte avec le message prérempli&nbsp;: il ne reste qu&apos;à cliquer sur
            «&nbsp;Envoyer&nbsp;». Si rien ne s&apos;est ouvert, écrivez directement à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="lien break-words">
              {CONTACT_EMAIL}
            </a>
            .
          </Callout>
        )}
      </div>
    </form>
  );
}
