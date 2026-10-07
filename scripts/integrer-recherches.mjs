// Intègre les fichiers de recherche (protocole PROTOCOLE.md) dans le catalogue embarqué :
//   nat-*.json     → packages/core/data/aides/nationales.json
//   regions-*.json → packages/core/data/aides/regions.json et portails.json
// Seule la version vérifiée <fichier>.verifie.json est acceptée : un fichier sans version vérifiée arrête
// l'intégration (code de sortie 1) avant toute écriture.
// Le contenu est copié tel quel, sauf :
//   - un montant dont les champs ne correspondent pas à son mode (refusé par AideSchema) passe en « non_chiffre » ;
//     le libellé est conservé, aucun montant n'est inventé ni complété ;
//   - le lien Agefiph de chaque région (liens_par_region des aides nat-agefiph-*) est ajouté au portail de la région ;
//   - les alternatives connues (table ALTERNATIVES_CONNUES : même dispositif présent dans plusieurs aides, comme la POE,
//     ou aides financées par le même solde CPF) sont déclarées dans les deux sens par cumul.alternatives ;
//   - la table CORRECTIONS (revue du moteur d'aides, octobre 2026) recatégorise en « remuneration_beneficiaire » les aides
//     qui paient une dépense de la personne et non la formation (permis, transport, hébergement, restauration, équipement,
//     mobilité, fonds social, aides aux apprentis), recatégorise en « aide_employeur » les aides versées à une entreprise
//     ou à une structure qui ne paient pas la formation elle-même, réserve les aides propres à la VAE au type de formation
//     « vae » (critère types_formation), rend cumulables les quatre fonds d'assurance formation des non-salariés dont la
//     seule restriction porte sur le CPF (AGEFICE, FAFCEA et FIF PL au choix avec le CPF ; FAF PM limité aux formations non
//     certifiantes), fait du FAFCEA un repli après refus du CPF pour la VAE et les formations RNCP (deux majorations sans
//     valeur : montant selon dossier), exclut les reconversions du FIF PL (critère types_formation), passe l'AGEFICE en
//     estimation (enveloppe selon la contribution versée), passe en « non_chiffre » le pourcentage de l'aide au permis de la Région
//     Hauts-de-France (il porte sur le contrat d'enseignement à la conduite, pas sur la formation) et corrige trois montants
//     (majoration RQTH du RFFT, deux aides versées sur une période qui n'est pas la durée de la formation). Chaque
//     correction vérifie l'état attendu de l'aide avant de la modifier : si l'aide a disparu ou a changé, le script
//     s'arrête (code 1) sans rien écrire.
// Usage : node scripts/integrer-recherches.mjs docs/recherche-aides/2026-10 (depuis la racine du dépôt)
// Le script réécrit les trois fichiers du catalogue : pour une mise à jour ponctuelle d'une aide, modifier directement
// `packages/core/data/aides/*.json` (puis lancer les tests) sans relancer le script ; une nouvelle campagne de recherche
// produit un nouveau dossier `docs/recherche-aides/<AAAA-MM>/` et la table `CORRECTIONS` doit alors être revue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = process.argv[2];
if (!dossier || !fs.existsSync(dossier)) {
  console.error('Usage : node scripts/integrer-recherches.mjs <dossier-recherche>');
  process.exit(1);
}

const CLES_AIDE = new Set([
  'id', 'nom', 'financeur', 'financeur_nom', 'categorie', 'projets', 'beneficiaires', 'description', 'criteres',
  'conditions', 'montant', 'cumul', 'demarches', 'url_demarche', 'liens_par_region', 'sources',
  'derniere_verification', 'validite', 'statut', 'confidence', 'ordre_empilement',
]);
const CLES_MONTANT = new Set(['mode', 'valeur', 'pourcentage', 'base', 'plafond', 'duree_max_mois', 'libelle', 'majorations']);
const CLES_CUMUL = new Set(['cumulable', 'alternatives', 'note']);
const CLES_VALIDITE = new Set(['debut', 'fin']);
const CLES_SOURCE = new Set(['url', 'titre', 'extrait']);
const CLES_PORTAIL = new Set(['region', 'nom_region', 'liens', 'derniere_verification']);
const CLES_LIEN = new Set(['titre', 'url', 'type']);

// Alternatives connues : des aides « au choix », jamais additionnées, que les fichiers de recherche ne déclarent pas
// toutes entre elles. Chaque paire est déclarée dans les deux sens (cumul.alternatives de chacune des deux aides) : le
// plan de financement ne retient qu'une aide par groupe d'alternatives, et un groupe doit être complet (chaque aide
// déclarée alternative de toutes les autres : voir tests/donnees-aides-coherence.test.ts).
//   - POE : la POEI nationale (nat-2) et la POEI financée par la Région Pays de la Loire (regions-2) sont le même
//     dispositif (mêmes plafonds de 300 / 450 / 600 h ; doublon signalé par les vérificateurs, tâche 16) ; la POEC
//     nationale est déjà au choix avec la POEI nationale ;
//   - solde CPF : nat-cpf, nat-vae, nat-clea et nat-bilan-competences prélèvent sur le même solde de droits CPF (les trois
//     dernières déclarent déjà nat-cpf).
// Des paires restent volontairement non déclarées (justifiées une à une dans le test de cohérence) : nat-ptp et
// nat-ptp-remuneration (même dispositif, cumulables) ; r84-pacte-region-emploi et r84-formations-individuelles (aucune des
// deux n'est déclarée incompatible avec l'autre) ; neuf paires de l'étoile du CPF et des fonds d'assurance formation (les
// fonds déclarent nat-cpf et nat-vae par la table CORRECTIONS ci-dessous, sans être alternatives de nat-clea, de
// nat-bilan-competences ni les uns des autres : ces aides ne peuvent jamais être éligibles ensemble).
const ALTERNATIVES_CONNUES = [
  {
    paire: ['nat-poei', 'r52-poei-region'],
    motif: 'même dispositif : la POEI nationale et la POEI de la Région Pays de la Loire ont les mêmes plafonds de 300 / 450 / 600 h',
  },
  {
    paire: ['nat-poec', 'r52-poei-region'],
    motif: 'POE : la POEC est au choix avec la POEI nationale, dont la POEI de la Région Pays de la Loire est la déclinaison régionale',
  },
  {
    paire: ['nat-vae', 'nat-clea'],
    motif: 'financées par le même solde CPF (chacune est déjà au choix avec nat-cpf) : jamais additionnées',
  },
  {
    paire: ['nat-vae', 'nat-bilan-competences'],
    motif: 'financées par le même solde CPF (chacune est déjà au choix avec nat-cpf) : jamais additionnées',
  },
  {
    paire: ['nat-clea', 'nat-bilan-competences'],
    motif: 'financées par le même solde CPF (chacune est déjà au choix avec nat-cpf) : jamais additionnées',
  },
];
const TITRE_AGEFIPH = "Agefiph : aides pour l'emploi des personnes handicapées";

