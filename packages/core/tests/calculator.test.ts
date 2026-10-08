import { describe, it, expect } from 'vitest';
import { calculateFunding, applyVarianteBranche } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { AlerteOpco, Confidence, DispositifComplementaire, OpcoData, PlafondTaille, VarianteBranche, WizardState } from '../src/types';
import { makeOpco, makeFormationState } from './fixtures';

/** Espace insécable (U+00A0), construite par son code : entre un nombre et son unité dans les textes du moteur. */
const NBSP = String.fromCharCode(0xa0);

describe('calculateFunding, coûts pédagogiques', () => {
  it('finance intégralement quand le coût est sous le plafond horaire', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.requestedAmount).toBe(3000);
    expect(peda.fundedAmount).toBe(3000); // 30€/h sous le plafond 40€/h
    expect(peda.remainder).toBe(0);
  });

  it('plafonne au plafond horaire et laisse un reste à charge', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.fundedAmount).toBe(4000); // 40€/h × 100h
    expect(peda.remainder).toBe(1000); // (50-40) × 100
    expect(r.warnings.some((w) => w.includes('dépasse le plafond'))).toBe(true);
  });

  it('marque depends_on_branche quand aucun plafond horaire connu, sans compter de montant faute de budget annuel publié', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
      cout_horaire_metier: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 50, pedagogyCostPerHour: 25 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.confidence).toBe('depends_on_branche');
    expect(peda.requestedAmount).toBe(1250);
    // Ni plafond horaire ni budget annuel publiés : rien ne borne le montant, il n'est donc pas compté comme financé
    // (avant la tâche 8a, le coût saisi entier était financé).
    expect(peda.fundedAmount).toBe(0);
  });
});

