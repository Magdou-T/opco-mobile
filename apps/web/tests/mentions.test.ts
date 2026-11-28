// Mentions légales et information sur les données (lib/mentions.ts, page /mentions-legales/) : champs à compléter,
// rubriques, lien du pied de page et adresse dans le plan du site.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_NAF } from '@opco/core';
import sitemap from '../src/app/sitemap';
import { CONTACT_EMAIL } from '../src/lib/contact';
import { ADRESSE_DU_SITE } from '../src/lib/metadonnees';
import {
  LIBELLES_DES_CHAMPS,
  LIEN_MENTIONS,
  MENTIONS,
  RUBRIQUES_MENTIONS,
  SOURCE_ENTREPRISES,
  SOURCE_SUGGESTION_NAF,
  TABLE_SIRET_OPCO,
  aCompleter,
  mentionsIncompletes,
} from '../src/lib/mentions';
import type { MentionsLegales } from '../src/lib/mentions';

const NBSP = String.fromCharCode(0xa0);
const source = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

/** Les mentions, chaque champ vide rempli : une page complète. */
function completes(): MentionsLegales {
  const copie = structuredClone(MENTIONS);
  for (const groupe of Object.values(copie) as Record<string, string | null>[]) {
    for (const champ of Object.keys(groupe)) groupe[champ] ??= `valeur de ${champ}`;
  }
  return copie;
}

describe('mentions légales : champs à compléter (mentionsIncompletes)', () => {
  test('les informations que seul l’éditeur peut fournir, laissées vides, sont signalées dans l’ordre de la page', () => {
    // Un brouillon de l'éditeur : les faits publics du répertoire SIRENE remplis, les treize autres informations à null.
    // Le test ne lit pas MENTIONS : il reste vrai le jour où l'éditeur a tout rempli.
    const attendus = [
      { champ: 'editeur.capitalSocial', libelle: 'capital social' },
      { champ: 'editeur.villeRcs', libelle: 'ville du greffe (RCS)' },
      { champ: 'editeur.tvaIntracommunautaire', libelle: 'numéro de TVA intracommunautaire' },
      { champ: 'editeur.telephone', libelle: 'téléphone' },
      { champ: 'directeurPublication.nom', libelle: 'nom du directeur de la publication' },
      { champ: 'directeurPublication.fonction', libelle: 'fonction du directeur de la publication' },
      { champ: 'hebergeur.denomination', libelle: "dénomination exacte de l'hébergeur" },
      { champ: 'hebergeur.adresse', libelle: "adresse de l'hébergeur" },
      { champ: 'hebergeur.telephone', libelle: "téléphone de l'hébergeur" },
      { champ: 'donnees.baseLegaleContact', libelle: 'base légale du traitement des messages de contact' },
      { champ: 'donnees.dureeConservationContact', libelle: 'durée de conservation des messages de contact' },
      { champ: 'donnees.adresseExerciceDroits', libelle: "adresse d'exercice des droits" },
      { champ: 'donnees.delegueProtectionDonnees', libelle: 'délégué à la protection des données (facultatif)' },
    ];
    const brouillon = completes();
    for (const { champ } of attendus) {
      const [groupe, nom] = champ.split('.');
      (brouillon[groupe as keyof MentionsLegales] as Record<string, string | null>)[nom] = null;
    }
    assert.deepEqual(mentionsIncompletes(brouillon), attendus);
  });

  test('page complète : aucun champ à compléter ; un champ rendu vide redevient à compléter', () => {
    const toutes = completes();
    assert.deepEqual(mentionsIncompletes(toutes), []);
    toutes.hebergeur.adresse = null;
    assert.deepEqual(mentionsIncompletes(toutes), [{ champ: 'hebergeur.adresse', libelle: "adresse de l'hébergeur" }]);
    // Une chaîne vide est une information fournie (le contrôleur écrit ce que l'éditeur donne) : seul null manque.
    toutes.hebergeur.adresse = '';
    assert.deepEqual(mentionsIncompletes(toutes), []);
  });

  test('chaque champ a un libellé, et chaque libellé un champ', () => {
    for (const groupe of Object.keys(MENTIONS) as (keyof MentionsLegales)[]) {
      assert.deepEqual(Object.keys(LIBELLES_DES_CHAMPS[groupe]).sort(), Object.keys(MENTIONS[groupe]).sort(), groupe);
    }
    assert.deepEqual(Object.keys(LIBELLES_DES_CHAMPS).sort(), Object.keys(MENTIONS).sort());
  });

  test('texte d’un champ vide : entre crochets, espace insécable avant le deux-points', () => {
    assert.equal(aCompleter('capital social'), `[à compléter${NBSP}: capital social]`);
  });

  test('module léger : il n’importe que l’espace insécable (ni lib/format.ts ni @opco/core)', () => {
    const importations = source('../src/lib/mentions.ts').match(/^import .*$/gm) ?? [];
    assert.deepEqual(importations, ["import { INSECABLE } from './insecable';"]);
  });
});

