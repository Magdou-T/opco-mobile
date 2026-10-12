import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { DispositifComplementaire } from '../src/types';
import { etatGroupe, makeFormationState, opcoGroupe, sourced } from './fixtures';

/** Espace insécable (U+00A0), construite par son code : entre un nombre et son unité dans les textes du moteur. */
const NBSP = String.fromCharCode(0xa0);

const poste = (r: ReturnType<typeof calculateFunding>, p: string) => r.lines.find((l) => l.poste === p)!;

describe('calculateFunding pour n personnes : coûts pédagogiques', () => {
  it('une personne : `personnes` vaut 1 et aucune ligne de détail ne parle de groupe', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe());
    expect(r.personnes).toBe(1);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 5000, fundedAmount: 4000, remainder: 1000 });
    expect((poste(r, 'pedagogie').details ?? []).some((d) => d.includes('personne'))).toBe(false);
  });

  it("un appel explicite à 1 personne rend exactement le résultat de l'appel sans paramètre", () => {
    expect(calculateFunding(opcoGroupe(), etatGroupe(), 1)).toEqual(calculateFunding(opcoGroupe(), etatGroupe()));
  });

  it("quatre personnes : le coût demandé et le financement valent 4 fois ceux d'une personne", () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(r.personnes).toBe(4);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 20000, fundedAmount: 16000, remainder: 4000 });
  });

  it("le détail du calcul garde la ligne d'une personne et ajoute celle du groupe", () => {
    const details = poste(calculateFunding(opcoGroupe(), etatGroupe(), 4), 'pedagogie').details ?? [];
    expect(details).toContain(`Coût pour 4${NBSP}personnes : 5000.00${NBSP}€ × 4 = 20000.00${NBSP}€`);
    expect(details).toContain(`Financement pour 4${NBSP}personnes : 4000.00${NBSP}€ × 4 = 16000.00${NBSP}€`);
    expect(details).toContain(`Reste à charge pour 4${NBSP}personnes : 1000.00${NBSP}€ × 4 = 4000.00${NBSP}€`);
    expect(details).toContain(`Calcul : 40${NBSP}€/h × 100${NBSP}h = 4000.00${NBSP}€`);
  });

  it('la ligne « Coût pour » part du coût saisi, comme le coût demandé (coût horaire arrondi : 4250 € sur 140 h)', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe({ pedagogyCostTotal: 4250, pedagogyCostPerHour: 30.36, durationHours: 140 }), 4);
    expect(poste(r, 'pedagogie').requestedAmount).toBe(17000);
    expect(poste(r, 'pedagogie').details).toContain(`Coût pour 4${NBSP}personnes : 4250.00${NBSP}€ × 4 = 17000.00${NBSP}€`);
  });

  it('budget publié sans plafond horaire : le groupe est financé à hauteur du budget, une seule fois', () => {
    const opco = opcoGroupe({ cout_horaire_inter: sourced(null), budget_annuel_max: sourced(12000), budget_annuel_portee: 'pedagogie' });
    const trois = calculateFunding(opco, etatGroupe(), 3);
    expect(poste(trois, 'pedagogie')).toMatchObject({ requestedAmount: 15000, fundedAmount: 12000, remainder: 3000 });
    expect(trois.budgetCapApplied).toBe(true);
    expect(poste(calculateFunding(opco, etatGroupe(), 2), 'pedagogie')).toMatchObject({ requestedAmount: 10000, fundedAmount: 10000, remainder: 0 });
  });

  it("l'avertissement de dépassement donne le reste à charge du groupe et dit pour combien de personnes", () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(r.warnings).toContain(
      `Le coût horaire demandé (50${NBSP}€/h) dépasse le plafond Test OPCO (40${NBSP}€/h). Le reste à charge est de 4000.00${NBSP}€ pour 4${NBSP}personnes.`,
    );
  });

  it('barème dégressif : financement et reste à charge du groupe', () => {
    const opco = opcoGroupe({
      cout_horaire_seuils: [
        { max_heures: 50, valeur: 40 },
        { max_heures: null, valeur: 20 },
      ],
      cout_horaire_seuils_mode: 'par_tranche',
    });
    const un = calculateFunding(opco, etatGroupe());
    const trois = calculateFunding(opco, etatGroupe(), 3);
    expect(poste(un, 'pedagogie')).toMatchObject({ requestedAmount: 5000, fundedAmount: 3000, remainder: 2000 });
    expect(poste(trois, 'pedagogie')).toMatchObject({ requestedAmount: 15000, fundedAmount: 9000, remainder: 6000 });
    expect(trois.warnings).toContain(
      `Le barème dégressif de Test OPCO laisse un reste à charge de 6000.00${NBSP}€ sur les coûts pédagogiques pour 3${NBSP}personnes.`,
    );
  });

  it("un nombre de personnes invalide (0, négatif, décimal, NaN, infini) est ramené à un entier d'au moins 1", () => {
    const base = calculateFunding(opcoGroupe(), etatGroupe());
    for (const n of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.4]) {
      expect(calculateFunding(opcoGroupe(), etatGroupe(), n), String(n)).toEqual(base);
    }
    expect(calculateFunding(opcoGroupe(), etatGroupe(), 3.9).personnes).toBe(3);
  });
});