describe('calculateFunding, textes du calcul : rien de plus fort que l’estimation, dépassement lisible au centime', () => {
  const opcoA = (plafond: number) => makeOpco({ cout_horaire_inter: { value: plafond, confidence: 'exact', source_url: 'x' } });
  const pedagogie = (r: ReturnType<typeof calculateFunding>) => r.lines.find((l) => l.poste === 'pedagogie')!;

  it('coût horaire sous le plafond : l’estimation le retient en entier, sans promettre une prise en charge', () => {
    const r = calculateFunding(opcoA(40), makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 }));
    expect(pedagogie(r).details).toContain("Votre coût horaire ne dépasse pas le plafond : l'estimation le retient en entier.");
    expect(pedagogie(r).fundedAmount).toBe(3000);
  });

  it('hébergement sous le plafond, repas sous le forfait : même formulation', () => {
    const opco = makeOpco({
      frais_hebergement: { value: 100, confidence: 'exact', source_url: 'x' },
      frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' },
    });
    const r = calculateFunding(
      opco,
      makeFormationState({
        needsAccommodation: true, accommodationCostPerNight: 80, accommodationNights: 2, needsMeals: true, mealCostPerDay: 15, trainingDays: 5,
      }),
    );
    const heb = r.lines.find((l) => l.poste === 'hebergement')!;
    const repas = r.lines.find((l) => l.poste === 'restauration')!;
    expect(heb.details).toContain("Votre coût par nuit ne dépasse pas le plafond : l'estimation le retient en entier.");
    expect(repas.details).toContain("Votre coût ne dépasse pas le forfait : l'estimation le retient en entier.");
    expect([heb.fundedAmount, repas.fundedAmount]).toEqual([160, 75]);
  });

  it('données réelles, tous OPCO et branches : aucun texte du calcul ne promet plus que l’estimation', () => {
    const PROMESSES = /intégralement|garanti|assuré|totalité/i;
    let textes = 0;
    for (const opco of EMBEDDED_OPCOS) {
      for (const idcc of [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)]) {
        for (const over of [
          { durationHours: 21, pedagogyCostTotal: 300, pedagogyCostPerHour: 300 / 21 },
          { durationHours: 7, pedagogyCostTotal: 140, pedagogyCostPerHour: 20, needsMeals: true, mealCostPerDay: 5, trainingDays: 1 },
          { durationHours: 14, pedagogyCostTotal: 280, pedagogyCostPerHour: 20, needsAccommodation: true, accommodationCostPerNight: 30, accommodationNights: 1 },
        ]) {
          const r = calculateFunding(opco, makeFormationState({ selectedOpcoSlug: opco.slug, detectedIdcc: idcc, trainingMode: 'presentiel', ...over }));
          for (const t of [...r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...r.warnings]) {
            textes++;
            expect(t, `${opco.slug} ${idcc}`).not.toMatch(PROMESSES);
          }
        }
      }
    }
    expect(textes).toBeGreaterThan(1000);
  });

  it('coût horaire égal au plafond une fois arrondi au centime (4 200,50 € sur 140 h, plafond 30 €/h) : dépassement écrit en euros, montants inchangés', () => {
    const r = calculateFunding(
      opcoA(30),
      makeFormationState({ durationHours: 140, pedagogyCostTotal: 4200.5, pedagogyCostPerHour: 4200.5 / 140 }),
    );
    const peda = pedagogie(r);
    // (4 200,50 / 140 - 30) x 140 = 0,50 € au-dessus du plafond : 4 200 € financés, 0,50 € de reste.
    expect(peda).toMatchObject({ requestedAmount: 4200.5, fundedAmount: 4200, remainder: 0.5 });
    expect(peda.details).toContain(`Votre coût dépasse le plafond de 0.50${NBSP}€ sur la formation → taux appliqué : 30${NBSP}€/h`);
    expect(r.warnings).toContain(`Le coût demandé dépasse le plafond Test OPCO (30${NBSP}€/h) de 0.50${NBSP}€ sur la formation : ce montant reste à charge.`);
    // Jamais un coût horaire qui s'affiche 30 €/h présenté au-dessus d'un plafond de 30 €/h (espace ordinaire ou insécable).
    expect([...(peda.details ?? []), ...r.warnings].filter((t) => /\(30(?:\.\d+)?\s€\/h\) dépasse/.test(t))).toEqual([]);
  });

  it('coût horaire au-dessus du plafond une fois arrondi (30,10 €/h) : le dépassement reste écrit en €/h', () => {
    const r = calculateFunding(opcoA(30), makeFormationState({ durationHours: 140, pedagogyCostTotal: 4214, pedagogyCostPerHour: 4214 / 140 }));
    expect(pedagogie(r).details).toContain(`Votre coût (30.1${NBSP}€/h) dépasse le plafond → taux appliqué : 30${NBSP}€/h`);
    expect(r.warnings).toContain(
      `Le coût horaire demandé (30.1${NBSP}€/h) dépasse le plafond Test OPCO (30${NBSP}€/h). Le reste à charge est de 14.00${NBSP}€.`,
    );
    expect(pedagogie(r)).toMatchObject({ fundedAmount: 4200, remainder: 14 });
  });

  it('coût horaire égal au plafond (30 €/h pour un plafond de 30 €/h) : aucun avertissement ni détail de dépassement', () => {
    // 4 200 € sur 140 h : 30 €/h exactement, le plafond. L'estimation retient le coût en entier, sans reste à charge ni « dépasse ».
    const r = calculateFunding(opcoA(30), makeFormationState({ durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30 }));
    expect(pedagogie(r)).toMatchObject({ requestedAmount: 4200, fundedAmount: 4200, remainder: 0 });
    expect(pedagogie(r).details).toContain("Votre coût horaire ne dépasse pas le plafond : l'estimation le retient en entier.");
    expect([...(pedagogie(r).details ?? []), ...r.warnings].filter((t) => /dépasse le plafond|Reste à charge sur ce poste/.test(t) && !t.includes('ne dépasse pas'))).toEqual([]);
  });

  it("variante de branche appliquée, forfaits de transport, d'hébergement et de restauration non publiés : « non publié pour la branche » plutôt que « selon votre accord de branche »", () => {
    const variante: VarianteBranche = {
      id: 'branche-test', branche_nom: 'Branche de test', idcc: ['9999'], source_url: 'https://example.opco.fr/branche', confidence: 'exact',
    };
    const etat = makeFormationState({
      selectedBrancheId: 'branche-test', needsTransport: true, transportMode: 'train', trainingDays: 2,
      needsAccommodation: true, accommodationNights: 1, accommodationCostPerNight: 90, needsMeals: true, mealCostPerDay: 15,
    });
    const r = calculateFunding(makeOpco({ variantes_branche: [variante] }), etat);
    expect(r.brancheAppliquee).toBe('Branche de test');
    const poste = (p: string) => r.lines.find((l) => l.poste === p)!;
    expect(poste('transport').note).toBe('Forfait transport non publié pour la branche Branche de test');
    expect(poste('transport').details).toEqual([
      'Test OPCO ne publie pas de forfait transport fixe',
      'Non publié pour la branche Branche de test : montant à confirmer auprès de Test OPCO',
    ]);
    expect(poste('restauration').note).toBe('Forfait restauration non publié pour la branche Branche de test');
    expect(poste('hebergement').note).toBe(
      'Plafond hébergement non publié pour la branche Branche de test : montant à confirmer auprès de Test OPCO',
    );
    for (const l of r.lines) expect([l.note ?? '', ...(l.details ?? [])].join(' '), l.poste).not.toMatch(/accord de branche/);
    // Sans variante appliquée, le texte d'origine reste : la branche n'est pas connue.
    const sansBranche = calculateFunding(makeOpco(), { ...etat, selectedBrancheId: null });
    expect(sansBranche.lines.find((l) => l.poste === 'transport')!.note).toBe('Montant transport selon accord de branche');
  });

  it("données réelles, chaque branche de chaque OPCO, chaque poste non publié (salaires, transport, hébergement, restauration) : « pour la branche » suivi du nom de la branche se lit, jamais « la branche Branches ... »", () => {
    // Les quatre postes rendus non publiés chez l'OPCO et dans la branche : le moteur écrit, pour chaque poste, sa phrase
    // « ... non publié(e) pour la branche <nom> ». Le site écrit aussi « Barème de la branche <nom> » et « le barème de la
    // branche « <nom> » » : un nom de branche qui commence par « Branche(s) » se lit faux partout.
    const nonPublie = { value: null, confidence: 'depends_on_branche' as const, source_url: 'https://example.opco.fr/criteres' };
    const phrases: string[] = [];
    for (const opco of EMBEDDED_OPCOS) {
      for (const variante of opco.variantes_branche ?? []) {
        const brancheSansPostes: VarianteBranche = {
          ...variante,
          prise_en_charge_salaires: undefined, prise_en_charge_salaires_mode: undefined, frais_transport: undefined,
          frais_hebergement: undefined, frais_restauration: undefined, frais_annexes_pourcentage: undefined,
        };
        const opcoSansPostes: OpcoData = {
          ...opco,
          prise_en_charge_salaires: nonPublie, prise_en_charge_salaires_mode: 'selon_accord', frais_transport: nonPublie,
          frais_hebergement: nonPublie, frais_restauration: nonPublie, frais_annexes_pourcentage: nonPublie,
          variantes_branche: [brancheSansPostes],
        };
        const r = calculateFunding(
          opcoSansPostes,
          makeFormationState({
            selectedOpcoSlug: opco.slug, selectedBrancheId: variante.id, companySize: 'less_11', needsTransport: true,
            transportMode: 'train', trainingDays: 2, needsAccommodation: true, accommodationNights: 1, accommodationCostPerNight: 90,
            needsMeals: true, mealCostPerDay: 15,
          }),
        );
        expect(r.brancheAppliquee).toBe(variante.branche_nom);
        for (const poste of ['salaires', 'transport', 'hebergement', 'restauration'] as const) {
          const ligne = r.lines.find((l) => l.poste === poste)!;
          const avecLeNom = [ligne.note ?? '', ...(ligne.details ?? [])].filter((t) => t.includes(`la branche ${variante.branche_nom}`));
          expect(avecLeNom.length, `${opco.slug} ${variante.id} ${poste}`).toBeGreaterThan(0);
          phrases.push(...avecLeNom);
        }
      }
    }
    // 38 branches, 4 postes : au moins une phrase chacun (le contrôle n'est pas vide).
    expect(phrases.length).toBeGreaterThanOrEqual(38 * 4);
    expect(phrases.filter((t) => /\bla branche\s+branches?\b/i.test(t))).toEqual([]);
  });

  it("données réelles, tous OPCO et branches, 1 000 états tirés au hasard (graine 61) : ni nombre collé à « h » ou à « % », ni « coûts péda », ni signe d'avertissement U+26A0, ni « de » sans élision devant un nom d'OPCO, ni « L'Opcommerce » au milieu d'une phrase", () => {
    // mulberry32 : tirages indépendants et reproductibles.
    let graine = 61;
    const hasard = (n: number): number => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const noms = EMBEDDED_OPCOS.map((o) => o.name);
    const voyelle = /^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/i;
    // Nom précédé de l'article « L' » (L'Opcommerce) : majuscule en début de phrase seulement.
    const avecArticle = noms.filter((n) => /^L'/.test(n)).map((n) => new RegExp(`[^.!?\\s]\\s+${n}`));
    expect(avecArticle).toHaveLength(1);
    const defauts: [string, (t: string) => boolean][] = [
      ['nombre collé à « h »', (t) => /\dh(?![\p{L}\p{N}])/u.test(t)],
      ['nombre collé à « % »', (t) => /\d%/.test(t)],
      ['« coûts péda »', (t) => /coûts péda\b/.test(t)],
      ["signe d'avertissement U+26A0", (t) => t.includes(String.fromCharCode(0x26a0))],
      ['« de » sans élision', (t) => noms.some((n) => voyelle.test(n) && t.includes(`de ${n}`))],
      ["« L'Opcommerce » au milieu d'une phrase", (t) => avecArticle.some((motif) => motif.test(t))],
    ];
    const vus = new Map<string, string[]>();
    let textes = 0;
    for (let i = 0; i < 1000; i++) {
      const opco = un(EMBEDDED_OPCOS);
      const variante = opco.variantes_branche?.length && hasard(3) > 0 ? un(opco.variantes_branche) : null;
      const heures = un([2, 3.5, 7, 21, 35, 70, 140, 400]);
      const cout = un([100, 300, 900, 1400, 4200, 12600]);
      const r = calculateFunding(
        opco,
        makeFormationState({
          selectedOpcoSlug: opco.slug, selectedBrancheId: variante?.id ?? null, trainingMode: 'presentiel',
          companySize: un(['less_11', '11_49', '50_299', '300_plus', null] as const),
          formationType: un(['non_certifiante', 'certification', 'cqp', 'habilitation', 'vae', null] as const),
          certificationLevel: un(['rncp', 'rs', null] as const),
          durationHours: heures, pedagogyCostTotal: cout, pedagogyCostPerHour: cout / heures,
          needsTransport: hasard(2) === 0, transportMode: 'train', trainingDays: Math.ceil(heures / 7),
          needsAccommodation: hasard(2) === 0, accommodationNights: 2, accommodationCostPerNight: un([40, 120]),
          needsMeals: hasard(2) === 0, mealCostPerDay: un([10, 30]), budgetDejaConsomme: un([null, 0, 500, 20000]),
        }),
      );
      const tous = [
        r.dispositifPrincipal, ...r.lines.flatMap((l) => [l.label, l.note ?? '', ...(l.details ?? [])]), ...r.warnings,
        ...r.conditions, ...r.demarches, ...r.nextSteps.map((s) => s.label),
      ];
      for (const t of tous) {
        textes++;
        for (const [nom, defaut] of defauts) if (defaut(t)) vus.set(nom, [...(vus.get(nom) ?? []), t].slice(0, 3));
      }
    }
    expect(textes).toBeGreaterThan(20000);
    expect(Object.fromEntries(vus)).toEqual({});
    // Le contrôle n'est pas vide : chaque défaut est reconnu sur un exemple.
    const exemples = ['15 €/h × 140h', 'Taux : 50% des coûts', 'coûts péda financés', `${String.fromCharCode(0x26a0)} Votre coût`, 'auprès de AKTO', "auprès de L'Opcommerce"];
    expect(exemples.map((e) => defauts.filter(([, d]) => d(e)).map(([n]) => n))).toEqual(defauts.map(([n]) => [n]));
  });

  it("données réelles, 11 OPCO et toutes leurs branches, trois projets, trois durées : entre un nombre et son unité (h, €, €/h, €/jour, €/nuit, € par repas, %, jours, nuits), l'espace des notes, des détails et des messages du calcul est insécable", () => {
    // Espace ordinaire (U+0020) entre un nombre (ou la borne ouverte « … » d'une tranche) et son unité : « 140 h », « 30 €/h »,
    // « 4200.00 € », « 20 € par repas », « 50 % », « 5 jours », « 2 nuits ».
    const ESPACE_ORDINAIRE_AVANT_UNITE = /[\d…] (?:h|€|%|jours?|nuits?)(?![\p{L}\p{N}])/u;
    const fautes = new Map<string, string>();
    let textes = 0;
    for (const opco of EMBEDDED_OPCOS) {
      for (const variante of [null, ...(opco.variantes_branche ?? [])]) {
        // Textes des données que les messages reprennent tels quels (enveloppe des 50 salariés et plus) : le moteur ne les écrit pas.
        const donnees = [...(opco.plafonds_par_taille ?? []), ...(variante?.plafonds_par_taille ?? [])]
          .map((p) => p.description)
          .filter((d): d is string => !!d);
        for (const projetType of ['formation_salarie', 'reconversion_salarie', null] as const) {
          for (const heures of [3, 140, 1300]) {
            for (const coutHoraire of [9, 95]) {
              for (const companySize of ['less_11', '11_49', '50_299', '300_plus'] as const) {
                for (const formationType of ['non_certifiante', 'certification'] as const) {
                  const bas = coutHoraire < 50;
                  const r = calculateFunding(
                    opco,
                    makeFormationState({
                      projetType, selectedOpcoSlug: opco.slug, selectedBrancheId: variante?.id ?? null, trainingMode: 'presentiel',
                      companySize, formationType, certificationLevel: formationType === 'certification' ? 'rncp' : null,
                      durationHours: heures, pedagogyCostTotal: coutHoraire * heures, pedagogyCostPerHour: coutHoraire,
                      needsTransport: true, transportMode: 'train', trainingDays: Math.ceil(heures / 7),
                      needsAccommodation: true, accommodationNights: bas ? 1 : 2, accommodationCostPerNight: bas ? 40 : 160,
                      needsMeals: true, mealCostPerDay: bas ? 8 : 40, budgetDejaConsomme: bas ? null : 500,
                    }),
                  );
                  const duMoteur = [
                    ...r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]),
                    ...r.warnings.map((w) => donnees.reduce((t, d) => t.split(d).join(''), w).replace(/«[^»]*»/g, '« »')),
                  ];
                  for (const t of duMoteur) {
                    textes++;
                    if (ESPACE_ORDINAIRE_AVANT_UNITE.test(t) && fautes.size < 12 && !fautes.has(t)) {
                      fautes.set(t, `${opco.slug} ${variante?.id ?? 'sans branche'} ${heures} h`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(textes).toBeGreaterThan(100000);
    expect(Object.fromEntries(fautes)).toEqual({});
    // Le contrôle n'est pas vide : chaque unité est reconnue après une espace ordinaire, jamais après une espace insécable.
    const exemples = ['140 h', '30 €/h', '4200.00 €', '20 € par repas', '50 %', '5 jours', '1 jour', '2 nuits', '… h'];
    expect(exemples.filter((e) => !ESPACE_ORDINAIRE_AVANT_UNITE.test(e))).toEqual([]);
    expect(exemples.filter((e) => ESPACE_ORDINAIRE_AVANT_UNITE.test(e.replace(' ', NBSP)))).toEqual([]);
    expect(['moins de 50 salariés', 'PDC 2026 est épuisée', '15 heures'].filter((e) => ESPACE_ORDINAIRE_AVANT_UNITE.test(e))).toEqual([]);
  });

  it("un jour, une nuit : singulier dans le calcul du transport, de l'hébergement et de la restauration ; pluriel à partir de deux", () => {
    const opco = makeOpco({
      frais_transport: { value: 10, confidence: 'exact', source_url: 'x' },
      frais_hebergement: { value: 100, confidence: 'exact', source_url: 'x' },
      frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' },
    });
    const textes = (jours: number, nuits: number): string[] => {
      const r = calculateFunding(
        opco,
        makeFormationState({
          durationHours: 7, needsTransport: true, transportMode: 'train', trainingDays: jours,
          needsAccommodation: true, accommodationNights: nuits, accommodationCostPerNight: 120, needsMeals: true, mealCostPerDay: 15,
        }),
      );
      return r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]);
    };
    const un = textes(1, 1);
    expect(un).toContain(`Calcul : 10${NBSP}€/jour × 1${NBSP}jour = 10.00${NBSP}€`);
    expect(un).toContain(`Calcul : 100${NBSP}€/nuit × 1${NBSP}nuit = 100.00${NBSP}€`);
    expect(un).toContain(`15${NBSP}€/jour × 1${NBSP}jour`);
    expect(un.filter((t) => /\b1\s(?:jours|nuits)\b/u.test(t))).toEqual([]);
    const deux = textes(2, 2);
    expect(deux).toContain(`Calcul : 10${NBSP}€/jour × 2${NBSP}jours = 20.00${NBSP}€`);
    expect(deux).toContain(`Votre coût : 120${NBSP}€/nuit × 2${NBSP}nuits = 240.00${NBSP}€`);
  });

  it("barème par tranches (aucun barème réel ne l'utilise aujourd'hui) : tranches, borne ouverte et heures au-delà du dernier seuil avec l'espace insécable", () => {
    const detailsDe = (seuils: { max_heures: number | null; valeur: number }[]) =>
      calculateFunding(
        makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' }),
        makeFormationState({ durationHours: 200, pedagogyCostPerHour: 9 }),
      ).lines.find((l) => l.poste === 'pedagogie')!.details ?? [];
    const bornes = detailsDe([{ max_heures: 70, valeur: 32 }, { max_heures: 140, valeur: 10 }]);
    expect(bornes).toEqual(
      expect.arrayContaining([
        `Tranche 0-70${NBSP}h : 70${NBSP}h × 9${NBSP}€/h (plafond 32${NBSP}€/h) = 630.00${NBSP}€`,
        `Tranche 70-140${NBSP}h : 70${NBSP}h × 9${NBSP}€/h (plafond 10${NBSP}€/h) = 630.00${NBSP}€`,
        `60${NBSP}h au-delà du dernier seuil publié : non financées`,
      ]),
    );
    const ouverte = detailsDe([{ max_heures: 70, valeur: 32 }, { max_heures: null, valeur: 10 }]);
    expect(ouverte).toContain(`Tranche 70-…${NBSP}h : 130${NBSP}h × 9${NBSP}€/h (plafond 10${NBSP}€/h) = 1170.00${NBSP}€`);
    expect([...bornes, ...ouverte].filter((t) => /[\d…] (?:h|€|%)(?![\p{L}\p{N}])/u.test(t))).toEqual([]);
  });
});

describe('calculateFunding, prise en charge salaires', () => {
  it('mode euro_par_heure', () => {
    const opco = makeOpco({
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
    });
    const state = makeFormationState({ durationHours: 100 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(1200); // 12€/h × 100h
  });

  it('mode pourcentage_pedagogique (% des coûts péda financés)', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 50, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'pourcentage_pedagogique',
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(1500); // 50% de 3000€
  });

  it('mode selon_accord → 0 et depends_on_branche', () => {
    const opco = makeOpco({ prise_en_charge_salaires_mode: 'selon_accord' });
    const state = makeFormationState({ durationHours: 100 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(0);
    expect(sal.confidence).toBe('depends_on_branche');
  });
});

describe('calculateFunding, prise en charge des salaires propre à la taille d\'entreprise', () => {
  const plafondTaille = (taille: PlafondTaille['taille'], over: Partial<PlafondTaille> = {}): PlafondTaille => ({
    taille,
    cout_horaire_max: null,
    budget_annuel_max: null,
    quota_horaire_max: null,
    description: `Plafond ${taille}`,
    ...over,
  });
  // Barème de type Constructys : 15 €/h sous 11 salariés, 10 €/h de 11 à 49, rien au-delà.
  const opcoSalairesParTaille = (plafonds: PlafondTaille[]): OpcoData =>
    makeOpco({
      prise_en_charge_salaires: { value: 15, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      plafonds_par_taille: plafonds,
    });
  const taillesConstructys = () => [
    plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }),
    plafondTaille('11_49', { prise_en_charge_salaires_horaire: 10 }),
  ];
  const salaires = (opco: OpcoData, companySize: WizardState['companySize']) =>
    calculateFunding(opco, makeFormationState({ companySize, durationHours: 100 })).lines.find((l) => l.poste === 'salaires')!;

  it('moins de 11 salariés : 15 €/h', () => {
    const sal = salaires(opcoSalairesParTaille(taillesConstructys()), 'less_11');
    expect(sal.fundedAmount).toBe(1500);
    expect(sal.note).toBe(`15${NBSP}€/h × 100${NBSP}h`);
  });

  it('de 11 à 49 salariés : 10 €/h, avec le détail du taux propre à la taille', () => {
    const sal = salaires(opcoSalairesParTaille(taillesConstructys()), '11_49');
    expect(sal.fundedAmount).toBe(1000);
    expect(sal.note).toBe(`10${NBSP}€/h × 100${NBSP}h`);
    expect(sal.details).toContain(`Taux propre à votre taille d'entreprise : 10${NBSP}€/h`);
    expect(sal.details).toContain(`Calcul : 10${NBSP}€/h × 100${NBSP}h = 1000.00${NBSP}€`);
  });

  it('une taille à null : aucune prise en charge des salaires, avec la note explicative', () => {
    const opco = opcoSalairesParTaille([
      plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }),
      plafondTaille('11_49', { prise_en_charge_salaires_horaire: null }),
    ]);
    const sal = salaires(opco, '11_49');
    expect(sal.fundedAmount).toBe(0);
    expect(sal.requestedAmount).toBe(0);
    expect(sal.note).toBe('Pas de prise en charge des salaires pour cette taille d\'entreprise');
    expect(sal.details?.some((d) => d.startsWith('Taux propre à votre taille'))).toBe(false);
  });

  it('une taille sans taux propre garde le taux de l\'OPCO', () => {
    const opco = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }), plafondTaille('11_49')]);
    const sal = salaires(opco, '11_49');
    expect(sal.fundedAmount).toBe(1500); // 15 €/h de l'OPCO × 100 h
    expect(sal.details?.some((d) => d.startsWith('Taux propre à votre taille'))).toBe(false);
  });

  it('une taille absente de plafonds_par_taille, une taille inconnue ou aucun plafond : taux de l\'OPCO', () => {
    const seulementTpe = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 10 })]);
    expect(salaires(seulementTpe, '11_49').fundedAmount).toBe(1500); // aucune entrée pour 11-49 : 15 €/h de l'OPCO
    expect(salaires(seulementTpe, null).fundedAmount).toBe(1500); // taille inconnue : aucun plafond ne s'applique
    expect(salaires(opcoSalairesParTaille([]), 'less_11').fundedAmount).toBe(1500);
  });

  it('un taux propre à 0 €/h est un taux (et non l\'absence de prise en charge)', () => {
    const opco = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 0 })]);
    const sal = salaires(opco, 'less_11');
    expect(sal.fundedAmount).toBe(0);
    expect(sal.note).toBe(`0${NBSP}€/h × 100${NBSP}h`);
  });

  it('le taux propre à la taille ne concerne que le mode euro_par_heure', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 50, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'pourcentage_pedagogique',
      plafonds_par_taille: [plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 })],
    });
    const sal = calculateFunding(opco, makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 30 }))
      .lines.find((l) => l.poste === 'salaires')!;
    expect(sal.fundedAmount).toBe(1500); // 50 % de 3000 € de coûts pédagogiques, inchangé
  });
});

describe('calculateFunding, plafonds & caps', () => {
  it('applique un plafond par taille d’entreprise', () => {
    const opco = makeOpco({
      plafonds_par_taille: [
        { taille: 'less_11', cout_horaire_max: 25, budget_annuel_max: 1500, quota_horaire_max: null, description: 'TPE' },
      ],
    });
    const state = makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    // 25€/h × 100h = 2500 → ramené au budget annuel 1500
    expect(peda.fundedAmount).toBe(1500);
  });

  it('applique le cap budgétaire annuel global proportionnellement', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // péda 4000 + salaire 1200 = 5200 > cap 2000 → total ramené à 2000
    expect(r.totalFunded).toBe(2000);
    expect(r.budgetCapApplied).toBe(true);
  });

  it('avertit une entreprise 300+ quand l’OPCO priorise les TPE/PME', () => {
    const opco = makeOpco({ priorite_tpe_pme: true });
    const state = makeFormationState({ companySize: '300_plus' });
    const r = calculateFunding(opco, state);
    expect(r.warnings.some((w) => w.includes('priorise les TPE/PME'))).toBe(true);
  });
});