const aujourdhui = new Date().toISOString().slice(0, 10);
const alertes = [];
const montantsNormalises = [];
const sansVerification = [];

function lireFichiers(prefixe) {
  const bruts = fs
    .readdirSync(dossier)
    .filter((f) => f.startsWith(prefixe) && f.endsWith('.json') && !f.endsWith('.verifie.json'))
    .sort();
  const lus = [];
  for (const f of bruts) {
    const verifie = f.replace(/\.json$/, '.verifie.json');
    if (!fs.existsSync(path.join(dossier, verifie))) {
      sansVerification.push(f);
      continue;
    }
    try {
      lus.push({ nom: verifie, contenu: JSON.parse(fs.readFileSync(path.join(dossier, verifie), 'utf-8')) });
    } catch (erreur) {
      console.error(`${verifie} : JSON illisible (${erreur.message})`);
      process.exit(1);
    }
  }
  return lus;
}

const texte = (v) => String(v ?? '').trim();

function verifierCles(objet, autorisees, contexte) {
  for (const cle of Object.keys(objet ?? {})) {
    if (!autorisees.has(cle)) alertes.push(`${contexte} : clé ignorée « ${cle} »`);
  }
}

// Abandonne l'estimation chiffrée d'un montant : le libellé lisible est conservé, aucun montant n'est inventé.
function passerEnNonChiffre(montant) {
  montant.mode = 'non_chiffre';
  montant.valeur = null;
  montant.pourcentage = null;
  montant.base = null;
  montant.plafond = null;
  montant.duree_max_mois = null;
  delete montant.majorations;
}

function normaliserAide(a, origine) {
  const contexte = `${origine} / ${a.id}`;
  verifierCles(a, CLES_AIDE, contexte);
  verifierCles(a.montant, CLES_MONTANT, `${contexte} / montant`);
  verifierCles(a.cumul, CLES_CUMUL, `${contexte} / cumul`);
  verifierCles(a.validite, CLES_VALIDITE, `${contexte} / validite`);
  for (const s of a.sources ?? []) verifierCles(s, CLES_SOURCE, `${contexte} / sources`);
  // Valeurs par défaut appliquées plus bas : on les signale pour ne rien inventer en silence.
  const requis = [
    ['montant', a.montant],
    ['montant.mode', a.montant?.mode],
    ['cumul', a.cumul],
    ['cumul.cumulable', a.cumul?.cumulable],
    ['statut', a.statut],
    ['confidence', a.confidence],
    ['derniere_verification', a.derniere_verification],
  ];
  for (const [cle, valeur] of requis) {
    if (valeur == null) alertes.push(`${contexte} : « ${cle} » absent, valeur par défaut appliquée`);
  }

  const m = a.montant ?? {};
  const montant = {
    mode: m.mode ?? 'non_chiffre',
    valeur: m.valeur ?? null,
    pourcentage: m.pourcentage ?? null,
    base: m.base ?? null,
    plafond: m.plafond ?? null,
    duree_max_mois: m.duree_max_mois ?? null,
    libelle: texte(m.libelle),
  };
  if (Array.isArray(m.majorations) && m.majorations.length > 0) montant.majorations = m.majorations;

  // Montant incohérent avec son mode (refusé par le schéma strict) : on abandonne l'estimation chiffrée,
  // on garde le libellé lisible. Cette normalisation suit l'affectation des majorations pour pouvoir les retirer.
  const incoherent =
    (montant.mode === 'pourcentage' && (montant.pourcentage == null || montant.base == null)) ||
    (montant.mode === 'par_mois' && montant.duree_max_mois == null) ||
    ((montant.mode === 'forfait' || montant.mode === 'par_heure' || montant.mode === 'par_mois') && montant.valeur == null);
  if (incoherent) {
    alertes.push(`${origine} / ${a.id} : montant « ${montant.mode} » incomplet, passé en non_chiffre (libellé conservé)`);
    montantsNormalises.push(a.id);
    passerEnNonChiffre(montant);
  }

  const cumul = { cumulable: a.cumul?.cumulable ?? true };
  if (a.cumul?.alternatives?.length) cumul.alternatives = a.cumul.alternatives;
  if (a.cumul?.note) cumul.note = texte(a.cumul.note);

  const aide = {
    id: texte(a.id),
    nom: texte(a.nom),
    financeur: a.financeur,
    financeur_nom: texte(a.financeur_nom),
    categorie: a.categorie,
    projets: a.projets ?? [],
    beneficiaires: a.beneficiaires ?? [],
    description: texte(a.description),
    criteres: a.criteres ?? {},
    conditions: (a.conditions ?? []).map(texte).filter(Boolean),
    montant,
    cumul,
    demarches: (a.demarches ?? []).map(texte).filter(Boolean),
    url_demarche: a.url_demarche ?? null,
    sources: (a.sources ?? []).map((s) => ({ url: texte(s.url), titre: texte(s.titre), extrait: texte(s.extrait) })),
    derniere_verification: a.derniere_verification ?? aujourdhui,
    validite: { debut: a.validite?.debut ?? null, fin: a.validite?.fin ?? null },
    statut: a.statut ?? 'a_confirmer',
    confidence: a.confidence ?? 'estimated',
  };
  if (a.liens_par_region && Object.keys(a.liens_par_region).length > 0) aide.liens_par_region = a.liens_par_region;
  if (a.ordre_empilement != null) aide.ordre_empilement = a.ordre_empilement;
  return aide;
}

