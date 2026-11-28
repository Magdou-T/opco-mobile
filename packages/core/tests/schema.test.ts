import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  AlerteOpcoSchema,
  DispositifComplementaireSchema,
  OpcoDataSchema,
  PlafondTailleSchema,
  SourceAideSchema,
  VarianteBrancheSchema,
  validateDataset,
  sanityCheckOpco,
} from '../src/schema';
import { resolveVarianteBranche } from '../src/calculator';
import { ALERTE_OPCO_LABELS } from '../src/types';
import type { AlerteOpco, FreeText, OpcoData, VarianteBranche } from '../src/types';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '../src/data';
import paquet from '../package.json';
import { makeOpco } from './fixtures';

describe('schéma, dataset embarqué', () => {
  it('contient bien 11 OPCO', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
  });

  it('chaque OPCO embarqué respecte le schéma Zod', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(() => OpcoDataSchema.parse(o)).not.toThrow();
    }
  });

  it('chaque OPCO embarqué passe les bornes de cohérence', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(sanityCheckOpco(o as never)).toEqual([]);
    }
  });

  // Horodatage fixe : `generatedAt` n'est qu'une chaîne pour validateDataset, le test ne lit pas l'horloge.
  const GENERATED_AT = '2026-10-08T00:00:00.000Z';

  it('validateDataset accepte le dataset embarqué', () => {
    const ds = { version: 1, generatedAt: GENERATED_AT, opcos: EMBEDDED_OPCOS };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it('validateDataset rejette un dataset incomplet', () => {
    const ds = { version: 1, generatedAt: GENERATED_AT, opcos: EMBEDDED_OPCOS.slice(0, 3) };
    expect(() => validateDataset(ds)).toThrow();
  });

  it('sanityCheck détecte un coût horaire hors bornes', () => {
    const bad = { ...EMBEDDED_OPCOS[0], cout_horaire_inter: { value: 999, confidence: 'exact', source_url: 'x' } };
    expect(sanityCheckOpco(bad as never).length).toBeGreaterThan(0);
  });
});

