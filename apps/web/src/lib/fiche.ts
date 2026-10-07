// ============================================================
// Fiches OPCO (/opco/[slug]/) et liste des OPCO (/opco/) : logique de présentation, en fonctions pures (tests :
// tests/fiche.test.ts). Aucun montant n'est calculé ici : chaque valeur vient des données (@opco/core) et n'est mise en
// forme qu'à l'affichage (formatEuro). Voir apps/web/DESIGN.md, section 16.
// ============================================================

import { ALERTE_OPCO_LABELS } from '@opco/core';
import type {
  AlerteOpco,
  Confidence,
  CoutHoraireSeuil,
  DispositifComplementaire,
  ModeSeuils,
  OpcoData,
  PlafondTaille,
  TypeAlerteOpco,
} from '@opco/core';
import { INSECABLE, UNITE_DISPOSITIF_LABELS, formatEuro, premierePhrase, texteFr } from './format';

/** Nombre à la française (« 1 200 », « 9,15 ») : milliers séparés par une espace fine insécable (Intl, fr-FR). */
const nombreFr = (n: number): string => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

/** Première lettre en majuscule (« déposer … » devient « Déposer … ») ; un texte qui commence par un signe reste tel quel. */
const majuscule = (s: string): string => s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);

// --- Découpe des textes des données --------------------------------------------------------------------------------

/**
 * Découpe un texte à chaque `separateur` placé au premier niveau : jamais à l'intérieur d'un extrait cité « … » (mot pour
 * mot) ni d'une parenthèse (une adresse ou une précision entre parenthèses reste avec son élément). Les morceaux sont
 * rendus sans les espaces de bord ; un morceau vide est retiré.
 */
function decouper(texte: string, separateur: RegExp): string[] {
  const motif = new RegExp(separateur.source, `y${separateur.unicode ? 'u' : ''}`);
  const morceaux: string[] = [];
  let citation = 0;
  let parenthese = 0;
  let debut = 0;
  let i = 0;
  while (i < texte.length) {
    if (citation === 0 && parenthese === 0) {
      motif.lastIndex = i;
      const m = motif.exec(texte);
      if (m && m[0].length > 0) {
        morceaux.push(texte.slice(debut, i));
        i += m[0].length;
        debut = i;
        continue;
      }
    }
    const c = texte[i];
    if (c === '«') citation++;
    else if (c === '»' && citation > 0) citation--;
    else if (citation === 0 && c === '(') parenthese++;
    else if (citation === 0 && c === ')' && parenthese > 0) parenthese--;
    i++;
  }
  morceaux.push(texte.slice(debut));
  return morceaux.map((m) => m.trim()).filter((m) => m !== '');
}

/**
 * Séparateur des textes composés de plusieurs éléments (« A | B | C », seule forme des 11 OPCO) : une barre verticale
 * entre deux espaces, le début ou la fin du texte en tenant lieu. Les espaces ne font pas partie du séparateur : deux
 * séparateurs de suite (« A | | B ») partagent la leur et ne laissent qu'un élément vide, retiré. Une barre collée à un
 * caractère (« A|B », adresse web) ne sépare rien.
 */
const SEPARATEUR_ELEMENTS = /(?<=^|\s)\|(?=\s|$)/;

const LIBELLES_VAE: Readonly<Record<string, string>> = {
  vae_simple: 'VAE sans action de formation',
  vae_mixte: 'VAE avec action de formation',
};

/**
 * Éléments d'un texte des données, un par ligne. Un texte composé de plusieurs éléments séparés par « | » entre deux
 * espaces (`specificites`, `points_cles_maximisation`) est découpé, jamais dans un extrait cité ni dans une parenthèse ;
 * une barre collée à un caractère reste dans le texte, aucun élément vide n'est rendu. Un champ libre (`FreeText`) peut
 * aussi être un objet { description, note, … } (OPCO EP, OPCO Santé) ou { vae_simple: { value, note }, vae_mixte:
 * { value, note } } (VAE d'Uniformation) : chacun de ses textes devient un élément, ses autres champs (nombres, adresse
 * de la source) sont ignorés. Seules des chaînes sont rendues : jamais « [object Object] ».
 */