describe('calculateFunding, V2.1 : PDC, budget consommé, cumuls', () => {
  it('le type non_certifiante utilise le plafond inter (PDC)', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ formationType: 'non_certifiante', durationHours: 20, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.fundedAmount).toBe(800); // plafonné à 40€/h × 20h
    expect(r.dispositifPrincipal).toContain('Plan de développement des compétences');
  });

  it('déduit le budget déjà consommé du plafond annuel', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, budgetDejaConsomme: 1500 });
    const r = calculateFunding(opco, state);
    // 3000 € calculés, plafond restant 2000-1500=500 €
    expect(r.totalFunded).toBe(500);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetDejaConsomme).toBe(1500);
    expect(r.warnings.some((w) => w.includes('déjà consommé'))).toBe(true);
  });

  it('enveloppe épuisée → 0 financé + warning explicite', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ budgetDejaConsomme: 2500 });
    const r = calculateFunding(opco, state);
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('épuisée'))).toBe(true);
  });

  it('filtre les dispositifs par taille et calcule l’enveloppe max potentielle', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      dispositifs_complementaires: [
        {
          id: 'boost', nom: 'Boost', cumul: 'additif',
          montant_max: 750, unite: 'par_dossier', pourcentage_couts: 50,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: ['less_11', '11_49'], publics: null,
          confidence: 'exact', source_url: 'x',
        },
        {
          id: 'grands-comptes', nom: 'GC', cumul: 'additif',
          montant_max: 5000, unite: 'par_an', pourcentage_couts: null,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: ['300_plus'], publics: null,
          confidence: 'exact', source_url: 'x',
        },
        {
          id: 'catalogue', nom: 'Catalogue', cumul: 'alternatif',
          montant_max: null, unite: null, pourcentage_couts: 100,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: null, publics: null,
          confidence: 'exact', source_url: 'x',
        },
      ],
    });
    const state = makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);

    // grands-comptes (300_plus) exclu ; boost et catalogue retenus
    expect(r.dispositifsComplementaires.map((d) => d.id).sort()).toEqual(['boost', 'catalogue']);
    // boost : PDC couvre déjà 100 % (30 €/h sous le plafond 40 €/h) → reste 0 → 0 €
    expect(r.dispositifsComplementaires.find((d) => d.id === 'boost')!.montantEstime).toBe(0);
    // l'enveloppe est plafonnée au coût : 3000
    expect(r.enveloppeMaxPotentielle).toBe(3000);
  });

  it('forfait par_heure × durée pour les dispositifs hors budget', () => {
    const opco = makeOpco({
      dispositifs_complementaires: [{
        id: 'transition', nom: 'Transition', cumul: 'hors_budget',
        montant_max: 32, unite: 'par_heure', pourcentage_couts: null,
        description: 'd', conditions: ['c'], demarches: 'm',
        tailles_eligibles: null, publics: null,
        confidence: 'exact', source_url: 'x',
      }],
    });
    const state = makeFormationState({ durationHours: 50 });
    const r = calculateFunding(opco, state);
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(1600); // 32 × 50h
  });

  it('génère des démarches concrètes ordonnées', () => {
    const opco = makeOpco();
    const r = calculateFunding(opco, makeFormationState());
    expect(r.demarches.length).toBeGreaterThanOrEqual(4);
    expect(r.demarches[0]).toContain('cotisations');
    expect(r.demarches.some((d) => d.includes('AVANT'))).toBe(true);
  });
});

describe('calculateFunding, barèmes par branche (variantes)', () => {
  const opcoAvecVariantes = () =>
    makeOpco({
      cout_horaire_inter: { value: 30, confidence: 'depends_on_branche', source_url: 'x' },
      budget_annuel_max: { value: 2500, confidence: 'depends_on_branche', source_url: 'x' },
      variantes_branche: [
        {
          id: 'organismes-de-formation',
          branche_nom: 'Organismes de formation',
          idcc: ['1516'],
          source_url: 'https://example.test/of',
          confidence: 'exact',
          cout_horaire_inter: { value: 60, confidence: 'exact', source_url: 'x' },
          prise_en_charge_salaires: { value: 15, confidence: 'exact', source_url: 'x' },
          prise_en_charge_salaires_mode: 'euro_par_heure',
          budget_annuel_max: { value: 4500, confidence: 'exact', source_url: 'x' },
        },
      ],
    });

  it('applique le barème de branche quand l’IDCC détecté correspond', () => {
    const state = makeFormationState({ detectedIdcc: '1516', durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    expect(r.brancheAppliquee).toBe('Organismes de formation');
    // Pédagogie 50€/h sous plafond branche 60 → 5000 ; salaire 15€/h × 100h = 1500.
    // Total 6500 > cap branche 4500 → réduit proportionnellement, total = 4500.
    expect(r.totalFunded).toBe(4500);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetCapAmount).toBe(4500); // cap de la BRANCHE, pas le 2500 général
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.requestedAmount).toBe(1500); // 15€/h × 100h (avant cap)
  });

  it('normalise l’IDCC court (padding 4 chiffres)', () => {
    const state = makeFormationState({ detectedIdcc: '1516', durationHours: 10, pedagogyCostPerHour: 10 });
    const r = calculateFunding(opcoAvecVariantes(), { ...state, detectedIdcc: '1516' });
    expect(r.brancheAppliquee).toBe('Organismes de formation');
  });

  it('le choix manuel de branche prime sur l’IDCC détecté', () => {
    const opco = opcoAvecVariantes();
    opco.variantes_branche!.push({
      id: 'autre-branche',
      branche_nom: 'Autre branche',
      idcc: ['9999'],
      source_url: 'x',
      confidence: 'exact',
      budget_annuel_max: { value: 1000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({
      detectedIdcc: '1516',
      selectedBrancheId: 'autre-branche',
      durationHours: 100,
      pedagogyCostPerHour: 30,
    });
    const r = calculateFunding(opco, state);
    expect(r.brancheAppliquee).toBe('Autre branche');
    expect(r.totalFunded).toBe(1000); // cap de la branche choisie manuellement
  });

  it('sans correspondance : barème général + warning explicite', () => {
    const state = makeFormationState({ detectedIdcc: '0042', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    expect(r.brancheAppliquee).toBeNull();
    expect(r.totalFunded).toBe(2500); // cap général
    expect(r.warnings.some((w) => w.includes('Barème général'))).toBe(true);
  });

  it('le warning de barème général ne cite aucune étape de l\'application', () => {
    // Le texte est affiché par l'app mobile et par le site, dont les étapes n'ont pas les mêmes noms.
    const state = makeFormationState({ detectedIdcc: '0042', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    const warning = r.warnings.find((w) => w.includes('Barème général'))!;
    expect(warning).toContain('Sélectionnez votre branche professionnelle ou vérifiez');
    expect(warning).not.toContain('étape');
  });

  it('les champs non surchargés héritent du barème général', () => {
    const opco = opcoAvecVariantes();
    // La variante OF ne surcharge pas frais_restauration
    opco.frais_restauration = { value: 19, confidence: 'exact', source_url: 'x' };
    const state = makeFormationState({
      detectedIdcc: '1516',
      durationHours: 10,
      pedagogyCostPerHour: 10,
      needsMeals: true,
      mealCostPerDay: 25,
      trainingDays: 2,
    });
    const r = calculateFunding(opco, state);
    const repas = r.lines.find((l) => l.label === 'Restauration')!;
    expect(repas.fundedAmount).toBe(38); // 19€ hérité × 2 jours
  });
});

describe('calculateFunding, forfait de frais annexes (%) et variante de branche', () => {
  const LIBELLE_FORFAIT = 'Frais annexes (forfait %)';
  const forfaitVariante = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  const opcoForfaitBatiment = (variante: Partial<VarianteBranche> = {}): OpcoData =>
    makeOpco({
      frais_annexes_pourcentage: { value: 8, confidence: 'exact', source_url: 'x' },
      frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' },
      variantes_branche: [
        {
          id: 'travaux-publics',
          branche_nom: 'Travaux publics',
          idcc: ['1702'],
          source_url: 'https://exemple.fr',
          confidence: 'exact',
          frais_annexes_pourcentage: forfaitVariante(null),
          ...variante,
        },
      ],
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, needsMeals: true, mealCostPerDay: 15, trainingDays: 2, ...over });

  it('sans IDCC : le forfait en % de l\'OPCO s\'applique', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat());
    const forfait = r.lines.filter((l) => l.label === LIBELLE_FORFAIT);
    expect(forfait).toHaveLength(1);
    expect(forfait[0].fundedAmount).toBe(240); // 8 % de 3000 € de coûts pédagogiques
  });

  it('une variante dont le forfait est null ne reçoit pas celui de l\'OPCO : aucune ligne de forfait', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat({ detectedIdcc: '1702' }));
    expect(r.brancheAppliquee).toBe('Travaux publics');
    expect(r.lines.filter((l) => l.label === LIBELLE_FORFAIT)).toHaveLength(0);
  });

  it('une variante sans forfait en % ne finance plus les frais annexes ligne par ligne : retour au calcul par poste', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat({ detectedIdcc: '1702' }));
    const repas = r.lines.find((l) => l.poste === 'restauration')!;
    expect(repas.fundedAmount).toBe(30); // forfait repas 20 €/jour, coût déclaré 15 €/jour × 2 jours
    expect(repas.note).not.toContain('forfait frais annexes');
  });

  it('une variante peut remplacer le taux du forfait', () => {
    const r = calculateFunding(opcoForfaitBatiment({ frais_annexes_pourcentage: forfaitVariante(4) }), etat({ detectedIdcc: '1702' }));
    expect(r.lines.find((l) => l.label === LIBELLE_FORFAIT)!.fundedAmount).toBe(120); // 4 % de 3000 €
  });

  it('une variante qui ne dit rien du forfait hérite de celui de l\'OPCO', () => {
    const opco = opcoForfaitBatiment();
    delete opco.variantes_branche![0].frais_annexes_pourcentage;
    const r = calculateFunding(opco, etat({ detectedIdcc: '1702' }));
    expect(r.lines.find((l) => l.label === LIBELLE_FORFAIT)!.fundedAmount).toBe(240);
  });

  it('applyVarianteBranche : le forfait de la variante remplace celui de l\'OPCO sans le muter', () => {
    const opco = opcoForfaitBatiment();
    const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
    expect(fusionne.frais_annexes_pourcentage.value).toBeNull();
    expect(opco.frais_annexes_pourcentage.value).toBe(8);
  });
});

describe('calculateFunding, règle des 50 salariés', () => {
  it('50+ sans enveloppe publiée : PDC mutualisé à 0 € et explication', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.requestedAmount).toBe(3000);
    expect(peda.fundedAmount).toBe(0);
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('moins de 50 salariés'))).toBe(true);
    expect(r.dispositifPrincipal).toContain('non accessibles');
  });

  it('50+ avec enveloppe publiée : calcul appliqué avec cette enveloppe', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      plafonds_par_taille: [
        { taille: '50_299', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'Plan conventionnel 50+.' },
      ],
    });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.totalFunded).toBe(1000);
    expect(r.warnings.some((w) => w.includes('50 salariés et plus'))).toBe(true);
  });
});