// Les schémas des OPCO ne sont pas stricts : une clé absente du schéma serait supprimée en silence au parsing.
// Chaque test vérifie donc que la valeur ressort du parsing, pas seulement que le parsing réussit.
describe('schéma, champs des barèmes vérifiés (v2)', () => {
  const source = 'https://exemple.fr';

  it('la fabrique de test produit un OPCO valide', () => {
    expect(() => OpcoDataSchema.parse(makeOpco())).not.toThrow();
  });

  describe('variante : forfait de frais annexes en %', () => {
    const variante = {
      id: 'travaux-publics',
      branche_nom: 'Travaux publics',
      idcc: ['1702'],
      source_url: source,
      confidence: 'exact' as const,
    };

    it('conserve frais_annexes_pourcentage, y compris à null', () => {
      const frais = { value: null, confidence: 'exact' as const, source_url: source };
      expect(VarianteBrancheSchema.parse({ ...variante, frais_annexes_pourcentage: frais }).frais_annexes_pourcentage).toEqual(frais);
    });

    it('reste facultatif', () => {
      expect(VarianteBrancheSchema.parse(variante).frais_annexes_pourcentage).toBeUndefined();
    });

    it('refuse un forfait mal formé', () => {
      expect(() => VarianteBrancheSchema.parse({ ...variante, frais_annexes_pourcentage: { value: 'huit' } })).toThrow();
    });
  });

  describe('plafond par taille : prise en charge des salaires en €/h', () => {
    const plafond = { taille: '11_49' as const, cout_horaire_max: null, budget_annuel_max: null, quota_horaire_max: null, description: 'PME' };

    it('distingue un taux, un null explicite (aucune prise en charge) et l\'absence de taux', () => {
      expect(PlafondTailleSchema.parse({ ...plafond, prise_en_charge_salaires_horaire: 10 }).prise_en_charge_salaires_horaire).toBe(10);
      expect(PlafondTailleSchema.parse({ ...plafond, prise_en_charge_salaires_horaire: 0 }).prise_en_charge_salaires_horaire).toBe(0);
      expect(PlafondTailleSchema.parse({ ...plafond, prise_en_charge_salaires_horaire: null }).prise_en_charge_salaires_horaire).toBeNull();
      expect(PlafondTailleSchema.parse(plafond).prise_en_charge_salaires_horaire).toBeUndefined();
    });

    it('refuse un taux négatif ou non numérique', () => {
      expect(() => PlafondTailleSchema.parse({ ...plafond, prise_en_charge_salaires_horaire: -1 })).toThrow();
      expect(() => PlafondTailleSchema.parse({ ...plafond, prise_en_charge_salaires_horaire: '10' })).toThrow();
    });

    it('ressort du parsing d\'un OPCO complet', () => {
      const opco = makeOpco({ plafonds_par_taille: [{ ...plafond, prise_en_charge_salaires_horaire: 10 }] });
      expect(OpcoDataSchema.parse(opco).plafonds_par_taille?.[0].prise_en_charge_salaires_horaire).toBe(10);
    });
  });

  describe('plafond par taille : confiance et source propres au plafond horaire', () => {
    const plafond = { taille: '11_49' as const, cout_horaire_max: 24, budget_annuel_max: null, quota_horaire_max: null, description: 'PME' };

    it('conserve confidence et source_url, qui restent facultatives', () => {
      const parsed = PlafondTailleSchema.parse({ ...plafond, confidence: 'estimated', source_url: source });
      expect(parsed.confidence).toBe('estimated');
      expect(parsed.source_url).toBe(source);
      const sans = PlafondTailleSchema.parse(plafond);
      expect(sans.confidence).toBeUndefined();
      expect(sans.source_url).toBeUndefined();
    });

    it('refuse une confiance inconnue et une source qui n\'est pas une URL', () => {
      expect(() => PlafondTailleSchema.parse({ ...plafond, confidence: 'certain' })).toThrow();
      expect(() => PlafondTailleSchema.parse({ ...plafond, source_url: 'pas une url' })).toThrow();
      expect(() => PlafondTailleSchema.parse({ ...plafond, source_url: 42 })).toThrow();
    });

    it('ressortent du parsing d\'un OPCO complet, pour le défaut comme pour une variante', () => {
      const entree = { ...plafond, confidence: 'depends_on_branche' as const, source_url: source };
      const variante = { id: 'batiment', branche_nom: 'Bâtiment', idcc: ['1596'], source_url: source, confidence: 'exact' as const };
      const opco = makeOpco({
        plafonds_par_taille: [entree],
        variantes_branche: [{ ...variante, plafonds_par_taille: [{ ...entree, confidence: 'estimated' as const }] }],
      });
      const parsed = OpcoDataSchema.parse(opco);
      expect(parsed.plafonds_par_taille?.[0]).toMatchObject({ confidence: 'depends_on_branche', source_url: source });
      expect(parsed.variantes_branche?.[0].plafonds_par_taille?.[0]).toMatchObject({ confidence: 'estimated', source_url: source });
    });
  });

  describe('nom complet de l\'OPCO', () => {
    it('conserve nom_complet au parsing d\'un OPCO complet', () => {
      const opco = makeOpco({ nom_complet: 'Opérateur de compétences de test' });
      expect(OpcoDataSchema.parse(opco).nom_complet).toBe('Opérateur de compétences de test');
    });

    it('reste facultatif', () => {
      expect(OpcoDataSchema.parse(makeOpco()).nom_complet).toBeUndefined();
    });

    it('refuse une valeur qui n\'est pas une chaîne', () => {
      expect(OpcoDataSchema.safeParse({ ...makeOpco(), nom_complet: 42 }).success).toBe(false);
    });
  });

  describe('unité du forfait de restauration', () => {
    const variante = { id: 'hcr', branche_nom: 'Hôtels, cafés, restaurants', idcc: ['1979'], source_url: source, confidence: 'exact' as const };

    it('conserve frais_restauration_unite sur l\'OPCO et sur une variante', () => {
      const opco = makeOpco({ frais_restauration_unite: 'repas', variantes_branche: [{ ...variante, frais_restauration_unite: 'jour' }] });
      const parsed = OpcoDataSchema.parse(opco);
      expect(parsed.frais_restauration_unite).toBe('repas');
      expect(parsed.variantes_branche?.[0].frais_restauration_unite).toBe('jour');
      expect(VarianteBrancheSchema.parse({ ...variante, frais_restauration_unite: 'repas' }).frais_restauration_unite).toBe('repas');
    });

    it('reste facultative', () => {
      expect(OpcoDataSchema.parse(makeOpco()).frais_restauration_unite).toBeUndefined();
      expect(VarianteBrancheSchema.parse(variante).frais_restauration_unite).toBeUndefined();
    });

    it('refuse une unité inconnue', () => {
      expect(OpcoDataSchema.safeParse({ ...makeOpco(), frais_restauration_unite: 'heure' }).success).toBe(false);
      expect(VarianteBrancheSchema.safeParse({ ...variante, frais_restauration_unite: 'semaine' }).success).toBe(false);
    });
  });

  describe('dispositif complémentaire : IDCC et note', () => {
    const dispositif = {
      id: 'transition-ecologique',
      nom: 'Transition écologique',
      cumul: 'additif' as const,
      montant_max: 1000,
      unite: 'par_dossier' as const,
      pourcentage_couts: null,
      description: 'Dispositif réservé à une branche',
      conditions: ['Entreprise de la branche'],
      demarches: 'Demande sur le portail',
      tailles_eligibles: null,
      publics: null,
      confidence: 'exact' as const,
      source_url: source,
    };

    it('conserve idcc et note', () => {
      const parsed = DispositifComplementaireSchema.parse({ ...dispositif, idcc: ['1702', '2614'], note: 'Travaux publics uniquement' });
      expect(parsed.idcc).toEqual(['1702', '2614']);
      expect(parsed.note).toBe('Travaux publics uniquement');
    });

    it('reste facultatif', () => {
      const parsed = DispositifComplementaireSchema.parse(dispositif);
      expect(parsed.idcc).toBeUndefined();
      expect(parsed.note).toBeUndefined();
    });

    it('refuse un IDCC qui n\'a pas 4 chiffres', () => {
      expect(() => DispositifComplementaireSchema.parse({ ...dispositif, idcc: ['702'] })).toThrow();
      expect(() => DispositifComplementaireSchema.parse({ ...dispositif, idcc: ['17O2'] })).toThrow();
    });

    it('ressort du parsing d\'un OPCO complet', () => {
      const opco = makeOpco({ dispositifs_complementaires: [{ ...dispositif, idcc: ['1702'], note: 'n' }] });
      const parsed = OpcoDataSchema.parse(opco);
      expect(parsed.dispositifs_complementaires?.[0].idcc).toEqual(['1702']);
      expect(parsed.dispositifs_complementaires?.[0].note).toBe('n');
    });
  });

  describe('barème dégressif réservé aux formations certifiantes', () => {
    const seuils = [
      { max_heures: 105, valeur: 65 },
      { max_heures: null, valeur: 15 },
    ];
    const variante = { id: 'branche', branche_nom: 'Branche', idcc: ['1234'], source_url: source, confidence: 'exact' as const };

    it('conserve cout_horaire_seuils_certifiant sur l\'OPCO et sur une variante', () => {
      const opco = makeOpco({
        cout_horaire_seuils: seuils,
        cout_horaire_seuils_certifiant: true,
        variantes_branche: [{ ...variante, cout_horaire_seuils_certifiant: false }],
      });
      const parsed = OpcoDataSchema.parse(opco);
      expect(parsed.cout_horaire_seuils_certifiant).toBe(true);
      expect(parsed.variantes_branche?.[0].cout_horaire_seuils_certifiant).toBe(false);
    });

    it('reste facultatif', () => {
      expect(OpcoDataSchema.parse(makeOpco({ cout_horaire_seuils: seuils })).cout_horaire_seuils_certifiant).toBeUndefined();
      expect(VarianteBrancheSchema.parse(variante).cout_horaire_seuils_certifiant).toBeUndefined();
    });

    it('refuse une valeur non booléenne', () => {
      expect(OpcoDataSchema.safeParse({ ...makeOpco(), cout_horaire_seuils_certifiant: 'oui' }).success).toBe(false);
      expect(VarianteBrancheSchema.safeParse({ ...variante, cout_horaire_seuils_certifiant: 1 }).success).toBe(false);
    });
  });

  describe('bornes de cohérence des nouveaux champs chiffrés', () => {
    const plafond = (taux: number | null) => ({
      taille: 'less_11' as const,
      cout_horaire_max: null,
      budget_annuel_max: null,
      quota_horaire_max: null,
      description: 'TPE',
      prise_en_charge_salaires_horaire: taux,
    });
    const variante = (over: Record<string, unknown>) => ({
      id: 'travaux-publics',
      branche_nom: 'Travaux publics',
      idcc: ['1702'],
      source_url: source,
      confidence: 'exact' as const,
      ...over,
    });
    const problemes = (over: Parameters<typeof makeOpco>[0]) => sanityCheckOpco(OpcoDataSchema.parse(makeOpco(over)));

    it('accepte des valeurs plausibles et null', () => {
      const frais = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: source });
      expect(problemes({ plafonds_par_taille: [plafond(15)] })).toEqual([]);
      expect(problemes({ plafonds_par_taille: [plafond(null)] })).toEqual([]);
      expect(problemes({ variantes_branche: [variante({ frais_annexes_pourcentage: frais(8) })] })).toEqual([]);
      expect(problemes({ variantes_branche: [variante({ frais_annexes_pourcentage: frais(null) })] })).toEqual([]);
    });

    it('signale un taux de salaires par taille hors bornes (OPCO et variante)', () => {
      expect(problemes({ plafonds_par_taille: [plafond(1500)] })).toEqual([
        'test-opco: plafond[less_11].prise_en_charge_salaires_horaire=1500 hors bornes [0, 200]',
      ]);
      expect(problemes({ variantes_branche: [variante({ plafonds_par_taille: [plafond(1500)] })] })).toEqual([
        'test-opco: variante[travaux-publics].plafond[less_11].prise_en_charge_salaires_horaire=1500 hors bornes [0, 200]',
      ]);
    });

    it('signale un forfait de frais annexes de variante supérieur à 100 %', () => {
      const frais = { value: 800, confidence: 'exact' as const, source_url: source };
      expect(problemes({ variantes_branche: [variante({ frais_annexes_pourcentage: frais })] })).toEqual([
        'test-opco: variante[travaux-publics].frais_annexes_pourcentage=800 hors bornes [0, 100]',
      ]);
    });
  });

  describe('alertes publiées par l\'OPCO', () => {
    const alerte: AlerteOpco = {
      type: 'fonds_epuises',
      branche: 'Organismes de formation',
      idcc: ['1516'],
      source_url: 'https://www.exemple.fr/regles-de-prise-en-charge/',
      extrait: 'L\'enveloppe budgétaire attribuée à votre branche a été intégralement engagée.',
      verifie_le: '2026-10-05',
    };
    const avecAlerte = (over: Record<string, unknown>) => makeOpco({ alertes: [{ ...alerte, ...over } as AlerteOpco] });

    it('conserve les alertes, y compris sans IDCC (toutes les branches), et la note sur les variantes', () => {
      const opco = makeOpco({
        alertes: [alerte, { ...alerte, type: 'changement_paiement', branche: 'Toutes branches', idcc: [] }],
        note_variantes: 'Pas de variante : barème unique.',
      });
      const parsed = OpcoDataSchema.parse(opco);
      const alertes: AlerteOpco[] | undefined = parsed.alertes; // le type déduit du schéma reste compatible avec AlerteOpco
      expect(alertes).toEqual(opco.alertes);
      expect(parsed.note_variantes).toBe('Pas de variante : barème unique.');
    });

    it('alertes et note_variantes sont facultatives', () => {
      const parsed = OpcoDataSchema.parse(makeOpco());
      expect(parsed.alertes).toBeUndefined();
      expect(parsed.note_variantes).toBeUndefined();
    });

    it('une alerte au type inconnu est rejetée par OpcoDataSchema', () => {
      expect(OpcoDataSchema.safeParse(avecAlerte({ type: 'fonds_inconnus' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ type: 'dispositif_non_confirme_2026' })).success).toBe(false);
    });

    it('les types acceptés sont exactement ceux des libellés', () => {
      expect([...AlerteOpcoSchema.shape.type.options].sort()).toEqual(Object.keys(ALERTE_OPCO_LABELS).sort());
      for (const type of Object.keys(ALERTE_OPCO_LABELS)) {
        expect(AlerteOpcoSchema.safeParse({ ...alerte, type }).success, type).toBe(true);
      }
    });

    it('les libellés affichables sont en français accentué', () => {
      expect(ALERTE_OPCO_LABELS).toEqual({
        fonds_epuises: 'Fonds épuisés',
        changement_criteres: 'Critères modifiés',
        dispositif_termine: 'Dispositif terminé',
        dispositif_non_confirme: 'Dispositif non confirmé',
        changement_paiement: 'Modalités de paiement modifiées',
        acces_restreint: 'Accès restreint',
        evolution_en_cours_annee: "Évolution en cours d'année",
        echeance: 'Échéance',
      });
    });

    it('refuse un IDCC qui n\'a pas 4 chiffres', () => {
      expect(OpcoDataSchema.safeParse(avecAlerte({ idcc: ['516'] })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ idcc: ['1516', 'abcd'] })).success).toBe(false);
    });

    it('exige une source en https', () => {
      expect(OpcoDataSchema.safeParse(avecAlerte({ source_url: 'http://www.exemple.fr/regles' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ source_url: 'pas une url' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ source_url: '' })).success).toBe(false);
    });

    it('exige un extrait non vide et une branche', () => {
      expect(OpcoDataSchema.safeParse(avecAlerte({ extrait: '' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ branche: '' })).success).toBe(false);
    });

    it('exige une date de vérification AAAA-MM-JJ existante', () => {
      expect(OpcoDataSchema.safeParse(avecAlerte({ verifie_le: '05/10/2026' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ verifie_le: '2026-02-30' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ verifie_le: '' })).success).toBe(false);
      expect(OpcoDataSchema.safeParse(avecAlerte({ verifie_le: '2026-10-05' })).success).toBe(true);
    });
  });
});