export function elementsDeTexte(valeur: unknown): string[] {
  if (typeof valeur === 'string') return decouper(valeur, SEPARATEUR_ELEMENTS);
  if (Array.isArray(valeur)) return valeur.flatMap(elementsDeTexte);
  if (valeur == null || typeof valeur !== 'object') return [];
  const champs = valeur as Record<string, unknown>;
  const elements: string[] = [];
  for (const cle of ['description', 'note']) {
    const texte = champs[cle];
    if (typeof texte === 'string') elements.push(...decouper(texte, SEPARATEUR_ELEMENTS));
  }
  for (const [cle, libelle] of Object.entries(LIBELLES_VAE)) {
    const poste = champs[cle];
    if (poste == null || typeof poste !== 'object' || Array.isArray(poste)) continue;
    const { value: montant, note } = poste as { value?: unknown; note?: unknown };
    const intitule =
      typeof montant === 'number' && Number.isFinite(montant)
        ? `${libelle} : jusqu'à ${formatEuro(montant)}.`
        : `${libelle}.`;
    elements.push(typeof note === 'string' && note.trim() ? `${intitule} ${note.trim()}` : intitule);
  }
  return elements;
}

/** Adresse de la source d'un champ libre donné en objet ({ description, source_url }) ; null pour un texte simple. */
export function sourceDuTexte(valeur: unknown): string | null {
  if (valeur == null || typeof valeur !== 'object' || Array.isArray(valeur)) return null;
  const url = (valeur as Record<string, unknown>).source_url;
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}

/** Étapes d'une démarche : coupées à chaque « ; » et à chaque « puis » (« Consulter …, puis déposer … »). */
const SEPARATEUR_ETAPES = /\s*;\s+|,?\s+puis\s+/;

/**
 * Étapes d'une démarche (`demarches` d'un dispositif), pour une liste numérotée : le texte est coupé à chaque « ; » et à
 * chaque « puis », jamais dans un extrait cité ni dans une parenthèse. Avec plusieurs étapes, chacune commence par une
 * majuscule et perd son point final (« etc. » garde le sien). Une démarche d'une seule étape est rendue telle quelle.
 */
export function etapesDeDemarche(texte: string): string[] {
  const etapes = decouper(texte, SEPARATEUR_ETAPES);
  if (etapes.length <= 1) return texte.trim() ? [texte.trim()] : [];
  return etapes.map((e) => majuscule(e.replace(/(?<!\betc)\.$/, '')));
}

// --- Barème poste par poste ----------------------------------------------------------------------------------------

/** Postes du barème communs à l'OPCO et à ses variantes de branche (une variante n'en renseigne que certains). */
export type PostesBareme = Partial<
  Pick<
    OpcoData,
    | 'cout_horaire_inter'
    | 'cout_horaire_intra'
    | 'cout_horaire_metier'
    | 'prise_en_charge_salaires'
    | 'frais_transport'
    | 'frais_hebergement'
    | 'frais_restauration'
    | 'frais_annexes_pourcentage'
    | 'budget_annuel_max'
  >
>;

/** Unité d'un poste : euros par heure, jour, nuit, repas ou an, ou pourcentage des coûts pédagogiques. */
export type UnitePoste = '€/h' | '€/jour' | '€/nuit' | '€/repas' | '€/an' | '%';

/**
 * Montant d'un poste avec son unité : « 25 €/h », « 14,50 €/h », « 7 500 €/an » (`formatEuro` : un montant entier sans
 * décimales, tout autre avec deux), « 8 % ». Espace insécable avant « € » et « % ».
 */
export function montantAvecUnite(valeur: number, unite: UnitePoste): string {
  if (unite === '%') return `${nombreFr(valeur)}${INSECABLE}%`;
  return `${formatEuro(valeur)}${unite.slice(1)}`;
}

/** Deux présentations du barème : tableau à partir de 768 px, une carte par poste en dessous. */
export type Affichage = 'tableau' | 'cartes';