function normaliserPortail(p, origine) {
  const contexte = `${origine} / portail ${p.region}`;
  verifierCles(p, CLES_PORTAIL, contexte);
  for (const l of p.liens ?? []) verifierCles(l, CLES_LIEN, `${contexte} / liens`);
  return {
    region: p.region,
    nom_region: texte(p.nom_region),
    liens: (p.liens ?? []).map((l) => ({ titre: texte(l.titre), url: texte(l.url), type: l.type })),
    derniere_verification: p.derniere_verification,
  };
}

function fusionner(fichiers, ids) {
  const aides = [];
  const exclues = [];
  const notes = [];
  for (const { nom, contenu } of fichiers) {
    for (const brute of contenu.aides ?? []) {
      const aide = normaliserAide(brute, nom);
      if (ids.has(aide.id)) {
        alertes.push(`${nom} : identifiant en double ignoré « ${aide.id} »`);
        continue;
      }
      ids.add(aide.id);
      aides.push(aide);
    }
    exclues.push(...(contenu.exclues ?? []).map((e) => ({ ...e, fichier: nom })));
    notes.push(...(contenu.notes ?? []).map((n) => `${nom} : ${n}`));
  }
  return { aides, exclues, notes };
}

// Une même exclusion peut figurer dans plusieurs fichiers sous des noms voisins (c'est le cas de l'aide VAE de
// France Travail, signalée par nat-1 et regions-2) : le rapport ne la liste qu'une fois, avec ses fichiers.
const cleExclusion = (nom) =>
  /\bVAE\b/i.test(nom) && /France Travail/i.test(nom) ? 'aide vae de france travail' : texte(nom).toLowerCase();

function dedoublonnerExclues(exclues) {
  const parCle = new Map();
  for (const e of exclues) {
    const cle = cleExclusion(e.nom);
    const connue = parCle.get(cle);
    if (!connue) {
      parCle.set(cle, { ...e, fichiers: [e.fichier], autresNoms: [] });
      continue;
    }
    if (!connue.fichiers.includes(e.fichier)) connue.fichiers.push(e.fichier);
    if (e.nom !== connue.nom && !connue.autresNoms.includes(e.nom)) connue.autresNoms.push(e.nom);
  }
  return [...parCle.values()];
}

const ids = new Set();
const fichiersNat = lireFichiers('nat-');
const fichiersReg = lireFichiers('regions-');
if (sansVerification.length > 0) {
  console.error(`Intégration refusée : pas de version vérifiée (.verifie.json) pour ${sansVerification.join(', ')}`);
  process.exit(1);
}
if (fichiersNat.length === 0 || fichiersReg.length === 0) {
  console.error(`Intégration refusée : aucun fichier ${fichiersNat.length === 0 ? 'nat-*' : 'regions-*'} dans ${dossier}`);
  process.exit(1);
}
const nationaux = fusionner(fichiersNat, ids);
const regionaux = fusionner(fichiersReg, ids);
const toutes = [...nationaux.aides, ...regionaux.aides];

// Alternatives connues : chaque aide de la paire devient l'alternative de l'autre (sans doublon : une déclaration déjà
// présente dans les fichiers de recherche est conservée, jamais répétée).
const parId = new Map(toutes.map((a) => [a.id, a]));
const alternativesLiees = [];
for (const { paire: [x, y], motif } of ALTERNATIVES_CONNUES) {
  const ax = parId.get(x);
  const ay = parId.get(y);
  if (!ax || !ay) {
    alertes.push(`alternative connue ${x} / ${y} : identifiant absent du catalogue, alternatives non créées`);
    continue;
  }
  let declarations = 0;
  for (const [aide, autre] of [[ax, y], [ay, x]]) {
    const alternatives = aide.cumul.alternatives ?? [];
    if (alternatives.includes(autre)) continue;
    // Reconstruit l'objet pour garder l'ordre des clés : cumulable, alternatives, note.
    const { cumulable, note } = aide.cumul;
    aide.cumul = { cumulable, alternatives: [...alternatives, autre], ...(note !== undefined && { note }) };
    declarations += 1;
  }
  alternativesLiees.push(`${x} et ${y} : ${motif}${declarations === 0 ? ' (déjà déclarées dans les deux sens par la recherche)' : ''}`);
}

for (const a of toutes) {
  if (!a.cumul.alternatives) continue;
  const inconnues = a.cumul.alternatives.filter((id) => !ids.has(id));
  if (inconnues.length > 0) {
    alertes.push(`${a.id} : alternatives inconnues retirées (${inconnues.join(', ')})`);
    a.cumul.alternatives = a.cumul.alternatives.filter((id) => ids.has(id));
    if (a.cumul.alternatives.length === 0) delete a.cumul.alternatives;
  }
}

// Corrections décidées à la revue du moteur d'aides (octobre 2026) : des défauts de données que le moteur ne peut pas
// compenser. Chaque entrée est { id, motif, condition, appliquer } :
//   - condition(aide) décrit l'état attendu de l'aide AVANT correction ; si l'identifiant est absent du catalogue ou si
//     la condition est fausse, le script écrit l'erreur sur stderr et sort avec le code 1 sans rien écrire : une
//     correction qui ne s'applique plus (recherche mise à jour, aide modifiée) ne doit jamais passer en silence ;
//   - appliquer(aide) modifie l'aide normalisée, jamais les fichiers de recherche (la correction est donc reproductible) ;
//   - motif tient en une ligne ; il est repris dans le rapport d'intégration.
// Catégorie « cout_formation » : l'aide paie la formation elle-même (frais pédagogiques, prise en charge, abondement,
// chèque ou bon de formation, financement du coût de la formation). Catégorie « remuneration_beneficiaire » : revenu ou
// aide à la personne (rémunération, transport, hébergement, restauration, permis, équipement, mobilité, fonds social,
// aides aux apprentis qui ne paient pas la formation). Une aide qui paie la formation et une dépense de la personne
// (frais pédagogiques et indemnité, par exemple) reste « cout_formation ».
const aideALaPersonne = (id, motif) => ({
  id,
  motif,
  condition: (aide) => aide.categorie === 'cout_formation',
  appliquer: (aide) => {
    aide.categorie = 'remuneration_beneficiaire';
  },
});