describe('mentions légales : faits publics préremplis (répertoire SIRENE, relus le 08/10/2026)', () => {
  test('éditeur : dénomination, forme, SIREN, SIRET et adresse du siège, adresse électronique du site', () => {
    assert.equal(MENTIONS.editeur.denomination, 'SFG Développement');
    assert.equal(MENTIONS.editeur.formeJuridique, 'Société par actions simplifiée (SAS)');
    assert.equal(MENTIONS.editeur.siren, '814 739 728');
    assert.equal(MENTIONS.editeur.siretSiege, '814 739 728 00024');
    assert.equal(MENTIONS.editeur.adresseSiege, '20 avenue Gabriel Péri, 95870 Bezons');
    // L'adresse du pied de page et du formulaire de contact.
    assert.equal(MENTIONS.editeur.courriel, CONTACT_EMAIL);
  });

  test('un champ rempli n’est jamais un texte de remplissage ni une valeur avec des espaces en trop', () => {
    // Vrai avant comme après la saisie des informations de l'éditeur : un champ vaut null (à compléter) ou une valeur réelle.
    for (const [groupe, champs] of Object.entries(MENTIONS)) {
      for (const [champ, valeur] of Object.entries(champs as Record<string, string | null>)) {
        if (valeur === null) continue;
        assert.doesNotMatch(valeur, /à compléter|a completer|todo|lorem|xxx/i, `${groupe}.${champ}`);
        assert.equal(valeur, valeur.trim(), `${groupe}.${champ}`);
      }
    }
  });
});