describe('calculateFunding pour n personnes : plafond annuel de portée « pédagogie »', () => {
  const avecPlafond = (plafond: number) => opcoGroupe({ budget_annuel_max: sourced(plafond), budget_annuel_portee: 'pedagogie' });

  it('plafond non atteint : aucun effet', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe(), 2);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(8000);
    expect(r.budgetCapApplied).toBe(false);
  });

  it('plafond atteint par le groupe : le poste pédagogique est ramené au plafond, une seule fois', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe(), 3);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(10000);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetCapAmount).toBe(10000);
  });

  it('le budget déjà consommé est déduit une fois du plafond du groupe', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe({ budgetDejaConsomme: 4000 }), 2);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(6000);
    expect(r.budgetCapAmount).toBe(6000);
    expect(r.budgetDejaConsomme).toBe(4000);
  });

  it("plafond à 0 € ou déjà consommé : rien n'est financé, aucun montant négatif, un seul message de budget nul", () => {
    for (const [plafond, consomme] of [[0, null], [10000, 10000], [10000, 25000]] as const) {
      const r = calculateFunding(avecPlafond(plafond), etatGroupe({ budgetDejaConsomme: consomme }), 5);
      expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 25000, fundedAmount: 0, remainder: 25000 });
      expect(r.lines.every((l) => l.fundedAmount >= 0 && l.remainder >= 0)).toBe(true);
    }
    const nul = calculateFunding(avecPlafond(0), etatGroupe(), 5);
    expect(nul.warnings.filter((w) => w.includes("Aucun budget n'est disponible"))).toHaveLength(1);
  });
});

describe('calculateFunding pour n personnes : plan fermé aux 50 salariés et plus', () => {
  it('les lignes à 0 € demandent n fois le coût', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe({ companySize: '50_299' }), 4);
    expect(r.pdcFerme).toBe(true);
    expect(r.personnes).toBe(4);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 20000, fundedAmount: 0, remainder: 20000 });
    expect(poste(r, 'hebergement')).toMatchObject({ requestedAmount: 1920, fundedAmount: 0 });
    expect(poste(r, 'restauration')).toMatchObject({ requestedAmount: 300, fundedAmount: 0 });
  });
});