/**
 * Raison de l'absence de montant d'un poste :
 * - non_publie : l'OPCO ne publie pas de barème national pour ce poste (fiabilité autre qu'« exact ») ;
 * - renvoi : pas de montant unique (frais réels, forfait conditionnel, pas de prise en charge), la précision donne la
 *   règle publiée ;
 * - sans_montant_fixe : ni montant ni précision (aucun cas dans les données actuelles) ;
 * - incluse : salaires compris dans le plafond horaire (mode `inclus_plafond_horaire`).
 */
export type ValeurAbsente = 'non_publie' | 'renvoi' | 'sans_montant_fixe' | 'incluse';

/** Renvoi à la précision, selon ce qui est visible : la colonne « Précision » du tableau, ou le texte sous le montant. */
export const RENVOI_PRECISION: Readonly<Record<Affichage, string>> = {
  tableau: 'montant précisé dans la colonne Précision',
  cartes: 'montant précisé ci-dessous',
};

/** Libellé affiché à la place d'un montant absent ; le renvoi dépend de la présentation (tableau ou cartes). */
export function libelleValeurAbsente(genre: ValeurAbsente, affichage: Affichage): string {
  switch (genre) {
    case 'non_publie':
      return 'non publié';
    case 'renvoi':
      return RENVOI_PRECISION[affichage];
    case 'sans_montant_fixe':
      return 'sans montant fixe';
    case 'incluse':
      return 'incluse dans le plafond horaire';
  }
}

/**
 * Précision d'un poste : sa règle en une phrase (`premierePhrase`) et, si la note en dit davantage (autres phrases,
 * extraits cités, adresse de la source, date de vérification), ce reste (`restePrecision`), montré à la demande. null
 * sans note.
 */
export interface PrecisionDuPoste {
  resume: string;
  /** Ce que la note dit en plus de sa règle ; null quand elle ne dit rien d'autre (aucun « Voir la précision »). */
  reste: string | null;
}

/** Extraits cités (« … », séparés ou non par « ; ») qui ouvrent une note : `premierePhrase` prend sa règle après eux. */
const CITATIONS_DE_TETE = /^(?:«[^»]*»\s*;?\s*)+/;

/**
 * Reste d'une note de poste une fois sa première phrase affichée (`premierePhrase`) : la note sans cette phrase, dans
 * son ordre (extraits cités qui l'ouvrent, phrases suivantes, parenthèse de source, date de vérification), dates au
 * format JJ/MM/AAAA ; chaîne vide quand la note ne dit rien d'autre. La phrase est cherchée là où `premierePhrase` la
 * prend : après les extraits cités de tête (sa règle), en tête (l'extrait cité de tête) ou au premier extrait cité (son
 * repli) ; le point final qu'elle rétablit (après une parenthèse de source ou une mention de vérification retirées)
 * n'est pas exigé. Le « ; » qui séparait la phrase du reste part avec elle. Une phrase introuvable telle quelle (aucun
 * cas dans les données) laisse la note entière : rien ne se perd.
 */
export function restePrecision(note: string): string {
  const texte = texteFr(note).trim();
  if (!texte) return '';
  const phrase = premierePhrase(note);
  const departs = [CITATIONS_DE_TETE.exec(texte)?.[0].length ?? 0, 0, texte.indexOf('«')];
  for (const debut of departs) {
    if (debut < 0) continue;
    for (const cherchee of [phrase, phrase.replace(/\.$/, '')]) {
      if (!cherchee || !texte.startsWith(cherchee, debut)) continue;
      const avant = texte.slice(0, debut).trim().replace(/\s*;$/, '');
      const apres = texte.slice(debut + cherchee.length).trim().replace(/^;\s*/, '');
      return [avant, apres].filter((m) => m !== '').join(' ');
    }
  }
  return texte;
}

export function precisionDuPoste(note: string | undefined): PrecisionDuPoste | null {
  const texte = note?.trim() ?? '';
  if (!texte) return null;
  return { resume: premierePhrase(texte), reste: restePrecision(texte) || null };
}

export interface LigneBareme {
  cle: keyof PostesBareme;
  libelle: string;
  /** Montant mis en forme avec son unité ; null quand l'OPCO ne publie pas de montant unique. */
  montant: string | null;
  /** Raison de l'absence de montant ; null quand il y a un montant. */
  absente: ValeurAbsente | null;
  confiance: Confidence;
  precision: PrecisionDuPoste | null;
  source: string | null;
}

