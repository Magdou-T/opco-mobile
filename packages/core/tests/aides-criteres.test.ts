import { describe, it, expect } from 'vitest';
import { evaluerCriteres, regionDeReference } from '../src/aides/criteres';
import type { CriteresAide, ProfilAides } from '../src/aides/types';
import { TRAINING_TYPE_LABELS, type TrainingType } from '../src/types';
import { makeProfil } from './fixtures-aides';

describe('evaluerCriteres', () => {
  it('sans critère : ok', () => {
    expect(evaluerCriteres({}, makeProfil()).etat).toBe('ok');
  });

  const cas: [string, CriteresAide, Partial<ProfilAides>, 'ok' | 'ko' | 'inconnu'][] = [
    ['région ok', { regions: ['11'] }, {}, 'ok'],
    ['région ko', { regions: ['84'] }, {}, 'ko'],
    ['région inconnue', { regions: ['11'] }, { regionEntreprise: null }, 'inconnu'],
    ['région du bénéficiaire', { regions: ['76'], perimetre_region: 'beneficiaire' }, { regionBeneficiaire: '76' }, 'ok'],
    ["bénéficiaire sans région : celle de l'entreprise", { regions: ['11'], perimetre_region: 'beneficiaire' }, {}, 'ok'],
    ['département', { departements: ['95'] }, {}, 'ok'],
    ['effectif sous le seuil', { effectif_max: 249 }, { effectifMin: 0, effectifMax: 10 }, 'ok'],
    ['effectif dans une tranche ambiguë', { effectif_max: 249 }, { effectifMin: 50, effectifMax: 299 }, 'inconnu'],
    ['effectif au-dessus du seuil', { effectif_max: 249 }, { effectifMin: 300, effectifMax: null }, 'ko'],
    ['effectif minimum atteint', { effectif_min: 11 }, { effectifMin: 11, effectifMax: 49 }, 'ok'],
    ['effectif inconnu', { effectif_max: 49 }, { effectifMin: null, effectifMax: null }, 'inconnu'],
    ['âge dans la tranche', { age_min: 16, age_max: 29 }, { age: 19 }, 'ok'],
    ['âge hors tranche', { age_max: 29 }, { age: 35 }, 'ko'],
    ['âge inconnu', { age_max: 29 }, { age: null }, 'inconnu'],
    ['RQTH requise absente', { rqth: true }, { rqth: false }, 'ko'],
    ['RQTH requise présente', { rqth: true }, { rqth: true }, 'ok'],
    ['diplôme', { niveaux_diplome: ['sans_diplome'] }, { niveauDiplome: 'bac' }, 'ko'],
    ['niveau visé trop élevé', { niveau_certification_max: 4 }, { niveauFormationVise: 5 }, 'ko'],
    ['niveau visé inconnu', { niveau_certification_max: 4 }, { niveauFormationVise: null }, 'inconnu'],
    ['contrat', { contrats: ['cdi'] }, { contrat: 'cdd' }, 'ko'],
    ["type d'alternance", { types_alternance: ['apprentissage'] }, { typeAlternance: 'apprentissage' }, 'ok'],
    ['ancienneté insuffisante', { anciennete_min_mois: 24 }, { ancienneteMois: 12 }, 'ko'],
    ['inscription France Travail inconnue', { inscrit_france_travail: true }, { inscritFranceTravail: null }, 'inconnu'],
    ['statut du dirigeant', { statuts_dirigeant: ['artisan'] }, { statutDirigeant: 'artisan' }, 'ok'],
    ['micro-entrepreneur exclu', { micro_entrepreneur: false }, { microEntrepreneur: true }, 'ko'],
    ['certification visée', { certifications: ['rncp', 'rs'] }, { certification: 'aucune' }, 'ko'],
    ['éligibilité CPF inconnue', { eligible_cpf: true }, { eligibleCpf: null }, 'inconnu'],
    ['durée minimale', { duree_min_heures: 150 }, { dureeHeures: 140 }, 'ko'],
    ['OPCO', { opcos: ['akto'] }, {}, 'ok'],
    ['IDCC', { idcc: ['1486'] }, {}, 'ko'],
    ['NAF', { naf_prefixes: ['85'] }, {}, 'ok'],
    ['structure inconnue', { structures: ['association'] }, { structures: null }, 'inconnu'],
    ['structure absente', { structures: ['association'] }, { structures: [] }, 'ko'],
    ['Qualiopi', { qualiopi_requis: true }, { qualiopi: false }, 'ko'],

    // --- Région (liste de plusieurs régions ; périmètre bénéficiaire : sa région décide, pas celle de l'entreprise)
    ['région dans une liste de deux', { regions: ['84', '11'] }, {}, 'ok'],
    ["région du bénéficiaire hors liste, même si celle de l'entreprise y est", { regions: ['11'], perimetre_region: 'beneficiaire' }, { regionBeneficiaire: '76' }, 'ko'],
    ["région du bénéficiaire et de l'entreprise toutes deux inconnues", { regions: ['11'], perimetre_region: 'beneficiaire' }, { regionEntreprise: null, regionBeneficiaire: null }, 'inconnu'],
    ["région de l'entreprise (périmètre explicite) : celle du bénéficiaire est ignorée", { regions: ['11'], perimetre_region: 'entreprise' }, { regionBeneficiaire: '76' }, 'ok'],

    // --- Département
    ['département dans une liste de deux', { departements: ['75', '95'] }, {}, 'ok'],
    ['département hors liste', { departements: ['95'] }, { departementEntreprise: '75' }, 'ko'],
    ["département de l'établissement inconnu", { departements: ['95'] }, { departementEntreprise: null }, 'inconnu'],
    ["département jugé sur le bénéficiaire : toujours à vérifier, même si celui de l'entreprise est connu", { departements: ['95'], perimetre_region: 'beneficiaire' }, { departementEntreprise: '95' }, 'inconnu'],
    ["département jugé sur l'établissement (périmètre explicite)", { departements: ['95'], perimetre_region: 'entreprise' }, {}, 'ok'],

    // --- Effectif : tranche [min, max] connue ; borne incluse ; tranche à cheval sur le seuil = inconnu
    ['effectif max : tranche [200, 249], borne incluse', { effectif_max: 249 }, { effectifMin: 200, effectifMax: 249 }, 'ok'],
    ['effectif max : tranche [249, 299] à cheval sur le seuil', { effectif_max: 249 }, { effectifMin: 249, effectifMax: 299 }, 'inconnu'],
    ['effectif max : tranche [250, 299] au-dessus du seuil', { effectif_max: 249 }, { effectifMin: 250, effectifMax: 299 }, 'ko'],
    ['effectif max : seule la borne haute est connue, sous le seuil', { effectif_max: 249 }, { effectifMin: null, effectifMax: 10 }, 'ok'],
    ['effectif max : seule la borne haute est connue, au-dessus du seuil', { effectif_max: 249 }, { effectifMin: null, effectifMax: 299 }, 'inconnu'],
    ['effectif max : seule la borne basse est connue, sous le seuil', { effectif_max: 249 }, { effectifMin: 20, effectifMax: null }, 'inconnu'],
    ['effectif min : tranche [200, 249] sous le seuil', { effectif_min: 250 }, { effectifMin: 200, effectifMax: 249 }, 'ko'],
    ['effectif min : tranche [200, 250] à cheval sur le seuil', { effectif_min: 250 }, { effectifMin: 200, effectifMax: 250 }, 'inconnu'],
    ['effectif min : tranche [250, 299], borne incluse', { effectif_min: 250 }, { effectifMin: 250, effectifMax: 299 }, 'ok'],
    ['effectif min : seule la borne basse est connue, au-dessus du seuil', { effectif_min: 250 }, { effectifMin: 300, effectifMax: null }, 'ok'],
    ['effectif min : seule la borne haute est connue, sous le seuil', { effectif_min: 250 }, { effectifMin: null, effectifMax: 249 }, 'ko'],
    ['effectif min : seule la borne haute est connue, au-dessus du seuil', { effectif_min: 250 }, { effectifMin: null, effectifMax: 400 }, 'inconnu'],
    ['effectif min : effectif inconnu', { effectif_min: 250 }, { effectifMin: null, effectifMax: null }, 'inconnu'],
    ['effectif min et max : tranche [11, 49] dans la fourchette', { effectif_min: 11, effectif_max: 49 }, { effectifMin: 11, effectifMax: 49 }, 'ok'],
    ['effectif min et max : sous le minimum', { effectif_min: 11, effectif_max: 49 }, { effectifMin: 0, effectifMax: 10 }, 'ko'],
    ['effectif min et max : au-dessus du maximum', { effectif_min: 11, effectif_max: 49 }, { effectifMin: 50, effectifMax: 249 }, 'ko'],

    // --- Zéro est une valeur de critère, pas une absence de critère
    ['effectif max à 0 : entreprise avec des salariés', { effectif_max: 0 }, { effectifMin: 1, effectifMax: 9 }, 'ko'],
    ['effectif max à 0 : entreprise sans salarié', { effectif_max: 0 }, { effectifMin: 0, effectifMax: 0 }, 'ok'],

    // --- Âge (16 à 29 ans) : bornes incluses
    ['âge 15 : sous le minimum', { age_min: 16, age_max: 29 }, { age: 15 }, 'ko'],
    ['âge 16 : minimum inclus', { age_min: 16, age_max: 29 }, { age: 16 }, 'ok'],
    ['âge 29 : maximum inclus', { age_min: 16, age_max: 29 }, { age: 29 }, 'ok'],
    ['âge 30 : au-dessus du maximum', { age_min: 16, age_max: 29 }, { age: 30 }, 'ko'],
    ['âge minimum seul : 15 ans', { age_min: 16 }, { age: 15 }, 'ko'],
    ['âge minimum seul : 16 ans', { age_min: 16 }, { age: 16 }, 'ok'],
    ['âge minimum seul : pas de maximum', { age_min: 16 }, { age: 99 }, 'ok'],
    ['âge minimum seul : âge inconnu', { age_min: 16 }, { age: null }, 'inconnu'],
    ['âge maximum seul : 29 ans', { age_max: 29 }, { age: 29 }, 'ok'],
    ['âge maximum seul : 30 ans', { age_max: 29 }, { age: 30 }, 'ko'],
    ['âge maximum seul : 0 an est un âge connu, pas de minimum', { age_max: 29 }, { age: 0 }, 'ok'],
    ['âge unique : 17 ans', { age_min: 17, age_max: 17 }, { age: 17 }, 'ok'],

    // --- Niveau de la certification visée
    ['niveau visé : maximum 4 inclus', { niveau_certification_max: 4 }, { niveauFormationVise: 4 }, 'ok'],
    ['niveau visé : minimum 5 inclus', { niveau_certification_min: 5 }, { niveauFormationVise: 5 }, 'ok'],
    ['niveau visé : sous le minimum 5', { niveau_certification_min: 5 }, { niveauFormationVise: 4 }, 'ko'],
    ['niveau visé inconnu avec un minimum', { niveau_certification_min: 5 }, { niveauFormationVise: null }, 'inconnu'],
    ['niveau visé : fourchette 4 à 5, trop bas', { niveau_certification_min: 4, niveau_certification_max: 5 }, { niveauFormationVise: 3 }, 'ko'],
    ['niveau visé : fourchette 4 à 5, borne basse', { niveau_certification_min: 4, niveau_certification_max: 5 }, { niveauFormationVise: 4 }, 'ok'],
    ['niveau visé : fourchette 4 à 5, borne haute', { niveau_certification_min: 4, niveau_certification_max: 5 }, { niveauFormationVise: 5 }, 'ok'],
    ['niveau visé : fourchette 4 à 5, trop haut', { niveau_certification_min: 4, niveau_certification_max: 5 }, { niveauFormationVise: 6 }, 'ko'],

    // --- Durée de la formation : bornes incluses
    ['durée : 149 h sous le minimum de 150 h', { duree_min_heures: 150 }, { dureeHeures: 149 }, 'ko'],
    ['durée : minimum de 150 h inclus', { duree_min_heures: 150 }, { dureeHeures: 150 }, 'ok'],
    ['durée : maximum de 400 h inclus', { duree_max_heures: 400 }, { dureeHeures: 400 }, 'ok'],
    ['durée : 401 h au-dessus du maximum de 400 h', { duree_max_heures: 400 }, { dureeHeures: 401 }, 'ko'],
    ['durée inconnue avec un minimum', { duree_min_heures: 150 }, { dureeHeures: null }, 'inconnu'],
    ['durée inconnue avec un maximum', { duree_max_heures: 400 }, { dureeHeures: null }, 'inconnu'],
    ['durée : fourchette 150 à 400 h, trop courte', { duree_min_heures: 150, duree_max_heures: 400 }, { dureeHeures: 149 }, 'ko'],
    ['durée : fourchette 150 à 400 h, trop longue', { duree_min_heures: 150, duree_max_heures: 400 }, { dureeHeures: 401 }, 'ko'],
    ['durée : fourchette 150 à 400 h, dans les bornes', { duree_min_heures: 150, duree_max_heures: 400 }, { dureeHeures: 280 }, 'ok'],

    // --- Ancienneté : borne incluse
    ['ancienneté : 23 mois sous le minimum de 24', { anciennete_min_mois: 24 }, { ancienneteMois: 23 }, 'ko'],
    ['ancienneté : minimum de 24 mois inclus', { anciennete_min_mois: 24 }, { ancienneteMois: 24 }, 'ok'],
    ['ancienneté : au-delà du minimum', { anciennete_min_mois: 24 }, { ancienneteMois: 25 }, 'ok'],
    ['ancienneté inconnue', { anciennete_min_mois: 24 }, { ancienneteMois: null }, 'inconnu'],
    ['ancienneté : 0 mois est une ancienneté connue', { anciennete_min_mois: 6 }, { ancienneteMois: 0 }, 'ko'],

    // --- Inscription à France Travail (requise ou exclue)
    ['France Travail requis : inscrit', { inscrit_france_travail: true }, { inscritFranceTravail: true }, 'ok'],
    ['France Travail requis : non inscrit', { inscrit_france_travail: true }, { inscritFranceTravail: false }, 'ko'],
    ['France Travail exclu : inscrit', { inscrit_france_travail: false }, { inscritFranceTravail: true }, 'ko'],
    ['France Travail exclu : non inscrit', { inscrit_france_travail: false }, { inscritFranceTravail: false }, 'ok'],
    ['France Travail exclu : inscription inconnue', { inscrit_france_travail: false }, { inscritFranceTravail: null }, 'inconnu'],

    // --- États inconnu : l'information manque dans le profil, le critère est présent
    ['contrat inconnu', { contrats: ['cdi'] }, { contrat: null }, 'inconnu'],
    ['contrat dans une liste de deux', { contrats: ['cdi', 'cdd'] }, { contrat: 'cdd' }, 'ok'],
    ['certification inconnue', { certifications: ['rncp', 'rs'] }, { certification: null }, 'inconnu'],
    ['certification dans une liste de deux', { certifications: ['rncp', 'rs'] }, { certification: 'rs' }, 'ok'],
    ['statut du dirigeant inconnu', { statuts_dirigeant: ['artisan'] }, { statutDirigeant: null }, 'inconnu'],
    ['statut du dirigeant hors liste', { statuts_dirigeant: ['artisan'] }, { statutDirigeant: 'commercant' }, 'ko'],
    ['niveau de diplôme inconnu', { niveaux_diplome: ['sans_diplome'] }, { niveauDiplome: null }, 'inconnu'],
    ['niveau de diplôme dans une liste de deux', { niveaux_diplome: ['sans_diplome', 'bac'] }, { niveauDiplome: 'bac' }, 'ok'],
    ['OPCO inconnu', { opcos: ['akto'] }, { opco: null }, 'inconnu'],
    ['OPCO hors liste', { opcos: ['akto'] }, { opco: 'atlas' }, 'ko'],
    ['OPCO dans une liste de deux', { opcos: ['akto', 'atlas'] }, { opco: 'atlas' }, 'ok'],
    ["type d'alternance inconnu", { types_alternance: ['apprentissage'] }, { typeAlternance: null }, 'inconnu'],
    ["type d'alternance hors liste", { types_alternance: ['apprentissage'] }, { typeAlternance: 'professionnalisation' }, 'ko'],
    ['micro-entrepreneur inconnu', { micro_entrepreneur: true }, { microEntrepreneur: null }, 'inconnu'],
    ['micro-entrepreneur requis : micro-entrepreneur', { micro_entrepreneur: true }, { microEntrepreneur: true }, 'ok'],
    ['micro-entrepreneur requis : autre statut', { micro_entrepreneur: true }, { microEntrepreneur: false }, 'ko'],
    ['micro-entrepreneur exclu : autre statut', { micro_entrepreneur: false }, { microEntrepreneur: false }, 'ok'],
    ['micro-entrepreneur exclu : statut inconnu', { micro_entrepreneur: false }, { microEntrepreneur: null }, 'inconnu'],
    ['convention collective inconnue', { idcc: ['1516'] }, { idccs: [] }, 'inconnu'],
    ['convention collective dans une liste de deux', { idcc: ['1486', '1516'] }, {}, 'ok'],
    ["une seule des conventions de l'entreprise suffit", { idcc: ['1516'] }, { idccs: ['9999', '1516'] }, 'ok'],
    ["aucune des conventions de l'entreprise", { idcc: ['1486'] }, { idccs: ['1516', '9999'] }, 'ko'],
    ['structure dans une liste de deux', { structures: ['ess', 'association'] }, { structures: ['association'] }, 'ok'],
    ['une seule des structures suffit', { structures: ['ess'] }, { structures: ['siae', 'ess'] }, 'ok'],
    ['structure hors liste', { structures: ['siae'] }, { structures: ['association'] }, 'ko'],
    ['Qualiopi inconnu', { qualiopi_requis: true }, { qualiopi: null }, 'inconnu'],
    ['Qualiopi : organisme certifié', { qualiopi_requis: true }, { qualiopi: true }, 'ok'],
    ['CPF : formation éligible', { eligible_cpf: true }, { eligibleCpf: true }, 'ok'],
    ['CPF : formation non éligible', { eligible_cpf: true }, { eligibleCpf: false }, 'ko'],

    // --- Type de formation du parcours (VAE, CQP…) : distinct de la certification visée
    ['type de formation : le type réservé', { types_formation: ['vae'] }, { typeFormation: 'vae' }, 'ok'],
    ['type de formation : un autre type', { types_formation: ['vae'] }, { typeFormation: 'certification' }, 'ko'],
    ['type de formation inconnu', { types_formation: ['vae'] }, { typeFormation: null }, 'inconnu'],
    ["type de formation : premier type d'une liste de deux", { types_formation: ['vae', 'reconversion'] }, { typeFormation: 'vae' }, 'ok'],
    ["type de formation : second type d'une liste de deux", { types_formation: ['vae', 'reconversion'] }, { typeFormation: 'reconversion' }, 'ok'],
    ["type de formation : hors d'une liste de deux", { types_formation: ['vae', 'reconversion'] }, { typeFormation: 'cqp' }, 'ko'],
    ['type de formation inconnu avec une liste de deux', { types_formation: ['vae', 'reconversion'] }, { typeFormation: null }, 'inconnu'],
    ["type de formation : la certification visée n'est pas le type (RNCP, type « certification »)", { types_formation: ['vae'] }, { certification: 'rncp', typeFormation: 'certification' }, 'ko'],
    ['type de formation : seul le type du parcours compte, pas la certification visée', { types_formation: ['vae'] }, { certification: 'aucune', typeFormation: 'vae' }, 'ok'],
    ["type de formation : une certification homonyme du type n'y change rien", { types_formation: ['cqp'] }, { certification: 'cqp', typeFormation: 'qualification' }, 'ko'],
  ];

  it.each(cas)('%s', (_nom, criteres, profil, attendu) => {
    expect(evaluerCriteres(criteres, makeProfil(profil)).etat).toBe(attendu);
  });

  it('donne des raisons lisibles', () => {
    const r = evaluerCriteres({ regions: ['84'], age_max: 29 }, makeProfil({ age: 40 }));
    expect(r.raisonsKo).toContain('Réservé à : Auvergne-Rhône-Alpes');
    expect(r.raisonsKo.some((x) => x.includes('29 ans'))).toBe(true);
  });

  it("ko l'emporte sur inconnu", () => {
    const r = evaluerCriteres({ regions: ['84'], age_max: 29 }, makeProfil({ age: null }));
    expect(r.etat).toBe('ko');
    expect(r.raisonsInconnu.length).toBe(1);
  });

  it('sans critère : aucune raison', () => {
    expect(evaluerCriteres({}, makeProfil())).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
  });

  it("plusieurs critères : ok si tous sont remplis, inconnu s'il n'y a aucun ko, ko dès qu'un seul ne l'est pas", () => {
    const criteres: CriteresAide = { regions: ['11'], age_max: 29, opcos: ['akto'] };
    const etat = (profil: Partial<ProfilAides>) => evaluerCriteres(criteres, makeProfil(profil)).etat;
    expect(etat({ age: 25 })).toBe('ok');
    expect(etat({ age: null })).toBe('inconnu');
    expect(etat({ age: 40 })).toBe('ko');
    expect(etat({ age: null, opco: 'atlas' })).toBe('ko');
    expect(etat({ age: 25, opco: null })).toBe('inconnu');
  });

  it("liste toutes les raisons ko et toutes les raisons inconnu, dans l'ordre des critères", () => {
    const criteres: CriteresAide = { regions: ['84'], age_max: 29, contrats: ['cdd'], opcos: ['akto'], idcc: ['1516'] };
    const r = evaluerCriteres(criteres, makeProfil({ age: null, opco: null, idccs: [] }));
    expect(r.etat).toBe('ko');
    expect(r.raisonsKo).toEqual(['Réservé à : Auvergne-Rhône-Alpes', 'Réservé aux contrats : CDD']);
    expect(r.raisonsInconnu).toEqual([
      "Précisez l'âge du bénéficiaire",
      "Identifiez l'OPCO de l'entreprise",
      "Précisez la convention collective de l'entreprise",
    ]);
  });

  it("rqth, eligible_cpf et qualiopi_requis ne sont évalués que lorsqu'ils valent true : false n'ajoute aucune restriction", () => {
    // Le schéma refuse `false` ; si une donnée non validée en contient un, l'évaluation l'ignore.
    const faux = { rqth: false, eligible_cpf: false, qualiopi_requis: false } as unknown as CriteresAide;
    const sansRien = { rqth: false, eligibleCpf: false, qualiopi: false };
    const inconnus = { rqth: true, eligibleCpf: null, qualiopi: null };
    expect(evaluerCriteres(faux, makeProfil(sansRien))).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
    expect(evaluerCriteres(faux, makeProfil(inconnus))).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
  });
});

