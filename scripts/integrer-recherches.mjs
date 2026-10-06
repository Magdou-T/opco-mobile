// Intègre les fichiers de recherche (protocole PROTOCOLE.md) dans le catalogue embarqué :
//   nat-*.json     → packages/core/data/aides/nationales.json
//   regions-*.json → packages/core/data/aides/regions.json et portails.json
// Seule la version vérifiée <fichier>.verifie.json est acceptée : un fichier sans version vérifiée arrête
// l'intégration (code de sortie 1) avant toute écriture.
// Le contenu est copié tel quel, sauf :
//   - un montant dont les champs ne correspondent pas à son mode (refusé par AideSchema) passe en « non_chiffre » ;
//     le libellé est conservé, aucun montant n'est inventé ni complété ;
//   - le lien Agefiph de chaque région (liens_par_region des aides nat-agefiph-*) est ajouté au portail de la région ;
//   - les doublons connus entre fichiers (POEI nationale et POEI Pays de la Loire) sont liés par cumul.alternatives ;
//   - la table CORRECTIONS (revue du moteur d'aides, octobre 2026) recatégorise en « remuneration_beneficiaire » les aides
//     qui paient une dépense de la personne et non la formation (permis, transport, hébergement, restauration, équipement,
//     mobilité, fonds social, aides aux apprentis) et corrige trois montants (majoration RQTH du RFFT, deux aides versées
//     sur une période qui n'est pas la durée de la formation). Chaque correction vérifie l'état attendu de l'aide avant de
//     la modifier : si l'aide a disparu ou a changé, le script s'arrête (code 1) sans rien écrire.
// Usage : node scripts/integrer-recherches.mjs <dossier-recherche>
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

// Doublons connus entre fichiers (signalés par les vérificateurs, tâche 16) : la POEI nationale (nat-2) et la POEI
// financée par la Région Pays de la Loire (regions-2) sont le même dispositif (mêmes plafonds de 300 / 450 / 600 h).
// Chacune est déclarée alternative de l'autre : le plan de financement ne retient que la mieux chiffrée.
const DOUBLONS_CONNUS = [['nat-poei', 'r52-poei-region']];
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
    montant.mode = 'non_chiffre';
    montant.valeur = null;
    montant.pourcentage = null;
    montant.base = null;
    montant.plafond = null;
    montant.duree_max_mois = null;
    delete montant.majorations;
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

// Doublons connus : chaque aide devient l'alternative de l'autre.
const parId = new Map(toutes.map((a) => [a.id, a]));
const doublonsLies = [];
for (const [x, y] of DOUBLONS_CONNUS) {
  const ax = parId.get(x);
  const ay = parId.get(y);
  if (!ax || !ay) {
    alertes.push(`doublon connu ${x} / ${y} : identifiant absent du catalogue, alternatives non créées`);
    continue;
  }
  for (const [aide, autre] of [[ax, y], [ay, x]]) {
    const alternatives = aide.cumul.alternatives ?? [];
    if (alternatives.includes(autre)) continue;
    // Reconstruit l'objet pour garder l'ordre des clés : cumulable, alternatives, note.
    const { cumulable, note } = aide.cumul;
    aide.cumul = { cumulable, alternatives: [...alternatives, autre], ...(note !== undefined && { note }) };
  }
  doublonsLies.push(`${x} et ${y} : même dispositif, déclarés alternatives l'un de l'autre`);
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
  `- Corrections appliquées après la revue du moteur : ${correctionsAppliquees.length}`,
  `- Alertes : ${alertes.length}`,
  '',
  '## Fichiers intégrés (versions vérifiées)',
  ...puces([...fichiersNat, ...fichiersReg].map((f) => f.nom)),
  '',
  '## Aides à confirmer',
  ...puces(aConfirmer.map((a) => `${a.id} — ${a.nom}`)),
  '',
  '## Doublons connus entre fichiers',
  ...puces([...doublonsLies, ...exclusionsFusionnees]),
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
console.log(`À confirmer : ${aConfirmer.length} | Montants passés en non_chiffre : ${montantsNormalises.length} | Portails avec lien Agefiph : ${nbPortailsAgefiph} | Corrections appliquées : ${correctionsAppliquees.length}`);
console.log(`Rapport : ${path.join(dossier, 'rapport-integration.md')}`);
