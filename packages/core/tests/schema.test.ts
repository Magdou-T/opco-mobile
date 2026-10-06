import { describe, it, expect } from 'vitest';
import {
  AlerteOpcoSchema,
  DispositifComplementaireSchema,
  OpcoDataSchema,
  PlafondTailleSchema,
  VarianteBrancheSchema,
  validateDataset,
  sanityCheckOpco,
} from '../src/schema';
import { ALERTE_OPCO_LABELS } from '../src/types';
import type { AlerteOpco } from '../src/types';
import { EMBEDDED_OPCOS } from '../src/data';
import { makeOpco } from './fixtures';

describe('schéma — dataset embarqué', () => {
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

  it('validateDataset accepte le dataset embarqué', () => {
    const ds = { version: 1, generatedAt: new Date().toISOString(), opcos: EMBEDDED_OPCOS };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it('validateDataset rejette un dataset incomplet', () => {
    const ds = { version: 1, generatedAt: new Date().toISOString(), opcos: EMBEDDED_OPCOS.slice(0, 3) };
    expect(() => validateDataset(ds)).toThrow();
  });

  it('sanityCheck détecte un coût horaire hors bornes', () => {
    const bad = { ...EMBEDDED_OPCOS[0], cout_horaire_inter: { value: 999, confidence: 'exact', source_url: 'x' } };
    expect(sanityCheckOpco(bad as never).length).toBeGreaterThan(0);
  });
});

// Les schémas des OPCO ne sont pas stricts : une clé absente du schéma serait supprimée en silence au parsing.
// Chaque test vérifie donc que la valeur ressort du parsing, pas seulement que le parsing réussit.
describe('schéma — champs des barèmes vérifiés (v2)', () => {
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