// Catégorie « aide_employeur » : aide versée à une entreprise ou à une structure qui ne paie pas la formation elle-même
// (ingénierie interne, conseil et diagnostic, fonctionnement d'une structure d'insertion). Les subventions aux entreprises
// qui financent des coûts de formation (dépenses pédagogiques, heures de formation) restent « cout_formation ».
const aideALEmployeur = (id, motif) => ({
  id,
  motif,
  condition: (aide) => aide.categorie === 'cout_formation',
  appliquer: (aide) => {
    aide.categorie = 'aide_employeur';
  },
});

// Aide propre à la VAE : tout son objet est un parcours de validation des acquis de l'expérience (accompagnement,
// formation liée au parcours, abondement du CPF, forfait). Le critère `types_formation: ['vae']` la masque (hors
// périmètre) quand le type de formation du parcours est connu et différent, et la laisse « à vérifier » quand il est
// inconnu. Une aide qui couvre la VAE parmi d'autres objets (CPF, C2P, aide de l'Agefiph, FAFCEA…) n'est pas concernée.
const aidePropreALaVae = (id, motif) => ({
  id,
  motif,
  condition: (aide) => aide.criteres.types_formation === undefined,
  appliquer: (aide) => {
    aide.criteres.types_formation = ['vae'];
  },
});

// Fonds d'assurance formation des non-salariés dont la seule restriction de cumul porte sur le CPF (AGEFICE, FAFCEA, FIF PL) :
// l'aide devient cumulable et au choix avec les deux aides du CPF qui peuvent payer la formation d'un dirigeant, nat-cpf et
// nat-vae (une VAE financée par le CPF) ; le plan ne retient alors que la mieux chiffrée des deux. L'abondement de l'employeur
// (nat-cpf-abondement-employeur) n'est pas déclaré : un dirigeant non salarié n'a pas d'employeur et cette aide ne vise que les
// salariés ; CléA et le bilan de compétences ne concernent pas non plus un dirigeant. `sources` : extraits mot pour mot des pages
// officielles qui justifient la règle de cumul, ajoutés à la fin des sources de l'aide quand la recherche ne la citait pas.
const fondsAuChoixAvecLeCpf = ({ id, motif, noteAvant, noteApres, sources }) => ({
  id,
  motif,
  condition: (aide) =>
    aide.categorie === 'cout_formation' &&
    aide.cumul.cumulable === false &&
    aide.cumul.alternatives === undefined &&
    aide.cumul.note === noteAvant,
  appliquer: (aide) => {
    aide.cumul = { cumulable: true, alternatives: ['nat-cpf', 'nat-vae'], note: noteApres };
    aide.sources.push(...sources);
  },
});

// Majoration dont les critères sont exactement `criteres` (ex. { rqth: true }).
const trouverMajoration = (aide, criteres) =>
  (aide.montant.majorations ?? []).find((m) => JSON.stringify(m.criteres) === JSON.stringify(criteres));