/**
 * Lignes d'un barème (général ou de branche), dans l'ordre de la fiche : seuls les postes renseignés apparaissent, et le
 * forfait de frais annexes seulement s'il est publié. Le libellé et l'unité des salaires suivent le mode de prise en
 * charge ; l'unité de la restauration suit celle de l'OPCO (par repas ou par jour).
 */
export function lignesDuBareme(
  bareme: PostesBareme,
  modeSalaires: OpcoData['prise_en_charge_salaires_mode'],
  uniteRestauration: OpcoData['frais_restauration_unite'],
): LigneBareme[] {
  const enPourcentage = modeSalaires === 'pourcentage_pedagogique';
  const postes: [keyof PostesBareme, string, UnitePoste, ValeurAbsente?][] = [
    ['cout_horaire_inter', 'Coût pédagogique (inter-entreprises)', '€/h'],
    ['cout_horaire_intra', 'Coût pédagogique (intra-entreprise)', '€/h'],
    ['cout_horaire_metier', 'Coût pédagogique (certifications, CQP, habilitations)', '€/h'],
    [
      'prise_en_charge_salaires',
      enPourcentage ? 'Prise en charge des salaires (% des coûts pédagogiques)' : 'Prise en charge des salaires',
      enPourcentage ? '%' : '€/h',
      modeSalaires === 'inclus_plafond_horaire' ? 'incluse' : undefined,
    ],
    ['frais_transport', 'Frais de transport', '€/jour'],
    ['frais_hebergement', "Frais d'hébergement", '€/nuit'],
    ['frais_restauration', 'Frais de restauration', uniteRestauration === 'repas' ? '€/repas' : '€/jour'],
    ['frais_annexes_pourcentage', 'Frais annexes (forfait en % des coûts pédagogiques)', '%'],
    ['budget_annuel_max', 'Budget annuel maximum', '€/an'],
  ];
  return postes.flatMap(([cle, libelle, unite, valeurNulle]): LigneBareme[] => {
    const poste = bareme[cle];
    if (!poste) return [];
    if (cle === 'frais_annexes_pourcentage' && poste.value == null) return [];
    const precision = precisionDuPoste(poste.note);
    const absente: ValeurAbsente | null =
      poste.value != null
        ? null
        : (valeurNulle ?? (poste.confidence !== 'exact' ? 'non_publie' : precision ? 'renvoi' : 'sans_montant_fixe'));
    return [
      {
        cle,
        libelle,
        montant: poste.value != null ? montantAvecUnite(poste.value, unite) : null,
        absente,
        confiance: poste.confidence,
        precision,
        source: poste.source_url ? poste.source_url : null,
      },
    ];
  });
}

/** Explication d'un libellé de montant absent, pour la légende (« non publié », renvoi à la précision). */
const EXPLICATIONS: Partial<Record<ValeurAbsente, string>> = {
  non_publie: `L'OPCO ne communique pas de barème national${INSECABLE}: le montant dépend de votre branche, contactez votre conseiller.`,
  renvoi: `L'OPCO ne fixe pas de montant unique pour ce poste (frais réels, forfait conditionnel selon la formation ou le public, ou pas de prise en charge)${INSECABLE}: la règle publiée figure dans la précision.`,
};

export interface EntreeLegende {
  genre: ValeurAbsente;
  /** Le libellé tel qu'il apparaît dans les lignes de cette présentation, avec une majuscule. */
  libelle: string;
  explication: string;
}

/**
 * Légende des libellés de montant absent réellement affichés dans ces lignes, pour une présentation : le renvoi cite la
 * colonne « Précision » dans le tableau et le texte « ci-dessous » dans les cartes, comme les lignes elles-mêmes.
 */
export function legendeDuBareme(lignes: readonly LigneBareme[], affichage: Affichage): EntreeLegende[] {
  const presents = new Set(lignes.map((l) => l.absente));
  const ordre: ValeurAbsente[] = ['non_publie', 'renvoi', 'sans_montant_fixe', 'incluse'];
  return ordre.flatMap((genre): EntreeLegende[] => {
    const explication = EXPLICATIONS[genre];
    if (!presents.has(genre) || !explication) return [];
    return [{ genre, libelle: majuscule(libelleValeurAbsente(genre, affichage)), explication }];
  });
}