describe('calculateFunding pour n personnes : salaires et frais annexes', () => {
  it("quatre personnes : chaque poste vaut 4 fois celui d'une personne", () => {
    const un = calculateFunding(opcoGroupe(), etatGroupe());
    const quatre = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    // Une personne : salaires 12 €/h × 100 h ; transport 30 € × 5 jours ; nuit à 120 € plafonnée à 100 € ; repas à 15 €, sous le forfait.
    expect(poste(un, 'salaires')).toMatchObject({ requestedAmount: 1200, fundedAmount: 1200 });
    expect(poste(un, 'transport')).toMatchObject({ requestedAmount: 150, fundedAmount: 150 });
    expect(poste(un, 'hebergement')).toMatchObject({ requestedAmount: 480, fundedAmount: 400, remainder: 80 });
    expect(poste(un, 'restauration')).toMatchObject({ requestedAmount: 75, fundedAmount: 75, remainder: 0 });
    expect(un).toMatchObject({ totalRequested: 6905, totalFunded: 5825, totalRemainder: 1080 });
    expect(poste(quatre, 'salaires')).toMatchObject({ requestedAmount: 4800, fundedAmount: 4800 });
    expect(poste(quatre, 'transport')).toMatchObject({ requestedAmount: 600, fundedAmount: 600 });
    expect(poste(quatre, 'hebergement')).toMatchObject({ requestedAmount: 1920, fundedAmount: 1600, remainder: 320 });
    expect(poste(quatre, 'restauration')).toMatchObject({ requestedAmount: 300, fundedAmount: 300, remainder: 0 });
    expect(quatre).toMatchObject({ totalRequested: 27620, totalFunded: 23300, totalRemainder: 4320 });
  });

  it("le détail de chaque poste garde la ligne d'une personne et ajoute celle du groupe", () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(poste(r, 'salaires').details).toContain(`Pour 4${NBSP}personnes : 1200.00${NBSP}€ × 4 = 4800.00${NBSP}€`);
    expect(poste(r, 'transport').details).toContain(`Pour 4${NBSP}personnes : 150.00${NBSP}€ × 4 = 600.00${NBSP}€`);
    expect(poste(r, 'hebergement').details).toContain(`Financement pour 4${NBSP}personnes : 400.00${NBSP}€ × 4 = 1600.00${NBSP}€`);
    expect(poste(r, 'restauration').details).toContain(`Pour 4${NBSP}personnes : 75.00${NBSP}€ × 4 = 300.00${NBSP}€`);
    expect(poste(r, 'salaires').note).toBe(`12${NBSP}€/h × 100${NBSP}h × 4${NBSP}personnes`);
    for (const p of ['salaires', 'transport', 'hebergement', 'restauration']) {
      const details = poste(calculateFunding(opcoGroupe(), etatGroupe()), p).details ?? [];
      expect(details.some((d) => d.includes('personne')), p).toBe(false);
    }
  });

  it("restauration au-dessus du forfait : le reste à charge du groupe suit celui d'une personne", () => {
    const details = poste(calculateFunding(opcoGroupe(), etatGroupe({ mealCostPerDay: 25 }), 4), 'restauration').details ?? [];
    expect(details).toContain(`Reste à charge : 25.00${NBSP}€`);
    expect(details).toContain(`Reste à charge pour 4${NBSP}personnes : 25.00${NBSP}€ × 4 = 100.00${NBSP}€`);
    const un = poste(calculateFunding(opcoGroupe(), etatGroupe({ mealCostPerDay: 25 })), 'restauration').details ?? [];
    expect(un).toContain(`Reste à charge : 25.00${NBSP}€`);
    expect(un.some((d) => d.includes('personne'))).toBe(false);
  });

  it("hébergement : le coût d'une personne est suivi de celui du groupe, que la nuit dépasse le plafond ou non", () => {
    const audessus = poste(calculateFunding(opcoGroupe(), etatGroupe(), 4), 'hebergement').details ?? [];
    expect(audessus).toContain(`Coût pour 4${NBSP}personnes : 480.00${NBSP}€ × 4 = 1920.00${NBSP}€`);
    expect(audessus).toContain(`Financement pour 4${NBSP}personnes : 400.00${NBSP}€ × 4 = 1600.00${NBSP}€`);
    const sous = poste(calculateFunding(opcoGroupe(), etatGroupe({ accommodationCostPerNight: 80 }), 4), 'hebergement');
    expect(sous).toMatchObject({ requestedAmount: 1280, fundedAmount: 1280, remainder: 0 });
    expect(sous.details).toContain(`Coût pour 4${NBSP}personnes : 320.00${NBSP}€ × 4 = 1280.00${NBSP}€`);
    expect(sous.details).toContain(`Financement pour 4${NBSP}personnes : 320.00${NBSP}€ × 4 = 1280.00${NBSP}€`);
  });

  it("hébergement sous le plafond : les deux lignes du groupe, aux mêmes montants, disent l'une le coût, l'autre le financement", () => {
    // 80 € la nuit, sous le plafond de 100 € : coût et financement d'une personne valent tous deux 320 € (4 nuits).
    const details = poste(calculateFunding(opcoGroupe(), etatGroupe({ accommodationCostPerNight: 80 }), 4), 'hebergement').details ?? [];
    expect(details.filter((d) => d.includes(`320.00${NBSP}€ × 4 = 1280.00${NBSP}€`))).toEqual([
      `Coût pour 4${NBSP}personnes : 320.00${NBSP}€ × 4 = 1280.00${NBSP}€`,
      `Financement pour 4${NBSP}personnes : 320.00${NBSP}€ × 4 = 1280.00${NBSP}€`,
    ]);
  });

  it("tout montant d'une personne énoncé dans un détail a sa ligne de groupe, dans chaque poste (spécification 5.2)", () => {
    const situations = [
      etatGroupe(),
      etatGroupe({ accommodationCostPerNight: 80, mealCostPerDay: 25 }),
      etatGroupe({ pedagogyCostTotal: 3000, pedagogyCostPerHour: 30 }),
    ];
    let montants = 0;
    for (const etat of situations) {
      for (const l of calculateFunding(opcoGroupe(), etat, 4).lines) {
        const details = l.details ?? [];
        for (const d of details) {
          const montant = new RegExp(`(\\d+\\.\\d{2})${NBSP}€$`).exec(d);
          if (!montant || d.includes(' × 4 = ')) continue;
          montants++;
          expect(details.some((g) => g.includes(`${montant[1]}${NBSP}€ × 4 = `)), `${l.poste} : ${d}`).toBe(true);
        }
      }
    }
    expect(montants).toBeGreaterThan(20);
  });

  it('salaires en pourcentage des coûts pédagogiques : le pourcentage porte sur le financement du groupe, sans second facteur', () => {
    const opco = opcoGroupe({ prise_en_charge_salaires: sourced(50), prise_en_charge_salaires_mode: 'pourcentage_pedagogique' });
    expect(poste(calculateFunding(opco, etatGroupe()), 'salaires')).toMatchObject({ requestedAmount: 2000, fundedAmount: 2000 });
    expect(poste(calculateFunding(opco, etatGroupe(), 3), 'salaires')).toMatchObject({ requestedAmount: 6000, fundedAmount: 6000 });
  });
});