const CORRECTIONS = [
  // Permis de conduire
  aideALaPersonne('r24-aide-permis-combo-parfait', 'paie un permis de conduire (code et cours de conduite), pas la formation'),
  aideALaPersonne('r28-aide-permis', "paie un permis de conduire (50 % de la préparation à l'examen pratique du permis B), pas la formation"),
  aideALaPersonne('r32-aide-permis', "paie un permis de conduire (contrat d'enseignement à la conduite), pas la formation"),
  aideALaPersonne('r75-permis-b', 'paie un permis de conduire, pas la formation'),
  aideALaPersonne('r84-permis-b', 'paie un permis de conduire, pas la formation'),
  // Transport, hébergement, restauration
  aideALaPersonne('nat-aide-mobilite-france-travail', "paie des frais de déplacement, de repas et d'hébergement du demandeur d'emploi, pas la formation"),
  aideALaPersonne('r24-aide-transport-hebergement', "paie le transport ou l'hébergement du stagiaire, pas la formation"),
  aideALaPersonne('r27-aide-transport-hebergement', "paie le transport ou l'hébergement du stagiaire, pas la formation"),
  aideALaPersonne('r32-apprentis-transport', "paie le transport domicile-CFA de l'apprenti, pas la formation"),
  aideALaPersonne('r32-apprentis-restauration', "compense des frais de restauration de l'apprenti, pas la formation"),
  aideALaPersonne('r32-apprentis-hebergement', "compense des frais d'hébergement de l'apprenti, pas la formation"),
  aideALaPersonne('r32-apprentis-transports-regionaux', "gratuité ou réduction des transports régionaux de l'apprenti, pas la formation"),
  aideALaPersonne('r76-hebergement-afpa', "paie l'hébergement du stagiaire en centre AFPA, pas la formation"),
  aideALaPersonne('r93-pass-zou-etudes', 'abonnement de transport (bus et trains régionaux), pas la formation'),
  aideALaPersonne('r94-mobilite-apprentis', "rembourse les frais de déplacement de l'apprenti, pas la formation"),
  aideALaPersonne('r94-train-gratuit-apprentis', 'gratuité du train entre le domicile et le lieu de formation, pas la formation'),
  aideALaPersonne('r04-reunipass-stagiaires', 'gratuité des bus et cars pour les stagiaires, pas la formation'),
  // Équipement
  aideALaPersonne('r28-aide-equipement-professionnel', "paie l'achat d'un équipement professionnel du stagiaire, pas la formation"),
  aideALaPersonne('r32-apprentis-equipement', "paie le premier équipement de l'apprenti (équipements professionnels, livres), pas la formation"),
  // Mobilité internationale (bourses, billets, allocations)
  aideALaPersonne('ue-erasmus-mobilite-alternants', 'bourse de mobilité européenne et internationale, pas la formation'),
  aideALaPersonne('nat-ladom-passeport-mobilite-formation', "paie le billet aller-retour et des allocations de mobilité, d'installation et post-mobilité, pas la formation"),
  aideALaPersonne('r28-pass-monde', "bourse de mobilité internationale (stage ou séjour à l'étranger), pas la formation"),
  aideALaPersonne('r32-mermoz-apprentis', "bourse de mobilité internationale (stage à l'étranger), pas la formation"),
  aideALaPersonne('r75-stages-etranger-infra-bac', "bourse de mobilité internationale (stage à l'étranger), pas la formation"),
  aideALaPersonne('r75-stages-etranger-post-bac', "bourse de mobilité internationale (stage à l'étranger), pas la formation"),
  aideALaPersonne('r84-mobilite-internationale-apprentis-superieur', "bourse de mobilité internationale (étude ou stage à l'étranger), pas la formation"),
  aideALaPersonne('r93-prame-mobilite-internationale', "bourse de mobilité internationale (stage ou semestre à l'étranger), pas la formation"),
  // Fonds social et aides aux apprentis qui ne paient pas la formation
  aideALaPersonne('r52-fonds-social-urgence', "fonds social d'urgence du stagiaire (logement, restauration, transport), pas la formation"),
  aideALaPersonne('nat-opco-frais-annexes-apprentis', "paie des frais annexes de l'apprenti (hébergement, restauration, premier équipement, mobilité internationale), pas la formation"),
  aideALaPersonne('r11-aide-regionale-apprentissage', "aide de rentrée de l'apprenti (livres, équipement, transport, restauration, hébergement), pas la formation"),
  aideALaPersonne('r27-aide-apprentis-difficulte', 'aide aux apprentis en difficulté sociale et financière (mobilité, hébergement, matériel), pas la formation'),
  aideALaPersonne('r93-fonds-aide-apprentis', "fonds d'aide individuelle aux apprentis : aucune prise en charge de la formation n'est décrite"),
  // Autres aides à la personne
  aideALaPersonne('nat-agefiph-parcours-vers-emploi', 'aide à la personne handicapée en situation de précarité (déplacements, hébergement, restauration, vêtements), pas la formation'),
  aideALaPersonne('r11-daeu', "prime incitative versée à la personne sous condition d'assiduité, qui n'avance pas les droits d'inscription : pas la formation"),

  // Aides versées à une entreprise ou à une structure, qui ne paient pas la formation elle-même (audit de la tâche 17b :
  // le plan ne les compte pas aujourd'hui car elles sont à confirmer et non chiffrées, mais leur catégorie est fausse)
  aideALEmployeur('r75-aiei-ingefor', "subvention de 50 % des dépenses d'ingénierie interne préalable à une formation (aide à l'entreprise), pas la formation"),
  aideALEmployeur('r53-pass-transitions', "subvention de la Région aux entreprises de 50 salariés au plus pour des prestations de conseil et de diagnostic (aide à l'entreprise), pas la formation"),
  aideALEmployeur('r01-iae-formation-salaries-insertion', "subvention de fonctionnement d'une structure d'insertion (aide à la structure), pas la formation"),

  // Aides propres à la VAE : lues une par une, tout leur objet est un parcours VAE
  aidePropreALaVae('nat-vae', "accompagnement d'un parcours VAE financé par le solde CPF : propre à la VAE"),
  aidePropreALaVae('nat-vae-transitions-pro', 'forfait de 2 000 € de la Transitions Pro pour un parcours VAE (accompagnement, formations, jury) : propre à la VAE'),
  aidePropreALaVae('r02-aide-vae', "aide de la CTM à l'accompagnement VAE des demandeurs d'emploi : propre à la VAE"),
  aidePropreALaVae('r24-abondement-cpf-vae', "abondement régional du CPF pour l'accompagnement VAE (Centre-Val de Loire) : propre à la VAE"),
  aidePropreALaVae('r27-pass-vae-accompagnement', "PASS'VAE Accompagnement : accompagnement méthodologique à la VAE : propre à la VAE"),
  aidePropreALaVae('r27-pass-vae-hybride', "PASS'VAE Hybride : formation complémentaire liée à un parcours VAE (avant le jury ou après une validation partielle) : propre à la VAE"),
  aidePropreALaVae('r28-vae-demandeurs-emploi', "accompagnement méthodologique à la VAE des demandeurs d'emploi (Région Normandie) : propre à la VAE"),
  aidePropreALaVae('r93-pass-vae', 'Pass VAE de la Région Sud (accompagnement, modules manquants, formations obligatoires du parcours VAE) : propre à la VAE'),
  aidePropreALaVae('r94-assegnu-vae', "Assegnu VAE : accompagnement méthodologique d'une VAE : propre à la VAE"),

  // Fonds d'assurance formation des non-salariés (tâche 21) : leurs sources n'écartent que les formations financées par le
  // CPF, pas les autres financements. Déclarés non cumulables, ils n'étaient jamais empilés dans le plan de financement.
  fondsAuChoixAvecLeCpf({
    id: 'faf-agefice',
    motif: "n'exclut que les actions entreprises avec mobilisation des droits CPF : cumulable, au choix avec le CPF (nat-cpf, nat-vae)",
    noteAvant: 'Non cumulable avec le CPF pour une même formation (les actions financées avec des droits CPF sont exclues).',
    noteApres:
      'Au choix avec le CPF (formation ou VAE) pour une même formation : les actions entreprises avec mobilisation des droits CPF sont exclues, même en cas de reste à charge.',
    sources: [],
  }),
  fondsAuChoixAvecLeCpf({
    id: 'faf-fafcea',
    motif: "n'intervient qu'en cas de refus du CPF pour la VAE, le bilan de compétences et les formations RNCP : cumulable, au choix avec le CPF (nat-cpf, nat-vae)",
    noteAvant: "Pour la VAE, le bilan de compétences et les formations RNCP, le FAFCEA n'intervient qu'en cas de refus de prise en charge par le CPF.",
    noteApres:
      "Au choix avec le CPF (formation ou VAE), jamais additionnés. Pour la VAE, le bilan de compétences et les formations RNCP, le FAFCEA n'intervient qu'en cas de refus de prise en charge par le CPF : pour la VAE et les formations RNCP, son montant n'est donc pas compté dans le plan. Le simulateur ne distingue pas le bilan de compétences : n'y comptez pas le FAFCEA.",
    sources: [
      {
        url: 'https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf',
        titre: 'FAFCEA – Critères de prise en charge 2026, secteur Services et Fabrication (1er septembre 2026)',
        extrait:
          'VAE comprenant l’accompagnement, le dépôt du livret 2 et le passage devant le jury Prise en charge dans le cas d’un refus de prise en charge du CPF plafonnée à 24h dans la limite d’un coût horaire maximum de 50€',
      },
      {
        url: 'https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf',
        titre: 'FAFCEA – Critères de prise en charge 2026, secteur Services et Fabrication (1er septembre 2026)',
        extrait: 'Bilan de compétences Prise en charge dans le cas d’un refus de prise en charge du CPF',
      },
      {
        url: 'https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf',
        titre: 'FAFCEA – Critères de prise en charge 2026, secteur Services et Fabrication (1er septembre 2026)',
        extrait:
          'Formations diplômantes et certifiantes inscrites au RNCP Prise en charge dans le cas d’un refus de prise en charge du CPF à hauteur de 7 500€ par action dans la limite d’un coût horaire maximum de 30€, après avis des commissions techniques et validation par le Conseil d’Administration',
      },
    ],
  }),
  fondsAuChoixAvecLeCpf({
    id: 'faf-fifpl',
    motif: 'ne complète pas les formations financées par le CPF : cumulable, au choix avec le CPF (nat-cpf, nat-vae)',
    noteAvant: 'Les formations liées au CPF sont exclues des prises en charge du FIF PL.',
    noteApres:
      'Au choix avec le CPF (formation ou VAE) : le FIF PL ne fait pas de complément de prise en charge pour les formations financées par le CPF.',
    sources: [
      {
        url: 'https://fifpl.fr/professions-liberales/foire-aux-questions-faq/',
        titre: 'FIF PL – Foire aux questions (FAQ)',
        extrait:
          'Ma formation est partiellement financée par le biais de mon CPF. Puis-je faire une demande au FIF PL pour la partie restant à ma charge ? Non, le FIF PL ne fait pas de complément de prise en charge pour les formations financées par le CPF.',
      },
    ],
  }),
  {
    id: 'faf-fafpm',
    motif:
      "ne prend pas en charge à titre individuel les formations diplômantes ou certifiantes, qui relèvent du CPF : cumulable, limité aux formations non certifiantes (types_formation), sans alternative",
    condition: (aide) =>
      aide.categorie === 'cout_formation' &&
      aide.cumul.cumulable === false &&
      aide.cumul.alternatives === undefined &&
      aide.cumul.note ===
        "Les formations diplômantes relèvent du CPF et les programmes DPC de l'ANDPC ; ils ne sont pas pris en charge à titre individuel par le FAF PM." &&
      aide.criteres.types_formation === undefined,
    appliquer: (aide) => {
      aide.cumul = {
        cumulable: true,
        note: "Les formations diplômantes ou certifiantes relèvent du CPF et les programmes DPC de l'ANDPC ; ils ne sont pas pris en charge à titre individuel par le FAF PM. L'aide n'est donc proposée que pour une formation non certifiante.",
      };
      aide.criteres.types_formation = ['non_certifiante'];
      const url = 'https://www.fafpm.org/medecins-liberaux/actions-de-formations-financees-a-titre-individuel/';
      const titre = 'FAF PM – Actions de formations financées à titre individuel – Règles de prise en charge 2026';
      aide.sources.push(
        {
          url,
          titre,
          extrait: 'Ne sont pas prises en charge à titre individuel par le FAF PM les actions de formation : Diplômantes ou certifiantes (DU, DIU, capacités,…)',
        },
        {
          url,
          titre,
          extrait:
            'Une partie de cette ressource sert à alimenter le CPF (Compte Personnel Formation) qui vous permet également de financer votre formation (diplômante, certifiante).',
        },
      );
    },
  },

  // Revue de la tâche 21 : ce que les sources des fonds permettent de chiffrer, et ce qu'elles écartent.
  // FAFCEA : les critères de prise en charge ont une ligne propre pour la VAE (« ... plafonnée à 24h dans la limite d’un coût
  // horaire maximum de 50€ »), pour le bilan de compétences et pour les formations RNCP (« ... à hauteur de 7 500€ par action dans
  // la limite d’un coût horaire maximum de 30€, après avis des commissions techniques et validation par le Conseil
  // d’Administration »), toutes précédées de « Prise en charge dans le cas d’un refus de prise en charge du CPF » : un repli, au
  // montant propre, jamais le tarif de la formation technique (35 €/h, 100 h). Deux majorations sans valeur (première
  // majoration remplie gagnante) laissent le FAFCEA « selon dossier » : le plan ne l'empile pas. Le bilan de compétences n'a ni
  // type de formation ni niveau de certification propre dans le parcours : il ne peut pas être reconnu.
  {
    id: 'faf-fafcea',
    motif:
      "VAE et formations RNCP : prise en charge seulement en cas de refus du CPF, avec des plafonds propres (VAE : 24 h et 50 €/h ; RNCP : 7 500 € par action et 30 €/h, après avis des commissions techniques) : deux majorations sans valeur, le montant n'est pas compté dans le plan (le bilan de compétences, sans type de formation ni niveau de certification propre, n'est pas reconnu)",
    condition: (aide) =>
      aide.categorie === 'cout_formation' &&
      aide.montant.mode === 'par_heure' &&
      aide.montant.valeur === 35 &&
      aide.montant.plafond === 3500 &&
      aide.montant.majorations === undefined &&
      aide.cumul.alternatives?.join() === 'nat-cpf,nat-vae',
    appliquer: (aide) => {
      aide.montant.majorations = [
        {
          criteres: { types_formation: ['vae', 'certification'] },
          valeur: null,
          libelle:
            "VAE ou formation certifiante : le FAFCEA intervient seulement en cas de refus de prise en charge par le CPF. VAE (accompagnement, livret 2 et jury) : 24 h au plus, dans la limite de 50 €/h. Formation diplômante ou certifiante inscrite au RNCP : 7 500 € par action dans la limite de 30 €/h, après avis des commissions techniques et validation par le Conseil d'Administration.",
        },
        {
          criteres: { certifications: ['rncp', 'diplome'] },
          valeur: null,
          libelle:
            "Formation diplômante ou certifiante inscrite au RNCP : le FAFCEA intervient seulement en cas de refus de prise en charge par le CPF, à hauteur de 7 500 € par action dans la limite de 30 €/h, après avis des commissions techniques et validation par le Conseil d'Administration.",
        },
      ];
    },
  },
  // FIF PL : la page « Qu'est-ce qui peut être pris en charge ? » exclut « les bilans de compétences et les reconversions
  // professionnelles ». Le parcours n'a pas de type « bilan » : seule la reconversion est exclue, par le critère types_formation
  // (tous les types du parcours sauf la reconversion, comme le FAF PM). Le FIF PL reste proposé à un médecin (les critères n'ont
  // pas de code NAF négatif) : limite documentée dans donnees-aides-faf.test.ts.
  {
    id: 'faf-fifpl',
    motif:
      "ne prend pas en charge les reconversions professionnelles : types_formation = tous les types du parcours sauf la reconversion (les bilans de compétences ne sont pas désignables)",
    condition: (aide) =>
      aide.categorie === 'cout_formation' &&
      aide.criteres.types_formation === undefined &&
      aide.criteres.statuts_dirigeant?.join() === 'profession_liberale',
    appliquer: (aide) => {
      aide.criteres.types_formation = ['non_certifiante', 'qualification', 'certification', 'vae', 'cqp', 'habilitation'];
      aide.sources.push({
        url: 'https://fifpl.fr/professions-liberales/quest-ce-qui-peut-etre-pris-en-charge/',
        titre: "FIF PL – Qu'est-ce qui peut être pris en charge ?",
        extrait: 'Ce qui n’est pas pris en charge Les bilans de compétences et les reconversions professionnelles',
      });
    },
  },
  // AGEFICE : l'enveloppe annuelle est de 3 000 € avec une CFP d'au moins 7 € et de 600 € au-dessous (page « Les plafonds
  // financiers pour l'année 2026 »), à 42 €/h en présentiel : le plan, qui compte désormais le fonds, chiffre la première tranche.
  // Le montant est une estimation, pas un montant exact.
  {
    id: 'faf-agefice',
    motif:
      "l'enveloppe annuelle dépend de la contribution versée (3 000 € avec une CFP d'au moins 7 €, 600 € au-dessous) et du mode de formation (42 €/h en présentiel) : le montant chiffré est une estimation",
    condition: (aide) =>
      aide.categorie === 'cout_formation' &&
      aide.confidence === 'exact' &&
      aide.montant.mode === 'par_heure' &&
      aide.montant.valeur === 42 &&
      aide.montant.plafond === 3000,
    appliquer: (aide) => {
      aide.confidence = 'estimated';
    },
  },

  // Montants : le moteur calcule `par_mois` au prorata de la durée de la formation (valeur × min(duree_max_mois, durée en
  // heures / 151,67)) et applique le plafond d'une majoration comme un total.
  {
    id: 'nat-rfft',
    motif:
      "la majoration RQTH « de 775,65 € à 2 188,27 € par mois » est un maximum mensuel (valeur 2 188,27 €, sans plafond), pas un total plafonné à 2 188,27 €",
    condition: (aide) => {
      const majoration = trouverMajoration(aide, { rqth: true });
      return (
        aide.montant.mode === 'par_mois' &&
        aide.montant.valeur === 775.65 &&
        majoration?.valeur === 775.65 &&
        majoration?.plafond === 2188.27
      );
    },
    appliquer: (aide) => {
      const majoration = trouverMajoration(aide, { rqth: true });
      majoration.valeur = 2188.27;
      majoration.plafond = null;
    },
  },
  {
    id: 'r32-reprise-apprentis',
    motif:
      "500 € par mois pendant 3 mois maximum après une rupture de contrat, sans lien avec la durée de la formation : forfait de 1 500 € (500 € × 3 mois), 600 € avant 18 ans (200 € × 3 mois)",
    condition: (aide) =>
      aide.montant.mode === 'par_mois' &&
      aide.montant.valeur === 500 &&
      aide.montant.duree_max_mois === 3 &&
      trouverMajoration(aide, { age_max: 17 })?.valeur === 200,
    appliquer: (aide) => {
      aide.montant.mode = 'forfait';
      aide.montant.valeur = 1500;
      aide.montant.duree_max_mois = null;
      trouverMajoration(aide, { age_max: 17 }).valeur = 600;
    },
  },
  {
    id: 'nat-mobili-jeune',
    motif:
      "11 mensualités de 10 € à 100 € par année de formation, dans la limite de 1 100 €, sans lien avec la durée de la formation : forfait de 1 100 € (plafond annuel publié)",
    condition: (aide) =>
      aide.montant.mode === 'par_mois' &&
      aide.montant.valeur === 100 &&
      aide.montant.plafond === 1100 &&
      aide.montant.duree_max_mois === 11,
    appliquer: (aide) => {
      aide.montant.mode = 'forfait';
      aide.montant.valeur = 1100;
      aide.montant.plafond = null;
      aide.montant.duree_max_mois = null;
    },
  },

  // Pourcentage d'une dépense qui n'est pas la formation : le moteur le calcule sur le coût de la formation (450 € pour une
  // formation de 500 €), alors que le pourcentage porte sur le coût du contrat d'enseignement à la conduite.
  {
    id: 'r32-aide-permis',
    motif:
      "90 % du coût du contrat d'enseignement à la conduite (1 200 € au plus) : le pourcentage ne porte pas sur le coût de la formation, aide non chiffrée (libellé conservé, aucun montant inventé)",
    condition: (aide) =>
      aide.montant.mode === 'pourcentage' &&
      aide.montant.pourcentage === 90 &&
      aide.montant.base === 'cout_total' &&
      aide.montant.plafond === 1200,
    appliquer: (aide) => {
      passerEnNonChiffre(aide.montant);
    },
  },
];