/** Tranches d'un barème dégressif selon la durée (Uniformation, par exemple), de la plus courte à la plus longue. */
export function tranchesDegressives(
  seuils: readonly CoutHoraireSeuil[],
  mode: ModeSeuils | undefined,
): { libelle: string; valeur: string }[] {
  const tranches = [...seuils].sort((a, b) => (a.max_heures ?? Infinity) - (b.max_heures ?? Infinity));
  const selonDureeTotale = mode === 'selon_duree_totale';
  const heures = (n: number) => `${nombreFr(n)}${INSECABLE}h`;
  return tranches.map((t, i) => {
    const borneBasse = i > 0 ? (tranches[i - 1].max_heures ?? 0) : 0;
    let libelle: string;
    if (selonDureeTotale) {
      libelle = t.max_heures != null ? `formation de ${heures(t.max_heures)} ou moins` : `formation de plus de ${heures(borneBasse)}`;
    } else {
      libelle = t.max_heures != null ? `de ${nombreFr(borneBasse)} à ${heures(t.max_heures)}` : `au-delà de ${heures(borneBasse)}`;
    }
    return { libelle, valeur: montantAvecUnite(t.valeur, '€/h') };
  });
}

// --- Plafonds par taille d'entreprise ------------------------------------------------------------------------------

export interface ChiffreTaille {
  libelle: string;
  valeur: string;
  /** Fiabilité du chiffre, seulement pour le plafond horaire (les autres chiffres n'en portent pas). */
  confiance: Confidence | null;
}

/**
 * Chiffres clés d'un plafond par taille d'entreprise (la description en prose reste la référence). Le plafond horaire
 * est le seul chiffre qui porte sa propre fiabilité (« exact » quand elle n'est pas renseignée).
 */
export function chiffresDeLaTaille(p: PlafondTaille): ChiffreTaille[] {
  const chiffres: ChiffreTaille[] = [];
  if (p.budget_annuel_max != null) {
    chiffres.push({ libelle: 'Budget annuel', valeur: formatEuro(p.budget_annuel_max), confiance: null });
  }
  if (p.cout_horaire_max != null) {
    chiffres.push({ libelle: 'Plafond horaire', valeur: montantAvecUnite(p.cout_horaire_max, '€/h'), confiance: p.confidence ?? 'exact' });
  }
  if (p.prise_en_charge_salaires_horaire != null) {
    chiffres.push({ libelle: 'Salaires', valeur: montantAvecUnite(p.prise_en_charge_salaires_horaire, '€/h'), confiance: null });
  }
  if (p.quota_horaire_max != null) {
    chiffres.push({ libelle: "Plafond d'heures", valeur: `${nombreFr(p.quota_horaire_max)}${INSECABLE}h`, confiance: null });
  }
  return chiffres;
}

// --- Dispositifs complémentaires -----------------------------------------------------------------------------------

/**
 * Montant d'un dispositif : « 50 % des coûts pédagogiques, dans la limite de 750 € par stagiaire », « jusqu'à 10 € par
 * heure », « 100 % des coûts pédagogiques » ; null quand le dispositif n'est pas chiffré publiquement.
 */
export function montantDuDispositif(
  d: Pick<DispositifComplementaire, 'pourcentage_couts' | 'montant_max' | 'unite'>,
): string | null {
  const parties: string[] = [];
  if (d.pourcentage_couts != null) parties.push(`${nombreFr(d.pourcentage_couts)}${INSECABLE}% des coûts pédagogiques`);
  if (d.montant_max != null) {
    const unite = d.unite ? ` ${UNITE_DISPOSITIF_LABELS[d.unite]}` : '';
    parties.push(`${d.pourcentage_couts != null ? 'dans la limite de' : "jusqu'à"} ${formatEuro(d.montant_max)}${unite}`);
  }
  return parties.length > 0 ? parties.join(', ') : null;
}