describe('regionDeReference', () => {
  it.each<[string, CriteresAide, Partial<ProfilAides>, string | null]>([
    ["par défaut : la région de l'entreprise, même si le bénéficiaire est ailleurs", {}, { regionEntreprise: '11', regionBeneficiaire: '76' }, '11'],
    ["périmètre « entreprise » : la région de l'entreprise", { perimetre_region: 'entreprise' }, { regionEntreprise: '11', regionBeneficiaire: '76' }, '11'],
    ['périmètre « entreprise » : jamais celle du bénéficiaire', { perimetre_region: 'entreprise' }, { regionEntreprise: null, regionBeneficiaire: '76' }, null],
    ['aucun périmètre : jamais celle du bénéficiaire', {}, { regionEntreprise: null, regionBeneficiaire: '76' }, null],
    ['périmètre « bénéficiaire » : la région du bénéficiaire', { perimetre_region: 'beneficiaire' }, { regionEntreprise: '11', regionBeneficiaire: '76' }, '76'],
    ["périmètre « bénéficiaire » sans région connue : celle de l'entreprise", { perimetre_region: 'beneficiaire' }, { regionEntreprise: '11', regionBeneficiaire: null }, '11'],
    ['périmètre « bénéficiaire » : le bénéficiaire seul', { perimetre_region: 'beneficiaire' }, { regionEntreprise: null, regionBeneficiaire: '76' }, '76'],
    ['périmètre « bénéficiaire » : aucune région connue', { perimetre_region: 'beneficiaire' }, { regionEntreprise: null, regionBeneficiaire: null }, null],
    ['aucune région connue', {}, { regionEntreprise: null, regionBeneficiaire: null }, null],
  ])('%s', (_nom, criteres, profil, attendu) => {
    expect(regionDeReference(criteres, makeProfil(profil))).toBe(attendu);
  });
});