const correctionsAppliquees = [];
const erreursCorrections = [];
for (const correction of CORRECTIONS) {
  const aide = parId.get(correction.id);
  if (!aide) {
    erreursCorrections.push(`${correction.id} : identifiant absent du catalogue (${correction.motif})`);
  } else if (!correction.condition(aide)) {
    erreursCorrections.push(`${correction.id} : l'aide n'est plus dans l'état attendu avant correction (${correction.motif})`);
  } else {
    correction.appliquer(aide);
    correctionsAppliquees.push(`${correction.id} : ${correction.motif}`);
  }
}
if (erreursCorrections.length > 0) {
  console.error("Intégration refusée : une correction ne s'applique plus, aucun fichier écrit (table CORRECTIONS à revoir) :");
  for (const erreur of erreursCorrections) console.error(`  - ${erreur}`);
  process.exit(1);
}

const portails = fichiersReg
  .flatMap(({ nom, contenu }) => (contenu.portails ?? []).map((p) => normaliserPortail(p, nom)))
  .sort((x, y) => String(x.region).localeCompare(String(y.region)));

const regionsVues = new Set();
for (const p of portails) {
  if (regionsVues.has(p.region)) alertes.push(`portail en double pour la région ${p.region}`);
  regionsVues.add(p.region);
}