describe('calculateFunding, plan de développement des compétences fermé (pdcFerme)', () => {
  const PREMIERE_DEMARCHE =
    'Votre entreprise compte 50 salariés ou plus : le plan de développement des compétences est financé sur ses fonds propres (art. L. 6332-17 du code du travail).';
  const demarchesFerme = (nomOpco: string) => [
    PREMIERE_DEMARCHE,
    `Demandez à ${nomOpco} si votre branche prévoit des fonds conventionnels ou un plan volontaire pour les entreprises de votre taille.`,
    'Consultez les autres financements mobilisables (CPF, Région, France Travail, Transitions Pro…) avant de démarrer la formation.',
  ];
  // Démarches générales de l'OPCO de la fixture (processus d'approbation et délai publiés, sans dispositif complémentaire).
  const DEMARCHES_GENERALES = [
    'Vérifier que votre entreprise est à jour de ses cotisations auprès de Test OPCO.',
    "Demander un devis et le programme détaillé à l'organisme de formation (certifié Qualiopi).",
    'Demande dématérialisée',
    'Délai : 2-3 semaines',
    "Attendre l'accord de prise en charge AVANT de démarrer la formation (sous réserve de fonds disponibles).",
  ];
  const enveloppe = (taille: PlafondTaille['taille'], budget: number | null): PlafondTaille => ({
    taille,
    cout_horaire_max: null,
    budget_annuel_max: budget,
    quota_horaire_max: null,
    description: `Plan conventionnel ${taille}.`,
  });
  const resultat = (opco: OpcoData, companySize: WizardState['companySize']) =>
    calculateFunding(opco, makeFormationState({ companySize, durationHours: 100, pedagogyCostPerHour: 30 }));

  it('300 salariés et plus sans enveloppe publiée : pdcFerme est vrai et la première démarche annonce le financement sur fonds propres', () => {
    const r = resultat(makeOpco(), '300_plus');
    expect(r.pdcFerme).toBe(true);
    expect(r.demarches[0]).toBe(
      'Votre entreprise compte 50 salariés ou plus : le plan de développement des compétences est financé sur ses fonds propres (art. L. 6332-17 du code du travail).',
    );
  });

  it('les démarches sont exactement les trois textes du PDC fermé, avec le nom de l\'OPCO', () => {
    expect(resultat(makeOpco(), '300_plus').demarches).toEqual(demarchesFerme('Test OPCO'));
    // Au milieu de la phrase, l'article du nom passe en minuscule : « Demandez à l'Opcommerce ».
    expect(resultat(makeOpco({ name: "L'Opcommerce" }), '300_plus').demarches[1]).toBe(
      "Demandez à l'Opcommerce si votre branche prévoit des fonds conventionnels ou un plan volontaire pour les entreprises de votre taille.",
    );
  });

  it('les démarches générales, y compris celle des dispositifs cumulables, sont remplacées et non complétées', () => {
    const cumulable: DispositifComplementaire = {
      id: 'fonds-branche',
      nom: 'Fonds de branche',
      cumul: 'additif',
      montant_max: 1000,
      unite: 'par_dossier',
      pourcentage_couts: null,
      description: 'd',
      conditions: ['c'],
      demarches: 'm',
      tailles_eligibles: null,
      publics: null,
      confidence: 'exact',
      source_url: 'x',
    };
    const r = resultat(makeOpco({ dispositifs_complementaires: [cumulable] }), '300_plus');
    expect(r.pdcFerme).toBe(true);
    expect(r.demarches).toEqual(demarchesFerme('Test OPCO'));
    expect(r.dispositifsComplementaires.map((d) => d.id)).toEqual(['fonds-branche']); // le dispositif reste exposé à part
  });

  it('50 à 299 salariés sans enveloppe publiée : pdcFerme est vrai, comme le dispositif principal et le financement à 0', () => {
    const r = resultat(makeOpco(), '50_299');
    expect(r.pdcFerme).toBe(true);
    expect(r.dispositifPrincipal).toContain('non accessibles');
    expect(r.totalFunded).toBe(0);
    expect(r.demarches).toEqual(demarchesFerme('Test OPCO'));
  });

  it('une enveloppe 50+ à 0 n\'ouvre pas le PDC : pdcFerme reste vrai', () => {
    const r = resultat(makeOpco({ plafonds_par_taille: [enveloppe('50_299', 0)] }), '50_299');
    expect(r.pdcFerme).toBe(true);
    expect(r.demarches).toEqual(demarchesFerme('Test OPCO'));
  });

  it('l\'enveloppe publiée pour les 50 à 299 salariés n\'ouvre pas le PDC des 300 salariés et plus', () => {
    const opco = makeOpco({ plafonds_par_taille: [enveloppe('50_299', 1000)] });
    expect(resultat(opco, '50_299').pdcFerme).toBe(false);
    expect(resultat(opco, '300_plus').pdcFerme).toBe(true);
  });

  it('50 à 299 salariés avec enveloppe 50+ publiée : pdcFerme est faux et les démarches sont les démarches générales', () => {
    const r = resultat(makeOpco({ plafonds_par_taille: [enveloppe('50_299', 1000)] }), '50_299');
    expect(r.pdcFerme).toBe(false);
    expect(r.dispositifPrincipal).not.toContain('non accessibles');
    expect(r.demarches).toEqual(DEMARCHES_GENERALES);
  });

  it.each(['less_11', '11_49', null] as const)('taille %s : pdcFerme est faux et les démarches sont inchangées', (taille) => {
    const r = resultat(makeOpco(), taille);
    expect(r.pdcFerme).toBe(false);
    expect(r.demarches).toEqual(DEMARCHES_GENERALES);
  });

  it('pdcFerme suit le barème appliqué : l\'enveloppe 50+ d\'une branche ouvre le PDC, le barème général le laisse fermé', () => {
    const opco = makeOpco({
      variantes_branche: [
        {
          id: 'pharmacie',
          branche_nom: 'Pharmacie',
          idcc: ['1996'],
          source_url: 'x',
          confidence: 'exact',
          plafonds_par_taille: [enveloppe('300_plus', 15000)],
        },
      ],
    });
    const etat = (over: Partial<WizardState>) =>
      makeFormationState({ companySize: '300_plus', durationHours: 100, pedagogyCostPerHour: 30, ...over });
    expect(calculateFunding(opco, etat({ detectedIdcc: '1996' })).pdcFerme).toBe(false);
    expect(calculateFunding(opco, etat({ detectedIdcc: null })).pdcFerme).toBe(true);
  });
});

describe('calculateFunding, barème dégressif', () => {
  const seuils = [
    { max_heures: 105, valeur: 65 },
    { max_heures: null, valeur: 15 },
  ];

  it('par tranche : chaque tranche d\'heures à son taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 105 h × min(40, 65) + 35 h × min(40, 15) = 4200 + 525
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(4725);
  });

  it('selon la durée totale : un seul taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'selon_duree_totale' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 140 h > 105 h → 15 €/h × 140 h
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2100);
  });

  it('un coût décimal entièrement financé ne produit pas d\'avertissement de reste à charge (bruit d\'arrondi)', () => {
    const opco = makeOpco({
      cout_horaire_seuils: [
        { max_heures: 105, valeur: 65 },
        { max_heures: null, valeur: 50 },
      ],
      cout_horaire_seuils_mode: 'par_tranche',
    });
    // 105 h × 33.33 + 1 h × 33.33 : la somme flottante des tranches diffère de 33.33 × 106 d'environ 5e-13
    const state = makeFormationState({ durationHours: 106, pedagogyCostPerHour: 33.33 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.fundedAmount).toBe(3532.98);
    expect(peda.remainder).toBe(0);
    expect(r.warnings.some((w) => w.includes('laisse un reste à charge'))).toBe(false);
  });

  it('avertit d\'un vrai reste à charge quand le barème ne finance pas tout', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // coût 5600 − financé 4725
    expect(r.warnings.some((w) => w.includes(`laisse un reste à charge de 875.00${NBSP}€`))).toBe(true);
  });

  describe('variante de branche et barème dégressif de l\'OPCO', () => {
    const opcoAvecVariante = (variante: Partial<VarianteBranche>): OpcoData =>
      makeOpco({
        cout_horaire_seuils: seuils,
        cout_horaire_seuils_mode: 'par_tranche',
        variantes_branche: [
          { id: 'branche-test', branche_nom: 'Branche test', idcc: ['1234'], source_url: 'x', confidence: 'exact', ...variante },
        ],
      });
    const pedagogieFinancee = (opco: OpcoData, formationType: 'qualification' | 'cqp' = 'qualification') =>
      calculateFunding(
        opco,
        makeFormationState({ detectedIdcc: '1234', formationType, durationHours: 140, pedagogyCostPerHour: 40 }),
      ).lines.find((l) => l.poste === 'pedagogie')!.fundedAmount;

    it('une variante à plafond horaire fixe n\'hérite pas du barème dégressif de l\'OPCO', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      // plafond fixe de la variante : 140 h × 20 €/h = 2800 (et non 4725 selon le barème dégressif de l'OPCO)
      expect(pedagogieFinancee(opco)).toBe(2800);
    });

    it('une variante à plafond horaire métier n\'hérite pas non plus du barème dégressif', () => {
      const opco = opcoAvecVariante({ cout_horaire_metier: { value: 25, confidence: 'exact', source_url: 'x' } });
      expect(pedagogieFinancee(opco, 'cqp')).toBe(3500); // 140 h × 25 €/h
    });

    it('applyVarianteBranche ne reprend ni les seuils ni leur mode quand la variante fixe un plafond horaire', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
      expect(fusionne.cout_horaire_seuils).toBeUndefined();
      expect(fusionne.cout_horaire_seuils_mode).toBeUndefined();
      expect(opco.cout_horaire_seuils).toEqual(seuils); // l'OPCO d'origine n'est pas muté
      expect(opco.cout_horaire_seuils_mode).toBe('par_tranche');
    });

    it('une variante sans plafond horaire hérite du barème dégressif de l\'OPCO', () => {
      const opco = opcoAvecVariante({ budget_annuel_max: { value: 100000, confidence: 'exact', source_url: 'x' } });
      expect(pedagogieFinancee(opco)).toBe(4725); // 105 h × 40 + 35 h × 15, comme sans variante
    });

    it('une variante qui publie ses propres seuils utilise ses seuils', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_mode: 'par_tranche',
      });
      expect(pedagogieFinancee(opco)).toBe(1400); // 140 h × min(40, 10)
    });
  });
});

describe('calculateFunding, barème dégressif réservé aux formations certifiantes', () => {
  const seuils = [
    { max_heures: 105, valeur: 65 },
    { max_heures: null, valeur: 15 },
  ];
  const BAREME = 7350; // 105 h × 65 + 35 h × 15 (coût demandé 70 €/h, au-dessus des deux plafonds)
  const PLAFOND_HABITUEL = 5600; // 140 h × 40 €/h
  const opcoCertifiant = (over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_seuils: seuils,
      cout_horaire_seuils_certifiant: true,
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      ...over,
    });
  const calcul = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(opco, makeFormationState({ durationHours: 140, pedagogyCostPerHour: 70, ...over }));
  const pedagogie = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calcul(opco, over).lines.find((l) => l.poste === 'pedagogie')!;

  it('formation non certifiante : le plafond horaire habituel s\'applique, pas le barème', () => {
    const peda = pedagogie(opcoCertifiant(), { certificationLevel: 'aucune' });
    expect(peda.fundedAmount).toBe(PLAFOND_HABITUEL);
    expect(peda.note).toBe(`Plafond horaire : 40${NBSP}€/h`);
  });

  it('formation certifiante (RNCP) : le barème dégressif s\'applique', () => {
    const peda = pedagogie(opcoCertifiant(), { certificationLevel: 'rncp' });
    expect(peda.fundedAmount).toBe(BAREME);
    expect(peda.note).toBe('Barème dégressif selon la durée');
  });

  it('RS, CQP et diplôme sont des certifications ; habilitation, autre et absence de certification ne le sont pas', () => {
    for (const certificationLevel of ['rncp', 'rs', 'cqp', 'diplome'] as const) {
      expect(pedagogie(opcoCertifiant(), { certificationLevel }).fundedAmount, certificationLevel).toBe(BAREME);
    }
    for (const certificationLevel of ['habilitation', 'autre', 'aucune', null] as const) {
      expect(pedagogie(opcoCertifiant(), { certificationLevel }).fundedAmount, String(certificationLevel)).toBe(PLAFOND_HABITUEL);
    }
  });

  it('un type de formation certification ou CQP suffit, même sans niveau de certification renseigné', () => {
    for (const formationType of ['certification', 'cqp'] as const) {
      expect(pedagogie(opcoCertifiant(), { formationType, certificationLevel: null }).fundedAmount, formationType).toBe(BAREME);
    }
    for (const formationType of ['qualification', 'non_certifiante', 'habilitation', 'vae', 'reconversion'] as const) {
      expect(pedagogie(opcoCertifiant(), { formationType, certificationLevel: null }).fundedAmount, formationType).toBe(PLAFOND_HABITUEL);
    }
  });

  it('sans drapeau (ou à false), le barème s\'applique à toutes les formations', () => {
    expect(pedagogie(opcoCertifiant({ cout_horaire_seuils_certifiant: undefined }), { certificationLevel: 'aucune' }).fundedAmount).toBe(BAREME);
    expect(pedagogie(opcoCertifiant({ cout_horaire_seuils_certifiant: false }), { certificationLevel: 'aucune' }).fundedAmount).toBe(BAREME);
  });

  it('chemin du plafond habituel : le plafond par taille d\'entreprise reste prioritaire', () => {
    const opco = opcoCertifiant({
      plafonds_par_taille: [{ taille: 'less_11', cout_horaire_max: 30, budget_annuel_max: null, quota_horaire_max: null, description: 'TPE' }],
    });
    expect(pedagogie(opco, { companySize: 'less_11', certificationLevel: 'aucune' }).fundedAmount).toBe(4200); // 140 h × 30 €/h
  });

  it('formation non certifiante : l\'avertissement du plafond horaire remplace celui du barème dégressif', () => {
    const r = calcul(opcoCertifiant(), { certificationLevel: 'aucune' });
    expect(r.warnings.some((w) => w.includes(`dépasse le plafond Test OPCO (40${NBSP}€/h)`))).toBe(true);
    expect(r.warnings.some((w) => w.includes('Le barème dégressif'))).toBe(false);
  });

  describe('héritage par les variantes de branche', () => {
    const opcoAvecVariante = (variante: Partial<VarianteBranche>): OpcoData =>
      opcoCertifiant({
        variantes_branche: [{ id: 'branche-test', branche_nom: 'Branche test', idcc: ['1234'], source_url: 'x', confidence: 'exact', ...variante }],
      });
    const pedagogieBranche = (opco: OpcoData, certificationLevel: 'aucune' | 'rncp') =>
      pedagogie(opco, { detectedIdcc: '1234', certificationLevel }).fundedAmount;

    it('une variante qui hérite du barème de l\'OPCO en hérite aussi la restriction aux certifiantes', () => {
      const opco = opcoAvecVariante({ budget_annuel_max: { value: 100000, confidence: 'exact', source_url: 'x' } });
      expect(applyVarianteBranche(opco, opco.variantes_branche![0]).cout_horaire_seuils_certifiant).toBe(true);
      expect(pedagogieBranche(opco, 'aucune')).toBe(PLAFOND_HABITUEL);
      expect(pedagogieBranche(opco, 'rncp')).toBe(BAREME);
    });

    it('une variante à plafond horaire fixe n\'hérite ni du barème ni de la restriction', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
      expect(fusionne.cout_horaire_seuils).toBeUndefined();
      expect(fusionne.cout_horaire_seuils_certifiant).toBeUndefined();
      expect(opco.cout_horaire_seuils_certifiant).toBe(true); // l'OPCO d'origine n'est pas muté
      expect(pedagogieBranche(opco, 'aucune')).toBe(2800); // 140 h × 20 €/h
      expect(pedagogieBranche(opco, 'rncp')).toBe(2800); // plafond fixe de la branche, jamais le barème de l'OPCO
    });

    it('une variante qui publie ses propres seuils peut préciser qu\'ils valent pour toutes les formations', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_certifiant: false,
      });
      expect(pedagogieBranche(opco, 'aucune')).toBe(1400); // 140 h × min(70, 10) : ses seuils, pas ceux de l'OPCO
    });

    it('une variante peut réserver ses propres seuils aux formations certifiantes', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_certifiant: true,
      });
      expect(pedagogieBranche(opco, 'aucune')).toBe(2800); // plafond habituel de la branche : 140 h × 20 €/h
      expect(pedagogieBranche(opco, 'rncp')).toBe(1400);
    });
  });
});