describe('evaluerCriteres : code NAF', () => {
  const etat = (prefixes: string[], codeNaf: string | null) =>
    evaluerCriteres({ naf_prefixes: prefixes }, makeProfil({ codeNaf })).etat;

  it.each<[string, string[], string, 'ok' | 'ko']>([
    ['un autre secteur', ['85'], '86.21Z', 'ko'],
    ['un préfixe est un début de code, pas une sous-chaîne', ['59'], '85.59A', 'ko'],
    ['une autre classe de la même division', ['86.21'], '86.22Z', 'ko'],
    ['un préfixe plus long que le code', ['86.21Z1'], '86.21Z', 'ko'],
    ['préfixe avec point, code avec point', ['86.21'], '86.21Z', 'ok'],
    ['code en minuscules', ['86.21'], '86.21z', 'ok'],
    ['code écrit sans point', ['86.21'], '8621Z', 'ok'],
    ['préfixe écrit sans point', ['8621'], '86.21Z', 'ok'],
    ['préfixe de division seule', ['86'], '86.21Z', 'ok'],
    ['préfixe en minuscules', ['86.21z'], '86.21Z', 'ok'],
    ['préfixe et code complets, écritures différentes', ['86.21Z'], '8621z', 'ok'],
    ['plusieurs préfixes : un seul suffit', ['85.59', '86.21'], '86.21Z', 'ok'],
    ['le préfixe égal au code entier', ['85.59A'], '85.59A', 'ok'],
  ])('%s', (_nom, prefixes, codeNaf, attendu) => {
    expect(etat(prefixes, codeNaf)).toBe(attendu);
  });

  it('code NAF inconnu : à préciser', () => {
    const bilan = evaluerCriteres({ naf_prefixes: ['86.21'] }, makeProfil({ codeNaf: null }));
    expect(bilan).toEqual({ etat: 'inconnu', raisonsKo: [], raisonsInconnu: ["Précisez le code NAF de l'entreprise"] });
  });

  it('raison : les préfixes sont listés tels que saisis', () => {
    expect(evaluerCriteres({ naf_prefixes: ['85', '86.21'] }, makeProfil({ codeNaf: '10.11Z' })).raisonsKo).toEqual([
      'Réservé aux secteurs (code NAF) : 85, 86.21',
    ]);
  });
});

