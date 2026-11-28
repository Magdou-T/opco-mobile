import { describe, expect, it } from 'vitest';
import { evaluerAide, evaluerAides, trierAidesEvaluees } from '../src/aides/evaluer';
import type { Aide, AideEvaluee, StatutEligibilite } from '../src/aides/types';
import { EMBEDDED_AIDES } from '../src/data';
import { fusionnerAides, profilsDuGroupe } from '../src/groupe';
import type { ProfilDuGroupe } from '../src/groupe';
import { makeAide, makeProfil } from './fixtures-aides';
import { AUJOURDHUI, groupe } from './fixtures-groupe';

describe('fusion des aides du catalogue', () => {
  const [pA, pB] = profilsDuGroupe(groupe()); // principal (3 personnes), profil-2 (2 personnes)
  const profilAidesA = makeProfil({ age: 35, rqth: false, niveauDiplome: null });
  const profilAidesB = makeProfil({
    projet: 'formation_dirigeant',
    statutBeneficiaire: 'dirigeant',
    age: 52,
    rqth: true,
    niveauDiplome: 'bac',
  });
  const ouvertes = {
    projets: ['formation_salarie', 'formation_dirigeant'],
    beneficiaires: ['salarie', 'dirigeant'],
  } satisfies Pick<Aide, 'projets' | 'beneficiaires'>;
  const evaluer = (aide: Aide) => [
    { profil: pA, aides: [evaluerAide(aide, profilAidesA, AUJOURDHUI)] },
    { profil: pB, aides: [evaluerAide(aide, profilAidesB, AUJOURDHUI)] },
  ];

  it("éligible pour un profil, non éligible pour l'autre : éligible, avec le seul profil concerné", () => {
    const [a] = fusionnerAides(evaluer(makeAide({ ...ouvertes, id: 'nat-seniors', criteres: { age_min: 50 } })));
    expect(a).toMatchObject({ id: 'nat-seniors', statut: 'eligible', raisons: [], horsPerimetre: false });
    expect(a.profils).toEqual([{ profilId: 'profil-2', nombre: 2, statut: 'eligible', montantEstime: 1000 }]);
  });

  it('éligible pour les deux profils avec des montants différents : le plus grand montant par personne, son libellé, le montant de chaque profil', () => {
    const aide = makeAide({
      ...ouvertes,
      id: 'nat-rqth',
      montant: {
        ...makeAide().montant,
        valeur: 1000,
        libelle: '1 000 €',
        majorations: [{ criteres: { rqth: true }, valeur: 2000, libelle: '2 000 € (RQTH)' }],
      },
    });
    const [a] = fusionnerAides(evaluer(aide));
    expect(a).toMatchObject({ statut: 'eligible', montantEstime: 2000, libelleMontant: '2 000 € (RQTH)' });
    expect(a.profils?.map((p) => [p.profilId, p.nombre, p.montantEstime])).toEqual([
      ['principal', 3, 1000],
      ['profil-2', 2, 2000],
    ]);
  });

  it("à vérifier pour un profil, éligible pour l'autre : éligible ; à vérifier pour les deux : à vérifier, raisons réunies sans doublon", () => {
    const exigeDiplome = makeAide({ ...ouvertes, id: 'nat-diplome', criteres: { niveaux_diplome: ['bac'] } });
    const [une] = fusionnerAides(evaluer(exigeDiplome));
    expect(une).toMatchObject({ statut: 'eligible', raisons: [] });
    const [deux] = fusionnerAides([
      { profil: pA, aides: [evaluerAide(exigeDiplome, profilAidesA, AUJOURDHUI)] },
      { profil: pB, aides: [evaluerAide(exigeDiplome, { ...profilAidesB, niveauDiplome: null }, AUJOURDHUI)] },
    ]);
    expect(deux.statut).toBe('a_verifier');
    expect(deux.raisons).toEqual(['Précisez le niveau de diplôme du bénéficiaire']);
    expect(deux.profils?.map((p) => p.statut)).toEqual(['a_verifier', 'a_verifier']);
  });

  it('non éligible pour tous : raisons réunies, aucun profil concerné ; hors périmètre seulement si tous les profils le sont', () => {
    const [a] = fusionnerAides(evaluer(makeAide({ ...ouvertes, id: 'nat-aines', criteres: { age_min: 70 } })));
    expect(a).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
    expect(a.raisons).toEqual(['Réservé aux personnes de 70 ans et plus']);
    expect(a.profils).toEqual([]);
    // Aide du seul projet salarié : hors périmètre pour le dirigeant, non éligible par l'âge pour le salarié. Elle reste
    // visible, avec la seule raison du salarié (jamais « Ne concerne pas ce type de projet » du dirigeant).
    const [b] = fusionnerAides(evaluer(makeAide({ id: 'nat-salaries', criteres: { age_min: 70 } })));
    expect(b).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
    expect(b.raisons).toEqual(['Réservé aux personnes de 70 ans et plus']);
    const [c] = fusionnerAides(evaluer(makeAide({ id: 'nat-autre', projets: ['alternance'], beneficiaires: ['alternant'] })));
    expect(c).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
  });

  it("la liste fusionnée est triée comme une liste évaluée : éligibles d'abord, montant décroissant, puis nom", () => {
    const aides = [
      makeAide({ ...ouvertes, id: 'nat-b', nom: 'B', criteres: { age_min: 70 } }),
      makeAide({ ...ouvertes, id: 'nat-a', nom: 'A', montant: { ...makeAide().montant, valeur: 500 } }),
      makeAide({ ...ouvertes, id: 'nat-c', nom: 'C', montant: { ...makeAide().montant, valeur: 1500 } }),
    ];
    const fusion = fusionnerAides([
      { profil: pA, aides: aides.map((a) => evaluerAide(a, profilAidesA, AUJOURDHUI)) },
      { profil: pB, aides: aides.map((a) => evaluerAide(a, profilAidesB, AUJOURDHUI)) },
    ]);
    expect(fusion.map((a) => a.id)).toEqual(['nat-c', 'nat-a', 'nat-b']);
  });

  it('un seul profil : la liste est rendue telle quelle, sans champ « profils »', () => {
    const liste = [evaluerAide(makeAide(), profilAidesA, AUJOURDHUI)];
    const fusion = fusionnerAides([{ profil: pA, aides: liste }]);
    expect(fusion).toEqual(liste);
    expect(fusion[0].profils).toBeUndefined();
  });

  it("catalogue entier, deux profils : une entrée par aide, jamais d'aide perdue", () => {
    const p = makeProfil();
    const q = makeProfil({ projet: 'formation_dirigeant', statutBeneficiaire: 'dirigeant', statutDirigeant: 'artisan', age: 52, rqth: true });
    const fusion = fusionnerAides([
      { profil: pA, aides: evaluerAides(EMBEDDED_AIDES, p, AUJOURDHUI) },
      { profil: pB, aides: evaluerAides(EMBEDDED_AIDES, q, AUJOURDHUI) },
    ]);
    expect(fusion).toHaveLength(EMBEDDED_AIDES.length);
    expect(new Set(fusion.map((a) => a.id)).size).toBe(EMBEDDED_AIDES.length);
    // Une aide ouverte au salarié comme au dirigeant concerne les deux profils (éligible ou à vérifier).
    expect(fusion.some((a) => (a.profils?.length ?? 0) === 2)).toBe(true);
  });

  it("à vérifier pour un profil, non éligible pour l'autre : à vérifier, avec les seules raisons du profil à vérifier", () => {
    const aide = makeAide({ ...ouvertes, id: 'nat-mixte', criteres: { age_min: 50, niveaux_diplome: ['bac'] } });
    const [a] = fusionnerAides([
      { profil: pA, aides: [evaluerAide(aide, profilAidesA, AUJOURDHUI)] },
      { profil: pB, aides: [evaluerAide(aide, { ...profilAidesB, niveauDiplome: null }, AUJOURDHUI)] },
    ]);
    expect(a).toMatchObject({ statut: 'a_verifier', horsPerimetre: false });
    // Le profil de 35 ans est écarté par l'âge : sa raison n'apparaît pas, seule celle du profil à vérifier reste.
    expect(a.raisons).toEqual(['Précisez le niveau de diplôme du bénéficiaire']);
    expect(a.profils).toEqual([{ profilId: 'profil-2', nombre: 2, statut: 'a_verifier', montantEstime: 1000 }]);
  });

  it("le libellé et le lien de la demande sont ceux du profil au plus grand montant, quel que soit l'ordre des blocs", () => {
    const aide = makeAide({
      ...ouvertes,
      id: 'nat-regionale',
      criteres: { perimetre_region: 'beneficiaire' },
      url_demarche: 'https://www.example.gouv.fr/national',
      liens_par_region: {
        '11': 'https://www.example.gouv.fr/ile-de-france',
        '84': 'https://www.example.gouv.fr/auvergne-rhone-alpes',
      },
      montant: {
        ...makeAide().montant,
        valeur: 1000,
        libelle: '1 000 €',
        majorations: [{ criteres: { rqth: true }, valeur: 2500, libelle: '2 500 € (RQTH)' }],
      },
    });
    const enAuvergne = evaluerAide(aide, { ...profilAidesA, regionBeneficiaire: '84' }, AUJOURDHUI);
    const enIleDeFrance = evaluerAide(aide, { ...profilAidesB, regionBeneficiaire: '11' }, AUJOURDHUI);
    expect(enAuvergne.urlDemarche).toBe('https://www.example.gouv.fr/auvergne-rhone-alpes');
    const attendu = {
      statut: 'eligible',
      montantEstime: 2500,
      libelleMontant: '2 500 € (RQTH)',
      urlDemarche: 'https://www.example.gouv.fr/ile-de-france',
    };
    expect(fusionnerAides([{ profil: pA, aides: [enAuvergne] }, { profil: pB, aides: [enIleDeFrance] }])[0]).toMatchObject(attendu);
    expect(fusionnerAides([{ profil: pB, aides: [enIleDeFrance] }, { profil: pA, aides: [enAuvergne] }])[0]).toMatchObject(attendu);
  });

  it('à montant égal, le lien de la demande est celui du profil éligible, même placé après un profil à vérifier', () => {
    const aide = makeAide({
      ...ouvertes,
      id: 'nat-regionale-diplome',
      criteres: { perimetre_region: 'beneficiaire', niveaux_diplome: ['bac'] },
      url_demarche: 'https://www.example.gouv.fr/national',
      liens_par_region: {
        '11': 'https://www.example.gouv.fr/ile-de-france',
        '84': 'https://www.example.gouv.fr/auvergne-rhone-alpes',
      },
    });
    // Même forfait de 1 000 € pour les deux profils : le profil sans niveau de diplôme est à vérifier, l'autre est éligible.
    const aVerifier = evaluerAide(aide, { ...profilAidesA, regionBeneficiaire: '84' }, AUJOURDHUI);
    const eligible = evaluerAide(aide, { ...profilAidesB, regionBeneficiaire: '11' }, AUJOURDHUI);
    expect([aVerifier.statut, aVerifier.montantEstime, eligible.statut, eligible.montantEstime]).toEqual(['a_verifier', 1000, 'eligible', 1000]);
    expect(aVerifier.urlDemarche).toBe('https://www.example.gouv.fr/auvergne-rhone-alpes');
    // Le lien dépend de la région du profil : l'aide est éligible, son lien est celui du profil éligible, quel que soit l'ordre des blocs.
    const attendu = { statut: 'eligible', montantEstime: 1000, urlDemarche: 'https://www.example.gouv.fr/ile-de-france' };
    expect(fusionnerAides([{ profil: pA, aides: [aVerifier] }, { profil: pB, aides: [eligible] }])[0]).toMatchObject(attendu);
    expect(fusionnerAides([{ profil: pB, aides: [eligible] }, { profil: pA, aides: [aVerifier] }])[0]).toMatchObject(attendu);
  });
});