// Les champs descriptifs libres : les données réelles mélangent texte, objet détaillé { description, source_url, … } et null
// (OPCO EP, OPCO Santé, Uniformation). Le type doit dire ce que le schéma accepte, sans quoi un composant typé « string »
// reçoit un objet sans le savoir. Ces champs ne pilotent pas le calcul.
describe('schéma et types, textes libres des OPCO (FreeText)', () => {
  const CHAMPS_TEXTE_LIBRE = [
    'delai_validation',
    'alternance_apprentissage',
    'alternance_professionnalisation',
    'cpf_details',
    'vae_details',
    'limite_dossiers_an',
  ] as const;
  type ChampTexteLibre = (typeof CHAMPS_TEXTE_LIBRE)[number];
  const objetDetaille = { description: 'Forfait selon la branche', source_url: 'https://exemple.fr/forfaits', verifie: true };

  it.each(CHAMPS_TEXTE_LIBRE)('%s : le schéma accepte une chaîne, un objet détaillé et null, et les conserve tels quels', (champ) => {
    for (const valeur of ['Texte libre', '', objetDetaille, null]) {
      const resultat = OpcoDataSchema.safeParse({ ...makeOpco(), [champ]: valeur });
      expect(resultat.success, `${champ} = ${JSON.stringify(valeur)}`).toBe(true);
      if (resultat.success) expect(resultat.data[champ]).toEqual(valeur);
    }
  });

  it.each(CHAMPS_TEXTE_LIBRE)('%s : le schéma refuse un nombre, un booléen et un tableau', (champ) => {
    for (const valeur of [42, true, ['texte']]) {
      expect(OpcoDataSchema.safeParse({ ...makeOpco(), [champ]: valeur }).success, `${champ} = ${JSON.stringify(valeur)}`).toBe(false);
    }
  });

  // Les deux tests suivants ne peuvent échouer qu'à la compilation (`tsc --noEmit` : le dossier tests en fait partie).
  it('le type OpcoData accepte une chaîne, un objet détaillé et null pour chacun des six champs', () => {
    const vae: OpcoData['vae_details'] = { description: 'VAE plafonnée par parcours', source_url: 'https://exemple.fr/vae' };
    // @ts-expect-error un nombre n'est pas un texte libre
    const nombre: OpcoData['vae_details'] = 42;
    expect(OpcoDataSchema.shape.vae_details.safeParse(vae).success).toBe(true); // le schéma accepte ce que le type accepte…
    expect(OpcoDataSchema.shape.vae_details.safeParse(nombre).success).toBe(false); // …et refuse ce que le type refuse

    const opco: OpcoData = makeOpco({
      delai_validation: objetDetaille,
      alternance_apprentissage: { description: 'Niveaux de prise en charge par certification' },
      alternance_professionnalisation: 'Forfait horaire fixé par la branche',
      cpf_details: null,
      vae_details: { vae_simple: { value: 1500, note: 'plafond par parcours' }, vae_mixte: null },
      limite_dossiers_an: null,
    });
    expect(OpcoDataSchema.safeParse(opco).success).toBe(true); // un OpcoData ainsi typé passe le schéma
  });

  it('chacun des six champs a exactement le type FreeText, dans OpcoData comme dans le type déduit du schéma', () => {
    type OpcoParse = ReturnType<typeof OpcoDataSchema.parse>;
    expectTypeOf<Pick<OpcoData, ChampTexteLibre>>().toEqualTypeOf<Record<ChampTexteLibre, FreeText>>();
    expectTypeOf<Pick<OpcoParse, ChampTexteLibre>>().toEqualTypeOf<Record<ChampTexteLibre, FreeText>>();
    expectTypeOf<FreeText>().toEqualTypeOf<string | Record<string, unknown> | null>();
  });
});

