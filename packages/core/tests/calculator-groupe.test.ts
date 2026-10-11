import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { etatGroupe, opcoGroupe, sourced } from './fixtures';

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

  it('un appel explicite à 1 personne rend exactement le résultat de l’appel sans paramètre', () => {
    expect(calculateFunding(opcoGroupe(), etatGroupe(), 1)).toEqual(calculateFunding(opcoGroupe(), etatGroupe()));
  });

  it('quatre personnes : le coût demandé et le financement valent 4 fois ceux d’une personne', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(r.personnes).toBe(4);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 20000, fundedAmount: 16000, remainder: 4000 });
  });

  it('le détail du calcul garde la ligne d’une personne et ajoute celle du groupe', () => {
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

  it('l’avertissement de dépassement donne le reste à charge du groupe et dit pour combien de personnes', () => {
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

  it('un nombre de personnes invalide (0, négatif, décimal, NaN, infini) est ramené à un entier d’au moins 1', () => {
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

  it('plafond à 0 € ou déjà consommé : rien n’est financé, aucun montant négatif, un seul message de budget nul', () => {
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