describe('mentions légales : page, pied de page et plan du site', () => {
  test('rubriques de la page, dans l’ordre', () => {
    assert.deepEqual(
      RUBRIQUES_MENTIONS.map((r) => [r.id, r.titre]),
      [
        ['editeur', 'Éditeur'],
        ['publication', 'Directeur de la publication'],
        ['hebergement', 'Hébergement'],
        ['donnees', 'Données personnelles'],
        ['sources', 'Sources et licences'],
        ['limites', 'Limites des estimations'],
      ],
    );
  });

  test('la page rend chaque rubrique et l’encadré « Page à compléter avant publication » tant qu’il reste un champ vide', () => {
    const page = source('../src/app/mentions-legales/page.tsx');
    assert.match(page, /RUBRIQUES_MENTIONS/);
    assert.match(page, /mentionsIncompletes\(\)/);
    assert.match(page, /Page à compléter avant publication/);
    assert.match(page, /les champs entre crochets attendent les informations légales de l(?:'|&apos;)éditeur/i);
  });

  test('fonction vide : la rubrique du directeur de la publication s’écrit en une phrase, sans nom de personne', () => {
    const page = source('../src/app/mentions-legales/page.tsx');
    assert.match(page, /directeurPublication\.fonction === ''/);
    assert.match(page, /Le directeur de la publication est\{' '\}/);
    // Une fonction vide est une information fournie : elle ne rouvre pas le champ « à compléter ».
    const sansPersonne = completes();
    sansPersonne.directeurPublication = { nom: 'le représentant légal de la société', fonction: '' };
    assert.deepEqual(mentionsIncompletes(sansPersonne), []);
  });

  test('le pied de page renvoie aux mentions légales (adresse à barre finale)', () => {
    assert.equal(LIEN_MENTIONS.href, '/mentions-legales/');
    assert.equal(LIEN_MENTIONS.libelle, 'Mentions légales et données');
    const pied = source('../src/components/site/SiteFooter.tsx');
    assert.match(pied, /href=\{LIEN_MENTIONS\.href\}/);
    assert.match(pied, /\{LIEN_MENTIONS\.libelle\}/);
  });

  test('sources et licences : la Table SIRET-OPCO de France compétences, avec sa date de mise à jour', () => {
    const page = source('../src/app/mentions-legales/page.tsx');
    assert.match(page, /Les pourcentages d(?:'|&apos;)établissements par secteur proposés quand une entreprise/);
    assert.match(page, /viennent de la Table SIRET-OPCO publiée par France compétences sur/);
    assert.match(page, /<Source href=\{TABLE_SIRET_OPCO\.adresse\}>data\.gouv\.fr<\/Source>/);
    assert.match(page, /\{TABLE_SIRET_OPCO\.miseAJour\}\), jointe à l(?:'|&apos;)API Recherche d(?:'|&apos;)entreprises/);
    assert.equal(TABLE_SIRET_OPCO.miseAJour, '24/09/2026');
  });

  test('la Table SIRET-OPCO est bien la source de chacune des suggestions par code NAF de @opco/core', () => {
    assert.ok(EMBEDDED_NAF.length > 0, String(EMBEDDED_NAF.length));
    for (const s of EMBEDDED_NAF) assert.equal(s.source, TABLE_SIRET_OPCO.adresse, s.prefixe);
  });

  test('lignes de source de l’étape Entreprise : textes exacts, espace insécable avant le deux-points', () => {
    assert.equal(
      SOURCE_ENTREPRISES,
      `Source${NBSP}: API Recherche d'entreprises (DINUM), données SIRENE de l'INSEE, licence ouverte 2.0.`,
    );
    assert.equal(
      SOURCE_SUGGESTION_NAF,
      `Source de la suggestion${NBSP}: Table SIRET-OPCO de France compétences (data.gouv.fr), licence ouverte 2.0, mise à jour du 24/09/2026.`,
    );
  });

  test('étape Entreprise : la phrase sous le champ de recherche renvoie aux données (nouvel onglet), les sources suivent les résultats', () => {
    const etape = source('../src/components/wizard/StepIdentification.tsx');
    assert.match(etape, /La recherche interroge l&apos;API Recherche d&apos;entreprises de l&apos;État&nbsp;; le site n&apos;en\s+conserve rien\./);
    assert.match(etape, /href=\{`\$\{LIEN_MENTIONS\.href\}#donnees`\} target="_blank"/);
    // Sous la liste des résultats et sur la carte de l'entreprise choisie.
    assert.equal(etape.match(/\{SOURCE_ENTREPRISES\}/g)?.length, 2);
    assert.match(etape, /suggestionNaf && !autreCandidat && <p className=\{PETIT_TEXTE\}>\{SOURCE_SUGGESTION_NAF\}<\/p>/);
    // La rubrique visée existe.
    assert.ok(RUBRIQUES_MENTIONS.some((r) => r.id === 'donnees'));
  });

  test('plan du site : adresses à barre finale, accueil compris, mentions légales comprises', () => {
    // L'adresse du site n'est pas répétée ici : tests/metadonnees.test.ts est le seul endroit qui la fixe.
    const adresses = sitemap().map((e) => e.url);
    const echappee = ADRESSE_DU_SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.ok(adresses.includes(`${ADRESSE_DU_SITE}/mentions-legales/`), adresses.join(' '));
    assert.equal(adresses[0], `${ADRESSE_DU_SITE}/`);
    for (const a of adresses) assert.match(a, new RegExp(`^${echappee}/(?:[a-z0-9-]+/)*$`), a);
    assert.equal(new Set(adresses).size, adresses.length);
    assert.ok(adresses.includes(`${ADRESSE_DU_SITE}/opco/akto/`));
  });
});
