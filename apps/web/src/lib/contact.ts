// ============================================================
// Formulaire de contact (/contact/) : composition du message et contrôle des champs obligatoires, en fonctions pures
// (tests : tests/contact.test.ts). Le formulaire n'envoie rien lui-même : il ouvre la messagerie de l'utilisateur
// (lien mailto) avec le message prérempli, adressé à SFG Développement. Aucune donnée n'est collectée par le site.
// ============================================================

import { INSECABLE } from './format';

export const CONTACT_EMAIL = 'contact@sfgdeveloppement.fr';

/** Sujets du formulaire : chacun est repris tel quel dans l'objet du message (« [financementOPCO] sujet »). */
export const SUJETS = [
  'Estimer ou monter un dossier de financement OPCO',
  'Organiser une formation pour mes salariés',
  'Question sur mes obligations (contributions, entretiens)',
  'Signaler une erreur sur le site',
  'Autre demande',
] as const;

export type Sujet = (typeof SUJETS)[number];

/**
 * Libellé affiché de chaque sujet dans la liste « Sujet » : court, pour se lire sans coupure dans le champ à 320 px
 * (153 px au plus en Inter 16 px ; le champ en montre 162 avec une barre de défilement classique, le sujet le plus long
 * en faisait 419). Il ne sert qu'à l'affichage : la valeur choisie, et donc l'objet du message, reste le sujet complet.
 */
export const LIBELLES_DES_SUJETS: Readonly<Record<Sujet, string>> = {
  'Estimer ou monter un dossier de financement OPCO': 'Financement OPCO',
  'Organiser une formation pour mes salariés': 'Former mes salariés',
  'Question sur mes obligations (contributions, entretiens)': 'Mes obligations',
  'Signaler une erreur sur le site': 'Signaler une erreur',
  'Autre demande': 'Autre demande',
};

export interface MessageContact {
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
  sujet: string;
  message: string;
}

/**
 * Lien mailto du message : objet « [financementOPCO] sujet », corps « Nom : … », « Entreprise : … » et « Téléphone : … »
 * seulement s'ils sont renseignés, « Email : … », une ligne vide puis le message. Les valeurs sont reprises telles que
 * saisies.
 */
export function lienMailto(m: MessageContact): string {
  const corps = [
    `Nom : ${m.nom}`,
    m.entreprise ? `Entreprise : ${m.entreprise}` : null,
    `Email : ${m.email}`,
    m.telephone ? `Téléphone : ${m.telephone}` : null,
    '',
    m.message,
  ]
    .filter((ligne) => ligne !== null)
    .join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[financementOPCO] ${m.sujet}`)}&body=${encodeURIComponent(corps)}`;
}

export type ChampObligatoire = 'nom' | 'email' | 'message';

/** Ordre des champs obligatoires dans le formulaire : le focus va à la première erreur. */
export const CHAMPS_OBLIGATOIRES: readonly ChampObligatoire[] = ['nom', 'email', 'message'];

/**
 * Erreurs des champs obligatoires : un champ vide (ou fait d'espaces) est refusé, comme une adresse e-mail que le
 * navigateur juge mal formée (`emailMalForme`, contrôle natif du champ `type="email"`). Le message dit quoi écrire.
 */
export function erreursDuContact(
  m: Pick<MessageContact, ChampObligatoire>,
  emailMalForme: boolean,
): Partial<Record<ChampObligatoire, string>> {
  const erreurs: Partial<Record<ChampObligatoire, string>> = {};
  if (!m.nom.trim()) erreurs.nom = 'Indiquez votre nom.';
  if (!m.email.trim()) erreurs.email = 'Indiquez votre adresse e-mail.';
  else if (emailMalForme) erreurs.email = `Vérifiez l'adresse e-mail${INSECABLE}: elle s'écrit sous la forme nom@entreprise.fr.`;
  if (!m.message.trim()) erreurs.message = 'Écrivez votre message.';
  return erreurs;
}