describe('evaluerCriteres : type de formation', () => {
  const TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
  const bilan = (types: TrainingType[], typeFormation: TrainingType | null) =>
    evaluerCriteres({ types_formation: types }, makeProfil({ typeFormation }));

  it('les sept types du parcours sont couverts', () => {
    expect(TYPES).toEqual(['non_certifiante', 'qualification', 'certification', 'vae', 'reconversion', 'cqp', 'habilitation']);
  });

  it.each(TYPES)('critère limité au type %s : ok pour ce type, ko pour chacun des six autres, inconnu sans type', (type) => {
    expect(bilan([type], type)).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
    expect(TYPES.filter((autre) => autre !== type && bilan([type], autre).etat !== 'ko')).toEqual([]);
    expect(bilan([type], null).etat).toBe('inconnu');
  });

  it('une liste de deux types accepte chacun des deux et refuse les cinq autres', () => {
    const acceptes = TYPES.filter((t) => bilan(['qualification', 'cqp'], t).etat === 'ok');
    expect(acceptes).toEqual(['qualification', 'cqp']);
    expect(TYPES.filter((t) => !acceptes.includes(t) && bilan(['qualification', 'cqp'], t).etat !== 'ko')).toEqual([]);
  });

  it("une liste vide n'impose aucune contrainte, comme un critère absent (le schéma la refuse)", () => {
    expect(bilan([], 'cqp')).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
    expect(bilan([], null)).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
  });

  it("sans critère de type, le type du parcours (connu ou non) n'est jamais examiné", () => {
    for (const typeFormation of [...TYPES, null]) {
      expect(evaluerCriteres({}, makeProfil({ typeFormation }))).toEqual({ etat: 'ok', raisonsKo: [], raisonsInconnu: [] });
    }
  });

  it('ko : un seul type ne remplit pas le critère, la raison nomme les types réservés avec leurs libellés', () => {
    expect(bilan(['vae'], 'certification')).toEqual({
      etat: 'ko',
      raisonsKo: ["Réservé aux formations de type : VAE (Validation des Acquis de l'Expérience)"],
      raisonsInconnu: [],
    });
  });

  it('inconnu : la raison demande de préciser le type de formation', () => {
    expect(bilan(['vae'], null)).toEqual({
      etat: 'inconnu',
      raisonsKo: [],
      raisonsInconnu: ['Précisez le type de formation'],
    });
  });

  it("ordre des critères : le type de formation vient après la certification visée et avant l'éligibilité au CPF", () => {
    const criteres: CriteresAide = { eligible_cpf: true, types_formation: ['vae'], certifications: ['rncp'] };
    expect(evaluerCriteres(criteres, makeProfil({ certification: 'aucune', typeFormation: 'cqp', eligibleCpf: false })).raisonsKo).toEqual([
      'Réservé aux formations menant à : RNCP (titre ou diplôme enregistré)',
      "Réservé aux formations de type : VAE (Validation des Acquis de l'Expérience)",
      'Réservé aux formations éligibles au CPF',
    ]);
    expect(evaluerCriteres(criteres, makeProfil({ certification: null, typeFormation: null, eligibleCpf: null })).raisonsInconnu).toEqual([
      'Précisez la certification visée par la formation',
      'Précisez le type de formation',
      'Vérifiez que la formation est éligible au CPF',
    ]);
  });

  it("ko l'emporte sur inconnu : un autre critère non rempli suffit, le type inconnu reste signalé", () => {
    const r = evaluerCriteres({ types_formation: ['vae'], age_max: 29 }, makeProfil({ typeFormation: null, age: 40 }));
    expect(r).toEqual({
      etat: 'ko',
      raisonsKo: ['Réservé aux personnes de 29 ans au plus'],
      raisonsInconnu: ['Précisez le type de formation'],
    });
  });
});

