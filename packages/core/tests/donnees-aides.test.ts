// ============================================================
// Intégrité du catalogue d'aides embarqué (data/aides) : forme de chaque aide (schéma strict, aucune clé inconnue), cohérence
// d'ensemble, dates de vérification (moins de 12 mois avant la date de référence du jeu de données, jamais après : aucune
// lecture de l'horloge, la fraîcheur par rapport au jour est contrôlée à part par fraicheur.test.ts), montants « exacts »
// justifiés par un extrait qui chiffre un montant (un nombre suivi de €, d'euros ou de %), code de région des aides
// régionales et portail officiel de chacune des 18 régions.
// Chaque contrôle est une fonction qui renvoie la liste des problèmes (vide = conforme) : elle est appliquée au catalogue
// embarqué, puis à des copies mutées pour prouver qu'elle détecte bien ce qu'elle prétend détecter.
// Les balayages du catalogue par profil et par plan sont dans donnees-aides-coherence.test.ts, les corrections de catégories
// et de modes dans donnees-aides-categories.test.ts : ils ne sont pas repris ici.
// ============================================================

import { describe, it, expect } from 'vitest';
import type { Aide, PortailRegional } from '../src/aides/types';
import { EMBEDDED_AIDES, EMBEDDED_PORTAILS } from '../src/data';
import { REGIONS } from '../src/geo';
import { AideSchema, CriteresAideSchema, MontantAideSchema, PortailRegionalSchema, sanityCheckAides } from '../src/schema';
import { controlerDatesFutures, controlerFraicheur, dateDeReference } from './dates-donnees';

// Clés connues du schéma. Le schéma est strict (Zod refuse déjà une clé inconnue) : cette seconde garde, indépendante de
// `.strict()`, continue de signaler une clé mal orthographiée si la rigueur du schéma est un jour relâchée.
const CLES_AIDE = Object.keys(AideSchema.shape);
const CLES_CRITERES = Object.keys(CriteresAideSchema.shape);
const CLES_MONTANT = Object.keys(MontantAideSchema.innerType().shape);

/** Aide régionale : identifiant « r<code région>- ». La LADOM (nat-ladom-…) est nationale mais restreinte à l'outre-mer : elle n'est pas visée. */
const estRegionale = (a: Aide): boolean => /^r\d{2}-/.test(a.id);

// ---------------------------------------------------------------------------
// Contrôles : chacun renvoie les problèmes (identifiant et raison), vide = conforme.
// ---------------------------------------------------------------------------

/** Aides que le schéma strict refuse, avec le chemin et le message de chaque écart. */
function controlerSchema(aides: Aide[]): string[] {
  return aides.flatMap((a) => {
    const r = AideSchema.safeParse(a);
    return r.success ? [] : [`${a.id} : ${r.error.issues.map((i) => `${i.path.join('.')} (${i.message})`).join(' ; ')}`];
  });
}

/** Clés absentes du schéma, dans l'aide, ses critères, son montant et les critères de chaque majoration. */
function controlerClesInconnues(aides: Aide[]): string[] {
  const inconnues = (objet: object, connues: string[], chemin: string): string[] =>
    Object.keys(objet)
      .filter((cle) => !connues.includes(cle))
      .map((cle) => `${chemin}.${cle} : clé inconnue`);
  return aides.flatMap((a) => [
    ...inconnues(a, CLES_AIDE, a.id),
    ...inconnues(a.criteres, CLES_CRITERES, `${a.id}.criteres`),
    ...inconnues(a.montant, CLES_MONTANT, `${a.id}.montant`),
    ...(a.montant.majorations ?? []).flatMap((m, rang) =>
      inconnues(m.criteres, CLES_CRITERES, `${a.id}.montant.majorations[${rang}].criteres`),
    ),
  ]);
}

/** Les portails sous la forme que lit `controlerFraicheur` : un libellé et une date de vérification. */
const entreesPortails = (portails: PortailRegional[]): { id: string; derniere_verification: string }[] =>
  portails.map((p) => ({ id: `portail ${p.region}`, derniere_verification: p.derniere_verification }));

/** Un nombre suivi d'une unité de montant : « 5 000 € », « 42€/h », « 100 % », « 8 euros ». Un millésime (2026) ou un numéro ne suffit pas. */
const MONTANT_CHIFFRE = /\d\s*(?:€|euros?\b|%)/i;