// Le catalogue d'aides (le plus lourd des jeux de données) vit dans son propre module : un composant du site qui n'importe que
// les barèmes ou la table IDCC n'embarque pas le catalogue, à condition que le paquet se déclare sans effet de bord.
describe('données embarquées, catalogue d\'aides séparé du reste', () => {
  it('data.ts et l\'index du paquet exposent toujours le catalogue et les portails, avec les mêmes références que data-aides', async () => {
    const aides = await import('../src/data-aides');
    const data = await import('../src/data');
    const index = await import('../src/index');
    expect(aides.EMBEDDED_AIDES.length).toBeGreaterThan(0);
    expect(aides.EMBEDDED_PORTAILS.length).toBeGreaterThan(0);
    expect(data.EMBEDDED_AIDES).toBe(aides.EMBEDDED_AIDES);
    expect(data.EMBEDDED_PORTAILS).toBe(aides.EMBEDDED_PORTAILS);
    expect(index.EMBEDDED_AIDES).toBe(aides.EMBEDDED_AIDES);
    expect(index.EMBEDDED_PORTAILS).toBe(aides.EMBEDDED_PORTAILS);
  }, 30_000); // l'import de l'index charge tout le paquet : plus de 5 s (délai par défaut) sur une machine chargée

  it('le paquet se déclare sans effet de bord (sideEffects false) : un bundler écarte les données qu\'aucun import n\'utilise', () => {
    expect((paquet as { sideEffects?: unknown }).sideEffects).toBe(false);
  });
});