describe('calculateFunding, portée du plafond annuel', () => {
  it('portée pédagogie : salaires financés en plus du plafond', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
      budget_annuel_portee: 'pedagogie',
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2000);
    expect(r.lines.find((l) => l.poste === 'salaires')!.fundedAmount).toBe(1200);
    expect(r.totalFunded).toBe(3200);
    expect(r.budgetCapApplied).toBe(true);
  });

  const opcoPlafonne = (portee?: 'global' | 'pedagogie') =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
      budget_annuel_portee: portee,
    });

  it('portée pédagogie : le message de plafond ne dit pas que le total finançable est plafonné', () => {
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opcoPlafonne('pedagogie'), state);
    expect(r.budgetCapApplied).toBe(true);
    // calcPedagogy annonce déjà que salaires et frais annexes sont financés en plus : pas de message contradictoire
    expect(r.warnings.some((w) => w.includes('Le montant total finançable est plafonné'))).toBe(false);
    expect(r.warnings).toContain('Le plafond budgétaire annuel de Test OPCO a été appliqué aux coûts pédagogiques.');
  });

  it('portée globale (par défaut) : le message de plafond reste inchangé', () => {
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opcoPlafonne(), state);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.warnings).toContain(
      'Le plafond budgétaire annuel de Test OPCO a été appliqué. Le montant total finançable est plafonné.',
    );
  });
});

describe('calculateFunding, budget annuel à 0 (enveloppe épuisée ou fermée)', () => {
  const MESSAGE_BUDGET_NUL =
    "Aucun budget n'est disponible sur le plan de développement des compétences de Test OPCO pour votre situation (enveloppe épuisée ou fermée). Consultez les autres financements.";
  const budget = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  const opcoAvecBudget = (value: number | null, over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: budget(value),
      ...over,
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, ...over });
  const messagesDePlafondApplique = (warnings: string[]) =>
    warnings.filter((w) => /plafond (budgétaire )?annuel/i.test(w) && w.includes('appliqué'));

  it('portée globale : rien n\'est financé, les montants restent finis et l\'avertissement dédié est affiché', () => {
    const r = calculateFunding(opcoAvecBudget(0), etat());
    expect(r.totalFunded).toBe(0);
    expect(r.totalRequested).toBe(4200); // 3000 € de pédagogie + 1200 € de salaires, toujours demandés
    expect(r.totalRemainder).toBe(4200);
    for (const l of r.lines) {
      expect(Number.isFinite(l.fundedAmount)).toBe(true);
      expect(l.fundedAmount).toBe(0);
    }
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
  });

  it('n\'ajoute pas en plus le message générique de plafond appliqué', () => {
    const r = calculateFunding(opcoAvecBudget(0), etat());
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('une variante appliquée par IDCC avec un budget à 0 ferme l\'enveloppe, alors que le barème général finance', () => {
    const opco = opcoAvecBudget(5000, {
      variantes_branche: [
        { id: 'epuisee', branche_nom: 'Branche épuisée', idcc: ['1516'], source_url: 'x', confidence: 'exact', budget_annuel_max: budget(0) },
      ],
    });
    const general = calculateFunding(opco, etat());
    expect(general.totalFunded).toBe(4200);
    expect(general.warnings).not.toContain(MESSAGE_BUDGET_NUL);

    const r = calculateFunding(opco, etat({ detectedIdcc: '1516' }));
    expect(r.brancheAppliquee).toBe('Branche épuisée');
    expect(r.totalFunded).toBe(0);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('portée pédagogie : les coûts pédagogiques tombent à 0 (sans division par zéro), les salaires restent financés en plus', () => {
    const r = calculateFunding(opcoAvecBudget(0, { budget_annuel_portee: 'pedagogie' }), etat());
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(0);
    expect(r.lines.find((l) => l.poste === 'salaires')!.fundedAmount).toBe(1200);
    expect(Number.isFinite(r.totalFunded)).toBe(true);
    expect(r.totalFunded).toBe(1200);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('un plafond par taille à 0 est respecté', () => {
    const opco = opcoAvecBudget(5000, {
      plafonds_par_taille: [
        { taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 0, quota_horaire_max: null, description: 'Enveloppe épuisée' },
      ],
    });
    const r = calculateFunding(opco, etat({ companySize: 'less_11' }));
    expect(r.totalFunded).toBe(0);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
  });

  it('un budget null reste sans plafond (comportement inchangé)', () => {
    const r = calculateFunding(opcoAvecBudget(null), etat());
    expect(r.totalFunded).toBe(4200);
    expect(r.budgetCapApplied).toBe(false);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });

  it('un budget positif entièrement consommé garde son message d\'épuisement, pas le message de budget nul', () => {
    const r = calculateFunding(opcoAvecBudget(2000), etat({ budgetDejaConsomme: 2500 }));
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('Votre enveloppe annuelle Test OPCO est épuisée'))).toBe(true);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });

  it('une enveloppe 50+ à 0 n\'ouvre pas le PDC : la règle des 50 salariés prime, sans message de budget nul', () => {
    const opco = opcoAvecBudget(null, {
      plafonds_par_taille: [
        { taille: '50_299', cout_horaire_max: null, budget_annuel_max: 0, quota_horaire_max: null, description: 'Plan conventionnel 50+.' },
      ],
    });
    const r = calculateFunding(opco, etat({ companySize: '50_299' }));
    expect(r.dispositifPrincipal).toContain('non accessibles');
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('moins de 50 salariés'))).toBe(true);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });
});

describe('calculateFunding, dispositifs complémentaires et enveloppe', () => {
  const boost = {
    id: 'boost', nom: 'Boost', cumul: 'additif' as const,
    montant_max: 750, unite: 'par_dossier' as const, pourcentage_couts: 50,
    description: 'd', conditions: ['c'], demarches: 'm',
    tailles_eligibles: null, publics: null,
    confidence: 'exact' as const, source_url: 'x',
  };

  it('un dispositif en % est calculé sur le reste à financer', () => {
    // Sans plafond en € : seule la base de calcul détermine le montant.
    const sansPlafond = { ...boost, id: 'sans-plafond', montant_max: null, unite: null };
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [sansPlafond] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 });
    const r = calculateFunding(opco, state);
    // PDC 4000 (40 €/h × 100 h) ; reste 6000 − 4000 = 2000 → 50 % = 1000 (et non 50 % de 6000 = 3000)
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(1000);
    expect(r.enveloppeMaxPotentielle).toBe(5000); // 4000 + 1000, sous le coût demandé 6000
  });

  it('un dispositif en % est plafonné par son montant maximal', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [boost] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 });
    const r = calculateFunding(opco, state);
    // PDC 4000 ; reste 2000 → 50 % = 1000, plafonné à 750
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(750);
    expect(r.enveloppeMaxPotentielle).toBe(4750);
  });

  it('l\'enveloppe ne dépasse jamais le coût demandé', () => {
    const gros = { ...boost, id: 'gros', pourcentage_couts: null, montant_max: 10000 };
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [gros] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.enveloppeMaxPotentielle).toBeLessThanOrEqual(r.totalRequested);
    // coût demandé 3000 (100 h × 30 €/h), déjà financé à 100 % : le forfait de 10 000 € ne rehausse rien
    expect(r.enveloppeMaxPotentielle).toBe(3000);
  });

  it('un dispositif avec une note la retrouve dans le dispositif retourné', () => {
    const note = 'Plafond de 750 € par dossier, hors budget annuel.';
    const opco = makeOpco({ dispositifs_complementaires: [{ ...boost, note }] });
    const r = calculateFunding(opco, makeFormationState());
    expect(r.dispositifsComplementaires[0].note).toBe(note);
  });

  it('un dispositif sans note n\'a pas de champ note (clé absente, et non undefined)', () => {
    const opco = makeOpco({ dispositifs_complementaires: [boost] });
    const [dispositif] = calculateFunding(opco, makeFormationState()).dispositifsComplementaires;
    expect(dispositif.id).toBe('boost');
    expect(Object.keys(dispositif)).not.toContain('note');
  });

  it('chaque ligne porte son poste', () => {
    const opco = makeOpco();
    const r = calculateFunding(opco, makeFormationState({ needsMeals: true, mealCostPerDay: 15, trainingDays: 2 }));
    expect(r.lines.map((l) => l.poste)).toEqual(['pedagogie', 'salaires', 'transport', 'hebergement', 'restauration']);
  });
});

describe('calculateFunding, dispositifs réservés à certaines conventions collectives', () => {
  const dispositif = (over: Partial<DispositifComplementaire> = {}): DispositifComplementaire => ({
    id: 'transition-ecologique',
    nom: 'Transition écologique',
    cumul: 'additif',
    montant_max: 1000,
    unite: 'par_dossier',
    pourcentage_couts: null,
    description: 'd',
    conditions: ['c'],
    demarches: 'm',
    tailles_eligibles: null,
    publics: null,
    confidence: 'exact',
    source_url: 'x',
    ...over,
  });
  const opcoAvecDispositif = (d: DispositifComplementaire, over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({ dispositifs_complementaires: [d], ...over });
  const idsRetenus = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0]) =>
    calculateFunding(opco, makeFormationState(over)).dispositifsComplementaires.map((d) => d.id);
  const opcoTp = () => opcoAvecDispositif(dispositif({ idcc: ['1702'] }));

  it('présent quand l\'IDCC détecté fait partie de ceux du dispositif', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1702' })).toEqual(['transition-ecologique']);
  });

  it('absent quand l\'IDCC détecté est celui d\'une autre convention', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1596' })).toEqual([]);
  });

  it('absent quand l\'IDCC de l\'entreprise est inconnu', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: null })).toEqual([]);
  });

  it('présent quand un établissement de l\'entreprise relève de la convention', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1596', idccEtablissements: ['1596', '1702'] })).toEqual(['transition-ecologique']);
  });

  it('présent quand la branche appliquée (choix manuel) couvre l\'IDCC, même sans IDCC détecté', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'] }), {
      variantes_branche: [{ id: 'travaux-publics', branche_nom: 'Travaux publics', idcc: ['1702', '2614'], source_url: 'x', confidence: 'exact' }],
    });
    expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null })).toEqual(['transition-ecologique']);
  });

  it('sans aucun IDCC connu, la branche choisie à la main ouvre les dispositifs réservés à chacune de ses conventions, et à elles seules', () => {
    const opco = makeOpco({
      dispositifs_complementaires: [
        dispositif({ id: 'tp-1702', idcc: ['1702'] }),
        dispositif({ id: 'tp-2614', idcc: ['2614'] }),
        dispositif({ id: 'batiment-1596', idcc: ['1596'] }),
      ],
      variantes_branche: [{ id: 'travaux-publics', branche_nom: 'Travaux publics', idcc: ['1702', '2614'], source_url: 'x', confidence: 'exact' }],
    });
    expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null })).toEqual(['tp-1702', 'tp-2614']);
  });

  it('une variante groupée n\'ajoute aucun IDCC quand l\'entreprise en connaît déjà un : elle n\'ouvre pas les dispositifs des autres conventions du groupe', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'] }), {
      variantes_branche: [{ id: 'travaux-publics', branche_nom: 'Travaux publics', idcc: ['1702', '2614'], source_url: 'x', confidence: 'exact' }],
    });
    expect(idsRetenus(opco, { detectedIdcc: '2614' })).toEqual([]); // la convention détectée est 2614, le dispositif vise 1702
    expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null, idccEtablissements: ['2614'] })).toEqual([]); // idem, connue par un établissement
    expect(idsRetenus(opco, { detectedIdcc: '1702' })).toEqual(['transition-ecologique']);
  });

  describe('variante groupée choisie à la main et IDCC connu hors de la variante (3333)', () => {
    const groupe = (): Partial<OpcoData> => ({
      variantes_branche: [{ id: 'travaux-publics', branche_nom: 'Travaux publics', idcc: ['1702', '2614'], source_url: 'x', confidence: 'exact' }],
    });

    it('n\'ouvre pas le dispositif réservé à l\'une des conventions de la variante', () => {
      const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'] }), groupe());
      expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: '3333' })).toEqual([]);
      expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null, idccEtablissements: ['3333'] })).toEqual([]);
    });

    it('symétrique : offre le dispositif réservé à l\'IDCC connu, et lui seul', () => {
      const opco = makeOpco({
        dispositifs_complementaires: [
          dispositif({ id: 'tp-1702', idcc: ['1702'] }),
          dispositif({ id: 'tp-2614', idcc: ['2614'] }),
          dispositif({ id: 'autre-3333', idcc: ['3333'] }),
        ],
        ...groupe(),
      });
      expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: '3333' })).toEqual(['autre-3333']);
      expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null, idccEtablissements: ['3333'] })).toEqual(['autre-3333']);
    });

    it('un IDCC vide (détecté ou d\'établissement) compte comme « aucun IDCC connu » : la branche choisie ouvre les dispositifs de chacune de ses conventions', () => {
      const opco = makeOpco({
        dispositifs_complementaires: [
          dispositif({ id: 'tp-1702', idcc: ['1702'] }),
          dispositif({ id: 'tp-2614', idcc: ['2614'] }),
          dispositif({ id: 'autre-3333', idcc: ['3333'] }),
        ],
        ...groupe(),
      });
      const etats: Parameters<typeof makeFormationState>[0][] = [
        { detectedIdcc: '' },
        { detectedIdcc: null, idccEtablissements: [''] },
        { detectedIdcc: '', idccEtablissements: [''] },
      ];
      for (const etat of etats) {
        expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', ...etat }), JSON.stringify(etat)).toEqual(['tp-1702', 'tp-2614']);
      }
    });
  });

  it('normalise les IDCC sur 4 chiffres avant de comparer', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['0702'] }));
    expect(idsRetenus(opco, { detectedIdcc: '702' })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opco, { detectedIdcc: null, idccEtablissements: ['702'] })).toEqual(['transition-ecologique']);
  });

  it('un dispositif sans IDCC, ou à liste vide, concerne toutes les entreprises', () => {
    expect(idsRetenus(opcoAvecDispositif(dispositif()), { detectedIdcc: null })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opcoAvecDispositif(dispositif({ idcc: [] })), { detectedIdcc: '1596' })).toEqual(['transition-ecologique']);
  });

  it('cumule avec la restriction par taille : les deux conditions doivent être remplies', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'], tailles_eligibles: ['less_11'] }));
    expect(idsRetenus(opco, { detectedIdcc: '1702', companySize: 'less_11' })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opco, { detectedIdcc: '1702', companySize: '11_49' })).toEqual([]); // taille exclue
    expect(idsRetenus(opco, { detectedIdcc: '1596', companySize: 'less_11' })).toEqual([]); // convention exclue
  });

  it('un dispositif écarté ne compte pas dans l\'enveloppe maximale potentielle', () => {
    const r = calculateFunding(opcoTp(), makeFormationState({ detectedIdcc: '1596', pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 }));
    expect(r.enveloppeMaxPotentielle).toBe(r.totalFunded);
  });
});