describe('fusion des aides du catalogue : règles de chaque champ', () => {
  const modele = profilsDuGroupe(groupe())[0];
  /** Le profil de rang `rang` (1, 2...) : identifiant `p<rang>`, `rang` personnes ; le premier est le profil principal. */
  const profil = (rang: number): ProfilDuGroupe => ({ ...modele, id: `p${rang}`, nombre: rang, principal: rang === 1 });
  const base = evaluerAide(makeAide({ id: 'nat-test' }), makeProfil(), AUJOURDHUI);
  /** Ce qu'un profil voit d'une aide : l'aide de base évaluée par le moteur, avec les champs donnés. */
  const vue = (champs: Partial<AideEvaluee> = {}): AideEvaluee => ({ ...base, ...champs });
  /** Un bloc par liste : le profil p1 voit la première liste, p2 la deuxième... */
  const blocs = (...listes: AideEvaluee[][]) => listes.map((aides, i) => ({ profil: profil(i + 1), aides }));
  /** Une même aide vue par plusieurs profils (une vue par profil, dans l'ordre des blocs), fusionnée. */
  const fusion = (...vues: AideEvaluee[]): AideEvaluee => fusionnerAides(blocs(...vues.map((v) => [v])))[0];
  /** Une vue qui porte un statut, un montant par personne et un libellé, avec un lien propre à ce libellé. */
  const chiffree = (statut: StatutEligibilite, montantEstime: number | null, nom: string) =>
    vue({ statut, montantEstime, libelleMontant: nom, urlDemarche: `https://exemple.test/${nom}` });

  it("le meilleur statut l'emporte, quel que soit l'ordre des blocs", () => {
    const cas: [StatutEligibilite[], StatutEligibilite][] = [
      [['eligible', 'a_verifier'], 'eligible'],
      [['a_verifier', 'eligible'], 'eligible'],
      [['eligible', 'non_eligible'], 'eligible'],
      [['non_eligible', 'eligible'], 'eligible'],
      [['a_verifier', 'non_eligible'], 'a_verifier'],
      [['non_eligible', 'a_verifier'], 'a_verifier'],
      [['non_eligible', 'a_verifier', 'eligible'], 'eligible'],
      [['non_eligible', 'a_verifier', 'a_verifier'], 'a_verifier'],
      [['non_eligible', 'non_eligible'], 'non_eligible'],
    ];
    for (const [statuts, attendu] of cas) {
      expect(fusion(...statuts.map((statut) => vue({ statut }))).statut, statuts.join(', ')).toBe(attendu);
    }
  });

  it('un profil à vérifier au plus grand montant ne change pas le statut éligible : il donne le montant, le libellé et le lien', () => {
    const r = fusion(chiffree('eligible', 1000, 'mille'), chiffree('a_verifier', 2000, 'deux-mille'));
    expect(r).toMatchObject({
      statut: 'eligible',
      raisons: [],
      montantEstime: 2000,
      libelleMontant: 'deux-mille',
      urlDemarche: 'https://exemple.test/deux-mille',
    });
    expect(r.profils?.map((p) => [p.profilId, p.statut, p.montantEstime])).toEqual([
      ['p1', 'eligible', 1000],
      ['p2', 'a_verifier', 2000],
    ]);
  });

  it('aucun profil concerné : le montant, le libellé et le lien sont ceux de la vue au plus grand montant, la première à égalité', () => {
    const petite = chiffree('non_eligible', 500, 'petite');
    const grande = chiffree('non_eligible', 2000, 'grande');
    const autreGrande = chiffree('non_eligible', 2000, 'autre-grande');
    expect(fusion(petite, grande, autreGrande)).toMatchObject({
      statut: 'non_eligible',
      montantEstime: 2000,
      libelleMontant: 'grande',
      urlDemarche: 'https://exemple.test/grande',
    });
    expect(fusion(autreGrande, grande, petite)).toMatchObject({
      montantEstime: 2000,
      libelleMontant: 'autre-grande',
      urlDemarche: 'https://exemple.test/autre-grande',
    });
  });

  it("le montant d'un profil non éligible ne compte jamais : ni le maximum, ni le libellé, ni le lien", () => {
    const r = fusion(chiffree('non_eligible', 3000, 'refuse'), chiffree('eligible', 1000, 'un'), chiffree('a_verifier', 2000, 'deux'));
    expect(r).toMatchObject({ statut: 'eligible', montantEstime: 2000, libelleMontant: 'deux', urlDemarche: 'https://exemple.test/deux' });
    // Un profil non éligible qui passe avant et dont le montant égale le maximum ne prête pas non plus son libellé ni son lien.
    const egal = fusion(chiffree('non_eligible', 2000, 'refuse'), chiffree('eligible', 1000, 'un'), chiffree('a_verifier', 2000, 'deux'));
    expect(egal).toMatchObject({ montantEstime: 2000, libelleMontant: 'deux', urlDemarche: 'https://exemple.test/deux' });
  });

  it("le plus grand montant par personne, où qu'il soit dans l'ordre des blocs ; à égalité, le premier profil donne le libellé et le lien", () => {
    const eligible = (montant: number, nom: string) => chiffree('eligible', montant, nom);
    expect(fusion(eligible(1000, 'a'), eligible(3000, 'b'), eligible(3000, 'c'), eligible(2000, 'd'))).toMatchObject({
      montantEstime: 3000,
      libelleMontant: 'b',
      urlDemarche: 'https://exemple.test/b',
    });
    expect(fusion(eligible(3000, 'a'), eligible(1000, 'b'), eligible(2000, 'c'))).toMatchObject({ montantEstime: 3000, libelleMontant: 'a' });
    expect(fusion(eligible(1000, 'a'), eligible(2000, 'b'), eligible(3000, 'c'))).toMatchObject({ montantEstime: 3000, libelleMontant: 'c' });
  });

  it("à montant maximal égal, le libellé et le lien sont ceux du profil au meilleur statut, puis du premier dans l'ordre des blocs", () => {
    const aVerifier = (nom: string) => chiffree('a_verifier', 1000, nom);
    const eligible = (nom: string) => chiffree('eligible', 1000, nom);
    // Un profil à vérifier avant un profil éligible au même montant : l'éligible donne le libellé et le lien, dans les deux ordres.
    const attendu = { statut: 'eligible', montantEstime: 1000, libelleMontant: 'eligible', urlDemarche: 'https://exemple.test/eligible' };
    expect(fusion(aVerifier('a-verifier'), eligible('eligible'))).toMatchObject(attendu);
    expect(fusion(eligible('eligible'), aVerifier('a-verifier'))).toMatchObject(attendu);
    // Plusieurs profils de chaque statut : le premier profil éligible dans l'ordre des blocs.
    expect(fusion(aVerifier('v1'), eligible('e1'), aVerifier('v2'), eligible('e2'))).toMatchObject({ libelleMontant: 'e1', urlDemarche: 'https://exemple.test/e1' });
    // Aucun profil éligible : le premier profil à vérifier.
    expect(fusion(aVerifier('v1'), aVerifier('v2'))).toMatchObject({ statut: 'a_verifier', libelleMontant: 'v1', urlDemarche: 'https://exemple.test/v1' });
    // Le montant prime sur le statut : parmi les profils au plus grand montant, c'est le meilleur statut qui compte, pas le premier rencontré.
    expect(fusion(chiffree('eligible', 1000, 'mille'), chiffree('a_verifier', 2000, 'deux-mille-a-verifier'), chiffree('eligible', 2000, 'deux-mille-eligible'))).toMatchObject({
      statut: 'eligible',
      montantEstime: 2000,
      libelleMontant: 'deux-mille-eligible',
    });
  });

  it('un montant de 0 € est un montant connu : il passe avant un montant non chiffré, seul ou non', () => {
    const nulle = (statut: StatutEligibilite) => chiffree(statut, null, 'nul');
    const zero = (statut: StatutEligibilite) => chiffree(statut, 0, 'zero');
    // Aucun profil concerné : le 0 € est celui de la meilleure vue, quel que soit l'ordre des blocs.
    expect(fusion(nulle('non_eligible'), zero('non_eligible'))).toMatchObject({ montantEstime: 0, libelleMontant: 'zero' });
    expect(fusion(zero('non_eligible'), nulle('non_eligible'))).toMatchObject({ montantEstime: 0, libelleMontant: 'zero' });
    // Aide éligible : le 0 € du seul profil chiffré est le montant de l'aide (nul seulement si aucun profil n'est chiffré).
    expect(fusion(nulle('eligible'), zero('eligible'))).toMatchObject({ montantEstime: 0, libelleMontant: 'zero', urlDemarche: 'https://exemple.test/zero' });
    expect(fusion(zero('eligible'), nulle('eligible'))).toMatchObject({ montantEstime: 0, libelleMontant: 'zero' });
    // Le profil chiffré peut avoir un moins bon statut que la meilleure vue : il porte quand même le libellé et le lien.
    expect(fusion(nulle('eligible'), zero('a_verifier'))).toMatchObject({
      statut: 'eligible',
      montantEstime: 0,
      libelleMontant: 'zero',
      urlDemarche: 'https://exemple.test/zero',
    });
    // Deux montants de 0 € à égalité : le premier profil donne le libellé et le lien, comme pour tout montant égal.
    for (const statut of ['non_eligible', 'eligible'] as const) {
      expect(fusion(chiffree(statut, 0, 'premier'), chiffree(statut, 0, 'second')), statut).toMatchObject({
        montantEstime: 0,
        libelleMontant: 'premier',
        urlDemarche: 'https://exemple.test/premier',
      });
    }
  });

  it("aucun profil concerné n'a de montant chiffré : montant nul, libellé et lien de la meilleure vue, jamais le montant d'un profil non éligible", () => {
    const r = fusion(
      chiffree('non_eligible', 700, 'refuse'),
      chiffree('a_verifier', null, 'a-verifier'),
      chiffree('eligible', null, 'eligible'),
      chiffree('eligible', null, 'autre-eligible'),
    );
    expect(r).toMatchObject({ statut: 'eligible', montantEstime: null, libelleMontant: 'eligible', urlDemarche: 'https://exemple.test/eligible' });
  });

  it("profils : un élément par profil éligible ou à vérifier, dans l'ordre des blocs, avec son effectif, son statut et son montant par personne", () => {
    const r = fusion(
      chiffree('a_verifier', 500, 'un'),
      chiffree('non_eligible', 900, 'deux'),
      chiffree('eligible', 1500, 'trois'),
      chiffree('a_verifier', null, 'quatre'),
    );
    expect(r.profils).toEqual([
      { profilId: 'p1', nombre: 1, statut: 'a_verifier', montantEstime: 500 },
      { profilId: 'p3', nombre: 3, statut: 'eligible', montantEstime: 1500 },
      { profilId: 'p4', nombre: 4, statut: 'a_verifier', montantEstime: null },
    ]);
  });

  it("profils : une liste vide, et non un champ absent, quand aucun profil n'est concerné", () => {
    const r = fusion(vue({ statut: 'non_eligible' }), vue({ statut: 'non_eligible' }));
    expect(r.profils).toEqual([]);
  });

  it("raisons vides dès qu'un profil est éligible, même si d'autres profils ont des doutes ou des exclusions", () => {
    const r = fusion(
      vue({ statut: 'a_verifier', raisons: ['Un doute'] }),
      vue({ statut: 'non_eligible', raisons: ['Une exclusion'] }),
      vue({ statut: 'eligible', raisons: [] }),
    );
    expect(r).toMatchObject({ statut: 'eligible', raisons: [] });
    // Entrée construite : le moteur ne rend jamais de raison pour une aide éligible. Le résultat n'en garde aucune, quoi que porte la vue.
    expect(fusion(vue({ statut: 'eligible', raisons: ['Reste'] }), vue({ statut: 'a_verifier', raisons: ['Un doute'] })).raisons).toEqual([]);
  });

  it("raisons d'une aide à vérifier : celles des seuls profils à vérifier, réunies sans doublon dans l'ordre d'apparition", () => {
    const r = fusion(
      vue({ statut: 'non_eligible', raisons: ['Exclusion'] }),
      vue({ statut: 'a_verifier', raisons: ['Doute B', 'Doute A'] }),
      vue({ statut: 'a_verifier', raisons: ['Doute B', 'Doute C'] }),
    );
    expect(r.statut).toBe('a_verifier');
    expect(r.raisons).toEqual(['Doute B', 'Doute A', 'Doute C']);
    const inverse = fusion(
      vue({ statut: 'a_verifier', raisons: ['Doute B', 'Doute C'] }),
      vue({ statut: 'a_verifier', raisons: ['Doute B', 'Doute A'] }),
    );
    expect(inverse.raisons).toEqual(['Doute B', 'Doute C', 'Doute A']);
  });

  it("raisons d'une aide non éligible : réunies sans doublon, sans celles des profils pour lesquels l'aide est hors périmètre", () => {
    const r = fusion(
      vue({ statut: 'non_eligible', horsPerimetre: true, raisons: ['Ne concerne pas ce type de projet'] }),
      vue({ statut: 'non_eligible', horsPerimetre: false, raisons: ['Exclusion B', 'Exclusion A'] }),
      vue({ statut: 'non_eligible', horsPerimetre: true, raisons: ['Ne concerne pas ce public', 'Exclusion D'] }),
      vue({ statut: 'non_eligible', horsPerimetre: false, raisons: ['Exclusion A', 'Exclusion C'] }),
    );
    expect(r).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
    expect(r.raisons).toEqual(['Exclusion B', 'Exclusion A', 'Exclusion C']);
  });

  it("hors périmètre pour tous les profils : l'aide l'est aussi, et aucune raison n'est à lister", () => {
    const r = fusion(
      vue({ statut: 'non_eligible', horsPerimetre: true, raisons: ['Ne concerne pas ce type de projet'] }),
      vue({ statut: 'non_eligible', horsPerimetre: true, raisons: ['Ne concerne pas ce public'] }),
    );
    expect(r).toMatchObject({ statut: 'non_eligible', horsPerimetre: true, raisons: [] });
  });

  it("l'écart des profils hors périmètre ne vaut que pour une aide non éligible : un profil à vérifier garde ses raisons", () => {
    // Entrée construite : le moteur ne rend jamais une vue à vérifier hors périmètre (hors périmètre entraîne une exclusion, donc non éligible).
    // La règle de la spécification ne vise que l'aide non éligible : ici, la vue à vérifier garde ses raisons.
    const r = fusion(vue({ statut: 'a_verifier', horsPerimetre: true, raisons: ['Un doute'] }), vue({ statut: 'non_eligible', raisons: ['Une exclusion'] }));
    expect(r).toMatchObject({ statut: 'a_verifier', raisons: ['Un doute'] });
  });

  it("hors périmètre seulement si l'aide l'est pour tous les profils, quel que soit l'ordre des blocs", () => {
    const hors = vue({ statut: 'non_eligible', horsPerimetre: true });
    const dans = vue({ statut: 'non_eligible', horsPerimetre: false });
    expect(fusion(hors, dans).horsPerimetre).toBe(false);
    expect(fusion(dans, hors).horsPerimetre).toBe(false);
    expect(fusion(hors, hors, dans).horsPerimetre).toBe(false);
    expect(fusion(dans, hors, hors).horsPerimetre).toBe(false);
    expect(fusion(dans, dans).horsPerimetre).toBe(false);
    expect(fusion(hors, hors).horsPerimetre).toBe(true);
    expect(fusion(hors, hors, hors).horsPerimetre).toBe(true);
  });

  it("une aide absente d'un des blocs est fusionnée avec les seules vues qui existent", () => {
    const seule = vue({ id: 'nat-seule', nom: 'Seule', statut: 'non_eligible', horsPerimetre: true, raisons: ['Ne concerne pas ce public'] });
    const chezP1 = vue({ id: 'nat-commune', nom: 'Commune', statut: 'eligible', montantEstime: 800 });
    const chezP2 = vue({ id: 'nat-commune', nom: 'Commune', statut: 'a_verifier', montantEstime: 1200, raisons: ['Un doute'] });
    const autre = vue({ id: 'nat-autre', nom: 'Autre', statut: 'eligible', montantEstime: 400 });
    const r = fusionnerAides(blocs([seule, chezP1], [chezP2, autre]));
    expect(r.map((a) => a.id)).toEqual(['nat-commune', 'nat-autre', 'nat-seule']);
    const [commune, vueParP2, vueParP1] = r;
    expect(commune).toMatchObject({ statut: 'eligible', montantEstime: 1200 });
    expect(commune.profils).toEqual([
      { profilId: 'p1', nombre: 1, statut: 'eligible', montantEstime: 800 },
      { profilId: 'p2', nombre: 2, statut: 'a_verifier', montantEstime: 1200 },
    ]);
    // Vue par le seul profil p2 : son montant, lui seul concerné.
    expect(vueParP2).toMatchObject({ statut: 'eligible', montantEstime: 400 });
    expect(vueParP2.profils).toEqual([{ profilId: 'p2', nombre: 2, statut: 'eligible', montantEstime: 400 }]);
    // Vue par le seul profil p1, pour lequel elle est hors périmètre : hors périmètre, sans raison, sans profil concerné.
    expect(vueParP1).toMatchObject({ statut: 'non_eligible', horsPerimetre: true, raisons: [], profils: [] });
  });

  it("deux aides de même nom et d'identifiants différents restent deux entrées, triées par identifiant", () => {
    const r = fusionnerAides(
      blocs(
        [vue({ id: 'nat-b', nom: 'Même nom' }), vue({ id: 'nat-a', nom: 'Même nom' })],
        [vue({ id: 'nat-b', nom: 'Même nom' }), vue({ id: 'nat-a', nom: 'Même nom' })],
      ),
    );
    expect(r.map((a) => [a.id, a.profils?.length])).toEqual([
      ['nat-a', 2],
      ['nat-b', 2],
    ]);
  });

  it('la liste fusionnée est triée sur les valeurs fusionnées : statut, montant décroissant (un montant non chiffré après 0 €), nom sans tenir compte de la casse, identifiant', () => {
    const aide = (id: string, nom: string, p1: Partial<AideEvaluee>, p2: Partial<AideEvaluee> = p1) => ({
      p1: vue({ id, nom, ...p1 }),
      p2: vue({ id, nom, ...p2 }),
    });
    const aides = [
      aide('nat-4', 'Refusée', { statut: 'non_eligible', montantEstime: 5000 }),
      aide('nat-1', 'Zebre', { statut: 'eligible', montantEstime: 1000 }),
      aide('nat-2', 'abeille', { statut: 'eligible', montantEstime: 1000 }),
      // Deux noms qui ne diffèrent que par la casse : l'identifiant les départage (nat-8 avant nat-9, quel que soit l'ordre d'arrivée).
      aide('nat-9', 'Même nom', { statut: 'eligible', montantEstime: 1000 }),
      aide('nat-8', 'même nom', { statut: 'eligible', montantEstime: 1000 }),
      aide('nat-3', 'Doutes', { statut: 'a_verifier', montantEstime: 9000 }),
      aide('nat-5', 'Non chiffrée', { statut: 'eligible', montantEstime: null }),
      aide('nat-6', 'Gratuite', { statut: 'eligible', montantEstime: 0 }),
      // Non éligible pour p1, éligible à 2 500 € pour p2 : c'est la valeur fusionnée (éligible, 2 500 €) qui place l'aide.
      aide('nat-7', 'Fusionnée', { statut: 'non_eligible', montantEstime: 0 }, { statut: 'eligible', montantEstime: 2500 }),
    ];
    const r = fusionnerAides(blocs(aides.map((a) => a.p1), aides.map((a) => a.p2)));
    expect(r.map((a) => a.id)).toEqual(['nat-7', 'nat-2', 'nat-8', 'nat-9', 'nat-1', 'nat-6', 'nat-5', 'nat-3', 'nat-4']);
  });

  it('un seul profil : une autre liste, les mêmes aides dans le même ordre, jamais retriée', () => {
    const liste = [
      vue({ id: 'nat-c', nom: 'C', statut: 'non_eligible', montantEstime: 100 }),
      vue({ id: 'nat-a', nom: 'A', statut: 'eligible', montantEstime: 900 }),
      vue({ id: 'nat-b', nom: 'B', statut: 'a_verifier', montantEstime: 500 }),
    ];
    const resultat = fusionnerAides(blocs(liste));
    expect(resultat).not.toBe(liste);
    expect(resultat).toHaveLength(3);
    for (const [i, aide] of resultat.entries()) {
      expect(aide).toBe(liste[i]);
      expect('profils' in aide).toBe(false);
    }
    resultat.pop();
    expect(liste).toHaveLength(3);
  });

  it('aucun profil, ou des profils sans aide : aucune aide', () => {
    expect(fusionnerAides([])).toEqual([]);
    expect(fusionnerAides(blocs([], []))).toEqual([]);
  });

  it("aucun argument n'est modifié : ni les aides reçues, ni leurs raisons, ni les listes des blocs", () => {
    const geler = <T>(valeur: T): T => {
      if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
        Object.freeze(valeur);
        Object.values(valeur).forEach(geler);
      }
      return valeur;
    };
    const brutes = blocs(
      [
        vue({ id: 'nat-c', nom: 'C', statut: 'a_verifier', montantEstime: 300, raisons: ['Doute B', 'Doute A'] }),
        vue({ id: 'nat-b', nom: 'B', statut: 'non_eligible', montantEstime: 200, horsPerimetre: true, raisons: ['Exclusion B', 'Exclusion A'] }),
        vue({ id: 'nat-a', nom: 'A', statut: 'eligible', montantEstime: 100 }),
        vue({ id: 'nat-d', nom: 'D', statut: 'non_eligible', montantEstime: 400, raisons: ['Exclusion F', 'Exclusion E'] }),
      ],
      [
        vue({ id: 'nat-a', nom: 'A', statut: 'non_eligible', montantEstime: 150, raisons: ['Exclusion D', 'Exclusion C'] }),
        vue({ id: 'nat-b', nom: 'B', statut: 'non_eligible', montantEstime: 250, raisons: ['Exclusion A', 'Exclusion E'] }),
        vue({ id: 'nat-c', nom: 'C', statut: 'a_verifier', montantEstime: 50, raisons: ['Doute C', 'Doute A'] }),
        vue({ id: 'nat-d', nom: 'D', statut: 'non_eligible', montantEstime: 450, raisons: ['Exclusion E', 'Exclusion G'] }),
      ],
      [vue({ id: 'nat-b', nom: 'B', statut: 'a_verifier', montantEstime: 10, raisons: ['Doute Z', 'Doute Y'] })],
    );
    // Copie profonde gelée : les tableaux et objets partagés avec les autres tests (`base`, `modele`) ne sont jamais gelés.
    const entrees = geler(structuredClone(brutes));
    const avant = JSON.stringify(entrees);
    const resultat = fusionnerAides(entrees);
    expect(JSON.stringify(entrees)).toBe(avant);
    // Les trois chemins des raisons ont servi : éligible (aucune), à vérifier, non éligible.
    expect(resultat.map((a) => [a.id, a.statut, a.raisons])).toEqual([
      ['nat-a', 'eligible', []],
      ['nat-c', 'a_verifier', ['Doute B', 'Doute A', 'Doute C']],
      ['nat-b', 'a_verifier', ['Doute Z', 'Doute Y']],
      ['nat-d', 'non_eligible', ['Exclusion F', 'Exclusion E', 'Exclusion G']],
    ]);
    const seul = fusionnerAides(entrees.slice(0, 1));
    expect(seul).not.toBe(entrees[0].aides);
    expect(JSON.stringify(entrees)).toBe(avant);
  });
});