// Le site rend en lien (href) la source d'une variante de branche et celle d'un dispositif : comme pour une alerte, seule une
// adresse https est acceptée. Un extrait de source d'aide tient en 300 caractères (spécification, protocole de recherche).
describe('schéma : sources des variantes et des dispositifs, longueur des extraits', () => {
  const variante = {
    id: 'branche', branche_nom: 'Branche', idcc: ['1234'], source_url: 'https://www.exemple.fr/branche', confidence: 'exact' as const,
  };
  const dispositif = {
    id: 'dispositif', nom: 'Dispositif', cumul: 'additif' as const, montant_max: null, unite: null, pourcentage_couts: null,
    description: 'Dispositif de test', conditions: [], demarches: 'Demande en ligne', tailles_eligibles: null, publics: null,
    confidence: 'exact' as const, source_url: 'https://www.exemple.fr/dispositif',
  };

  it("la source d'une variante et celle d'un dispositif sont des adresses https", () => {
    expect(VarianteBrancheSchema.safeParse(variante).success).toBe(true);
    expect(DispositifComplementaireSchema.safeParse(dispositif).success).toBe(true);
    for (const source_url of ['pas une adresse', 'http://www.exemple.fr/branche', '', 'javascript:alert(1)', 'www.exemple.fr']) {
      expect(VarianteBrancheSchema.safeParse({ ...variante, source_url }).success, `variante ${source_url}`).toBe(false);
      expect(DispositifComplementaireSchema.safeParse({ ...dispositif, source_url }).success, `dispositif ${source_url}`).toBe(false);
    }
  });

  it('toutes les variantes et tous les dispositifs embarqués ont une source https acceptée par le schéma', () => {
    const variantes = EMBEDDED_OPCOS.flatMap((o) => o.variantes_branche ?? []);
    const dispositifs = EMBEDDED_OPCOS.flatMap((o) => o.dispositifs_complementaires ?? []);
    expect(variantes.length).toBeGreaterThan(30);
    expect(dispositifs.length).toBeGreaterThan(30);
    expect(variantes.filter((v) => !VarianteBrancheSchema.safeParse(v).success).map((v) => v.id)).toEqual([]);
    expect(dispositifs.filter((d) => !DispositifComplementaireSchema.safeParse(d).success).map((d) => d.id)).toEqual([]);
  });

  it("un extrait de source d'aide tient en 300 caractères : 300 accepté, 301 refusé ; le catalogue embarqué les respecte", () => {
    const source = { url: 'https://www.exemple.fr/aide', titre: 'Page officielle', extrait: 'x'.repeat(300) };
    expect(SourceAideSchema.safeParse(source).success).toBe(true);
    expect(SourceAideSchema.safeParse({ ...source, extrait: 'x'.repeat(301) }).success).toBe(false);
    expect(Math.max(...EMBEDDED_AIDES.flatMap((a) => a.sources.map((s) => s.extrait.length)))).toBeLessThanOrEqual(300);
  });
});