describe('calculateFunding, alertes publiées par l\'OPCO', () => {
  const alerte = (over: Partial<AlerteOpco> = {}): AlerteOpco => ({
    type: 'fonds_epuises',
    branche: 'Organismes de formation',
    idcc: ['1516'],
    source_url: 'https://exemple.fr/alerte',
    extrait: 'Enveloppe budgétaire intégralement engagée pour 2026',
    verifie_le: '2026-10-05',
    ...over,
  });
  const resultat = (alertes: AlerteOpco[] | undefined, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(makeOpco({ alertes }), makeFormationState(over));
  const avertissementsEpuisement = (warnings: string[]) => warnings.filter((w) => w.includes('est épuisée'));

  it('une alerte de fonds épuisés concerne l\'entreprise de la branche : alerte retournée et avertissement daté', () => {
    const a = alerte();
    const r = resultat([a], { detectedIdcc: '1516' });
    expect(r.alertes).toEqual([a]);
    expect(r.warnings).toContain(
      "Test OPCO signale que l'enveloppe de la branche « Organismes de formation » est épuisée (vérifié le 05/10/2026) : " +
        'la prise en charge sur le plan de développement des compétences peut être refusée.',
    );
  });

  it('l\'avertissement contient « est épuisée (vérifié le 05/10/2026) »', () => {
    const r = resultat([alerte()], { detectedIdcc: '1516' });
    expect(r.warnings.some((w) => w.includes('est épuisée (vérifié le 05/10/2026)'))).toBe(true);
  });

  it('une entreprise d\'une autre branche n\'est pas concernée : ni alerte ni avertissement', () => {
    const r = resultat([alerte()], { detectedIdcc: '1979' });
    expect(r.alertes).toEqual([]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([]);
  });

  it('une entreprise dont la convention est inconnue n\'est pas concernée par une alerte de branche', () => {
    const r = resultat([alerte()], { detectedIdcc: null });
    expect(r.alertes).toEqual([]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([]);
  });

  it('une alerte sans IDCC concerne toutes les entreprises de l\'OPCO, sans avertissement d\'épuisement', () => {
    const a = alerte({ type: 'changement_paiement', branche: 'Toutes branches', idcc: [] });
    for (const idcc of ['1516', '1979', null]) {
      const r = resultat([a], { detectedIdcc: idcc });
      expect(r.alertes).toEqual([a]);
      expect(avertissementsEpuisement(r.warnings)).toEqual([]);
    }
  });

  it('une alerte de fonds épuisés sans IDCC avertit toutes les entreprises de l\'OPCO', () => {
    const r = resultat([alerte({ idcc: [], branche: 'Toutes branches' })], { detectedIdcc: null });
    expect(r.alertes).toHaveLength(1);
    expect(avertissementsEpuisement(r.warnings)).toHaveLength(1);
  });

  it('les autres types d\'alerte sont retournés sans avertissement supplémentaire', () => {
    const types = ['changement_criteres', 'dispositif_termine', 'dispositif_non_confirme', 'acces_restreint', 'evolution_en_cours_annee', 'echeance'] as const;
    const sans = resultat(undefined, { detectedIdcc: '1516' });
    for (const type of types) {
      const r = resultat([alerte({ type })], { detectedIdcc: '1516' });
      expect(r.alertes.map((x) => x.type)).toEqual([type]);
      expect(r.warnings).toEqual(sans.warnings);
    }
  });

  it('retient seulement les alertes qui concernent l\'entreprise, dans l\'ordre de l\'OPCO, un avertissement par fonds épuisés', () => {
    const tp = alerte({ branche: 'Travaux publics', idcc: ['1702'] });
    const of = alerte();
    const gros = alerte({ branche: 'Commerces de gros', idcc: ['0573'], verifie_le: '2026-01-09' });
    const paiement = alerte({ type: 'changement_paiement', branche: 'Toutes branches', idcc: [] });
    const r = resultat([tp, of, gros, paiement], { detectedIdcc: '573' });
    expect(r.alertes).toEqual([gros, paiement]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([
      "Test OPCO signale que l'enveloppe de la branche « Commerces de gros » est épuisée (vérifié le 09/01/2026) : " +
        'la prise en charge sur le plan de développement des compétences peut être refusée.',
    ]);
  });

  it('retient une alerte dont un établissement ou la branche choisie manuellement relève de l\'IDCC', () => {
    const a = alerte();
    expect(resultat([a], { detectedIdcc: '1979', idccEtablissements: ['1979', '1516'] }).alertes).toEqual([a]);

    const opco = makeOpco({
      alertes: [a],
      variantes_branche: [{ id: 'of', branche_nom: 'Organismes de formation', idcc: ['1516'], source_url: 'x', confidence: 'exact' }],
    });
    expect(calculateFunding(opco, makeFormationState({ selectedBrancheId: 'of' })).alertes).toEqual([a]);
  });

  describe('variante de branche groupée (plusieurs IDCC) ou à un seul IDCC', () => {
    const gros = alerte({ branche: 'Commerces de gros', idcc: ['0573'], verifie_le: '2026-01-09' });
    const dechet = alerte({ branche: 'Activités du déchet', idcc: ['2149'] });
    const opcoAvecVariante = (idcc: string[]): OpcoData =>
      makeOpco({
        alertes: [gros, dechet],
        variantes_branche: [{ id: 'groupe', branche_nom: 'Branches groupées', idcc, source_url: 'x', confidence: 'exact' }],
      });

    it('variante groupée appliquée par l\'IDCC détecté : seule l\'alerte de la convention de l\'entreprise est retenue', () => {
      const r = calculateFunding(opcoAvecVariante(['0573', '2149']), makeFormationState({ detectedIdcc: '0573' }));
      expect(r.brancheAppliquee).toBe('Branches groupées');
      expect(r.alertes).toEqual([gros]); // et non aussi celle du déchet (2149), autre convention du même groupe
      expect(avertissementsEpuisement(r.warnings)).toHaveLength(1);
      expect(r.warnings.some((w) => w.includes('Activités du déchet'))).toBe(false);
    });

    it('variante à un seul IDCC choisie manuellement, sans IDCC détecté : l\'alerte de cet IDCC est retenue', () => {
      const r = calculateFunding(opcoAvecVariante(['0573']), makeFormationState({ selectedBrancheId: 'groupe', detectedIdcc: null }));
      expect(r.brancheAppliquee).toBe('Branches groupées');
      expect(r.alertes).toEqual([gros]);
      expect(avertissementsEpuisement(r.warnings)).toHaveLength(1);
    });

    it('variante groupée choisie manuellement, sans aucun IDCC connu : les alertes de toutes les conventions du groupe sont retenues', () => {
      // L'utilisateur a choisi lui-même la branche : sans IDCC détecté ni IDCC d'établissement, tout ce qu'elle couvre reste disponible.
      const r = calculateFunding(opcoAvecVariante(['0573', '2149']), makeFormationState({ selectedBrancheId: 'groupe', detectedIdcc: null }));
      expect(r.brancheAppliquee).toBe('Branches groupées');
      expect(r.alertes).toEqual([gros, dechet]);
      expect(avertissementsEpuisement(r.warnings)).toHaveLength(2);
    });

    it('variante groupée choisie manuellement, avec seulement un IDCC d\'établissement connu : seule l\'alerte de cette convention est retenue', () => {
      const r = calculateFunding(
        opcoAvecVariante(['0573', '2149']),
        makeFormationState({ selectedBrancheId: 'groupe', detectedIdcc: null, idccEtablissements: ['0573'] }),
      );
      expect(r.brancheAppliquee).toBe('Branches groupées');
      expect(r.alertes).toEqual([gros]);
      expect(avertissementsEpuisement(r.warnings)).toHaveLength(1);
    });

    it('variante à un seul IDCC : son IDCC est ajouté même quand l\'entreprise en connaît déjà un autre', () => {
      const r = calculateFunding(opcoAvecVariante(['0573']), makeFormationState({ selectedBrancheId: 'groupe', detectedIdcc: '2149' }));
      expect(r.alertes).toEqual([gros, dechet]); // 0573 par la branche choisie (un seul IDCC), 2149 par l'IDCC détecté
    });

    it('variante groupée : les IDCC des établissements restent pris en compte', () => {
      const r = calculateFunding(
        opcoAvecVariante(['0573', '2149']),
        makeFormationState({ detectedIdcc: '0573', idccEtablissements: ['0573', '2149'] }),
      );
      expect(r.alertes).toEqual([gros, dechet]);
    });

    it('variante groupée choisie manuellement avec un IDCC connu hors de la variante : elle n\'ajoute rien, seule l\'alerte de cet IDCC (et celles de toutes les branches) est retenue', () => {
      const autre = alerte({ branche: 'Autre convention', idcc: ['3333'] });
      const toutes = alerte({ type: 'changement_paiement', branche: 'Toutes branches', idcc: [] });
      const opco = makeOpco({
        alertes: [gros, dechet, autre, toutes],
        variantes_branche: [{ id: 'groupe', branche_nom: 'Branches groupées', idcc: ['0573', '2149'], source_url: 'x', confidence: 'exact' }],
      });
      const r = calculateFunding(opco, makeFormationState({ selectedBrancheId: 'groupe', detectedIdcc: '3333' }));
      expect(r.brancheAppliquee).toBe('Branches groupées'); // le choix manuel donne le barème, il ne donne pas les IDCC du groupe
      expect(r.alertes).toEqual([autre, toutes]); // ni celle de 0573 ni celle de 2149 : l'entreprise déclare 3333, hors du groupe
      expect(avertissementsEpuisement(r.warnings)).toHaveLength(1); // le fonds épuisé de 3333 seul ; l'alerte de toutes les branches est un changement de paiement
      expect(r.warnings.some((w) => w.includes('Commerces de gros') || w.includes('Activités du déchet'))).toBe(false);
    });

    it('un IDCC vide (détecté ou d\'établissement) compte comme « aucun IDCC connu » : la variante groupée choisie à la main garde tous ses IDCC', () => {
      const etats: Parameters<typeof makeFormationState>[0][] = [
        { detectedIdcc: '' },
        { detectedIdcc: null, idccEtablissements: [''] },
        { detectedIdcc: '', idccEtablissements: [''] },
      ];
      for (const etat of etats) {
        const r = calculateFunding(opcoAvecVariante(['0573', '2149']), makeFormationState({ selectedBrancheId: 'groupe', ...etat }));
        expect(r.brancheAppliquee, JSON.stringify(etat)).toBe('Branches groupées');
        expect(r.alertes, JSON.stringify(etat)).toEqual([gros, dechet]);
        expect(avertissementsEpuisement(r.warnings), JSON.stringify(etat)).toHaveLength(2);
      }
    });
  });

  it('sans alertes dans l\'OPCO : liste vide, jamais undefined', () => {
    expect(resultat(undefined).alertes).toEqual([]);
    expect(resultat([]).alertes).toEqual([]);
  });

  it('les alertes restent signalées quand le PDC mutualisé est fermé (50 salariés et plus)', () => {
    const a = alerte({ idcc: [] });
    const r = resultat([a], { companySize: '50_299' });
    expect(r.dispositifPrincipal).toContain('non accessibles');
    expect(r.alertes).toEqual([a]);
  });

  it('le calcul ne modifie pas les alertes de l\'OPCO', () => {
    const alertes = [alerte(), alerte({ type: 'echeance', idcc: [] })];
    const avant = structuredClone(alertes);
    resultat(alertes, { detectedIdcc: '1516' });
    expect(alertes).toEqual(avant);
  });
});

describe('calculateFunding, frais annexes plafonnés au coût déclaré', () => {
  describe('forfait repas', () => {
    const opcoForfaitRepas = () =>
      makeOpco({ frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' } });
    const stateRepas = (mealCostPerDay: number) =>
      makeFormationState({ needsMeals: true, mealCostPerDay, trainingDays: 5 });

    it('forfait supérieur au coût déclaré : financé au coût réel, sans reste négatif', () => {
      const r = calculateFunding(opcoForfaitRepas(), stateRepas(15));
      const repas = r.lines.find((l) => l.poste === 'restauration')!;
      expect(repas.requestedAmount).toBe(75); // 15 €/jour × 5 jours
      expect(repas.fundedAmount).toBe(75); // coût réel, et non le forfait 20 €/jour × 5 jours = 100
      expect(repas.remainder).toBe(0);
      expect(repas.details).toContain(`Votre coût (15${NBSP}€/jour) est inférieur au forfait : prise en charge au coût réel`);
      expect(repas.details).toContain(`Calcul : 15${NBSP}€/jour × 5${NBSP}jours = 75.00${NBSP}€`);
    });

    it('forfait supérieur au coût déclaré : le financé ne dépasse pas le demandé et l\'enveloppe reste cohérente', () => {
      const r = calculateFunding(opcoForfaitRepas(), stateRepas(15));
      expect(r.totalFunded).toBeLessThanOrEqual(r.totalRequested);
      expect(r.totalRemainder).toBe(0);
      expect(r.enveloppeMaxPotentielle).toBeGreaterThanOrEqual(r.totalFunded);
    });

    it('la note courte de la ligne affiche le taux réellement appliqué : le coût réel quand il est sous le forfait', () => {
      const repas = calculateFunding(opcoForfaitRepas(), stateRepas(15)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toContain(`15${NBSP}€/jour × 5${NBSP}jours`); // et non « 20 €/jour × 5 jours » à côté de 75 € financés
      expect(repas.note).not.toMatch(/20\s€\/jour/);
    });

    it('la note courte affiche le forfait quand le coût déclaré le dépasse', () => {
      const repas = calculateFunding(opcoForfaitRepas(), stateRepas(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.fundedAmount).toBe(100); // forfait 20 €/jour × 5 jours
      expect(repas.note).toContain(`20${NBSP}€/jour × 5${NBSP}jours`);
    });
  });

  describe('hébergement', () => {
    const stateHebergement = () =>
      makeFormationState({ needsAccommodation: true, accommodationCostPerNight: 80, accommodationNights: 3 });

    it('plafond publié : financé au plus bas du coût et du plafond', () => {
      const opco = makeOpco({ frais_hebergement: { value: 60, confidence: 'exact', source_url: 'x' } });
      const heb = calculateFunding(opco, stateHebergement()).lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240); // 80 €/nuit × 3 nuits
      expect(heb.fundedAmount).toBe(180); // plafond 60 €/nuit × 3 nuits
      expect(heb.remainder).toBe(60);
    });

    it('plafond non publié (null) : aucun montant compté, à confirmer auprès de l\'OPCO', () => {
      const opco = makeOpco({ frais_hebergement: { value: null, confidence: 'exact', source_url: 'x' } });
      const r = calculateFunding(opco, stateHebergement());
      const heb = r.lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240); // le coût saisi reste le demandé
      expect(heb.fundedAmount).toBe(0); // aucun montant inventé
      expect(heb.remainder).toBe(240);
      expect(heb.confidence).toBe('depends_on_branche');
      expect(heb.details).toContain("Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé");
      expect(r.totalFunded).toBe(3000); // pédagogie seule : l'hébergement n'ajoute rien
    });

    it('plafond à 0 (hébergement non pris en charge) : aucun montant financé', () => {
      const opco = makeOpco({ frais_hebergement: { value: 0, confidence: 'exact', source_url: 'x' } });
      const r = calculateFunding(opco, stateHebergement());
      const heb = r.lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240);
      expect(heb.fundedAmount).toBe(0);
      expect(heb.remainder).toBe(240);
      expect(heb.confidence).toBe('exact'); // la valeur 0 est publiée par l'OPCO : confiance conservée
      expect(heb.note).toBe('Hébergement non pris en charge par Test OPCO');
      expect(r.totalFunded).toBe(3000);
    });
  });
});

describe('calculateFunding, montants non publiés : jamais comptés comme financés', () => {
  const source = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  // Aucun plafond horaire publié nulle part : ni inter, ni intra, ni métier, ni seuils, ni plafond par taille.
  const opcoSansPlafondHoraire = (over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_inter: source(null),
      cout_horaire_intra: source(null),
      cout_horaire_metier: source(null),
      ...over,
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40, ...over });
  const pedagogie = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(opco, etat(over)).lines.find((l) => l.poste === 'pedagogie')!;

  describe('coûts pédagogiques sans plafond horaire publié', () => {
    it('avec un budget annuel publié (portée globale) : le coût est compté dans la limite du budget', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(3000) }));
      expect(peda.requestedAmount).toBe(4000); // 100 h × 40 €/h
      expect(peda.fundedAmount).toBe(3000); // borné par le budget annuel
      expect(peda.confidence).toBe('depends_on_branche');
      expect(peda.note).toBe(
        "Pas de plafond horaire publié : coûts pédagogiques pris en charge dans la limite du budget annuel, à confirmer auprès de l'OPCO",
      );
    });

    it('avec un budget annuel null : rien n\'est compté, la note et les détails l\'expliquent', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(null) }));
      expect(peda.requestedAmount).toBe(4000);
      expect(peda.fundedAmount).toBe(0);
      expect(peda.remainder).toBe(4000);
      expect(peda.confidence).toBe('depends_on_branche');
      expect(peda.note).toBe("Plafond horaire non publié : prise en charge selon l'accord de branche, à confirmer auprès de l'OPCO");
      expect(peda.details).toContain('Test OPCO ne publie pas de plafond horaire pour cette situation');
      expect(peda.details).toContain("Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé");
    });

    it('sans budget annuel : le total financé reste à 0 et le reste à charge est complet', () => {
      const r = calculateFunding(opcoSansPlafondHoraire(), etat());
      expect(r.totalFunded).toBe(0);
      expect(r.totalRemainder).toBe(r.totalRequested);
      expect(r.budgetCapApplied).toBe(false);
    });

    it('portée pédagogie : le budget annuel borne les coûts pédagogiques', () => {
      const r = calculateFunding(opcoSansPlafondHoraire({ budget_annuel_max: source(3000), budget_annuel_portee: 'pedagogie' }), etat());
      expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(3000);
      expect(r.budgetCapApplied).toBe(true);
    });

    it('un budget propre à la taille d\'entreprise compte comme budget publié', () => {
      const opco = opcoSansPlafondHoraire({
        plafonds_par_taille: [{ taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 2500, quota_horaire_max: null, description: 'TPE' }],
      });
      expect(pedagogie(opco, { companySize: 'less_11' }).fundedAmount).toBe(2500);
    });

    it('l\'enveloppe publiée d\'une entreprise de 50 salariés et plus compte comme budget publié', () => {
      const opco = opcoSansPlafondHoraire({
        plafonds_par_taille: [{ taille: '50_299', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'Plan conventionnel 50+.' }],
      });
      expect(pedagogie(opco, { companySize: '50_299' }).fundedAmount).toBe(1000);
    });

    it('un budget déjà entièrement consommé ne laisse rien à financer', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(3000) }), { budgetDejaConsomme: 3000 });
      expect(peda.fundedAmount).toBe(0);
    });

    it('un plafond horaire publié reste prioritaire, avec ou sans budget annuel', () => {
      const opco = opcoSansPlafondHoraire({ cout_horaire_inter: source(30) });
      const peda = pedagogie(opco);
      expect(peda.fundedAmount).toBe(3000); // 100 h × min(40, 30)
      expect(peda.confidence).toBe('exact');
    });
  });

  describe('restauration sans forfait publié', () => {
    const stateRepas = () => makeFormationState({ needsMeals: true, mealCostPerDay: 15, trainingDays: 2 });

    it('le coût déclaré reste affiché comme demandé, sans rien financer', () => {
      const repas = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas()).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.requestedAmount).toBe(30); // 15 €/jour × 2 jours
      expect(repas.fundedAmount).toBe(0);
      expect(repas.remainder).toBe(30);
    });

    it('garde la note, la confiance et les détails d\'un montant selon l\'accord de branche', () => {
      const repas = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas()).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.confidence).toBe('depends_on_branche');
      expect(repas.note).toBe('Montant restauration selon accord de branche');
      expect(repas.details).toEqual(['Test OPCO ne publie pas de forfait restauration fixe', 'Le montant dépend de votre accord de branche']);
    });

    it('comme l\'hébergement : le coût déclaré compte dans le total demandé', () => {
      const r = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas());
      expect(r.totalRequested).toBe(3030); // 3000 € de pédagogie + 30 € de repas
      expect(r.totalFunded).toBe(3000);
    });
  });
});