describe('calculateFunding pour n personnes : plafond annuel de portée « global »', () => {
  const avecPlafond = (plafond: number) => opcoGroupe({ budget_annuel_max: sourced(plafond) });

  it('trois personnes sous le plafond : aucun effet', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe(), 3);
    expect(r).toMatchObject({ totalFunded: 17475, budgetCapApplied: false, budgetCapAmount: null });
  });

  it('quatre personnes au-dessus du plafond : le total du groupe est ramené au plafond, lignes réduites du même ratio', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe(), 4);
    expect(r).toMatchObject({ totalFunded: 20000, budgetCapApplied: true, budgetCapAmount: 20000 });
    const somme = r.lines.reduce((s, l) => s + l.fundedAmount, 0);
    expect(Math.abs(somme - 20000)).toBeLessThanOrEqual(0.03);
    expect(r.lines.every((l) => l.fundedAmount <= l.requestedAmount && l.remainder >= 0)).toBe(true);
    expect(poste(r, 'pedagogie').fundedAmount).toBeCloseTo((16000 * 20000) / 23300, 1);
  });

  it('le budget déjà consommé est déduit une seule fois du plafond du groupe', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe({ budgetDejaConsomme: 5000 }), 3);
    expect(r).toMatchObject({ totalFunded: 15000, budgetCapApplied: true, budgetCapAmount: 15000, budgetDejaConsomme: 5000 });
  });
});