/**
 * Aides chiffrées de confiance « exact » dont aucun extrait de source ne chiffre un montant, c'est-à-dire ne contient un nombre
 * suivi de €, d'euro(s) ou de % (le solde CPF et le non chiffré n'ont pas de montant).
 */
function controlerMontantsExacts(aides: Aide[]): string[] {
  return aides
    .filter((a) => a.confidence === 'exact' && a.montant.mode !== 'non_chiffre' && a.montant.mode !== 'solde_cpf')
    .filter((a) => !a.sources.some((s) => MONTANT_CHIFFRE.test(s.extrait)))
    .map((a) => `${a.id} : montant « exact » sans aucun montant chiffré (nombre suivi de €, d'euros ou de %) dans ses extraits`);
}

/** Aides régionales dont les critères de région ne contiennent pas le code porté par leur identifiant. */
function controlerCodeRegion(aides: Aide[]): string[] {
  return aides.filter(estRegionale).flatMap((a) => {
    const code = a.id.slice(1, 3);
    const regions: readonly string[] = a.criteres.regions ?? [];
    return regions.includes(code) ? [] : [`${a.id} : criteres.regions ne contient pas ${code}`];
  });
}

/** Portails : schéma strict, nom officiel de la région, exactement un portail par région des 18 régions. */
function controlerPortails(portails: PortailRegional[]): string[] {
  const problemes: string[] = [];
  for (const p of portails) {
    const r = PortailRegionalSchema.safeParse(p);
    if (!r.success) {
      problemes.push(`portail ${p.region} : ${r.error.issues.map((i) => `${i.path.join('.')} (${i.message})`).join(' ; ')}`);
    } else if (REGIONS[p.region] !== p.nom_region) {
      problemes.push(`portail ${p.region} : nom « ${p.nom_region} » au lieu de « ${REGIONS[p.region]} »`);
    }
  }
  const codes: string[] = portails.map((p) => p.region);
  for (const code of Object.keys(REGIONS)) {
    const n = codes.filter((c) => c === code).length;
    if (n === 0) problemes.push(`portail ${code} : région sans portail`);
    if (n > 1) problemes.push(`portail ${code} : ${n} portails pour une même région`);
  }
  for (const code of new Set(codes)) {
    if (!(code in REGIONS)) problemes.push(`portail ${code} : région inconnue`);
  }
  return problemes;
}

// ---------------------------------------------------------------------------
// Le catalogue embarqué
// ---------------------------------------------------------------------------

describe("catalogue d'aides embarqué", () => {
  const nationales = EMBEDDED_AIDES.filter((a) => !estRegionale(a));
  const regionales = EMBEDDED_AIDES.filter(estRegionale);

  it('couvre le national et les régions', () => {
    expect(nationales.length).toBeGreaterThanOrEqual(15);
    expect(regionales.length).toBeGreaterThanOrEqual(18);
    // Chacune des 18 régions (métropole et outre-mer) a au moins une aide propre.
    const sansAide = Object.keys(REGIONS).filter((code) => !regionales.some((a) => a.id.startsWith(`r${code}-`)));
    expect(sansAide).toEqual([]);
  });

  it('chaque aide respecte le schéma, sans clé inconnue', () => {
    expect(controlerSchema(EMBEDDED_AIDES)).toEqual([]);
    expect(controlerClesInconnues(EMBEDDED_AIDES)).toEqual([]);
  });

  it('est cohérent (identifiants, alternatives, bornes)', () => {
    expect(sanityCheckAides(EMBEDDED_AIDES)).toEqual([]);
  });

  it('a été vérifié moins de 12 mois avant la date de référence du jeu de données (la fraîcheur par rapport au jour : fraicheur.test.ts)', () => {
    expect(controlerFraicheur(EMBEDDED_AIDES, dateDeReference())).toEqual([]);
    expect(controlerFraicheur(entreesPortails(EMBEDDED_PORTAILS), dateDeReference())).toEqual([]);
  });

  it("n'a aucune dernière vérification après la date de référence du jeu de données (faute de frappe, ou date de référence à avancer)", () => {
    expect(controlerDatesFutures(EMBEDDED_AIDES, dateDeReference())).toEqual([]);
    expect(controlerDatesFutures(entreesPortails(EMBEDDED_PORTAILS), dateDeReference())).toEqual([]);
  });

  it('chaque montant exact est justifié par un extrait qui chiffre un montant (nombre suivi de €, d\'euros ou de %)', () => {
    expect(controlerMontantsExacts(EMBEDDED_AIDES)).toEqual([]);
    // Le contrôle n'est pas vide : des aides chiffrées « exact » existent.
    const exactes = EMBEDDED_AIDES.filter((a) => a.confidence === 'exact' && a.montant.mode !== 'non_chiffre' && a.montant.mode !== 'solde_cpf');
    expect(exactes.length).toBeGreaterThan(10);
  });

  it('une aide régionale porte le code de sa région', () => {
    expect(controlerCodeRegion(EMBEDDED_AIDES)).toEqual([]);
    expect(regionales.length).toBeGreaterThan(50); // le contrôle n'est pas vide
  });

  it('propose un portail officiel pour chacune des 18 régions', () => {
    expect(controlerPortails(EMBEDDED_PORTAILS)).toEqual([]);
    expect(EMBEDDED_PORTAILS).toHaveLength(18);
    expect(new Set(EMBEDDED_PORTAILS.map((p) => p.region))).toEqual(new Set(Object.keys(REGIONS)));
  });
});