// Liens Agefiph : les portails de recherche n'en portent pas ; les aides nat-agefiph-* connaissent la page de chaque région.
const urlAgefiphParRegion = new Map();
for (const a of nationaux.aides) {
  if (!a.id.startsWith('nat-agefiph-')) continue;
  for (const [region, url] of Object.entries(a.liens_par_region ?? {})) {
    const connue = urlAgefiphParRegion.get(region);
    if (connue && connue !== url) {
      alertes.push(`${a.id} : lien Agefiph différent pour la région ${region} (${url}), premier lien conservé (${connue})`);
    } else {
      urlAgefiphParRegion.set(region, url);
    }
  }
}
const liensAgefiphAjoutes = [];
for (const p of portails) {
  const url = urlAgefiphParRegion.get(p.region);
  if (!url) {
    alertes.push(`portail ${p.region} (${p.nom_region}) : aucune aide nat-agefiph-* ne donne de lien pour cette région`);
    continue;
  }
  if (p.liens.some((l) => l.url === url)) {
    alertes.push(`portail ${p.region} (${p.nom_region}) : lien Agefiph déjà présent, non ajouté (${url})`);
    continue;
  }
  p.liens.push({ titre: TITRE_AGEFIPH, url, type: 'agefiph' });
  liensAgefiphAjoutes.push(`${p.region} ${p.nom_region} : ${url}`);
}
const nbPortailsAgefiph = portails.filter((p) => p.liens.some((l) => l.type === 'agefiph')).length;