describe("calculateFunding pour n personnes : dispositifs complémentaires de l'OPCO", () => {
  const dispositif = (id: string, over: Partial<DispositifComplementaire>): DispositifComplementaire => ({
    id,
    nom: `Dispositif ${id}`,
    cumul: 'additif',
    montant_max: null,
    unite: null,
    pourcentage_couts: null,
    description: 'Dispositif fictif.',
    conditions: [],
    demarches: 'Déposer la demande.',
    tailles_eligibles: null,
    publics: null,
    confidence: 'exact',
    source_url: 'x',
    ...over,
  });
  const opco = opcoGroupe({
    dispositifs_complementaires: [
      dispositif('par-stagiaire', { cumul: 'alternatif', montant_max: 750, unite: 'par_stagiaire', pourcentage_couts: 50 }),
      dispositif('par-dossier', { montant_max: 500, unite: 'par_dossier' }),
      dispositif('par-heure', { montant_max: 10, unite: 'par_heure' }),
    ],
  });
  const montant = (r: ReturnType<typeof calculateFunding>, id: string) =>
    r.dispositifsComplementaires.find((d) => d.id === id)?.montantEstime;

  it('une personne : 50 % du coût plafonnés à 750 €, forfait de 500 €, 10 € par heure', () => {
    const r = calculateFunding(opco, etatGroupe());
    expect([montant(r, 'par-stagiaire'), montant(r, 'par-dossier'), montant(r, 'par-heure')]).toEqual([750, 500, 1000]);
  });

  it('quatre personnes : seul le plafond « par stagiaire » est multiplié', () => {
    const r = calculateFunding(opco, etatGroupe(), 4);
    // 50 % de 20 000 € = 10 000 €, plafonnés à 4 × 750 € ; les autres unités ne se multiplient pas (prudence).
    expect([montant(r, 'par-stagiaire'), montant(r, 'par-dossier'), montant(r, 'par-heure')]).toEqual([3000, 500, 1000]);
  });

  it('un montant forfaitaire « par stagiaire », sans pourcentage, vaut n fois son montant', () => {
    const forfait = opcoGroupe({ dispositifs_complementaires: [dispositif('forfait', { montant_max: 750, unite: 'par_stagiaire' })] });
    expect(montant(calculateFunding(forfait, etatGroupe()), 'forfait')).toBe(750);
    expect(montant(calculateFunding(forfait, etatGroupe(), 4), 'forfait')).toBe(3000);
  });
});

describe('calculateFunding pour n personnes : données réelles', () => {
  it("sans plafond annuel atteint, chaque ligne du groupe vaut n fois celle d'une personne (au demi-centime par personne)", () => {
    let comparaisons = 0;
    for (const opco of EMBEDDED_OPCOS) {
      const idccs = [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)];
      for (const idcc of idccs) {
        for (const taille of ['less_11', '11_49', '50_299'] as const) {
          const etat = makeFormationState({
            selectedOpcoSlug: opco.slug,
            detectedIdcc: idcc,
            companySize: taille,
            trainingMode: 'presentiel',
            formationType: 'certification',
            certificationLevel: 'rncp',
            durationHours: 35,
            pedagogyCostTotal: 1400,
            pedagogyCostPerHour: 40,
            needsTransport: true,
            trainingDays: 5,
            needsAccommodation: true,
            accommodationNights: 4,
            accommodationCostPerNight: 90,
            needsMeals: true,
            mealCostPerDay: 18,
          });
          const un = calculateFunding(opco, etat);
          for (const n of [2, 5, 12]) {
            const groupe = calculateFunding(opco, etat, n);
            expect(groupe.personnes).toBe(n);
            if (groupe.budgetCapApplied || un.budgetCapApplied) continue;
            comparaisons++;
            expect(groupe.lines.map((l) => l.poste)).toEqual(un.lines.map((l) => l.poste));
            groupe.lines.forEach((l, i) => {
              for (const champ of ['requestedAmount', 'fundedAmount', 'remainder'] as const) {
                expect(Math.abs(l[champ] - un.lines[i][champ] * n), `${opco.slug} ${idcc} ${taille} n=${n} ${l.poste} ${champ}`).toBeLessThanOrEqual(
                  0.005 * n + 0.005,
                );
              }
            });
          }
        }
      }
    }
    expect(comparaisons).toBeGreaterThan(150);
  });

  it("aucun texte du calcul d'un groupe ne promet plus que l'estimation", () => {
    const PROMESSES = /intégralement|garanti|assuré|totalité/i;
    let textes = 0;
    for (const opco of EMBEDDED_OPCOS) {
      const etat = makeFormationState({
        selectedOpcoSlug: opco.slug,
        trainingMode: 'presentiel',
        durationHours: 21,
        pedagogyCostTotal: 900,
        pedagogyCostPerHour: 900 / 21,
        needsMeals: true,
        mealCostPerDay: 12,
        trainingDays: 3,
      });
      const r = calculateFunding(opco, etat, 6);
      for (const t of [...r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...r.warnings]) {
        textes++;
        expect(t, opco.slug).not.toMatch(PROMESSES);
      }
    }
    expect(textes).toBeGreaterThan(50);
  });
});