describe("tri d'une liste évaluée", () => {
  it("trierAidesEvaluees redonne l'ordre d'evaluerAides, quel que soit l'ordre d'entrée", () => {
    const evaluees = evaluerAides(EMBEDDED_AIDES, makeProfil(), AUJOURDHUI);
    expect(trierAidesEvaluees([...evaluees].reverse())).toEqual(evaluees);
  });

  const aide = (id: string, nom: string, statut: StatutEligibilite, montantEstime: number | null): AideEvaluee => ({
    ...evaluerAide(makeAide({ id, nom }), makeProfil(), AUJOURDHUI),
    statut,
    montantEstime,
  });
  const ids = (liste: readonly AideEvaluee[]) => liste.map((a) => a.id);

  it('éligibles, puis à vérifier, puis non éligibles ; à statut égal, montant décroissant, un montant non chiffré après un montant de 0 €', () => {
    const liste = [
      aide('nat-1', 'Un', 'non_eligible', 9000),
      aide('nat-2', 'Deux', 'a_verifier', null),
      aide('nat-3', 'Trois', 'eligible', 0),
      aide('nat-4', 'Quatre', 'eligible', 700),
      aide('nat-5', 'Cinq', 'a_verifier', 300),
      aide('nat-6', 'Six', 'eligible', null),
      aide('nat-7', 'Sept', 'non_eligible', 20),
    ];
    expect(ids(trierAidesEvaluees(liste))).toEqual(['nat-4', 'nat-3', 'nat-6', 'nat-5', 'nat-2', 'nat-1', 'nat-7']);
  });

  it('à statut et montant égaux : nom sans tenir compte de la casse, puis identifiant', () => {
    const liste = [
      aide('nat-1', 'Zebre', 'eligible', 100),
      aide('nat-4', 'Même', 'eligible', 100),
      aide('nat-6', 'Idem', 'eligible', 100),
      aide('nat-2', 'abeille', 'eligible', 100),
      aide('nat-3', 'même', 'eligible', 100),
      aide('nat-5', 'Idem', 'eligible', 100),
    ];
    expect(ids(trierAidesEvaluees(liste))).toEqual(['nat-2', 'nat-5', 'nat-6', 'nat-3', 'nat-4', 'nat-1']);
  });

  it('rend une nouvelle liste et laisse la liste reçue intacte, même gelée', () => {
    const liste = [aide('nat-b', 'B', 'non_eligible', 10), aide('nat-a', 'A', 'eligible', 20)];
    liste.forEach((a) => Object.freeze(a));
    Object.freeze(liste);
    const triee = trierAidesEvaluees(liste);
    expect(triee).not.toBe(liste);
    expect(ids(triee)).toEqual(['nat-a', 'nat-b']);
    expect(ids(liste)).toEqual(['nat-b', 'nat-a']);
    triee.reverse();
    expect(ids(liste)).toEqual(['nat-b', 'nat-a']);
  });
});