describe('calculateFunding, plafond horaire des formations certifiantes (CQP, certification, habilitation)', () => {
  const opcoMetier = (metier: number | null): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 25, confidence: 'exact', source_url: 'https://exemple.fr/inter' },
      cout_horaire_metier: { value: metier, confidence: 'estimated', source_url: 'https://exemple.fr/metier' },
    });
  const pedagogie = (opco: OpcoData, formationType: WizardState['formationType']) =>
    calculateFunding(opco, makeFormationState({ formationType, durationHours: 10, pedagogyCostPerHour: 60 })).lines.find(
      (l) => l.poste === 'pedagogie',
    )!;

  it.each(['cqp', 'certification', 'habilitation'] as const)(
    '%s : le plafond « métier » de l\'OPCO s\'applique, avec sa confiance et sa source',
    (formationType) => {
      const peda = pedagogie(opcoMetier(15), formationType);
      expect(peda.fundedAmount).toBe(150); // 10 h × 15 €/h
      expect(peda.confidence).toBe('estimated');
      expect(peda.sourceUrl).toBe('https://exemple.fr/metier');
    },
  );

  it.each(['non_certifiante', 'qualification', 'vae', 'reconversion'] as const)(
    '%s : le plafond « inter » s\'applique, pas celui des formations certifiantes',
    (formationType) => {
      const peda = pedagogie(opcoMetier(15), formationType);
      expect(peda.fundedAmount).toBe(250); // 10 h × 25 €/h
      expect(peda.confidence).toBe('exact');
      expect(peda.sourceUrl).toBe('https://exemple.fr/inter');
    },
  );

  it('sans plafond « métier » publié (null), une formation certifiante retombe sur le plafond « inter »', () => {
    const peda = pedagogie(opcoMetier(null), 'cqp');
    expect(peda.fundedAmount).toBe(250);
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe('https://exemple.fr/inter');
  });
});

describe('calculateFunding, habilitation au taux « métier » : jamais « exact »', () => {
  // cout_horaire_metier est le taux publié pour les CQP et certifications ; les formations réglementaires (habilitations)
  // ont parfois un taux distinct (OPCO EP, immobilier : 40 €/h en formation métier, 9,15 €/h appliqué). Le plafond reste
  // appliqué (résultat prudent), mais il ne s'affiche pas « exact » pour une habilitation.
  const SOURCE_INTER = 'https://exemple.fr/inter';
  const SOURCE_METIER = 'https://exemple.fr/metier';
  const SOURCE_BRANCHE = 'https://exemple.fr/branche/metier';
  const opcoMetier = (metier: number | null, confidence: Confidence = 'exact', over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: SOURCE_INTER },
      cout_horaire_metier: { value: metier, confidence, source_url: SOURCE_METIER },
      ...over,
    });
  const pedagogie = (opco: OpcoData, formationType: WizardState['formationType'], over: Partial<WizardState> = {}) =>
    calculateFunding(opco, makeFormationState({ formationType, durationHours: 10, pedagogyCostPerHour: 40, ...over })).lines.find(
      (l) => l.poste === 'pedagogie',
    )!;

  it('habilitation : le plafond « métier » exact s\'applique comme avant, mais la ligne pédagogie est « estimated »', () => {
    const peda = pedagogie(opcoMetier(25), 'habilitation');
    expect(peda.requestedAmount).toBe(400);
    expect(peda.fundedAmount).toBe(250); // 10 h × 25 €/h : le montant ne change pas
    expect(peda.note).toBe(`Plafond horaire : 25${NBSP}€/h`);
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_METIER);
  });

  it.each(['cqp', 'certification'] as const)('%s : le plafond « métier » exact reste « exact » (taux des formations certifiantes)', (formationType) => {
    const peda = pedagogie(opcoMetier(25), formationType);
    expect(peda.fundedAmount).toBe(250);
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe(SOURCE_METIER);
  });

  it.each(['estimated', 'depends_on_branche'] as const)('habilitation : un plafond « métier » « %s » garde sa confiance', (confidence) => {
    const peda = pedagogie(opcoMetier(25, confidence), 'habilitation');
    expect(peda.fundedAmount).toBe(250);
    expect(peda.confidence).toBe(confidence);
  });

  it('habilitation sans plafond « métier » (null) : repli sur cout_horaire_inter, avec sa confiance « exact »', () => {
    const peda = pedagogie(opcoMetier(null), 'habilitation');
    expect(peda.fundedAmount).toBe(400); // 10 h × 40 €/h du champ « inter »
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe(SOURCE_INTER);
  });

  it('habilitation avec un plafond « métier » à 0 (marqueur d\'enveloppe épuisée) : ce n\'est pas un taux, la ligne garde sa confiance « exact »', () => {
    const opco = opcoMetier(0, 'exact', { cout_horaire_inter: { value: 0, confidence: 'exact', source_url: SOURCE_INTER } });
    const peda = pedagogie(opco, 'habilitation');
    expect(peda.requestedAmount).toBe(400);
    expect(peda.fundedAmount).toBe(0); // enveloppe épuisée : aucun financement simulé, comme avant
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe(SOURCE_METIER);
  });

  it.each([
    ['sans confiance ni source propres', {}],
    ['avec sa propre confiance « exact » et sa source', { confidence: 'exact' as const, source_url: 'https://exemple.fr/branche/plafond' }],
  ])('habilitation, plafond propre à la taille %s : reste « exact »', (_libelle, propre) => {
    const opco = opcoMetier(25, 'exact', {
      plafonds_par_taille: [
        { taille: 'less_11', cout_horaire_max: 30, budget_annuel_max: null, quota_horaire_max: null, description: 'Moins de 11 salariés : 30 €/h', ...propre },
      ],
    });
    const peda = pedagogie(opco, 'habilitation');
    expect(peda.fundedAmount).toBe(300); // 10 h × 30 €/h : le plafond de la taille prime sur le plafond « métier »
    expect(peda.confidence).toBe('exact');
  });

  it('habilitation avec une variante de branche : le plafond « métier » exact de la variante est « estimated » lui aussi', () => {
    const opco = opcoMetier(25, 'exact', {
      variantes_branche: [
        {
          id: 'branche',
          branche_nom: 'Branche',
          idcc: ['1234'],
          source_url: 'https://exemple.fr/branche',
          confidence: 'exact',
          cout_horaire_metier: { value: 15, confidence: 'exact', source_url: SOURCE_BRANCHE },
        },
      ],
    });
    const peda = pedagogie(opco, 'habilitation', { detectedIdcc: '1234' });
    expect(peda.fundedAmount).toBe(150); // 10 h × 15 €/h
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_BRANCHE);
  });
});