/** Nombre de codes au-delà duquel une liste de conventions collectives se replie (« 76 conventions collectives »). */
export const IDCC_AVANT_REPLI = 6;

/** Conventions collectives d'une branche en quelques mots : « IDCC 1486 », « IDCC 1516, 1518 », « 76 conventions collectives ». */
export function resumeIdcc(codes: readonly string[]): string {
  if (codes.length === 0) return '';
  if (codes.length <= 3) return `IDCC ${codes.join(', ')}`;
  return `${codes.length}${INSECABLE}conventions collectives`;
}

// --- Alertes -------------------------------------------------------------------------------------------------------

export interface TypeDAlerte {
  type: TypeAlerteOpco;
  libelle: string;
  nombre: number;
}

/** Alertes d'un OPCO comptées par type, du type le plus fréquent au moins fréquent (à égalité, l'ordre des données). */
export function resumeDesAlertes(alertes: readonly Pick<AlerteOpco, 'type'>[]): TypeDAlerte[] {
  const comptes = new Map<TypeAlerteOpco, number>();
  for (const a of alertes) comptes.set(a.type, (comptes.get(a.type) ?? 0) + 1);
  return [...comptes]
    .map(([type, nombre]) => ({ type, libelle: ALERTE_OPCO_LABELS[type] ?? type, nombre }))
    .sort((a, b) => b.nombre - a.nombre);
}

/**
 * Alertes qui visent une branche : celles dont un code IDCC est l'un des siens. Une alerte sans code vaut pour toutes
 * les entreprises de l'OPCO : elle reste dans la liste générale et n'est pas répétée dans chaque branche.
 */
export function alertesDeLaBranche<T extends Pick<AlerteOpco, 'idcc'>>(alertes: readonly T[], idcc: readonly string[]): T[] {
  const codes = new Set(idcc);
  return alertes.filter((a) => a.idcc.some((c) => codes.has(c)));
}

// --- Plan de la fiche ----------------------------------------------------------------------------------------------

export interface CarteTexteLibre {
  cle: 'apprentissage' | 'professionnalisation' | 'cpf' | 'vae';
  titre: string;
  elements: string[];
  source: string | null;
}

/** Cartes « Alternance, CPF et VAE » qui ont un texte à montrer (aucune carte vide). */
export function cartesAlternance(opco: OpcoData): CarteTexteLibre[] {
  const cartes: [CarteTexteLibre['cle'], string, unknown, boolean][] = [
    ['apprentissage', 'Apprentissage', opco.alternance_apprentissage, true],
    ['professionnalisation', 'Professionnalisation', opco.alternance_professionnalisation, true],
    ['cpf', 'Abondement CPF', opco.cpf_details, opco.cpf_abondement],
    ['vae', 'VAE', opco.vae_details, opco.vae_possible],
  ];
  return cartes.flatMap(([cle, titre, valeur, affichee]): CarteTexteLibre[] => {
    const elements = affichee ? elementsDeTexte(valeur) : [];
    return elements.length > 0 ? [{ cle, titre, elements, source: sourceDuTexte(valeur) }] : [];
  });
}

export type IdSection = 'bareme' | 'tailles' | 'branches' | 'alertes' | 'dispositifs' | 'alternance' | 'pratique';

export interface SectionFiche {
  id: IdSection;
  libelle: string;
  /** Nombre affiché à côté du libellé dans le sommaire (alertes). */
  compte?: number;
}

/**
 * Sections de la fiche, dans l'ordre de la page : le sommaire et la page les lisent ici, ils ne peuvent pas diverger.
 * Une section sans contenu n'existe pas (ni lien de sommaire vers elle).
 */