describe('evaluerCriteres : libellés des raisons', () => {
  const raisonsKo = (criteres: CriteresAide, profil: Partial<ProfilAides> = {}) =>
    evaluerCriteres(criteres, makeProfil(profil)).raisonsKo;

  it.each<[string, CriteresAide, number, string]>([
    ['une tranche', { age_min: 16, age_max: 29 }, 30, 'Réservé aux personnes de 16 à 29 ans'],
    ['un âge unique (jamais « de 17 à 17 ans »)', { age_min: 17, age_max: 17 }, 30, 'Réservé aux personnes de 17 ans'],
    ['un âge unique, côté âge minimal', { age_min: 17, age_max: 17 }, 16, 'Réservé aux personnes de 17 ans'],
    ['un minimum seul', { age_min: 16 }, 15, 'Réservé aux personnes de 16 ans et plus'],
    ['un maximum seul', { age_max: 29 }, 30, 'Réservé aux personnes de 29 ans au plus'],
  ])('âge : %s', (_nom, criteres, age, attendu) => {
    expect(raisonsKo(criteres, { age })).toEqual([attendu]);
  });

  it("type d'alternance : « contrats d'alternance suivants »", () => {
    expect(raisonsKo({ types_alternance: ['apprentissage'] }, { typeAlternance: 'professionnalisation' })).toEqual([
      "Réservé aux contrats d'alternance suivants : Contrat d'apprentissage",
    ]);
  });

  it('statut du dirigeant : « statuts suivants »', () => {
    expect(raisonsKo({ statuts_dirigeant: ['artisan'] }, { statutDirigeant: 'commercant' })).toEqual([
      'Réservé aux statuts suivants : Artisan',
    ]);
    expect(raisonsKo({ statuts_dirigeant: ['artisan', 'commercant'] }, { statutDirigeant: 'exploitant_agricole' })).toEqual([
      'Réservé aux statuts suivants : Artisan, Commerçant (ou prestataire de services)',
    ]);
  });

  // Chaque ligne : un seul critère, un profil qui ne le remplit pas, la raison affichée (accents et apostrophes comprises).
  it.each<[string, CriteresAide, Partial<ProfilAides>, string]>([
    ['régions', { regions: ['84', '27'] }, {}, 'Réservé à : Auvergne-Rhône-Alpes, Bourgogne-Franche-Comté'],
    ['départements', { departements: ['75', '78'] }, {}, 'Réservé aux départements : 75, 78'],
    ['effectif maximal', { effectif_max: 249 }, { effectifMin: 300, effectifMax: null }, 'Réservé aux entreprises de 249 salariés au plus'],
    ['effectif minimal', { effectif_min: 250 }, {}, "Réservé aux entreprises d'au moins 250 salariés"],
    ['RQTH', { rqth: true }, {}, 'Réservé aux personnes reconnues travailleurs handicapés (RQTH ou équivalent)'],
    ['niveaux de diplôme', { niveaux_diplome: ['sans_diplome', 'cap_bep'] }, {}, 'Réservé aux niveaux de diplôme : Sans diplôme, CAP / BEP'],
    ['niveau de certification maximal', { niveau_certification_max: 4 }, {}, 'Réservé aux certifications de niveau 4 au plus'],
    ['niveau de certification minimal', { niveau_certification_min: 6 }, {}, 'Réservé aux certifications de niveau 6 au moins'],
    ['contrats', { contrats: ['cdd', 'interim'] }, {}, 'Réservé aux contrats : CDD, Intérim'],
    ['ancienneté', { anciennete_min_mois: 36 }, {}, 'Ancienneté minimale requise : 36 mois'],
    ['France Travail requis', { inscrit_france_travail: true }, { inscritFranceTravail: false }, 'Réservé aux personnes inscrites à France Travail'],
    ['France Travail exclu', { inscrit_france_travail: false }, { inscritFranceTravail: true }, 'Réservé aux personnes non inscrites à France Travail'],
    ['micro-entrepreneur requis', { micro_entrepreneur: true }, { microEntrepreneur: false }, 'Réservé aux micro-entrepreneurs'],
    ['micro-entrepreneur exclu', { micro_entrepreneur: false }, { microEntrepreneur: true }, 'Non ouvert aux micro-entrepreneurs'],
    [
      'certifications',
      { certifications: ['rncp', 'rs'] },
      { certification: 'aucune' },
      'Réservé aux formations menant à : RNCP (titre ou diplôme enregistré), Répertoire spécifique (RS)',
    ],
    [
      'type de formation',
      { types_formation: ['vae'] },
      { typeFormation: 'certification' },
      "Réservé aux formations de type : VAE (Validation des Acquis de l'Expérience)",
    ],
    [
      "types de formation (libellés du parcours, dans l'ordre du critère)",
      { types_formation: ['reconversion', 'non_certifiante', 'cqp'] },
      { typeFormation: 'vae' },
      'Réservé aux formations de type : Reconversion professionnelle, Formation courte / non certifiante (plan de développement des compétences), CQP (Certificat de Qualification Professionnelle)',
    ],
    ['éligibilité CPF', { eligible_cpf: true }, { eligibleCpf: false }, 'Réservé aux formations éligibles au CPF'],
    ['durée minimale', { duree_min_heures: 150 }, {}, 'Durée minimale : 150 h'],
    ['durée maximale', { duree_max_heures: 100 }, {}, 'Durée maximale : 100 h'],
    ['OPCO', { opcos: ['akto'] }, { opco: 'atlas' }, 'Réservé aux entreprises relevant de : AKTO'],
    [
      'OPCO (noms officiels, identifiant inconnu repris tel quel)',
      { opcos: ['opcommerce', 'opco-ep', 'nouveau-opco'] },
      { opco: 'atlas' },
      "Réservé aux entreprises relevant de : L'Opcommerce, OPCO EP, nouveau-opco",
    ],
    ['conventions collectives', { idcc: ['1486', '1517'] }, {}, 'Réservé aux conventions collectives : IDCC 1486, 1517'],
    ['structures', { structures: ['ess', 'siae'] }, { structures: [] }, "Réservé aux structures : ESS, structure d'insertion (SIAE)"],
    ['Qualiopi', { qualiopi_requis: true }, { qualiopi: false }, 'Organisme de formation certifié Qualiopi exigé'],
  ])('raison ko : %s', (_nom, criteres, profil, raison) => {
    expect(evaluerCriteres(criteres, makeProfil(profil))).toEqual({ etat: 'ko', raisonsKo: [raison], raisonsInconnu: [] });
  });

  // Même principe pour l'information manquante : « Précisez … » / « Vérifiez … » / « Identifiez … ».
  it.each<[string, CriteresAide, Partial<ProfilAides>, string]>([
    ['région', { regions: ['11'] }, { regionEntreprise: null }, 'Précisez la région'],
    ['département', { departements: ['95'] }, { departementEntreprise: null }, "Précisez le département de l'établissement"],
    [
      'département du bénéficiaire',
      { departements: ['75', '95'], perimetre_region: 'beneficiaire' },
      {},
      "Vérifiez que le bénéficiaire réside dans l'un de ces départements : 75, 95",
    ],
    ['effectif maximal', { effectif_max: 249 }, { effectifMin: null, effectifMax: null }, "Vérifiez que l'effectif ne dépasse pas 249 salariés"],
    ['effectif minimal', { effectif_min: 250 }, { effectifMin: null, effectifMax: null }, "Vérifiez que l'effectif atteint au moins 250 salariés"],
    ['âge', { age_max: 29 }, { age: null }, "Précisez l'âge du bénéficiaire"],
    ['niveau de diplôme', { niveaux_diplome: ['bac'] }, { niveauDiplome: null }, 'Précisez le niveau de diplôme du bénéficiaire'],
    ['niveau de certification', { niveau_certification_min: 4 }, { niveauFormationVise: null }, 'Précisez le niveau de la certification visée'],
    ['contrat', { contrats: ['cdi'] }, { contrat: null }, 'Précisez le type de contrat'],
    ["type d'alternance", { types_alternance: ['apprentissage'] }, { typeAlternance: null }, "Précisez le type de contrat d'alternance"],
    ['ancienneté', { anciennete_min_mois: 24 }, { ancienneteMois: null }, "Précisez l'ancienneté du salarié"],
    ['France Travail', { inscrit_france_travail: true }, { inscritFranceTravail: null }, 'Précisez si le bénéficiaire est inscrit à France Travail'],
    ['statut du dirigeant', { statuts_dirigeant: ['artisan'] }, { statutDirigeant: null }, 'Précisez le statut du dirigeant'],
    ['micro-entrepreneur', { micro_entrepreneur: true }, { microEntrepreneur: null }, 'Précisez si le dirigeant est micro-entrepreneur'],
    ['certification', { certifications: ['rncp'] }, { certification: null }, 'Précisez la certification visée par la formation'],
    ['type de formation', { types_formation: ['vae'] }, { typeFormation: null }, 'Précisez le type de formation'],
    ['éligibilité CPF', { eligible_cpf: true }, { eligibleCpf: null }, 'Vérifiez que la formation est éligible au CPF'],
    ['durée', { duree_min_heures: 150 }, { dureeHeures: null }, 'Précisez la durée de la formation'],
    ['OPCO', { opcos: ['akto'] }, { opco: null }, "Identifiez l'OPCO de l'entreprise"],
    ['convention collective', { idcc: ['1516'] }, { idccs: [] }, "Précisez la convention collective de l'entreprise"],
    ['code NAF', { naf_prefixes: ['85'] }, { codeNaf: null }, "Précisez le code NAF de l'entreprise"],
    ['structures', { structures: ['ess', 'siae'] }, { structures: null }, "Vérifiez que votre structure relève de : ESS, structure d'insertion (SIAE)"],
    ['Qualiopi', { qualiopi_requis: true }, { qualiopi: null }, "Vérifiez que l'organisme de formation est certifié Qualiopi"],
  ])('raison inconnu : %s', (_nom, criteres, profil, raison) => {
    expect(evaluerCriteres(criteres, makeProfil(profil))).toEqual({ etat: 'inconnu', raisonsKo: [], raisonsInconnu: [raison] });
  });
});
