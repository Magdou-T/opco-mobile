'use client';

import { useState } from 'react';

const CONTACT_EMAIL = 'contact@sfgdeveloppement.fr';

const SUJETS = [
  'Estimer ou monter un dossier de financement OPCO',
  'Organiser une formation pour mes salariés',
  'Question sur mes obligations (contributions, entretiens)',
  'Signaler une erreur sur le site',
  'Autre demande',
];

export function ContactForm() {
  const [nom, setNom] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [sujet, setSujet] = useState(SUJETS[0]);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `Nom : ${nom}`,
      entreprise ? `Entreprise : ${entreprise}` : null,
      `Email : ${email}`,
      telephone ? `Téléphone : ${telephone}` : null,
      '',
      message,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      `[financementOPCO] ${sujet}`,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = url;
    setSent(true);
  };

  const inputClass =
    'w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-ink bg-white p-6 shadow-[5px_5px_0_0_var(--paper-deep)] md:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-nom" className="block text-sm font-medium text-ink-soft">
            Votre nom <span className="text-alert">*</span>
          </label>
          <input
            id="contact-nom"
            type="text"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Marie Dupont"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-entreprise" className="block text-sm font-medium text-ink-soft">
            Entreprise
          </label>
          <input
            id="contact-entreprise"
            type="text"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            placeholder="Ex : Boulangerie Dupont"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className="block text-sm font-medium text-ink-soft">
            Votre email <span className="text-alert">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-tel" className="block text-sm font-medium text-ink-soft">
            Téléphone
          </label>
          <input
            id="contact-tel"
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <label htmlFor="contact-sujet" className="block text-sm font-medium text-ink-soft">
          Sujet <span className="text-alert">*</span>
        </label>
        <select
          id="contact-sujet"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          className={inputClass}
        >
          {SUJETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 space-y-1.5">
        <label htmlFor="contact-message" className="block text-sm font-medium text-ink-soft">
          Votre message <span className="text-alert">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez votre projet : formation envisagée, nombre de salariés concernés, échéance..."
          className={inputClass}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="rounded bg-cobalt px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy"
        >
          Envoyer à {CONTACT_EMAIL}
        </button>
        <p className="text-xs text-ink-faint">
          L&apos;envoi ouvre votre messagerie avec le message prérempli.
        </p>
      </div>

      {sent && (
        <div className="mt-4 rounded border border-valid/40 bg-valid-soft px-4 py-3 text-sm text-valid">
          Votre messagerie s&apos;est ouverte avec le message prérempli : il ne reste
          qu&apos;à cliquer sur « Envoyer ». Si rien ne s&apos;est ouvert, écrivez directement
          à {CONTACT_EMAIL}.
        </div>
      )}
    </form>
  );
}