// Une branche dont l'enveloppe du plan de développement des compétences est épuisée peut être financée par le plan
// conventionnel de la branche, qui prend le relais : le barème de la variante est alors celui de ce plan conventionnel, dans
// la limite de son plafond annuel (budget_annuel_max). Le champ relais_plan_conventionnel le dit au site, qui nomme alors la
// ligne de l'OPCO « plan conventionnel de branche » au lieu de laisser croire que les fonds épuisés financent la formation.
describe('variante de branche : relais du plan conventionnel', () => {
  const variante = {
    id: 'branche', branche_nom: 'Branche', idcc: ['1234'], source_url: 'https://www.exemple.fr/branche', confidence: 'exact' as const,
  };

  it('champ facultatif : true conservé au parsing, false et toute autre valeur refusés, absent par défaut', () => {
    expect(VarianteBrancheSchema.parse({ ...variante, relais_plan_conventionnel: true }).relais_plan_conventionnel).toBe(true);
    expect(VarianteBrancheSchema.parse(variante).relais_plan_conventionnel).toBeUndefined();
    for (const valeur of [false, 'oui', 1, null]) {
      expect(VarianteBrancheSchema.safeParse({ ...variante, relais_plan_conventionnel: valeur }).success, String(valeur)).toBe(false);
    }
    const opco = makeOpco({ variantes_branche: [{ ...variante, relais_plan_conventionnel: true }] });
    expect(OpcoDataSchema.parse(opco).variantes_branche?.[0].relais_plan_conventionnel).toBe(true);
    // Le type exporté porte le champ (vérifié à la compilation par tsc --noEmit).
    const typee: VarianteBranche = { ...variante, relais_plan_conventionnel: true };
    expect(typee.relais_plan_conventionnel).toBe(true);
  });

  it("données : seule la variante AKTO « Organismes de formation » (IDCC 1516) le porte, avec le plafond annuel de 10 000 € du plan conventionnel", () => {
    const marquees = EMBEDDED_OPCOS.flatMap((o) =>
      (o.variantes_branche ?? []).filter((v) => v.relais_plan_conventionnel === true).map((v) => `${o.slug}/${v.id}`),
    );
    expect(marquees).toEqual(['akto/organismes-de-formation']);
    const akto = EMBEDDED_OPCOS.find((o) => o.slug === 'akto')!;
    const of = akto.variantes_branche!.find((v) => v.id === 'organismes-de-formation')!;
    expect(of.idcc).toEqual(['1516']);
    expect(of.budget_annuel_max).toMatchObject({ value: 10000, confidence: 'exact' });
    expect(of.budget_annuel_max!.note).toContain('« La prise en charge des formations ne peut dépasser le plafond annuel de 10 000 €/entreprise au titre du Plan conventionnel. »');
    expect(of.note).toContain('Plan conventionnel dans la limite du plafond annuel par entreprise.');
    // La variante des branches dont l'enveloppe est épuisée sans relais (dépôts suspendus) ne le porte pas.
    expect(akto.variantes_branche!.find((v) => v.id === 'akto-pdc-2026-epuise')!.relais_plan_conventionnel).toBeUndefined();
  });

  it('resolveVarianteBranche rend la variante avec le champ (IDCC détecté ou branche choisie) ; validateDataset et sanityCheckOpco gardent le jeu embarqué', () => {
    const akto = EMBEDDED_OPCOS.find((o) => o.slug === 'akto')!;
    expect(resolveVarianteBranche(akto, { selectedBrancheId: null, detectedIdcc: '1516' })?.relais_plan_conventionnel).toBe(true);
    expect(resolveVarianteBranche(akto, { selectedBrancheId: 'organismes-de-formation', detectedIdcc: null })?.relais_plan_conventionnel).toBe(true);
    expect(resolveVarianteBranche(akto, { selectedBrancheId: 'hcr', detectedIdcc: null })?.relais_plan_conventionnel).toBeUndefined();
    const ds = validateDataset({ version: 4, generatedAt: '2026-10-08T00:00:00.000Z', opcos: EMBEDDED_OPCOS });
    const parse = ds.opcos.find((o) => o.slug === 'akto')!.variantes_branche!.find((v) => v.id === 'organismes-de-formation')!;
    expect(parse.relais_plan_conventionnel).toBe(true);
    expect(sanityCheckOpco(ds.opcos.find((o) => o.slug === 'akto')!)).toEqual([]);
  });
});