export function sectionsDeLaFiche(opco: OpcoData): SectionFiche[] {
  const sections: SectionFiche[] = [{ id: 'bareme', libelle: 'Barème général' }];
  if ((opco.plafonds_par_taille ?? []).length > 0) sections.push({ id: 'tailles', libelle: "Selon la taille de l'entreprise" });
  if ((opco.variantes_branche ?? []).length > 0 || (opco.note_variantes ?? '').trim() !== '') {
    sections.push({ id: 'branches', libelle: 'Barèmes par branche' });
  }
  const alertes = opco.alertes ?? [];
  if (alertes.length > 0) sections.push({ id: 'alertes', libelle: 'Alertes', compte: alertes.length });
  if ((opco.dispositifs_complementaires ?? []).length > 0) {
    sections.push({ id: 'dispositifs', libelle: 'Financements complémentaires' });
  }
  if (cartesAlternance(opco).length > 0) sections.push({ id: 'alternance', libelle: 'Alternance, CPF et VAE' });
  sections.push({ id: 'pratique', libelle: 'En pratique' });
  return sections;
}

// --- Liste des OPCO ------------------------------------------------------------------------------------------------

/** Nom de tri : sans article élidé en tête (« L'Opcommerce » se range à O). */
const cleDeTri = (nom: string): string => nom.replace(/^L['’]\s*/i, '');

/** OPCO dans l'ordre alphabétique de leur nom, article élidé ignoré, casse et accents ignorés, nombres dans l'ordre. */
export function trierParNom<T extends { name: string }>(opcos: readonly T[]): T[] {
  return [...opcos].sort((a, b) =>
    cleDeTri(a.name).localeCompare(cleDeTri(b.name), 'fr', { sensitivity: 'base', numeric: true }),
  );
}

// --- Ancre de l'adresse --------------------------------------------------------------------------------------------

/**
 * Ancre d'une fiche (`/opco/akto/#hcr`) décodée sans jamais lever, même mal encodée (`#taux-100%`). Définie dans
 * lib/ancre.ts, module sans importation, que le composant client `OuvertureDesDetails` importe directement.
 */
export { decoderAncre } from './ancre';

// --- Abréviations --------------------------------------------------------------------------------------------------

/**
 * Sigles des données définis sur la page officielle de l'OPCO (vérifiés le 07/10/2026) :
 * - Uniformation, page « Plan de développement des compétences : financement » : la section « La demande d'aide
 *   financière » et ses sous-parties « DAF certifications », « DAF handicap »… ;
 * - OPCO Santé, page « Les règles de prise en charge » : intitulés des quatre synthèses de prise en charge.
 * Un sigle qui n'a pas pu être vérifié (BETIC chez ATLAS) n'est pas défini.
 */
export const ABREVIATIONS_PAR_OPCO: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  uniformation: { DAF: "demande d'aide financière" },
  'opco-sante': {
    SSSMS: 'secteur sanitaire, social et médico-social privé à but non lucratif',
    HP: "secteur de l'hospitalisation privée et du thermalisme",
    SPSTI: 'services de prévention et santé au travail interentreprises',
    'hors CC': "entreprises ne relevant pas d'une convention collective",
  },
};

export type MorceauTexte =
  | { genre: 'texte'; valeur: string }
  | { genre: 'abreviation'; valeur: string; definition: string };

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Découpe un texte autour de ses sigles définis : la première occurrence de chaque sigle (mot entier, casse exacte)
 * devient un morceau `abreviation` qui porte sa définition, le reste du texte est gardé tel quel ; les morceaux
 * recomposent le texte à l'identique. Texte vide : aucun morceau.
 */
export function definirAbreviations(texte: string, definitions: Readonly<Record<string, string>>): MorceauTexte[] {
  if (!texte) return [];
  const sigles = Object.keys(definitions).sort((a, b) => b.length - a.length);
  if (sigles.length === 0) return [{ genre: 'texte', valeur: texte }];
  const motif = new RegExp(`(?<![\\p{L}\\p{N}])(?:${sigles.map(echapper).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const definis = new Set<string>();
  const morceaux: MorceauTexte[] = [];
  let debut = 0;
  for (const m of texte.matchAll(motif)) {
    if (definis.has(m[0])) continue;
    definis.add(m[0]);
    if (m.index > debut) morceaux.push({ genre: 'texte', valeur: texte.slice(debut, m.index) });
    morceaux.push({ genre: 'abreviation', valeur: m[0], definition: definitions[m[0]] });
    debut = m.index + m[0].length;
  }
  if (debut < texte.length) morceaux.push({ genre: 'texte', valeur: texte.slice(debut) });
  return morceaux;
}