describe('calculateFunding, plafond horaire par taille : confiance et source de la valeur', () => {
  const PAGE_CRITERES = 'https://exemple.fr/criteres';
  const SOURCE_PLAFOND = 'https://exemple.fr/branche/plafonds';
  const SOURCE_CHAMP = 'https://exemple.fr/branche/champ-inter';
  const plafondTpe = (over: Partial<PlafondTaille> = {}): PlafondTaille => ({
    taille: 'less_11',
    cout_horaire_max: 50,
    budget_annuel_max: null,
    quota_horaire_max: null,
    description: 'Moins de 11 salariés : 50 €/h',
    ...over,
  });
  const opcoAvecPlafond = (plafond: PlafondTaille): OpcoData =>
    makeOpco({
      url_finance_page: PAGE_CRITERES,
      cout_horaire_inter: { value: 30, confidence: 'depends_on_branche', source_url: SOURCE_CHAMP },
      plafonds_par_taille: [plafond],
    });
  const etatTpe = (over: Partial<WizardState> = {}) =>
    makeFormationState({ companySize: 'less_11', durationHours: 10, pedagogyCostPerHour: 60, ...over });
  const pedagogie = (opco: OpcoData, state: WizardState = etatTpe()) =>
    calculateFunding(opco, state).lines.find((l) => l.poste === 'pedagogie')!;

  it('un plafond de taille sans confiance propre reste « exact » et renvoie à la page de critères (comportement inchangé)', () => {
    const peda = pedagogie(opcoAvecPlafond(plafondTpe()));
    expect(peda.fundedAmount).toBe(500); // 10 h × 50 €/h
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe(PAGE_CRITERES);
  });

  it('un plafond de taille estimé, avec sa source, les reporte dans la ligne pédagogie', () => {
    const peda = pedagogie(opcoAvecPlafond(plafondTpe({ confidence: 'estimated', source_url: SOURCE_PLAFOND })));
    expect(peda.fundedAmount).toBe(500);
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_PLAFOND);
  });

  it('une confiance sans source garde la page de critères ; une source sans confiance garde « exact »', () => {
    const sansSource = pedagogie(opcoAvecPlafond(plafondTpe({ confidence: 'depends_on_branche' })));
    expect(sansSource.confidence).toBe('depends_on_branche');
    expect(sansSource.sourceUrl).toBe(PAGE_CRITERES);
    const sansConfiance = pedagogie(opcoAvecPlafond(plafondTpe({ source_url: SOURCE_PLAFOND })));
    expect(sansConfiance.confidence).toBe('exact');
    expect(sansConfiance.sourceUrl).toBe(SOURCE_PLAFOND);
  });

  it('un plafond de taille sans valeur horaire laisse la confiance et la source du champ de l\'OPCO', () => {
    const peda = pedagogie(
      opcoAvecPlafond(plafondTpe({ cout_horaire_max: null, confidence: 'estimated', source_url: SOURCE_PLAFOND })),
    );
    expect(peda.fundedAmount).toBe(300); // 10 h × 30 €/h du champ « inter »
    expect(peda.confidence).toBe('depends_on_branche');
    expect(peda.sourceUrl).toBe(SOURCE_CHAMP);
  });

  it('le plafond estimé d\'une variante de branche est celui qui s\'affiche', () => {
    const opco = makeOpco({
      url_finance_page: PAGE_CRITERES,
      variantes_branche: [
        {
          id: 'branche',
          branche_nom: 'Branche',
          idcc: ['1234'],
          source_url: 'https://exemple.fr/branche',
          confidence: 'exact',
          plafonds_par_taille: [plafondTpe({ confidence: 'estimated', source_url: SOURCE_PLAFOND })],
        },
      ],
    });
    const peda = pedagogie(opco, etatTpe({ detectedIdcc: '1234' }));
    expect(peda.fundedAmount).toBe(500);
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_PLAFOND);
  });
});

describe('calculateFunding, forfait de restauration : unité du forfait (repas ou jour)', () => {
  const forfait = { value: 20, confidence: 'exact' as const, source_url: 'x' };
  const opcoRestauration = (over: Partial<OpcoData> = {}): OpcoData => makeOpco({ frais_restauration: forfait, ...over });
  const stateRepas = (mealCostPerDay: number) => makeFormationState({ needsMeals: true, mealCostPerDay, trainingDays: 5 });
  const restauration = (opco: OpcoData, mealCostPerDay: number) =>
    calculateFunding(opco, stateRepas(mealCostPerDay)).lines.find((l) => l.poste === 'restauration')!;

  describe('forfait par repas', () => {
    const opcoParRepas = () => opcoRestauration({ frais_restauration_unite: 'repas' });

    it('coût déclaré supérieur au forfait : financé au forfait, avec des textes « par repas »', () => {
      const repas = restauration(opcoParRepas(), 28);
      expect(repas.requestedAmount).toBe(140); // 28 € × 5 jours
      expect(repas.fundedAmount).toBe(100); // 20 € par repas × 5 jours
      expect(repas.details).toContain(`Forfait restauration Test OPCO : 20${NBSP}€ par repas (un repas par jour de formation retenu)`);
      expect(repas.details).toContain(`Calcul : 20${NBSP}€ par repas × 5${NBSP}jours = 100.00${NBSP}€`);
      expect(repas.note).toBe(`20${NBSP}€ par repas × 5${NBSP}jours`);
    });

    it('coût déclaré inférieur au forfait : financé au coût réel, avec des textes « par repas »', () => {
      const repas = restauration(opcoParRepas(), 15);
      expect(repas.fundedAmount).toBe(75);
      expect(repas.details).toContain(`Calcul : 15${NBSP}€ par repas × 5${NBSP}jours = 75.00${NBSP}€`);
      expect(repas.note).toBe(`15${NBSP}€ par repas × 5${NBSP}jours`);
    });

    it('aucun texte du forfait ne parle de « €/jour » quand le coût déclaré dépasse le forfait', () => {
      const repas = restauration(opcoParRepas(), 28);
      expect(repas.note).not.toContain('€/jour');
      expect((repas.details ?? []).length).toBeGreaterThan(0);
      for (const d of repas.details ?? []) expect(d, d).not.toContain('€/jour');
    });
  });

  describe('forfait par jour', () => {
    it.each([['explicite', 'jour' as const], ['par défaut (unité absente)', undefined]])(
      'unité %s : textes « €/jour »',
      (_libelle, unite) => {
        const repas = restauration(opcoRestauration({ frais_restauration_unite: unite }), 28);
        expect(repas.fundedAmount).toBe(100);
        expect(repas.details).toContain(`Forfait restauration Test OPCO : 20${NBSP}€/jour`);
        expect(repas.details).toContain(`Calcul : 20${NBSP}€/jour × 5${NBSP}jours = 100.00${NBSP}€`);
        expect(repas.note).toBe(`20${NBSP}€/jour × 5${NBSP}jours`);
      },
    );
  });

  describe('variante de branche', () => {
    const variante = (over: Partial<VarianteBranche> = {}): VarianteBranche => ({
      id: 'branche',
      branche_nom: 'Branche',
      idcc: ['1234'],
      source_url: 'x',
      confidence: 'exact',
      ...over,
    });
    const etat = (mealCostPerDay: number) => ({ ...stateRepas(mealCostPerDay), detectedIdcc: '1234' });

    it('la variante hérite de l\'unité de l\'OPCO quand elle n\'en déclare pas', () => {
      const opco = opcoRestauration({ frais_restauration_unite: 'repas', variantes_branche: [variante()] });
      const repas = calculateFunding(opco, etat(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toBe(`20${NBSP}€ par repas × 5${NBSP}jours`);
    });

    it('la variante peut surcharger l\'unité (et son forfait) : par jour chez l\'OPCO, par repas dans la branche', () => {
      const opco = opcoRestauration({
        frais_restauration_unite: 'jour',
        variantes_branche: [
          variante({ frais_restauration: { value: 25, confidence: 'exact', source_url: 'x' }, frais_restauration_unite: 'repas' }),
        ],
      });
      const repas = calculateFunding(opco, etat(30)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.fundedAmount).toBe(125);
      expect(repas.note).toBe(`25${NBSP}€ par repas × 5${NBSP}jours`);
    });

    it('une variante « par jour » chez un OPCO « par repas » repasse aux textes « €/jour »', () => {
      const opco = opcoRestauration({
        frais_restauration_unite: 'repas',
        variantes_branche: [variante({ frais_restauration_unite: 'jour' })],
      });
      const repas = calculateFunding(opco, etat(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toBe(`20${NBSP}€/jour × 5${NBSP}jours`);
    });

    it('applyVarianteBranche : l\'unité de la variante remplace celle de l\'OPCO, sinon elle est héritée', () => {
      const opco = opcoRestauration({ frais_restauration_unite: 'repas' });
      expect(applyVarianteBranche(opco, variante()).frais_restauration_unite).toBe('repas');
      expect(applyVarianteBranche(opco, variante({ frais_restauration_unite: 'jour' })).frais_restauration_unite).toBe('jour');
      expect(applyVarianteBranche(opcoRestauration(), variante()).frais_restauration_unite).toBeUndefined();
    });
  });
});

describe('calculateFunding, plafond annuel estimé : mention « à confirmer » dans les messages', () => {
  const MENTION = ' (montant estimé : à confirmer auprès de Test OPCO)';
  const opcoPlafonne = (confidence: 'exact' | 'estimated' | 'depends_on_branche', portee?: 'global' | 'pedagogie'): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence, source_url: 'x' },
      budget_annuel_portee: portee,
    });
  const etat = () => makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
  const messagesDePlafond = (warnings: string[]) =>
    warnings.filter((w) => w.startsWith('Plafond annuel appliqué') || w.startsWith('Le plafond budgétaire annuel'));

  it('budget estimé, portée pédagogie : les deux messages de plafond se terminent par la mention', () => {
    const r = calculateFunding(opcoPlafonne('estimated', 'pedagogie'), etat());
    expect(r.budgetCapApplied).toBe(true);
    const messages = messagesDePlafond(r.warnings);
    expect(messages).toHaveLength(2); // calcPedagogy (montant) et generateWarnings (plafond appliqué)
    expect(messages.some((m) => m.startsWith(`Plafond annuel appliqué aux coûts pédagogiques : 2000.00${NBSP}€`))).toBe(true);
    expect(messages.some((m) => m.startsWith('Le plafond budgétaire annuel de Test OPCO a été appliqué aux coûts pédagogiques'))).toBe(true);
    for (const m of messages) expect(m.endsWith(MENTION), m).toBe(true);
  });

  it('budget estimé, portée globale : le message de plafond se termine par la mention', () => {
    const r = calculateFunding(opcoPlafonne('estimated'), etat());
    const messages = messagesDePlafond(r.warnings);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(
      'Le plafond budgétaire annuel de Test OPCO a été appliqué. Le montant total finançable est plafonné' + MENTION,
    );
  });

  it('un budget « depends_on_branche » est aussi signalé comme estimé', () => {
    const r = calculateFunding(opcoPlafonne('depends_on_branche'), etat());
    for (const m of messagesDePlafond(r.warnings)) expect(m.endsWith(MENTION), m).toBe(true);
  });

  it.each([undefined, 'pedagogie'] as const)('budget exact (portée %s) : aucune mention d\'estimation', (portee) => {
    const r = calculateFunding(opcoPlafonne('exact', portee), etat());
    expect(messagesDePlafond(r.warnings).length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes('montant estimé'))).toBe(false);
    for (const m of messagesDePlafond(r.warnings)) expect(m.endsWith('.'), m).toBe(true);
  });

  it('le détail de la ligne pédagogie n\'est pas modifié par la mention', () => {
    const peda = calculateFunding(opcoPlafonne('estimated', 'pedagogie'), etat()).lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.details?.some((d) => d.includes('montant estimé'))).toBe(false);
  });

  // Données réelles (AFDAS, Atlas, ALISFA) : le budget annuel de l'OPCO n'a pas de valeur (null), le plafond est posé par taille.
  describe('plafond annuel posé par taille (budget annuel de l\'OPCO sans valeur)', () => {
    const plafondTpe: PlafondTaille = {
      taille: 'less_11',
      cout_horaire_max: null,
      budget_annuel_max: 2000,
      quota_horaire_max: null,
      description: 'Moins de 11 salariés : 2 000 € par an',
    };
    const opcoPlafondParTaille = (confidence: 'exact' | 'estimated' | 'depends_on_branche', portee?: 'global' | 'pedagogie'): OpcoData =>
      makeOpco({
        cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
        prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
        prise_en_charge_salaires_mode: 'euro_par_heure',
        budget_annuel_max: { value: null, confidence, source_url: 'x' },
        budget_annuel_portee: portee,
        plafonds_par_taille: [plafondTpe],
      });

    it.each([undefined, 'pedagogie'] as const)(
      'budget annuel de l\'OPCO estimé (portée %s) : le plafond de la taille s\'applique et chaque message de plafond se termine par la mention',
      (portee) => {
        const r = calculateFunding(opcoPlafondParTaille('estimated', portee), etat());
        expect(r.budgetCapApplied).toBe(true);
        expect(r.budgetCapAmount).toBe(2000); // plafond de la taille, et non budget_annuel_max.value (null)
        const messages = messagesDePlafond(r.warnings);
        expect(messages).toHaveLength(portee === 'pedagogie' ? 2 : 1); // calcPedagogy (montant) puis generateWarnings (plafond appliqué)
        for (const m of messages) expect(m.endsWith(MENTION), m).toBe(true);
      },
    );

    it.each([undefined, 'pedagogie'] as const)(
      'budget annuel de l\'OPCO « exact » (portée %s) : le plafond de la taille s\'applique, aucune mention d\'estimation',
      (portee) => {
        const r = calculateFunding(opcoPlafondParTaille('exact', portee), etat());
        expect(r.budgetCapApplied).toBe(true);
        expect(r.budgetCapAmount).toBe(2000);
        const messages = messagesDePlafond(r.warnings);
        expect(messages.length).toBeGreaterThan(0);
        expect(r.warnings.some((w) => w.includes('montant estimé'))).toBe(false);
        for (const m of messages) expect(m.endsWith('.'), m).toBe(true);
      },
    );
  });
});

describe('calculateFunding, délai de validation (texte libre de l\'OPCO)', () => {
  // delai_validation est un champ libre : le schéma accepte aussi un objet détaillé ou null. Le résultat reste une chaîne
  // (l'application mobile l'affiche telle quelle dans un <Text>, un objet y planterait) : sans texte, chaîne vide.
  const resultat = (delai_validation: OpcoData['delai_validation']) => calculateFunding(makeOpco({ delai_validation }), makeFormationState());
  const objetDetaille = { description: 'Réponse sous 30 jours', source_url: 'https://exemple.fr/delais' };

  it('recopie le délai publié quand c\'est un texte, et l\'ajoute aux démarches', () => {
    const r = resultat('2-3 semaines');
    expect(r.delaiValidation).toBe('2-3 semaines');
    expect(r.demarches).toContain('Délai : 2-3 semaines');
  });

  it('donne une chaîne vide quand l\'OPCO publie un objet détaillé ou rien : le résultat reste une chaîne', () => {
    for (const delai of [objetDetaille, null]) {
      const r = resultat(delai);
      expect(r.delaiValidation, JSON.stringify(delai)).toBe('');
      expect(typeof r.delaiValidation).toBe('string');
    }
  });

  it('n\'ajoute aucune étape « Délai » aux démarches quand le délai n\'est pas un texte, ni quand il est vide', () => {
    for (const delai of [objetDetaille, null, '']) {
      expect(resultat(delai).demarches.some((d) => d.startsWith('Délai')), JSON.stringify(delai)).toBe(false);
    }
  });
});

describe('calculateFunding, déterminisme', () => {
  it('mêmes entrées → mêmes sorties', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState();
    expect(calculateFunding(opco, state)).toEqual(calculateFunding(opco, state));
  });
});