// ---------------------------------------------------------------------------
// Les contrôles détectent une copie mutée
// ---------------------------------------------------------------------------

/**
 * Problèmes qu'une copie ajoute à ceux des données embarquées : l'état du catalogue n'altère pas la preuve que le contrôle
 * détecte la mutation (le catalogue lui-même est jugé par les tests ci-dessus).
 */
function ajouts<T>(controle: (donnees: T) => string[], base: T, copie: T): string[] {
  const connus = new Set(controle(base));
  return controle(copie).filter((probleme) => !connus.has(probleme));
}

describe('les contrôles détectent une copie mutée', () => {
  const copieAides = (): Aide[] => structuredClone(EMBEDDED_AIDES);
  const dans = (aides: Aide[], id: string): Aide => {
    const a = aides.find((x) => x.id === id);
    if (!a) throw new Error(`Aide absente du catalogue embarqué : ${id}`);
    return a;
  };
  const copiePortails = (): PortailRegional[] => structuredClone(EMBEDDED_PORTAILS);
  const portail = (portails: PortailRegional[], region: string): PortailRegional => {
    const p = portails.find((x) => x.region === region);
    if (!p) throw new Error(`Portail absent : ${region}`);
    return p;
  };

  it('le catalogue embarqué passe tous les contrôles (point de départ des mutations)', () => {
    const maintenant = dateDeReference();
    expect(controlerSchema(EMBEDDED_AIDES)).toEqual([]);
    expect(controlerClesInconnues(EMBEDDED_AIDES)).toEqual([]);
    expect(controlerFraicheur(EMBEDDED_AIDES, maintenant)).toEqual([]);
    expect(controlerDatesFutures(EMBEDDED_AIDES, maintenant)).toEqual([]);
    expect(controlerMontantsExacts(EMBEDDED_AIDES)).toEqual([]);
    expect(controlerCodeRegion(EMBEDDED_AIDES)).toEqual([]);
    expect(controlerPortails(EMBEDDED_PORTAILS)).toEqual([]);
  });

  describe('clés inconnues', () => {
    it("une clé mal orthographiée dans les critères, l'aide, le montant ou une majoration est signalée avec son chemin", () => {
      const copie = copieAides();
      (dans(copie, 'nat-cpf').criteres as Record<string, unknown>).age_maxi = 30;
      (dans(copie, 'nat-rfft') as unknown as Record<string, unknown>).region = '11';
      (dans(copie, 'nat-aide-unique-apprentissage').montant as unknown as Record<string, unknown>).plafon = 500;
      (dans(copie, 'nat-rfft').montant.majorations![0].criteres as Record<string, unknown>).rqht = true;
      expect(ajouts(controlerClesInconnues, EMBEDDED_AIDES, copie).sort()).toEqual([
        'nat-aide-unique-apprentissage.montant.plafon : clé inconnue',
        'nat-cpf.criteres.age_maxi : clé inconnue',
        'nat-rfft.montant.majorations[0].criteres.rqht : clé inconnue',
        'nat-rfft.region : clé inconnue',
      ]);
    });

    it('le schéma strict refuse aussi une aide dont la forme est altérée, et le dit avec son identifiant', () => {
      const copie = copieAides();
      dans(copie, 'nat-cpf').derniere_verification = '2026-02-30'; // date impossible
      (dans(copie, 'nat-rfft').criteres as Record<string, unknown>).age_maxi = 30;
      const problemes = ajouts(controlerSchema, EMBEDDED_AIDES, copie);
      expect(problemes).toHaveLength(2);
      expect(problemes.filter((p) => p.startsWith('nat-cpf : derniere_verification'))).toHaveLength(1);
      expect(problemes.filter((p) => p.startsWith('nat-rfft : criteres'))).toHaveLength(1);
    });
  });

  describe('fraîcheur', () => {
    // Date fixe pour les copies mutées : le résultat ne dépend pas du jour où le test s'exécute.
    const maintenant = new Date('2026-10-07T00:00:00Z');

    it('une vérification de 12 mois ou plus est signalée, 11 mois reste accepté', () => {
      const copie = copieAides();
      dans(copie, 'nat-cpf').derniere_verification = '2025-10-31'; // 12 mois civils
      dans(copie, 'nat-rfft').derniere_verification = '2025-11-01'; // 11 mois civils
      dans(copie, 'nat-clea').derniere_verification = '2024-01-15'; // 33 mois
      expect(ajouts((aides) => controlerFraicheur(aides, maintenant), EMBEDDED_AIDES, copie)).toEqual([
        'nat-cpf : dernière vérification le 2025-10-31 (12 mois)',
        'nat-clea : dernière vérification le 2024-01-15 (33 mois)',
      ]);
    });

    it("un portail dont la vérification est trop ancienne est signalé (même contrôle appliqué aux portails)", () => {
      const copie = copiePortails();
      portail(copie, '53').derniere_verification = '2025-01-01';
      expect(
        ajouts((e) => controlerFraicheur(e, maintenant), entreesPortails(EMBEDDED_PORTAILS), entreesPortails(copie)),
      ).toEqual(['portail 53 : dernière vérification le 2025-01-01 (21 mois)']);
    });

    it("une date de vérification future n'est pas vue par le contrôle de fraîcheur : le contrôle des dates futures la signale", () => {
      const copie = copieAides();
      dans(copie, 'nat-cpf').derniere_verification = '2027-09-01'; // faute de frappe : 2027 pour 2026
      expect(ajouts((aides) => controlerFraicheur(aides, maintenant), EMBEDDED_AIDES, copie)).toEqual([]);
      expect(ajouts((aides) => controlerDatesFutures(aides, maintenant), EMBEDDED_AIDES, copie)).toEqual([
        'nat-cpf : dernière vérification le 2027-09-01, après le 2026-10-08',
      ]);
    });

    it("le jour même et le lendemain (fuseau horaire) sont acceptés, le surlendemain est signalé ; même contrôle pour les portails", () => {
      const copie = copieAides();
      dans(copie, 'nat-cpf').derniere_verification = '2026-10-07'; // le jour même
      dans(copie, 'nat-rfft').derniere_verification = '2026-10-08'; // le lendemain
      dans(copie, 'nat-clea').derniere_verification = '2026-10-09'; // le surlendemain
      expect(ajouts((aides) => controlerDatesFutures(aides, maintenant), EMBEDDED_AIDES, copie)).toEqual([
        'nat-clea : dernière vérification le 2026-10-09, après le 2026-10-08',
      ]);
      const portails = copiePortails();
      portail(portails, '53').derniere_verification = '2027-01-01';
      expect(
        ajouts((e) => controlerDatesFutures(e, maintenant), entreesPortails(EMBEDDED_PORTAILS), entreesPortails(portails)),
      ).toEqual(['portail 53 : dernière vérification le 2027-01-01, après le 2026-10-08']);
    });
  });

  describe('montants exacts', () => {
    const SANS_MONTANT = "nat-aide-unique-apprentissage : montant « exact » sans aucun montant chiffré (nombre suivi de €, d'euros ou de %) dans ses extraits";

    it('une aide chiffrée « exact » dont aucun extrait ne contient de chiffre est signalée', () => {
      const copie = copieAides();
      for (const s of dans(copie, 'nat-aide-unique-apprentissage').sources) s.extrait = 'Texte officiel sans montant.';
      expect(ajouts(controlerMontantsExacts, EMBEDDED_AIDES, copie)).toEqual([SANS_MONTANT]);
    });

    it("un extrait dont les seuls chiffres sont un millésime, une date ou un numéro ne justifie pas un montant « exact »", () => {
      const copie = copieAides();
      const extraits = [
        'Barème 2026 validé par le conseil du 31/07/2026',
        'Article 244 quater M du code général des impôts, version en vigueur depuis le 1er janvier 2026',
        'Tableau n° 12 page 3 : 5 000 sans unité, 42 h',
      ];
      dans(copie, 'nat-aide-unique-apprentissage').sources.forEach((s, rang) => (s.extrait = extraits[rang % extraits.length]));
      expect(ajouts(controlerMontantsExacts, EMBEDDED_AIDES, copie)).toEqual([SANS_MONTANT]);
    });

    it.each(['Montant : 5 000 €.', 'plafond de 5000€ par an', '42€/h', "Prise en charge de 8 euros par heure", 'une aide de 1 euro', 'à hauteur de 100 %', 'financé à 50% du coût'])(
      'un extrait qui chiffre un montant (%s) justifie un montant « exact »',
      (extrait) => {
        const copie = copieAides();
        dans(copie, 'nat-aide-unique-apprentissage').sources.forEach((s, rang) => (s.extrait = rang === 0 ? extrait : 'Texte sans montant 2026.'));
        expect(ajouts(controlerMontantsExacts, EMBEDDED_AIDES, copie)).toEqual([]);
      },
    );

    it("un seul extrait chiffré suffit, et une aide non « exact », non chiffrée ou prélevée sur le solde CPF n'est pas concernée", () => {
      const copie = copieAides();
      const unique = dans(copie, 'nat-aide-unique-apprentissage');
      unique.sources.forEach((s, rang) => (s.extrait = rang === 0 ? 'Montant : 5 000 €.' : 'Texte sans montant.'));
      for (const id of ['nat-cpf', 'faf-fifpl', 'faf-fafcea']) {
        for (const s of dans(copie, id).sources) s.extrait = 'Texte officiel sans montant.';
      }
      // nat-cpf : solde_cpf ; faf-fifpl : non chiffré ; faf-fafcea : confiance depends_on_branche.
      expect(dans(copie, 'nat-cpf').montant.mode).toBe('solde_cpf');
      expect(dans(copie, 'faf-fifpl').montant.mode).toBe('non_chiffre');
      expect(dans(copie, 'faf-fafcea').confidence).not.toBe('exact');
      expect(ajouts(controlerMontantsExacts, EMBEDDED_AIDES, copie)).toEqual([]);
    });
  });

  describe('code de région', () => {
    it("une aide régionale qui ne cible plus sa région, ou qui n'en cible aucune, est signalée", () => {
      const copie = copieAides();
      dans(copie, 'r11-recrutup').criteres.regions = ['75'];
      delete dans(copie, 'r53-aide-financiere').criteres.regions;
      expect(ajouts(controlerCodeRegion, EMBEDDED_AIDES, copie)).toEqual([
        'r11-recrutup : criteres.regions ne contient pas 11',
        'r53-aide-financiere : criteres.regions ne contient pas 53',
      ]);
    });

    it("une aide nationale (dont la LADOM, restreinte à l'outre-mer) n'est pas soumise à la règle", () => {
      const copie = copieAides();
      delete dans(copie, 'nat-cpf').criteres.regions;
      dans(copie, 'nat-ladom-passeport-mobilite-formation').criteres.regions = ['01', '02', '03', '04', '06'];
      expect(ajouts(controlerCodeRegion, EMBEDDED_AIDES, copie)).toEqual([]);
    });
  });

  describe('portails', () => {
    it('un portail manquant, en double, de région inconnue ou au nom inexact est signalé', () => {
      const copie = copiePortails().filter((p) => p.region !== '53'); // Bretagne retirée
      copie.push(structuredClone(portail(copie, '11'))); // Île-de-France en double
      portail(copie, '76').nom_region = 'Occitanie-Pyrénées';
      expect(ajouts(controlerPortails, EMBEDDED_PORTAILS, copie).sort()).toEqual(
        [
          'portail 76 : nom « Occitanie-Pyrénées » au lieu de « Occitanie »',
          'portail 11 : 2 portails pour une même région',
          'portail 53 : région sans portail',
        ].sort(),
      );
    });

    it('une URL non https ou une région hors des 18 est refusée par le schéma', () => {
      const copie = copiePortails();
      portail(copie, '84').liens[0].url = 'http://www.auvergnerhonealpes.fr';
      (portail(copie, '94') as unknown as { region: string }).region = '99';
      const problemes = ajouts(controlerPortails, EMBEDDED_PORTAILS, copie);
      expect(problemes.filter((p) => p.startsWith('portail 84 :'))).toHaveLength(1);
      expect(problemes.filter((p) => p.startsWith('portail 99 :'))).toHaveLength(2); // schéma et région inconnue
      expect(problemes).toContain('portail 94 : région sans portail');
    });
  });
});