const dossierAides = path.join(racine, 'packages/core/data/aides');
const ecrire = (fichier, objet) =>
  fs.writeFileSync(path.join(dossierAides, fichier), JSON.stringify(objet, null, 2) + '\n', 'utf-8');

ecrire('nationales.json', {
  meta: {
    perimetre: 'Aides nationales, européennes, fonds des non-salariés et fiscalité',
    date_integration: aujourdhui,
    fichiers: fichiersNat.map((f) => f.nom),
    nb_aides: nationaux.aides.length,
  },
  aides: nationaux.aides,
});
ecrire('regions.json', {
  meta: {
    perimetre: "Aides des 18 régions (13 métropolitaines et 5 d'outre-mer)",
    date_integration: aujourdhui,
    fichiers: fichiersReg.map((f) => f.nom),
    nb_aides: regionaux.aides.length,
  },
  aides: regionaux.aides,
});
ecrire('portails.json', {
  meta: {
    perimetre: 'Portails officiels par région (Région, Carif-Oref, Transitions Pro, France Travail, Agefiph)',
    date_integration: aujourdhui,
  },
  portails,
});

const aConfirmer = toutes.filter((a) => a.statut === 'a_confirmer');
const exclues = dedoublonnerExclues([...nationaux.exclues, ...regionaux.exclues]);
const exclusionsFusionnees = exclues
  .filter((e) => e.fichiers.length > 1)
  .map((e) => {
    const autres = e.autresNoms.length > 0 ? ` (aussi nommée ${e.autresNoms.map((n) => `« ${n} »`).join(', ')})` : '';
    return `exclusion « ${e.nom} »${autres} : signalée par ${e.fichiers.length} fichiers, listée une seule fois (${e.fichiers.join(' ; ')})`;
  });
const puces = (lignes) => (lignes.length > 0 ? lignes.map((l) => `- ${l}`) : ['- aucun']);

const rapport = [
  `# Rapport d'intégration du catalogue — ${aujourdhui}`,
  '',
  `- Aides nationales : ${nationaux.aides.length}`,
  `- Aides régionales : ${regionaux.aides.length}`,
  `- Portails régionaux : ${portails.length} (dont ${nbPortailsAgefiph} avec un lien Agefiph)`,
  `- Aides à confirmer : ${aConfirmer.length}`,
  `- Montants passés en non_chiffre (libellé conservé) : ${montantsNormalises.length}`,
  `- Paires d'alternatives connues : ${alternativesLiees.length}`,
  `- Corrections appliquées après la revue du moteur : ${correctionsAppliquees.length}`,
  `- Alertes : ${alertes.length}`,
  '',
  '## Fichiers intégrés (versions vérifiées)',
  ...puces([...fichiersNat, ...fichiersReg].map((f) => f.nom)),
  '',
  '## Aides à confirmer',
  ...puces(aConfirmer.map((a) => `${a.id} — ${a.nom}`)),
  '',
  '## Alternatives connues (aides au choix, déclarées dans les deux sens)',
  ...puces(alternativesLiees),
  '',
  '## Doublons connus entre fichiers',
  ...puces(exclusionsFusionnees),
  '',
  '## Liens Agefiph ajoutés aux portails',
  ...puces(liensAgefiphAjoutes),
  '',
  '## Corrections appliquées après la revue du moteur',
  ...puces(correctionsAppliquees),
  '',
  '## Dispositifs exclus (terminés, suspendus, sans financement)',
  ...puces(exclues.map((e) => `${e.nom} — ${e.raison} (${e.fichiers.join(' ; ')})`)),
  '',
  '## Notes des chercheurs',
  ...puces([...nationaux.notes, ...regionaux.notes]),
  '',
  '## Alertes',
  ...puces(alertes),
  '',
].join('\n');
fs.writeFileSync(path.join(dossier, 'rapport-integration.md'), rapport, 'utf-8');

console.log(`Nationales : ${nationaux.aides.length} | Régionales : ${regionaux.aides.length} | Portails : ${portails.length} | Alertes : ${alertes.length}`);
console.log(`À confirmer : ${aConfirmer.length} | Montants passés en non_chiffre : ${montantsNormalises.length} | Portails avec lien Agefiph : ${nbPortailsAgefiph} | Paires d'alternatives connues : ${alternativesLiees.length} | Corrections appliquées : ${correctionsAppliquees.length}`);
console.log(`Rapport : ${path.join(dossier, 'rapport-integration.md')}`);
